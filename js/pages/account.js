const SUPABASE_URL = 'https://ddhhhieitupjixynjrry.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkaGhoaWVpdHVwaml4eW5qcnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNDAyOTQsImV4cCI6MjA5NzcxNjI5NH0.PXAxGc3TSFUnbcyWdizhkiJkKqJlqD1Ic8PHAjHSFIc';
const PASSWORD_RESET_ENDPOINT = `${SUPABASE_URL}/functions/v1/admin-password-reset`;
const PASSWORD_RESET_PKCE_KEY = 'checkauto-admin-password-reset-pkce';
const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;

const roleLabels = Object.freeze({
  owner: 'Owner',
  admin: 'Administrator',
  inspector: 'Inspector',
  viewer: 'Viewer'
});

const accessRightLabels = Object.freeze({
  'admin_console.access': 'View dashboard, bookings and availability',
  'operations.manage': 'Manage bookings and availability',
  'sensitive_data.access': 'View customers, invoices and marketing',
  'billing_email.manage': 'Manage invoices and email',
  'privacy.manage': 'Manage privacy records',
  'confirmation_schedule.manage': 'Manage the confirmation schedule'
});

const legacyRoleAccess = Object.freeze({
  owner: Object.keys(accessRightLabels),
  admin: [
    'admin_console.access',
    'operations.manage',
    'sensitive_data.access',
    'billing_email.manage',
    'privacy.manage'
  ],
  inspector: ['admin_console.access', 'operations.manage'],
  viewer: ['admin_console.access']
});

let requestController = null;

function base64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return window.btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function createPkcePair() {
  if (!window.crypto || !window.crypto.getRandomValues || !window.crypto.subtle) {
    throw new Error('This browser cannot create a secure password reset request.');
  }
  const verifierBytes = window.crypto.getRandomValues(new Uint8Array(32));
  const verifier = base64Url(verifierBytes);
  const digest = await window.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier)
  );
  return {
    verifier,
    challenge: base64Url(new Uint8Array(digest))
  };
}

function storePkceVerifier(verifier) {
  const value = JSON.stringify({
    verifier,
    expires_at: Date.now() + PASSWORD_RESET_TTL_MS
  });
  window.localStorage.setItem(PASSWORD_RESET_PKCE_KEY, value);
  if (window.localStorage.getItem(PASSWORD_RESET_PKCE_KEY) !== value) {
    throw new Error('The browser could not securely retain this reset request.');
  }
}

function readStoredPkceVerifier() {
  try {
    const value = window.localStorage.getItem(PASSWORD_RESET_PKCE_KEY);
    const record = JSON.parse(value || 'null');
    if (
      !record ||
      !/^[A-Za-z0-9._~-]{43,128}$/.test(String(record.verifier || '')) ||
      !Number.isFinite(Number(record.expires_at)) ||
      Number(record.expires_at) <= Date.now()
    ) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

function restoreStoredPkceVerifier(value) {
  try {
    if (value) {
      window.localStorage.setItem(PASSWORD_RESET_PKCE_KEY, value);
    } else {
      window.localStorage.removeItem(PASSWORD_RESET_PKCE_KEY);
    }
  } catch {
    // The request status below remains the authoritative user feedback.
  }
}

function target(selector) {
  return document.querySelector(selector);
}

function setText(selector, value, fallback = 'Not provided') {
  const element = target(selector);
  if (element) element.textContent = value || fallback;
}

function setOptionalRow(selector, value) {
  const row = target(selector);
  if (!row) return;
  row.hidden = !value;
  const valueTarget = row.querySelector('dd');
  if (valueTarget) valueTarget.textContent = value || '';
}

function formatAccountDate(value) {
  if (!value || Number.isNaN(Date.parse(value))) return '';
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Vilnius'
  }).format(new Date(value));
}

function setStatus(message, tone = '') {
  const status = target('[data-account-reset-status]');
  if (!status) return;
  status.textContent = message || '';
  status.dataset.tone = tone;
}

function setButtonBusy(button, busy) {
  if (!button) return;
  if (busy) {
    button.dataset.idleLabel = button.textContent;
    button.textContent = 'Sending…';
    button.classList.add('is-loading');
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
  } else {
    button.textContent = button.dataset.idleLabel || 'Send reset link';
    button.classList.remove('is-loading');
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
}

function assignedRoles(staff) {
  const values = Array.isArray(staff && staff.roles)
    ? staff.roles
    : staff && staff.role
      ? [staff.role]
      : [];
  return Array.from(new Set(values.filter((role) => typeof role === 'string' && role)));
}

function humanizeIdentifier(value) {
  const normalized = String(value || '')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized
    ? normalized.charAt(0).toUpperCase() + normalized.slice(1)
    : 'Unknown';
}

function assignedAccessRights(staff, roles) {
  const values = Array.isArray(staff && staff.access_rights)
    ? staff.access_rights
    : roles.flatMap((role) => legacyRoleAccess[role] || []);
  return Array.from(new Set(values.filter((right) => typeof right === 'string' && right)));
}

function renderAccount(staff) {
  const resetButton = target('[data-account-password-reset]');
  if (!staff) {
    if (resetButton) resetButton.disabled = true;
    return;
  }

  const authEmail = String(staff.auth_email || '');
  const profileEmail = String(staff.email || '');
  const roles = assignedRoles(staff);
  const accessRights = assignedAccessRights(staff, roles);

  setText('[data-account-name]', String(staff.display_name || ''));
  setText('[data-account-auth-email]', authEmail);
  setOptionalRow(
    '[data-account-profile-email-row]',
    profileEmail && profileEmail.toLocaleLowerCase() !== authEmail.toLocaleLowerCase()
      ? profileEmail
      : ''
  );
  setOptionalRow('[data-account-phone-row]', String(staff.phone || ''));
  setOptionalRow('[data-account-calendar-email-row]', String(staff.calendar_email || ''));
  setOptionalRow('[data-account-created-row]', formatAccountDate(staff.auth_created_at));
  setOptionalRow('[data-account-last-sign-in-row]', formatAccountDate(staff.auth_last_sign_in_at));
  setText('[data-account-status]', staff.is_active ? 'Active' : 'Inactive');
  setText('[data-account-reset-email]', authEmail);

  const rolesList = target('[data-account-roles]');
  if (rolesList) {
    const roleItems = roles.length ? roles : [''];
    rolesList.replaceChildren(...roleItems.map((role) => {
      const item = document.createElement('li');
      item.className = 'admin-account-role-chip';
      item.textContent = role ? (roleLabels[role] || humanizeIdentifier(role)) : 'None assigned';
      return item;
    }));
  }

  const rightsList = target('[data-account-rights]');
  if (rightsList) {
    const rights = accessRights.length ? accessRights : [''];
    rightsList.replaceChildren(...rights.map((right) => {
      const item = document.createElement('li');
      item.textContent = right
        ? (accessRightLabels[right] || humanizeIdentifier(right))
        : 'No access assigned';
      return item;
    }));
  }

  if (resetButton) resetButton.disabled = !authEmail;
}

async function requestPasswordReset(state, button) {
  if (!state.session || !state.session.access_token || !state.staff || !state.staff.auth_email) {
    setStatus('Refresh the page and sign in again before requesting a reset.', 'error');
    return;
  }

  if (requestController) requestController.abort();
  const controller = new AbortController();
  requestController = controller;
  setStatus('');
  setButtonBusy(button, true);
  const previousPkceRecord = readStoredPkceVerifier();
  let serverResponded = false;

  try {
    const pkce = await createPkcePair();
    if (requestController !== controller || controller.signal.aborted) return;
    storePkceVerifier(pkce.verifier);
    const response = await fetch(PASSWORD_RESET_ENDPOINT, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${state.session.access_token}`,
        'Content-Type': 'application/json'
      },
      cache: 'no-store',
      signal: controller.signal,
      body: JSON.stringify({
        action: 'request',
        code_challenge: pkce.challenge
      })
    });
    if (requestController !== controller || controller.signal.aborted) return;
    serverResponded = true;
    const body = await response.json().catch(() => ({}));
    if (requestController !== controller || controller.signal.aborted) return;
    if (!response.ok) {
      const error = new Error(body.error || 'The reset email could not be sent.');
      error.name = body.code || 'PasswordResetError';
      throw error;
    }

    setStatus(
      'Reset link sent. Open the newest link in this browser within 15 minutes.',
      'success'
    );
  } catch (error) {
    if (error && error.name === 'AbortError') return;
    if (serverResponded) restoreStoredPkceVerifier(previousPkceRecord);
    setStatus(
      !serverResponded
        ? 'Request status unknown. If an email arrives, use the newest link in this browser.'
        : error instanceof Error
          ? error.message
          : 'The reset email could not be sent.',
      'error'
    );
  } finally {
    if (requestController === controller) {
      requestController = null;
      if (document.body.contains(button)) setButtonBusy(button, false);
    }
  }
}

export const page = 'account';

export function renderStaticPage(root) {
  root.innerHTML = `
    <section class="admin-account-layout" aria-labelledby="account-page-title">
      <header class="admin-account-heading">
        <h1 id="account-page-title">Account</h1>
      </header>

      <div class="admin-account-grid">
        <section class="admin-panel admin-account-panel" aria-labelledby="account-details-title">
          <div class="admin-panel-header">
            <h2 id="account-details-title">Personal information</h2>
          </div>
          <dl class="admin-account-details">
            <div>
              <dt>Full name</dt>
              <dd data-account-name>Loading…</dd>
            </div>
            <div>
              <dt>Sign-in email</dt>
              <dd data-account-auth-email>Loading…</dd>
            </div>
            <div data-account-profile-email-row hidden>
              <dt>Profile email</dt>
              <dd></dd>
            </div>
            <div data-account-phone-row hidden>
              <dt>Phone</dt>
              <dd></dd>
            </div>
            <div data-account-calendar-email-row hidden>
              <dt>Calendar email</dt>
              <dd></dd>
            </div>
            <div>
              <dt>Account status</dt>
              <dd data-account-status>Loading…</dd>
            </div>
            <div data-account-created-row hidden>
              <dt>Account created</dt>
              <dd></dd>
            </div>
            <div data-account-last-sign-in-row hidden>
              <dt>Last sign-in</dt>
              <dd></dd>
            </div>
          </dl>
        </section>

        <section class="admin-panel admin-account-panel" aria-labelledby="account-access-title">
          <div class="admin-panel-header">
            <h2 id="account-access-title">Roles and access</h2>
          </div>
          <div class="admin-account-access">
            <div class="admin-account-role">
              <span>Roles</span>
              <ul class="admin-account-role-list" data-account-roles>
                <li class="admin-account-role-chip">Loading…</li>
              </ul>
            </div>
            <h3 class="admin-account-access-label">Permissions</h3>
            <ul class="admin-account-rights" data-account-rights>
              <li>Loading…</li>
            </ul>
          </div>
        </section>

        <section class="admin-panel admin-account-panel admin-account-security" aria-labelledby="account-security-title">
          <div class="admin-panel-header">
            <h2 id="account-security-title">Password</h2>
          </div>
          <div class="admin-account-security-content">
            <p>
              A reset link will be sent to
              <strong data-account-reset-email>your sign-in email</strong>.
            </p>
            <button
              class="admin-button admin-button-primary"
              type="button"
              data-account-password-reset
              disabled
            >Send reset link</button>
          </div>
          <p
            class="admin-account-reset-status"
            data-account-reset-status
            role="status"
            aria-live="polite"
            aria-atomic="true"
          ></p>
        </section>
      </div>
    </section>
  `;
}

export function beforeRender({ state }) {
  renderAccount(state.staff);
}

export function afterEvents({ state }) {
  const resetButton = target('[data-account-password-reset]');
  renderAccount(state.staff);
  if (!resetButton || resetButton.dataset.bound === 'true') return;
  resetButton.dataset.bound = 'true';
  resetButton.addEventListener('click', () => {
    requestPasswordReset(state, resetButton);
  });
}

export function destroyPage() {
  if (requestController) requestController.abort();
  requestController = null;
}
