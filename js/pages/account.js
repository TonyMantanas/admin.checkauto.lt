import { auth } from '../core/auth.js?v=20260802-4';

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

let requestController = null;
let signOutOthersPending = false;

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

function accountSessionId(session) {
  return String(session && (session.id || session.session_id) || '');
}

function isCurrentAccountSession(session, currentSessionId) {
  return currentSessionId
    ? accountSessionId(session) === currentSessionId
    : Boolean(session && session.is_current === true);
}

function approximateSessionLabel(session) {
  const suppliedLabel = String(
    session && (session.label || session.safe_label) || ''
  ).trim();
  if (suppliedLabel) return suppliedLabel.slice(0, 120);

  const userAgent = String(session && session.user_agent || '');
  let browser = '';
  let platform = '';

  if (/EdgiOS\//i.test(userAgent) || /EdgA?\//i.test(userAgent)) browser = 'Microsoft Edge';
  else if (/OP(?:iOS|R)\//i.test(userAgent)) browser = 'Opera';
  else if (/CriOS\//i.test(userAgent) || /Chrome\//i.test(userAgent)) browser = 'Chrome';
  else if (/FxiOS\//i.test(userAgent) || /Firefox\//i.test(userAgent)) browser = 'Firefox';
  else if (/Version\/[^\s]+.*Safari\//i.test(userAgent)) browser = 'Safari';

  if (/iPad/i.test(userAgent)) platform = 'iPad';
  else if (/iPhone|iPod/i.test(userAgent)) platform = 'iPhone';
  else if (/Android/i.test(userAgent)) platform = 'Android';
  else if (/Macintosh|Mac OS X/i.test(userAgent)) platform = 'Mac';
  else if (/Windows/i.test(userAgent)) platform = 'Windows';
  else if (/CrOS/i.test(userAgent)) platform = 'ChromeOS';
  else if (/Linux/i.test(userAgent)) platform = 'Linux';

  if (browser && platform) return `${browser} on ${platform}`;
  if (browser) return browser;
  if (platform) return `Browser on ${platform}`;
  return 'Unknown browser';
}

function sessionDateRow(label, value) {
  const row = document.createElement('div');
  const term = document.createElement('dt');
  const description = document.createElement('dd');
  const formatted = formatAccountDate(value);

  term.textContent = label;
  if (formatted) {
    const time = document.createElement('time');
    time.dateTime = String(value);
    time.textContent = formatted;
    description.appendChild(time);
  } else {
    description.textContent = 'Not available';
  }
  row.append(term, description);
  return row;
}

function sessionListItem(session, currentSessionId) {
  const item = document.createElement('li');
  const identity = document.createElement('div');
  const titleRow = document.createElement('div');
  const title = document.createElement('strong');
  const dates = document.createElement('dl');
  const isCurrent = isCurrentAccountSession(session, currentSessionId);

  item.className = 'admin-account-session';
  if (isCurrent) item.dataset.current = 'true';
  identity.className = 'admin-account-session-identity';
  titleRow.className = 'admin-account-session-title';
  title.textContent = approximateSessionLabel(session);
  titleRow.appendChild(title);

  if (isCurrent) {
    const badge = document.createElement('span');
    badge.className = 'admin-status-pill admin-account-session-current';
    badge.dataset.status = 'active';
    badge.textContent = 'Current';
    titleRow.appendChild(badge);
  }

  identity.appendChild(titleRow);
  dates.className = 'admin-account-session-dates';
  dates.append(
    sessionDateRow('Signed in', session && session.created_at),
    sessionDateRow('Last active', session && session.last_active_at)
  );
  item.append(identity, dates);
  return item;
}

function hasOtherAccountSessions(sessions, currentSessionId) {
  if (sessions.some((session) => isCurrentAccountSession(session, currentSessionId))) {
    return sessions.some((session) => !isCurrentAccountSession(session, currentSessionId));
  }
  return sessions.length > 1;
}

function setSessionsStatus(message, tone = '') {
  const status = target('[data-account-sessions-status]');
  if (!status) return;
  status.textContent = message || '';
  status.dataset.tone = tone;
}

function renderAccountSessions(state) {
  const list = target('[data-account-sessions]');
  const count = target('[data-account-session-count]');
  const button = target('[data-account-sign-out-others]');
  if (!list || !count) return;

  const isLoaded = Boolean(state.loadedViews && state.loadedViews.auth);
  if (!isLoaded) {
    count.textContent = 'Loading…';
    list.setAttribute('aria-busy', 'true');
    if (button) button.disabled = true;
    return;
  }

  const currentSessionId = auth.sessionId(state.session);
  const sessions = (Array.isArray(state.accountSessions) ? state.accountSessions : [])
    .filter((session) => session && typeof session === 'object')
    .slice()
    .sort((left, right) => {
      const leftCurrent = isCurrentAccountSession(left, currentSessionId) ? 1 : 0;
      const rightCurrent = isCurrentAccountSession(right, currentSessionId) ? 1 : 0;
      if (leftCurrent !== rightCurrent) return rightCurrent - leftCurrent;
      const leftActiveAt = Date.parse(left.last_active_at || '') || 0;
      const rightActiveAt = Date.parse(right.last_active_at || '') || 0;
      return rightActiveAt - leftActiveAt;
    });

  count.textContent = `${sessions.length} ${sessions.length === 1 ? 'session' : 'sessions'}`;
  list.removeAttribute('aria-busy');
  if (sessions.length) {
    list.replaceChildren(...sessions.map((session) => (
      sessionListItem(session, currentSessionId)
    )));
  } else {
    const empty = document.createElement('li');
    empty.className = 'admin-account-session-empty';
    empty.textContent = 'Session details are unavailable.';
    list.replaceChildren(empty);
  }

  if (button) {
    const hasOtherSessions = hasOtherAccountSessions(sessions, currentSessionId);
    button.disabled = signOutOthersPending || !hasOtherSessions;
    button.classList.toggle('is-loading', signOutOthersPending);
    if (signOutOthersPending) button.setAttribute('aria-busy', 'true');
    else button.removeAttribute('aria-busy');
    button.textContent = signOutOthersPending ? 'Signing out…' : 'Sign out other sessions';
  }
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

function renderAccount(staff) {
  const resetButton = target('[data-account-password-reset]');
  if (!staff) {
    if (resetButton) resetButton.disabled = true;
    return;
  }

  const authEmail = String(staff.auth_email || '');
  const phone = String(staff.phone || '');
  const createdAt = formatAccountDate(staff.auth_created_at);
  const lastSignInAt = formatAccountDate(staff.auth_last_sign_in_at);
  const roles = assignedRoles(staff);

  setText('[data-account-name]', String(staff.display_name || ''));
  setText('[data-account-auth-email]', authEmail);
  setOptionalRow('[data-account-phone-row]', phone);
  setOptionalRow('[data-account-created-row]', createdAt);
  setOptionalRow('[data-account-last-sign-in-row]', lastSignInAt);
  setText('[data-account-status]', staff.is_active ? 'Active' : 'Inactive');
  const accountContact = target('[data-account-contact]');
  if (accountContact) accountContact.hidden = !phone;
  const accountMetadata = target('[data-account-metadata]');
  if (accountMetadata) accountMetadata.hidden = !createdAt && !lastSignInAt;
  const accountStatus = target('[data-account-status]');
  if (accountStatus) {
    accountStatus.dataset.status = staff.is_active ? 'active' : 'inactive';
    accountStatus.classList.remove('is-skeleton');
  }

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

  if (resetButton) resetButton.disabled = !authEmail;
}

async function signOutOtherSessions(state) {
  if (signOutOthersPending) return;
  if (!state.session || !state.session.access_token) {
    setSessionsStatus('Refresh the page and sign in again before managing sessions.', 'error');
    return;
  }

  const currentSessionId = auth.sessionId(state.session);
  const sessions = Array.isArray(state.accountSessions) ? state.accountSessions : [];
  if (!hasOtherAccountSessions(sessions, currentSessionId)) {
    renderAccountSessions(state);
    return;
  }

  signOutOthersPending = true;
  renderAccountSessions(state);
  setSessionsStatus('Signing out other sessions…', 'loading');

  try {
    await auth.signOut(state.session, 'others');
    state.accountSessions = sessions.filter((session) => (
      isCurrentAccountSession(session, currentSessionId)
    ));
    if (state.loadedViews && state.loadedViews.auth) {
      state.loadedViews.auth.loadedAt = Date.now();
    }
    signOutOthersPending = false;
    renderAccountSessions(state);
    setSessionsStatus('Other sessions signed out. This session remains active.', 'success');
  } catch (error) {
    signOutOthersPending = false;
    renderAccountSessions(state);
    setSessionsStatus(
      error instanceof Error ? error.message : 'Other sessions could not be signed out.',
      'error'
    );
  }

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
      <section class="admin-panel admin-account-panel">
        <header class="admin-panel-header admin-workspace-header admin-account-header">
          <div class="admin-page-title">
            <h1 id="account-page-title">Account</h1>
          </div>
        </header>

        <div class="admin-account-content">
          <section class="admin-account-profile" aria-labelledby="account-details-title">
            <div class="admin-account-identity">
              <div class="admin-account-identity-copy">
                <h2 id="account-details-title" data-account-name><span class="admin-skeleton admin-skeleton-line admin-skeleton-account-name" aria-hidden="true"></span></h2>
                <p data-account-auth-email><span class="admin-skeleton admin-skeleton-line admin-skeleton-account-email" aria-hidden="true"></span></p>
              </div>
              <span
                class="admin-status-pill admin-account-status is-skeleton"
                data-account-status
                data-status=""
              ><span class="admin-skeleton admin-skeleton-pill" aria-hidden="true"></span></span>
            </div>
            <dl class="admin-account-details" data-account-contact hidden>
              <div data-account-phone-row hidden>
                <dt>Phone</dt>
                <dd></dd>
              </div>
            </dl>
          </section>

          <div class="admin-account-settings">
            <section class="admin-account-section admin-account-roles" aria-labelledby="account-roles-title">
              <h2 id="account-roles-title">Roles</h2>
              <ul class="admin-account-role-list" data-account-roles>
                <li class="admin-account-role-chip admin-skeleton-role" aria-hidden="true"><span class="admin-skeleton admin-skeleton-line"></span></li>
              </ul>
            </section>

            <section class="admin-account-section admin-account-security" aria-labelledby="account-security-title">
              <h2 id="account-security-title">Password</h2>
              <button
                class="admin-button admin-button-secondary"
                type="button"
                data-account-password-reset
                disabled
              >Send reset link</button>
              <p
                class="admin-account-reset-status"
                data-account-reset-status
                role="status"
                aria-live="polite"
                aria-atomic="true"
              ></p>
            </section>
          </div>
        </div>

        <section class="admin-account-sessions" aria-labelledby="account-sessions-title">
          <header class="admin-account-sessions-header">
            <div class="admin-account-sessions-heading">
              <h2 id="account-sessions-title">Active sessions</h2>
              <span class="admin-account-session-count" data-account-session-count>Loading…</span>
            </div>
            <button
              class="admin-button admin-button-danger"
              type="button"
              data-account-sign-out-others
              aria-describedby="account-sessions-status"
              disabled
            >Sign out other sessions</button>
          </header>
          <ul class="admin-account-session-list" data-account-sessions aria-busy="true">
            <li class="admin-account-session admin-account-session-skeleton" aria-hidden="true">
              <span class="admin-skeleton admin-skeleton-line"></span>
              <span class="admin-skeleton admin-skeleton-line"></span>
            </li>
          </ul>
          <p
            id="account-sessions-status"
            class="admin-account-sessions-status"
            data-account-sessions-status
            role="status"
            aria-live="polite"
            aria-atomic="true"
          ></p>
        </section>

        <dl class="admin-account-metadata" data-account-metadata aria-label="Account activity" hidden>
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
    </section>
  `;
}

export function beforeRender({ state }) {
  renderAccount(state.staff);
  renderAccountSessions(state);
}

export function afterEvents({ state }) {
  const resetButton = target('[data-account-password-reset]');
  const signOutOthersButton = target('[data-account-sign-out-others]');
  renderAccount(state.staff);
  renderAccountSessions(state);
  if (resetButton && resetButton.dataset.bound !== 'true') {
    resetButton.dataset.bound = 'true';
    resetButton.addEventListener('click', () => {
      requestPasswordReset(state, resetButton);
    });
  }
  if (signOutOthersButton && signOutOthersButton.dataset.bound !== 'true') {
    signOutOthersButton.dataset.bound = 'true';
    signOutOthersButton.addEventListener('click', () => {
      signOutOtherSessions(state);
    });
  }
}

export function destroyPage() {
  if (requestController) requestController.abort();
  requestController = null;
}
