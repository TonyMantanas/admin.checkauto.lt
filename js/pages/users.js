import { api } from '../core/api.js?v=20260804-1';
import { ICONS } from '../core/icons.js?v=20260802-1';
import { modals } from '../core/modals.js?v=20260804-1';
import { toast } from '../core/toast.js?v=20260804-1';

const ROLE_OPTIONS = Object.freeze([
  {
    value: 'owner',
    label: 'Owner',
    description: 'Full access, including user and organization settings.'
  },
  {
    value: 'admin',
    label: 'Administrator',
    description: 'Operations, customer data, invoices, and marketing.'
  },
  {
    value: 'inspector',
    label: 'Inspector',
    description: 'Bookings, availability, and assigned inspection work.'
  },
  {
    value: 'viewer',
    label: 'Viewer',
    description: 'Read-only access to the admin console.'
  }
]);

const USER_LIST_MAX_AGE_MS = 15 * 1000;

let listController = null;
let listPromise = null;
let mutationPending = false;
let pageDestroyed = false;

export const page = 'users';

function target(selector, root = document) {
  return root.querySelector(selector);
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function uniqueRoles(value) {
  const roles = Array.isArray(value) ? value : value ? [value] : [];
  return Array.from(new Set(roles.filter((role) => (
    ROLE_OPTIONS.some((option) => option.value === role)
  ))));
}

function staffRoles(staff) {
  return uniqueRoles(staff && (staff.roles || staff.role));
}

function isOwner(staff) {
  return staffRoles(staff).includes('owner');
}

function normalizeUser(record) {
  const value = record && typeof record === 'object' ? record : {};
  const id = String(value.id || value.userId || value.user_id || '');
  return {
    id,
    userId: String(value.userId || value.user_id || id),
    authUserId: String(value.authUserId || value.auth_user_id || ''),
    email: String(value.email || value.authEmail || value.auth_email || ''),
    displayName: String(value.displayName || value.display_name || ''),
    phone: String(value.phone || ''),
    calendarEmail: String(value.calendarEmail || value.calendar_email || ''),
    roles: uniqueRoles(value.roles || value.role),
    isActive: value.isActive === true || value.is_active === true,
    mustChangePassword: value.mustChangePassword === true || value.must_change_password === true,
    createdAt: value.createdAt || value.created_at || '',
    updatedAt: value.updatedAt || value.updated_at || '',
    authCreatedAt: value.authCreatedAt || value.auth_created_at || '',
    lastSignInAt: value.lastSignInAt || value.last_sign_in_at || '',
    bannedUntil: value.bannedUntil || value.banned_until || ''
  };
}

function normalizedUsers(body) {
  const records = Array.isArray(body && body.users)
    ? body.users
    : Array.isArray(body && body.result && body.result.users)
      ? body.result.users
      : [];
  return records
    .map(normalizeUser)
    .filter((user) => user.id)
    .sort((left, right) => (
      left.displayName.localeCompare(right.displayName, 'en', { sensitivity: 'base' }) ||
      left.email.localeCompare(right.email, 'en', { sensitivity: 'base' })
    ));
}

function userById(state, id) {
  return (Array.isArray(state.staffUsers) ? state.staffUsers : [])
    .find((user) => user.id === id) || null;
}

function formatDate(value) {
  if (!value || Number.isNaN(Date.parse(value))) return '';
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Vilnius'
  }).format(new Date(value));
}

function roleLabel(role) {
  const option = ROLE_OPTIONS.find((item) => item.value === role);
  return option ? option.label : role;
}

function roleChips(roles) {
  if (!roles.length) return '<span class="admin-user-role-empty">No role</span>';
  return roles.map((role) => (
    `<span class="admin-user-role-chip">${escapeHtml(roleLabel(role))}</span>`
  )).join('');
}

function roleChoices(selectedRoles) {
  return ROLE_OPTIONS.map((option) => {
    const checked = selectedRoles.includes(option.value) ? ' checked' : '';
    return `
      <label class="admin-user-role-choice">
        <input type="checkbox" name="roles" value="${option.value}"${checked}>
        <span>
          <strong>${escapeHtml(option.label)}</strong>
          <small>${escapeHtml(option.description)}</small>
        </span>
      </label>
    `;
  }).join('');
}

function userListSkeleton() {
  return Array.from({ length: 4 }, (_, index) => `
    <div class="admin-user-row admin-user-row-skeleton" aria-hidden="true" style="--admin-skeleton-delay: ${index * 70}ms">
      <div class="admin-user-primary">
        <span class="admin-skeleton admin-skeleton-line admin-skeleton-line-wide"></span>
        <span class="admin-skeleton admin-skeleton-line admin-skeleton-line-medium"></span>
      </div>
      <span class="admin-skeleton admin-skeleton-line admin-skeleton-line-short"></span>
      <span class="admin-skeleton admin-skeleton-pill"></span>
      <span class="admin-skeleton admin-skeleton-line admin-skeleton-line-short"></span>
    </div>
  `).join('');
}

function unauthorizedHtml() {
  return `
    <section class="admin-users-access-state" role="alert" aria-labelledby="users-unauthorized-title">
      <span class="admin-users-access-icon">${ICONS.alert}</span>
      <div>
        <h2 id="users-unauthorized-title">Unauthorized</h2>
        <p>Only users with the Owner role can access user management.</p>
      </div>
    </section>
  `;
}

function listErrorHtml(message) {
  return `
    <section class="admin-empty-state" role="alert">
      <div>
        <h2>Users could not be loaded</h2>
        <p>${escapeHtml(message || 'Try loading the user list again.')}</p>
      </div>
      <button class="admin-button admin-button-secondary" type="button" data-users-retry>Try again</button>
    </section>
  `;
}

function emptyUsersHtml() {
  return `
    <section class="admin-empty-state" role="status">
      <div>
        <h2>No staff accounts</h2>
        <p>Create the first account that should have access to this admin panel.</p>
      </div>
      <button class="admin-button admin-button-primary" type="button" data-user-create>${ICONS.add} Create user</button>
    </section>
  `;
}

function userRow(user, state) {
  const isCurrentUser = user.id === String(state.staff && state.staff.id || '');
  const activity = formatDate(user.lastSignInAt);
  const status = user.isActive ? 'active' : 'cancelled';
  const statusText = user.isActive ? 'Active' : 'Disabled';
  return `
    <article class="admin-user-row" data-user-id="${escapeHtml(user.id)}">
      <div class="admin-user-primary">
        <strong>${escapeHtml(user.displayName || 'Unnamed user')}</strong>
        <span>${escapeHtml(user.email || 'No sign-in email')}</span>
      </div>
      <div class="admin-user-roles" aria-label="Roles">${roleChips(user.roles)}</div>
      <div class="admin-user-statuses">
        <span class="admin-status-pill" data-status="${status}">${statusText}</span>
        ${user.mustChangePassword
          ? '<span class="admin-status-pill" data-status="warning">Password change required</span>'
          : ''}
      </div>
      <div class="admin-user-activity">
        <span>${activity ? `Last sign-in ${escapeHtml(activity)}` : 'Never signed in'}</span>
        ${isCurrentUser ? '<strong>Current user</strong>' : ''}
      </div>
      ${isCurrentUser
        ? '<span class="admin-user-self-label">Current account</span>'
        : `<button
            class="admin-button admin-button-secondary"
            type="button"
            data-user-edit="${escapeHtml(user.id)}"
            aria-label="Edit ${escapeHtml(user.displayName || user.email || 'user')}"
          >Edit</button>`}
    </article>
  `;
}

function renderUsersPage(state) {
  const content = target('[data-admin-users-content]');
  const count = target('[data-admin-user-count]');
  const addButton = target('[data-user-create-header]');
  const refreshButton = target('[data-users-refresh]');
  if (!content) return;

  const denied = state.staffUsersAccessDenied === true || (state.staff && !isOwner(state.staff));
  if (denied) {
    content.innerHTML = unauthorizedHtml();
    if (count) count.textContent = '';
    if (addButton) addButton.hidden = true;
    if (refreshButton) refreshButton.hidden = true;
    return;
  }

  if (!state.staff) {
    content.innerHTML = `<div class="admin-user-list" aria-hidden="true">${userListSkeleton()}</div>`;
    if (count) count.textContent = 'Checking access…';
    if (addButton) addButton.hidden = true;
    if (refreshButton) refreshButton.hidden = true;
    return;
  }

  if (addButton) addButton.hidden = false;
  if (refreshButton) refreshButton.hidden = false;
  if (refreshButton) {
    const loading = state.staffUsersLoadState === 'loading';
    refreshButton.disabled = loading;
    refreshButton.classList.toggle('is-loading', loading);
    refreshButton.setAttribute('aria-busy', loading ? 'true' : 'false');
  }

  if (state.staffUsersLoadState === 'error' && !state.staffUsersLoadedAt) {
    content.innerHTML = listErrorHtml(state.staffUsersError);
    if (count) count.textContent = '';
    return;
  }

  if (!state.staffUsersLoadedAt) {
    content.innerHTML = `<div class="admin-user-list" aria-hidden="true">${userListSkeleton()}</div>`;
    if (count) count.textContent = 'Loading…';
    return;
  }

  const users = Array.isArray(state.staffUsers) ? state.staffUsers : [];
  if (count) count.textContent = `${users.length} ${users.length === 1 ? 'user' : 'users'}`;
  content.innerHTML = users.length
    ? `<div class="admin-user-list" role="list">${users.map((user) => userRow(user, state)).join('')}</div>`
    : emptyUsersHtml();
}

function isAccessError(error) {
  return Boolean(error && error.code === 'owner_required');
}

async function loadUsers(state, options = {}) {
  if (!state.staff || !isOwner(state.staff) || state.staffUsersAccessDenied) return false;
  if (listPromise && !options.force) return listPromise;
  if (listController) listController.abort();

  const controller = new AbortController();
  listController = controller;
  state.staffUsersLoadState = 'loading';
  state.staffUsersError = '';
  if (!options.background) renderUsersPage(state);

  const promise = (async () => {
    try {
      const body = await api.staffUsers.request(
        state.session,
        { action: 'list' },
        { signal: controller.signal }
      );
      if (controller.signal.aborted) return false;
      state.staffUsers = normalizedUsers(body);
      state.staffUsersLoadedAt = Date.now();
      state.staffUsersLoadState = 'loaded';
      state.staffUsersError = '';
      state.staffUsersAccessDenied = false;
      if (!pageDestroyed && state.page === 'users') {
        renderUsersPage(state);
        if (
          typeof modals.renderCurrent === 'function' &&
          !(typeof modals.isDirty === 'function' && modals.isDirty())
        ) {
          modals.renderCurrent();
        }
      }
      return true;
    } catch (error) {
      if (error && error.name === 'AbortError') return false;
      if (isAccessError(error)) {
        state.staffUsersAccessDenied = true;
      } else {
        state.staffUsersLoadState = 'error';
        state.staffUsersError = error instanceof Error
          ? error.message
          : 'Users could not be loaded.';
      }
      if (!pageDestroyed && state.page === 'users') renderUsersPage(state);
      return false;
    } finally {
      if (listController === controller) listController = null;
      if (listPromise === promise) listPromise = null;
    }
  })();

  listPromise = promise;
  return promise;
}

function selectedRoles(form) {
  return Array.from(form.querySelectorAll('input[name="roles"]:checked'))
    .map((input) => input.value)
    .filter((role) => ROLE_OPTIONS.some((option) => option.value === role));
}

function setFormStatus(form, message, tone = 'error', input = null) {
  const status = target('[data-user-form-status]', form);
  if (!status) return;
  status.textContent = message || '';
  status.classList.toggle('is-success', tone === 'success');
  if (!status.id) status.id = `admin-user-form-status-${Math.random().toString(36).slice(2)}`;
  form.querySelectorAll('[aria-invalid="true"]').forEach((field) => {
    field.removeAttribute('aria-invalid');
    field.removeAttribute('aria-describedby');
  });
  if (message && input) {
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', status.id);
    input.focus();
  }
}

function setFormBusy(form, busy, label = 'Saving…') {
  form.setAttribute('aria-busy', busy ? 'true' : 'false');
  form.querySelectorAll('button, input, select, textarea').forEach((control) => {
    if (busy) {
      control.dataset.userOriginalDisabled = control.disabled ? 'true' : 'false';
      control.disabled = true;
    } else if (Object.prototype.hasOwnProperty.call(control.dataset, 'userOriginalDisabled')) {
      control.disabled = control.dataset.userOriginalDisabled === 'true';
      delete control.dataset.userOriginalDisabled;
    }
  });
  const submit = target('button[type="submit"]', form);
  if (!submit) return;
  if (busy) {
    submit.dataset.userIdleLabel = submit.textContent;
    submit.textContent = label;
    submit.classList.add('is-loading');
    submit.setAttribute('aria-busy', 'true');
  } else {
    submit.textContent = submit.dataset.userIdleLabel || submit.textContent;
    submit.classList.remove('is-loading');
    submit.removeAttribute('aria-busy');
  }
}

function tempPasswordValues(form, email) {
  const password = String(form.elements.tempPassword && form.elements.tempPassword.value || '');
  const confirmation = String(form.elements.confirmPassword && form.elements.confirmPassword.value || '');
  if (!password) {
    return { error: 'Enter a temporary password.', input: form.elements.tempPassword };
  }
  if (Array.from(password).length < 14) {
    return { error: 'Use at least 14 characters for the temporary password.', input: form.elements.tempPassword };
  }
  if (new TextEncoder().encode(password).length > 72) {
    return { error: 'The temporary password must be no more than 72 bytes.', input: form.elements.tempPassword };
  }
  if (!/\S/u.test(password) || /[\x00-\x1f\x7f]/u.test(password)) {
    return { error: 'Use a password with visible characters and no control characters.', input: form.elements.tempPassword };
  }
  if (email && password.toLocaleLowerCase() === String(email).trim().toLocaleLowerCase()) {
    return { error: 'The temporary password cannot match the sign-in email.', input: form.elements.tempPassword };
  }
  if (password !== confirmation) {
    return { error: 'The temporary passwords do not match.', input: form.elements.confirmPassword };
  }
  return { password };
}

function mutationErrorMessage(error) {
  if (!error) return 'The user could not be updated.';
  const fallback = error instanceof Error ? error.message : 'The user could not be updated.';
  return {
    self_management_not_allowed: 'You cannot disable your current account or remove its Owner role.',
    last_owner_protected: 'At least one active Owner must remain.',
    email_already_exists: 'An admin account already uses this email address.',
    invalid_password: 'This temporary password is not valid.',
    weak_password: 'Choose a stronger temporary password.'
  }[error.code] || fallback;
}

async function refreshAfterMutation(state) {
  state.staffUsersLoadedAt = 0;
  return loadUsers(state, { force: true });
}

async function runMutation(state, payload) {
  try {
    return await api.staffUsers.request(state.session, payload);
  } catch (error) {
    if (isAccessError(error)) {
      state.staffUsersAccessDenied = true;
      if (typeof modals.markClean === 'function') modals.markClean();
      if (typeof modals.closeRoute === 'function') await modals.closeRoute({ force: true });
      renderUsersPage(state);
    }
    throw error;
  }
}

function modalHeader(title, subtitle, closeLabel) {
  return `
    <header class="admin-modal-header">
      <div>
        <h2>${escapeHtml(title)}</h2>
        ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}
      </div>
      <button
        class="admin-preview-close admin-icon-button"
        type="button"
        data-admin-modal-close
        aria-label="${escapeHtml(closeLabel)}"
        title="Close"
      >${ICONS.close}</button>
    </header>
  `;
}

function createUserModalHtml() {
  return `
    ${modalHeader('Create user', 'Create an admin account without sending email.', 'Close create user')}
    <form class="admin-action-form admin-user-form" data-user-create-form novalidate>
      <div class="admin-user-form-grid">
        <label>
          Name
          <input type="text" name="displayName" autocomplete="name" maxlength="120" required autofocus>
        </label>
        <label>
          Sign-in email
          <input type="email" name="email" autocomplete="off" inputmode="email" maxlength="254" required>
        </label>
        <label>
          Phone <span class="admin-field-optional">Optional</span>
          <input type="tel" name="phone" autocomplete="tel" maxlength="40">
        </label>
        <label>
          Calendar email <span class="admin-field-optional">Optional</span>
          <input type="email" name="calendarEmail" autocomplete="off" inputmode="email" maxlength="254">
        </label>
      </div>

      <fieldset class="admin-user-role-fieldset">
        <legend>Roles</legend>
        <p>Choose one or more roles. Combined roles grant the access of each selected role.</p>
        <div class="admin-user-role-choices">${roleChoices(['viewer'])}</div>
      </fieldset>

      <fieldset class="admin-user-password-fields">
        <legend>Temporary password</legend>
        <p>The user must change this password immediately when they first sign in, before MFA setup.</p>
        <div class="admin-user-form-grid">
          <label>
            Temporary password
            <input type="password" name="tempPassword" autocomplete="new-password" minlength="14" required>
          </label>
          <label>
            Confirm password
            <input type="password" name="confirmPassword" autocomplete="new-password" minlength="14" required>
          </label>
        </div>
      </fieldset>

      <p class="admin-detail-note">No email will be sent. Hand the sign-in email and temporary password to the new user through another secure method.</p>
      <p class="admin-form-error" data-user-form-status role="alert" aria-live="assertive"></p>
      <div class="admin-action-buttons admin-modal-actions">
        <button class="admin-button admin-button-secondary" type="button" data-admin-modal-close>Cancel</button>
        <button class="admin-button admin-button-primary" type="submit">Create user</button>
      </div>
    </form>
  `;
}

function editUserModalHtml(user, state) {
  const isCurrentUser = user.id === String(state.staff && state.staff.id || '');
  return `
    ${modalHeader(user.displayName || 'Edit user', user.email, 'Close edit user')}
    <form class="admin-action-form admin-user-form" data-user-edit-form data-user-id="${escapeHtml(user.id)}" novalidate>
      <section class="admin-user-modal-section" aria-labelledby="user-profile-title">
        <h3 id="user-profile-title">Profile</h3>
        <div class="admin-user-form-grid">
          <label>
            Name
            <input type="text" name="displayName" value="${escapeHtml(user.displayName)}" autocomplete="name" maxlength="120" required autofocus>
          </label>
          <div class="admin-user-readonly-field">
            <span>Sign-in email</span>
            <strong>${escapeHtml(user.email)}</strong>
          </div>
          <label>
            Phone <span class="admin-field-optional">Optional</span>
            <input type="tel" name="phone" value="${escapeHtml(user.phone)}" autocomplete="tel" maxlength="40">
          </label>
          <label>
            Calendar email <span class="admin-field-optional">Optional</span>
            <input type="email" name="calendarEmail" value="${escapeHtml(user.calendarEmail)}" autocomplete="off" inputmode="email" maxlength="254">
          </label>
        </div>
      </section>

      <fieldset class="admin-user-role-fieldset admin-user-modal-section">
        <legend>Roles</legend>
        <p>Choose one or more roles. At least one active Owner must remain.</p>
        <div class="admin-user-role-choices">${roleChoices(user.roles)}</div>
      </fieldset>

      <p class="admin-form-error" data-user-form-status role="alert" aria-live="assertive"></p>
      <div class="admin-action-buttons admin-modal-actions">
        <button class="admin-button admin-button-secondary" type="button" data-admin-modal-close>Cancel</button>
        <button class="admin-button admin-button-primary" type="submit">Save changes</button>
      </div>
    </form>

    <section class="admin-user-modal-section admin-user-security-section" aria-labelledby="user-password-title">
      <div class="admin-user-section-heading">
        <div>
          <h3 id="user-password-title">Temporary password</h3>
          <p>Set a new temporary password and require a change at the user’s next sign-in.</p>
        </div>
        ${user.mustChangePassword
          ? '<span class="admin-status-pill" data-status="warning">Change required</span>'
          : ''}
      </div>
      <form class="admin-action-form admin-user-temp-form" data-user-temp-password-form data-user-id="${escapeHtml(user.id)}" novalidate>
        <div class="admin-user-form-grid">
          <label>
            Temporary password
            <input type="password" name="tempPassword" autocomplete="new-password" minlength="14" required>
          </label>
          <label>
            Confirm password
            <input type="password" name="confirmPassword" autocomplete="new-password" minlength="14" required>
          </label>
        </div>
        <p class="admin-form-error" data-user-form-status role="alert" aria-live="assertive"></p>
        <div class="admin-action-buttons">
          <button class="admin-button admin-button-secondary" type="submit">Set temporary password</button>
        </div>
      </form>
    </section>

    <section class="admin-user-modal-section admin-user-access-section" aria-labelledby="user-access-title">
      <div>
        <h3 id="user-access-title">Account access</h3>
        <p>${user.isActive
          ? 'Disable access without deleting this user or their role assignments.'
          : 'Enable this account so the user can sign in again.'}</p>
      </div>
      <button
        class="admin-button ${user.isActive ? 'admin-button-danger' : 'admin-button-secondary'}"
        type="button"
        data-user-set-active="${user.isActive ? 'false' : 'true'}"
        data-user-id="${escapeHtml(user.id)}"
        ${isCurrentUser ? 'disabled aria-describedby="current-user-access-note"' : ''}
      >${user.isActive ? 'Disable user' : 'Enable user'}</button>
      ${isCurrentUser
        ? '<p id="current-user-access-note" class="admin-user-current-note">You cannot disable the account you are currently using.</p>'
        : ''}
    </section>
  `;
}

function loadingUserModalHtml() {
  return `
    ${modalHeader('Loading user', '', 'Close user')}
    <div class="admin-user-modal-loading" role="status" aria-live="polite">
      <span class="admin-skeleton admin-skeleton-line admin-skeleton-line-wide"></span>
      <span class="admin-skeleton admin-skeleton-line admin-skeleton-line-medium"></span>
      <span class="admin-skeleton admin-skeleton-line"></span>
    </div>
  `;
}

function missingUserModalHtml() {
  return `
    ${modalHeader('User not found', '', 'Close user')}
    <div class="admin-empty-state admin-empty-state-compact" role="alert">
      <p>This user may have been removed or is no longer available.</p>
      <button class="admin-button admin-button-secondary" type="button" data-admin-modal-close>Close</button>
    </div>
  `;
}

function currentUserModalHtml(user) {
  return `
    ${modalHeader(user.displayName || 'Current account', user.email, 'Close current account')}
    <div class="admin-empty-state admin-empty-state-compact" role="status">
      <div>
        <h3>Current account</h3>
        <p>Your own profile, roles, access, and temporary password cannot be changed from user management.</p>
      </div>
      <button class="admin-button admin-button-secondary" type="button" data-admin-modal-close>Close</button>
    </div>
  `;
}

async function handleCreateSubmit(event, state) {
  event.preventDefault();
  if (mutationPending) return;
  const form = event.currentTarget;
  setFormStatus(form, '');
  if (!form.reportValidity()) return;
  const roles = selectedRoles(form);
  if (!roles.length) {
    setFormStatus(form, 'Choose at least one role.', 'error', target('input[name="roles"]', form));
    return;
  }
  const password = tempPasswordValues(form, form.elements.email.value);
  if (password.error) {
    setFormStatus(form, password.error, 'error', password.input);
    return;
  }

  mutationPending = true;
  setFormBusy(form, true, 'Creating…');
  try {
    await runMutation(state, {
      action: 'create',
      email: String(form.elements.email.value || '').trim(),
      tempPassword: password.password,
      displayName: String(form.elements.displayName.value || '').trim(),
      phone: String(form.elements.phone.value || '').trim() || null,
      calendarEmail: String(form.elements.calendarEmail.value || '').trim() || null,
      roles
    });
    if (typeof modals.markClean === 'function') modals.markClean();
    if (typeof modals.closeRoute === 'function') await modals.closeRoute({ force: true });
    await refreshAfterMutation(state);
    if (typeof toast.show === 'function') toast.show('User created. No email was sent.', 'success');
  } catch (error) {
    if (document.body.contains(form)) {
      setFormStatus(form, mutationErrorMessage(error));
    }
  } finally {
    mutationPending = false;
    if (document.body.contains(form)) setFormBusy(form, false);
  }
}

async function handleEditSubmit(event, state, user) {
  event.preventDefault();
  if (mutationPending) return;
  const form = event.currentTarget;
  setFormStatus(form, '');
  if (!form.reportValidity()) return;
  const roles = selectedRoles(form);
  if (!roles.length) {
    setFormStatus(form, 'Choose at least one role.', 'error', target('input[name="roles"]', form));
    return;
  }

  const displayName = String(form.elements.displayName.value || '').trim();
  const phone = String(form.elements.phone.value || '').trim() || null;
  const calendarEmail = String(form.elements.calendarEmail.value || '').trim() || null;
  const profileChanged = displayName !== user.displayName ||
    phone !== (user.phone || null) ||
    calendarEmail !== (user.calendarEmail || null);
  const rolesChanged = roles.slice().sort().join('|') !== user.roles.slice().sort().join('|');

  if (!profileChanged && !rolesChanged) {
    if (typeof modals.markClean === 'function') modals.markClean();
    if (typeof modals.closeRoute === 'function') await modals.closeRoute({ force: true });
    return;
  }

  mutationPending = true;
  setFormBusy(form, true);
  try {
    if (profileChanged) {
      await runMutation(state, {
        action: 'updateProfile',
        userId: user.id,
        displayName,
        phone,
        calendarEmail
      });
    }
    if (rolesChanged) {
      await runMutation(state, {
        action: 'setRoles',
        userId: user.id,
        roles
      });
    }
    if (typeof modals.markClean === 'function') modals.markClean();
    if (typeof modals.closeRoute === 'function') await modals.closeRoute({ force: true });
    await refreshAfterMutation(state);
    if (typeof toast.show === 'function') toast.show('User changes saved.', 'success');
  } catch (error) {
    await refreshAfterMutation(state);
    if (document.body.contains(form)) {
      setFormStatus(form, mutationErrorMessage(error));
    }
  } finally {
    mutationPending = false;
    if (document.body.contains(form)) setFormBusy(form, false);
  }
}

async function handleTemporaryPasswordSubmit(event, state, user) {
  event.preventDefault();
  if (mutationPending) return;
  const form = event.currentTarget;
  setFormStatus(form, '');
  if (!form.reportValidity()) return;
  const password = tempPasswordValues(form, user.email);
  if (password.error) {
    setFormStatus(form, password.error, 'error', password.input);
    return;
  }

  const confirmed = typeof modals.confirm === 'function'
    ? await modals.confirm({
      title: 'Set temporary password?',
      message: `${user.displayName || user.email} must use this password and change it at the next sign-in. Existing sessions will be signed out.`,
      cancelLabel: 'Cancel',
      confirmLabel: 'Set password'
    })
    : true;
  if (!confirmed) return;

  mutationPending = true;
  setFormBusy(form, true, 'Setting…');
  try {
    await runMutation(state, {
      action: 'setTemporaryPassword',
      userId: user.id,
      tempPassword: password.password
    });
    form.reset();
    if (typeof modals.markClean === 'function') modals.markClean();
    await refreshAfterMutation(state);
    if (typeof toast.show === 'function') {
      toast.show('Temporary password set. Existing sessions were signed out.', 'success');
    }
  } catch (error) {
    if (document.body.contains(form)) setFormStatus(form, mutationErrorMessage(error));
  } finally {
    mutationPending = false;
    if (document.body.contains(form)) setFormBusy(form, false);
  }
}

async function handleSetActive(button, state, user, isActive) {
  if (mutationPending) return;
  const confirmed = typeof modals.confirm === 'function'
    ? await modals.confirm({
      title: isActive ? 'Enable user?' : 'Disable user?',
      message: isActive
        ? `${user.displayName || user.email} will be able to sign in to the admin panel again.`
        : `${user.displayName || user.email} will lose admin access and be signed out. Their account and roles will be retained.`,
      cancelLabel: 'Cancel',
      confirmLabel: isActive ? 'Enable user' : 'Disable user',
      danger: !isActive
    })
    : true;
  if (!confirmed) return;

  mutationPending = true;
  button.disabled = true;
  button.classList.add('is-loading');
  button.setAttribute('aria-busy', 'true');
  try {
    await runMutation(state, {
      action: 'setActive',
      userId: user.id,
      isActive
    });
    if (typeof modals.markClean === 'function') modals.markClean();
    if (typeof modals.closeRoute === 'function') await modals.closeRoute({ force: true });
    await refreshAfterMutation(state);
    if (typeof toast.show === 'function') {
      toast.show(isActive ? 'User enabled.' : 'User disabled and signed out.', 'success');
    }
  } catch (error) {
    if (typeof toast.show === 'function') toast.show(mutationErrorMessage(error), 'error');
  } finally {
    mutationPending = false;
    if (document.body.contains(button)) {
      button.disabled = false;
      button.classList.remove('is-loading');
      button.removeAttribute('aria-busy');
    }
  }
}

function bindModalEvents(root, state, user) {
  const createForm = target('[data-user-create-form]', root);
  if (createForm) {
    createForm.addEventListener('submit', (event) => handleCreateSubmit(event, state));
    return;
  }

  const editForm = target('[data-user-edit-form]', root);
  if (editForm && user) {
    editForm.addEventListener('submit', (event) => handleEditSubmit(event, state, user));
  }
  const passwordForm = target('[data-user-temp-password-form]', root);
  if (passwordForm && user) {
    passwordForm.addEventListener('submit', (event) => (
      handleTemporaryPasswordSubmit(event, state, user)
    ));
  }
  const activeButton = target('[data-user-set-active]', root);
  if (activeButton && user) {
    activeButton.addEventListener('click', () => (
      handleSetActive(activeButton, state, user, activeButton.dataset.userSetActive === 'true')
    ));
  }
}

function maybeLoadUsers(state) {
  if (!state.staff || !isOwner(state.staff) || state.staffUsersAccessDenied) return;
  const stale = !state.staffUsersLoadedAt ||
    Date.now() - Number(state.staffUsersLoadedAt || 0) >= USER_LIST_MAX_AGE_MS;
  if (stale && !listPromise) {
    loadUsers(state, {
      background: Boolean(state.staffUsersLoadedAt)
    });
  }
}

export function renderStaticPage(root) {
  pageDestroyed = false;
  root.innerHTML = `
    <section class="admin-workbench admin-users-workbench">
      <section class="admin-panel admin-list-panel" aria-labelledby="users-page-title">
        <header class="admin-panel-header admin-workspace-header admin-users-workspace-header">
          <div class="admin-page-title">
            <h1 id="users-page-title">Users</h1>
            <p class="admin-count" data-admin-user-count role="status" aria-live="polite">Loading…</p>
          </div>
          <div class="admin-workspace-controls">
            <button class="admin-button admin-button-secondary" type="button" data-users-refresh hidden>Refresh</button>
            <button class="admin-button admin-button-primary" type="button" data-user-create-header hidden>${ICONS.add} Create user</button>
          </div>
        </header>
        <div data-admin-users-content>
          <div class="admin-user-list" aria-hidden="true">${userListSkeleton()}</div>
        </div>
      </section>
    </section>
  `;
}

export function beforeRender({ state }) {
  renderUsersPage(state);
  maybeLoadUsers(state);
}

export function afterEvents({ state }) {
  const root = target('[data-page-root]');
  if (!root || root.dataset.usersBound === 'true') return;
  root.dataset.usersBound = 'true';
  root.addEventListener('click', (event) => {
    const createButton = event.target.closest('[data-user-create], [data-user-create-header]');
    if (createButton && typeof modals.navigate === 'function') {
      modals.navigate('staff', 'new');
      return;
    }
    const editButton = event.target.closest('[data-user-edit]');
    if (editButton && typeof modals.navigate === 'function') {
      modals.navigate('staff', editButton.dataset.userEdit);
      return;
    }
    const retryButton = event.target.closest('[data-users-retry], [data-users-refresh]');
    if (retryButton) {
      loadUsers(state, { force: true });
    }
  });
  renderUsersPage(state);
  maybeLoadUsers(state);
}

export function renderModal(route, { state }) {
  if (!route || route.type !== 'staff' || state.page !== 'users') return false;
  if (!state.staff || !isOwner(state.staff) || state.staffUsersAccessDenied) return false;
  if (typeof modals.open !== 'function') return false;

  if (route.id === 'new') {
    const root = modals.open(createUserModalHtml(), 'lg');
    bindModalEvents(root, state, null);
    return true;
  }

  if (!state.staffUsersLoadedAt) {
    modals.open(loadingUserModalHtml(), 'lg');
    maybeLoadUsers(state);
    return true;
  }

  const user = userById(state, route.id);
  if (!user) {
    modals.open(missingUserModalHtml(), 'sm');
    return true;
  }

  if (user.id === String(state.staff && state.staff.id || '')) {
    modals.open(currentUserModalHtml(user), 'sm');
    return true;
  }

  const root = modals.open(editUserModalHtml(user, state), 'lg');
  bindModalEvents(root, state, user);
  return true;
}

export async function initPage() {}

export function destroyPage({ state } = {}) {
  pageDestroyed = true;
  if (listController) listController.abort();
  listController = null;
  listPromise = null;
  if (state && state.staffUsersLoadState === 'loading') {
    state.staffUsersLoadState = state.staffUsersLoadedAt ? 'loaded' : 'idle';
  }
}
