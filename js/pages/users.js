import { api } from '../core/api.js?v=20260804-1';
import { ICONS } from '../core/icons.js?v=20261106-5';
import { modals } from '../core/modals.js?v=20260804-1';
import { toast } from '../core/toast.js?v=20260804-1';
import { relativeDateTime } from '../core/formatting.js?v=20261105-3';

const ROLE_OPTIONS = Object.freeze([
  {
    value: 'owner',
    label: 'Owner',
    description: 'All access and settings'
  },
  {
    value: 'admin',
    label: 'Administrator',
    description: 'Operations, customers, billing, marketing'
  },
  {
    value: 'inspector',
    label: 'Inspector',
    description: 'Bookings, availability, assigned inspections'
  },
  {
    value: 'viewer',
    label: 'Viewer',
    description: 'Read-only access'
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
      Number(right.isActive) - Number(left.isActive) ||
      left.displayName.localeCompare(right.displayName, 'en', { sensitivity: 'base' }) ||
      left.email.localeCompare(right.email, 'en', { sensitivity: 'base' })
    ));
}

function userById(state, id) {
  return (Array.isArray(state.staffUsers) ? state.staffUsers : [])
    .find((user) => user.id === id) || null;
}

function roleLabel(role) {
  const option = ROLE_OPTIONS.find((item) => item.value === role);
  return option ? option.label : role;
}

function rolesText(roles) {
  return roles.map(roleLabel).join(' · ');
}

function initials(user) {
  const parts = String(user.displayName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length) return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  return String(user.email || '?').charAt(0).toUpperCase();
}

function isCurrent(user, state) {
  return Boolean(user && user.id === String(state.staff && state.staff.id || ''));
}

// Each role shows what it allows, instead of hiding that in a tooltip.
function roleChoices(selectedRoles, disabled = false) {
  return ROLE_OPTIONS.map((option) => {
    const checked = selectedRoles.includes(option.value) ? ' checked' : '';
    const disabledAttribute = disabled ? ' disabled' : '';
    return `
      <label class="admin-user-role-choice">
        <input type="checkbox" name="roles" value="${option.value}"${checked}${disabledAttribute}>
        <span><strong>${escapeHtml(option.label)}</strong><span>${escapeHtml(option.description)}</span></span>
      </label>
    `;
  }).join('');
}

function userListSkeleton() {
  return `<div class="admin-row-list" aria-hidden="true">${Array.from({ length: 4 }, (_, index) => `
    <div class="admin-row-item admin-user-row-skeleton" style="--admin-skeleton-delay: ${index * 70}ms">
      <span class="admin-skeleton admin-avatar"></span>
      <span class="admin-row-text">
        <span class="admin-skeleton admin-skeleton-line admin-skeleton-line-wide"></span>
        <span class="admin-skeleton admin-skeleton-line admin-skeleton-line-medium"></span>
      </span>
    </div>
  `).join('')}</div>`;
}

function stateHtml({ tone = '', icon = ICONS.info, title, text = '', action = '', role = 'status' }) {
  return `
    <div class="admin-state"${tone ? ` data-tone="${tone}"` : ''} role="${role}">
      <span class="admin-state-icon" aria-hidden="true">${icon}</span>
      <div class="admin-state-text"><strong>${escapeHtml(title)}</strong>${text ? `<span>${escapeHtml(text)}</span>` : ''}</div>
      ${action}
    </div>
  `;
}

function unauthorizedHtml() {
  return stateHtml({ tone: 'danger', icon: ICONS.alert, title: 'Only the owner can manage users.', role: 'alert' });
}

function listErrorHtml(message) {
  return stateHtml({
    tone: 'danger',
    icon: ICONS.alert,
    title: 'Users could not be loaded.',
    text: message || '',
    role: 'alert',
    action: '<button class="admin-button admin-button-secondary" type="button" data-users-retry>Try again</button>'
  });
}

function emptyUsersHtml() {
  return stateHtml({
    icon: ICONS.user,
    title: 'No users yet.',
    action: `<button class="admin-button admin-button-primary" type="button" data-user-create>${ICONS.add} Add user</button>`
  });
}

function userRow(user, state) {
  const current = isCurrent(user, state);
  const name = user.displayName || user.email || 'Unnamed user';
  const signedIn = user.lastSignInAt ? 'Signed in ' + relativeDateTime(user.lastSignInAt) : 'Never signed in';
  const roles = rolesText(user.roles);
  const chips = [
    current ? '<span class="admin-chip">You</span>' : '',
    !user.roles.length ? '<span class="admin-chip" data-tone="warning">No role</span>' : '',
    user.mustChangePassword ? '<span class="admin-chip" data-tone="warning">Needs password change</span>' : '',
    !user.isActive ? '<span class="admin-chip">Disabled</span>' : ''
  ].join('');
  const label = [
    name,
    roles || 'no role',
    current ? 'you' : '',
    user.isActive ? '' : 'disabled',
    user.mustChangePassword ? 'needs password change' : '',
    signedIn.toLowerCase()
  ].filter(Boolean).join(', ');
  return `
    <li>
      <button class="admin-row-item admin-user-row" type="button" data-user-edit="${escapeHtml(user.id)}" data-user-id="${escapeHtml(user.id)}" aria-label="${escapeHtml(label)}">
        <span class="admin-avatar"${user.isActive ? '' : ' data-tone="muted"'} aria-hidden="true">${escapeHtml(initials(user))}</span>
        <span class="admin-row-text">
          <strong>${escapeHtml(name)}</strong>
          <span>${escapeHtml([user.email, roles].filter(Boolean).join(' · '))}</span>
        </span>
        <span class="admin-row-meta-group">${chips}<span class="admin-user-signin">${escapeHtml(signedIn)}</span></span>
        <span class="admin-row-go" aria-hidden="true">${ICONS.next}</span>
      </button>
    </li>
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
    content.innerHTML = userListSkeleton();
    if (count) count.innerHTML = '<span class="admin-skeleton admin-skeleton-line admin-skeleton-count" aria-hidden="true"></span>';
    if (addButton) addButton.hidden = true;
    if (refreshButton) refreshButton.hidden = true;
    return;
  }

  if (addButton) addButton.hidden = false;
  if (refreshButton) {
    const loading = state.staffUsersLoadState === 'loading';
    refreshButton.hidden = false;
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
    content.innerHTML = userListSkeleton();
    if (count) count.innerHTML = '<span class="admin-skeleton admin-skeleton-line admin-skeleton-count" aria-hidden="true"></span>';
    return;
  }

  const users = Array.isArray(state.staffUsers) ? state.staffUsers : [];
  const active = users.filter((user) => user.isActive);
  const disabled = users.filter((user) => !user.isActive);
  if (count) {
    count.textContent = `${users.length} ${users.length === 1 ? 'user' : 'users'}` +
      (disabled.length ? ` · ${disabled.length} disabled` : '');
  }
  if (!users.length) {
    content.innerHTML = emptyUsersHtml();
    return;
  }
  content.innerHTML =
    (active.length ? `<ul class="admin-row-list" aria-label="Active users">${active.map((user) => userRow(user, state)).join('')}</ul>` : '') +
    (disabled.length
      ? `<h2 class="admin-row-group-label" id="users-disabled-title">Disabled</h2>
         <ul class="admin-row-list" aria-labelledby="users-disabled-title">${disabled.map((user) => userRow(user, state)).join('')}</ul>`
      : '');
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
        if (target('[data-admin-modal-root]:not([hidden]) .admin-user-modal-loading')) {
          modals.renderCurrent?.();
        } else if (modals.isOpen?.()) {
          modals.reconcile?.();
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
    return { error: 'Use at least 14 characters.', input: form.elements.tempPassword };
  }
  if (new TextEncoder().encode(password).length > 72) {
    return { error: 'That password is too long. Use fewer characters.', input: form.elements.tempPassword };
  }
  if (!/\S/u.test(password) || /[\x00-\x1f\x7f]/u.test(password)) {
    return { error: 'The password can’t contain line breaks or other hidden characters.', input: form.elements.tempPassword };
  }
  if (email && password.toLocaleLowerCase() === String(email).trim().toLocaleLowerCase()) {
    return { error: 'The password can’t be the same as their email.', input: form.elements.tempPassword };
  }
  if (password !== confirmation) {
    return { error: 'The passwords don’t match.', input: form.elements.confirmPassword };
  }
  return { password };
}

function mutationErrorMessage(error, fallback = 'That didn’t work. Try again.') {
  if (!error) return fallback;
  return {
    self_management_not_allowed: 'You can’t disable your own account or remove your Owner role.',
    last_owner_protected: 'There must always be at least one active owner.',
    email_already_exists: 'Another user already has this email.',
    invalid_password: 'This password can’t be used. Choose another.',
    weak_password: 'Choose a stronger password.'
  }[error.code] || (error instanceof Error && error.message) || fallback;
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

function closeButton(label) {
  return `<button class="admin-preview-close admin-icon-button" type="button" data-admin-modal-close aria-label="${escapeHtml(label)}" title="Close">${ICONS.close}</button>`;
}

function modalHeader(title, closeLabel) {
  return `
    <header class="admin-modal-header">
      <div><h2>${escapeHtml(title)}</h2></div>
      ${closeButton(closeLabel)}
    </header>
  `;
}

const optional = '<span class="admin-optional">(optional)</span>';

function textField(label, input, { hint = '', optionalField = false } = {}) {
  return `
    <label>
      <span class="admin-field-label">${label}${optionalField ? ' ' + optional : ' <span class="admin-required-marker" aria-hidden="true">*</span>'}</span>
      ${input}
      ${hint ? `<span class="admin-field-hint">${hint}</span>` : ''}
    </label>
  `;
}

function contactFields(user, readOnly) {
  const attribute = readOnly ? ' readonly' : '';
  return `
    ${textField('Phone', `<input type="tel" name="phone" value="${escapeHtml(user ? user.phone : '')}" autocomplete="tel" maxlength="40"${attribute}>`, { optionalField: true })}
    ${textField('Calendar email', `<input type="email" name="calendarEmail" value="${escapeHtml(user ? user.calendarEmail : '')}" autocomplete="off" inputmode="email" maxlength="254"${attribute}>`, { optionalField: true })}
  `;
}

function passwordFields(disabled = false) {
  const attribute = disabled ? ' disabled' : '';
  return `
    ${textField('Password', `<input type="password" name="tempPassword" autocomplete="new-password" minlength="14" required${attribute}>`)}
    ${textField('Repeat password', `<input type="password" name="confirmPassword" autocomplete="new-password" minlength="14" required${attribute}>`)}
  `;
}

function createUserModalHtml() {
  return `
    ${modalHeader('Add user', 'Close add user')}
    <form class="admin-action-form admin-user-form admin-form-plain" data-user-create-form novalidate>
      <fieldset class="admin-form-group">
        <legend>Details</legend>
        ${textField('Name', '<input type="text" name="displayName" autocomplete="name" maxlength="120" required autofocus>')}
        ${textField('Email', '<input type="email" name="email" autocomplete="off" inputmode="email" maxlength="254" required>', { hint: 'Used to sign in.' })}
        ${contactFields(null, false)}
      </fieldset>

      <fieldset class="admin-form-group">
        <legend>Roles</legend>
        <div class="admin-user-role-choices admin-form-wide">${roleChoices(['viewer'])}</div>
      </fieldset>

      <fieldset class="admin-form-group">
        <legend>Temporary password</legend>
        ${passwordFields()}
        <p class="admin-field-hint admin-form-wide">At least 14 characters. No email is sent, so share it with them yourself.</p>
      </fieldset>

      <div class="admin-modal-footer admin-panel-footer">
        <p class="admin-form-error" data-user-form-status data-action-error role="alert" aria-live="assertive"></p>
        <button class="admin-button admin-button-secondary" type="button" data-admin-modal-close>Close</button>
        <button class="admin-button admin-button-primary" type="submit">Add user</button>
      </div>
    </form>
  `;
}

function editUserModalHtml(user, state) {
  const current = isCurrent(user, state);
  return `
    <header class="admin-modal-header admin-user-modal-header">
      <div class="admin-user-identity">
        <span class="admin-avatar admin-avatar-lg"${user.isActive ? '' : ' data-tone="muted"'} aria-hidden="true">${escapeHtml(initials(user))}</span>
        <div>
          <h2>${escapeHtml(user.displayName || user.email || 'User')}${current ? ' <span class="admin-chip">You</span>' : ''}${user.isActive ? '' : ' <span class="admin-chip">Disabled</span>'}</h2>
          <p>${escapeHtml(user.email || '')}</p>
        </div>
      </div>
      ${closeButton(current ? 'Close your account details' : 'Close user')}
    </header>
    ${current ? '' : `
    <div class="admin-segmented admin-user-tabs" role="tablist" aria-label="User sections">
      <button type="button" role="tab" id="user-tab-details" aria-controls="user-panel-details" aria-selected="true" class="is-active" data-user-tab="details">Details</button>
      <button type="button" role="tab" id="user-tab-access" aria-controls="user-panel-access" aria-selected="false" tabindex="-1" data-user-tab="access">Sign-in and access</button>
    </div>`}
    <form class="admin-action-form admin-user-form admin-form-plain" data-user-edit-form data-user-id="${escapeHtml(user.id)}" id="user-panel-details"${current ? '' : ' role="tabpanel" aria-labelledby="user-tab-details"'} novalidate>
      <fieldset class="admin-form-group">
        <legend${current ? '' : ' class="admin-visually-hidden"'}>Details</legend>
        <div class="admin-form-wide">${textField('Name', `<input type="text" name="displayName" value="${escapeHtml(user.displayName)}" autocomplete="name" maxlength="120" required${current ? ' readonly' : ' autofocus'}>`)}</div>
        ${contactFields(user, current)}
      </fieldset>

      <fieldset class="admin-form-group">
        <legend>Roles</legend>
        ${current ? '<p class="admin-field-hint admin-form-wide">This is your account. Another owner can change your roles.</p>' : ''}
        <div class="admin-user-role-choices admin-form-wide">${roleChoices(user.roles, current)}</div>
      </fieldset>

      <div class="admin-modal-footer admin-panel-footer">
        <p class="admin-form-error" data-user-form-status data-action-error role="alert" aria-live="assertive"></p>
        <button class="admin-button admin-button-secondary" type="button" data-admin-modal-close>Close</button>
        ${current ? '' : '<button class="admin-button admin-button-primary" type="submit">Save changes</button>'}
      </div>
    </form>

    ${current ? '' : `
    <section class="admin-user-access" id="user-panel-access" role="tabpanel" aria-labelledby="user-tab-access" hidden>
      <details class="admin-user-access-item admin-user-security-section">
        <summary class="admin-row-item">
          <span class="admin-row-text">
            <strong>Reset password</strong>
            <span>Set a temporary password they change at their next sign-in.</span>
          </span>
          ${user.mustChangePassword ? '<span class="admin-chip" data-tone="warning">Needs password change</span>' : '<span aria-hidden="true"></span>'}
          <span class="admin-row-go" aria-hidden="true">${ICONS.next}</span>
        </summary>
        <form class="admin-action-form admin-user-temp-form admin-form-plain" data-user-temp-password-form data-user-id="${escapeHtml(user.id)}" novalidate>
          <div class="admin-form-group">${passwordFields()}</div>
          <div class="admin-user-temp-actions">
            <p class="admin-form-error" data-user-form-status data-action-error role="alert" aria-live="assertive"></p>
            <button class="admin-button admin-button-secondary" type="submit">Set password</button>
          </div>
        </form>
      </details>
      <div class="admin-row-item admin-user-access-item">
        <span class="admin-row-text">
          <strong>${user.isActive ? 'Disable access' : 'Restore access'}</strong>
          <span>${user.isActive ? 'Signs them out. Their account and roles are kept.' : 'They can sign in again with their current password.'}</span>
        </span>
        <span aria-hidden="true"></span>
        <button
          class="admin-button ${user.isActive ? 'admin-button-danger' : 'admin-button-secondary'}"
          type="button"
          data-user-set-active="${user.isActive ? 'false' : 'true'}"
          data-user-id="${escapeHtml(user.id)}"
        >${user.isActive ? 'Disable' : 'Restore'}</button>
      </div>
    </section>`}
  `;
}

function loadingUserModalHtml() {
  return `
    <header class="admin-modal-header" role="status" aria-label="Loading user details">
      <div><h2><span class="admin-skeleton admin-skeleton-line admin-skeleton-line-wide" aria-hidden="true"></span></h2></div>
      ${closeButton('Close user')}
    </header>
    <div class="admin-user-modal-loading" aria-hidden="true">
      <span class="admin-skeleton admin-skeleton-line admin-skeleton-line-wide"></span>
      <span class="admin-skeleton admin-skeleton-line admin-skeleton-line-medium"></span>
      <span class="admin-skeleton admin-skeleton-line"></span>
    </div>
  `;
}

function missingUserModalHtml() {
  return `
    ${modalHeader('User not found', 'Close user')}
    ${stateHtml({
      icon: ICONS.user,
      title: 'This user no longer exists.',
      role: 'alert',
      action: '<button class="admin-button admin-button-secondary" type="button" data-admin-modal-close>Close</button>'
    })}
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
  setFormBusy(form, true, 'Adding…');
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
    if (typeof toast.show === 'function') toast.show('User added.', 'success');
  } catch (error) {
    if (document.body.contains(form)) {
      setFormStatus(form, mutationErrorMessage(error, 'The user could not be added. Try again.'));
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
    await runMutation(state, {
      action: 'updateUser', userId: user.id, displayName, phone, calendarEmail, roles
    });
    if (typeof modals.markClean === 'function') modals.markClean();
    if (typeof modals.closeRoute === 'function') await modals.closeRoute({ force: true });
    await refreshAfterMutation(state);
    if (typeof toast.show === 'function') toast.show('Changes saved.', 'success');
  } catch (error) {
    await refreshAfterMutation(state);
    if (document.body.contains(form)) {
      setFormStatus(form, mutationErrorMessage(error, 'Changes could not be saved. Try again.'));
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
      title: 'Set a temporary password?',
      message: `${user.displayName || user.email} will be signed out everywhere and must change it at their next sign-in.`,
      cancelLabel: 'Go back',
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
    if (typeof toast.show === 'function') toast.show('Temporary password set.', 'success');
  } catch (error) {
    if (document.body.contains(form)) setFormStatus(form, mutationErrorMessage(error, 'The password could not be set. Try again.'));
  } finally {
    mutationPending = false;
    if (document.body.contains(form)) setFormBusy(form, false);
  }
}

async function handleSetActive(button, state, user, isActive) {
  if (mutationPending) return;
  const confirmed = typeof modals.confirm === 'function'
    ? await modals.confirm({
      title: isActive ? 'Restore access?' : 'Disable access?',
      message: isActive
        ? `${user.displayName || user.email} can sign in again.`
        : `${user.displayName || user.email} will be signed out and can’t sign in until you restore access.`,
      cancelLabel: isActive ? 'Go back' : 'Keep access',
      confirmLabel: isActive ? 'Restore access' : 'Disable access',
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
      toast.show(isActive ? 'Access restored.' : 'Access disabled.', 'success');
    }
  } catch (error) {
    if (typeof toast.show === 'function') toast.show(mutationErrorMessage(error, 'Access could not be changed. Try again.'), 'error');
  } finally {
    mutationPending = false;
    if (document.body.contains(button)) {
      button.disabled = false;
      button.classList.remove('is-loading');
      button.removeAttribute('aria-busy');
    }
  }
}

// Two tabs: details (with Save) and sign-in and access. Arrow keys move
// between tabs, as the ARIA tabs pattern expects.
function bindUserTabs(root) {
  const tabs = Array.from(root.querySelectorAll('[data-user-tab]'));
  if (!tabs.length) return;
  const select = (tab, focus) => {
    tabs.forEach((item) => {
      const selected = item === tab;
      item.setAttribute('aria-selected', selected ? 'true' : 'false');
      item.classList.toggle('is-active', selected);
      item.tabIndex = selected ? 0 : -1;
      const panel = root.querySelector('#' + item.getAttribute('aria-controls'));
      if (panel) panel.hidden = !selected;
    });
    if (focus) tab.focus();
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab, false));
    tab.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      select(tabs[next], true);
    });
  });
}

function bindModalEvents(root, state, user) {
  const createForm = target('[data-user-create-form]', root);
  if (createForm) {
    createForm.addEventListener('submit', (event) => handleCreateSubmit(event, state));
    return;
  }
  bindUserTabs(root);

  const isCurrentUser = Boolean(user && user.id === String(state.staff && state.staff.id || ''));
  const editForm = target('[data-user-edit-form]', root);
  if (editForm && user && !isCurrentUser) {
    editForm.addEventListener('submit', (event) => handleEditSubmit(event, state, user));
  }
  const passwordForm = target('[data-user-temp-password-form]', root);
  if (passwordForm && user && !isCurrentUser) {
    passwordForm.addEventListener('submit', (event) => (
      handleTemporaryPasswordSubmit(event, state, user)
    ));
  }
  const activeButton = target('[data-user-set-active]', root);
  if (activeButton && user && !isCurrentUser) {
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
    <div class="admin-page-body admin-page-narrow admin-users-page">
      <header class="admin-page-header">
        <div>
          <h1 id="users-page-title">Users</h1>
          <p class="admin-page-meta" data-admin-user-count role="status" aria-live="polite"><span class="admin-skeleton admin-skeleton-line admin-skeleton-count" aria-hidden="true"></span></p>
        </div>
        <div class="admin-page-actions">
          <button class="admin-button admin-button-ghost admin-icon-button" type="button" data-users-refresh aria-label="Refresh users" title="Refresh" hidden>${ICONS.refresh}</button>
          <button class="admin-button admin-button-primary" type="button" data-user-create-header hidden>${ICONS.add} Add user</button>
        </div>
      </header>
      <section class="admin-card" aria-labelledby="users-page-title">
        <div data-admin-users-content>${userListSkeleton()}</div>
      </section>
    </div>
  `;
}

export function beforeRender({ state }) {
  renderUsersPage(state);
  maybeLoadUsers(state);
}

export async function beforeInitialReveal() {
  if (listPromise) await listPromise;
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
    const root = modals.open(createUserModalHtml(), 'panel');
    bindModalEvents(root, state, null);
    return true;
  }

  if (!state.staffUsersLoadedAt) {
    modals.open(loadingUserModalHtml(), 'panel');
    maybeLoadUsers(state);
    return true;
  }

  const user = userById(state, route.id);
  if (!user) {
    modals.open(missingUserModalHtml(), 'sm');
    return true;
  }

  const root = modals.open(editUserModalHtml(user, state), 'panel');
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
