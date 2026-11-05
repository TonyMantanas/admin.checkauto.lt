import { auth } from '../core/auth.js?v=20260804-1';
import { formatDateTime, formatDay, relativeDateTime } from '../core/formatting.js?v=20261105-3';
import { modals } from '../core/modals.js?v=20260804-1';

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

function setText(selector, value, fallback = '') {
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

function sessionListItem(session, currentSessionId) {
  const item = document.createElement('li');
  const text = document.createElement('span');
  const title = document.createElement('strong');
  const detail = document.createElement('span');
  const isCurrent = isCurrentAccountSession(session, currentSessionId);

  item.className = 'admin-row-item admin-row-item--plain admin-account-session';
  if (isCurrent) item.dataset.current = 'true';
  text.className = 'admin-row-text';
  title.textContent = approximateSessionLabel(session);
  const signedIn = session && session.created_at ? 'Signed in ' + formatDateTime(session.created_at) : '';
  const active = session && session.last_active_at ? 'last active ' + relativeDateTime(session.last_active_at) : '';
  detail.textContent = [signedIn, active].filter(Boolean).join(' · ');
  text.append(title, detail);
  item.appendChild(text);

  if (isCurrent) {
    const badge = document.createElement('span');
    badge.className = 'admin-chip';
    badge.textContent = 'This device';
    item.appendChild(badge);
  }
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
    count.innerHTML = '<span class="admin-skeleton admin-skeleton-line admin-skeleton-count" aria-hidden="true"></span>';
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

  count.textContent = sessions.length ? `${sessions.length} signed in` : '';
  list.removeAttribute('aria-busy');
  if (sessions.length) {
    list.replaceChildren(...sessions.map((session) => (
      sessionListItem(session, currentSessionId)
    )));
  } else {
    const empty = document.createElement('li');
    empty.className = 'admin-row-item admin-row-item--plain admin-account-session-empty';
    empty.textContent = 'Sessions can’t be shown right now.';
    list.replaceChildren(empty);
  }

  if (button) {
    const hasOtherSessions = hasOtherAccountSessions(sessions, currentSessionId);
    button.disabled = signOutOthersPending || !hasOtherSessions;
    button.classList.toggle('is-loading', signOutOthersPending);
    if (signOutOthersPending) button.setAttribute('aria-busy', 'true');
    else button.removeAttribute('aria-busy');
    button.textContent = signOutOthersPending ? 'Signing out…' : 'Sign out other sessions';
    button.hidden = !signOutOthersPending && !hasOtherSessions;
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

function accountInitials(staff) {
  const parts = String(staff.display_name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length) return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  return String(staff.auth_email || '?').charAt(0).toUpperCase();
}

function renderAccount(staff, state) {
  const resetButton = target('[data-account-password-reset]');
  const accountViewLoaded = Boolean(state && state.loadedViews && state.loadedViews.auth);
  if (!staff || !accountViewLoaded) {
    if (resetButton) resetButton.disabled = true;
    return;
  }

  const authEmail = String(staff.auth_email || '');
  const phone = String(staff.phone || '');
  const createdAt = staff.auth_created_at && !Number.isNaN(Date.parse(staff.auth_created_at)) ? formatDay(staff.auth_created_at) : '';
  const roles = assignedRoles(staff);

  const avatar = target('[data-account-avatar]');
  if (avatar) avatar.textContent = accountInitials(staff);
  setText('[data-account-name]', String(staff.display_name || ''), authEmail || 'Your account');
  const email = target('[data-account-auth-email]');
  if (email) {
    email.textContent = authEmail;
    email.hidden = !authEmail;
  }
  // Only an explicitly inactive account gets a chip; a missing flag is not "inactive".
  const status = target('[data-account-status]');
  if (status) {
    status.hidden = staff.is_active !== false;
    status.textContent = staff.is_active === false ? 'Inactive' : '';
  }
  setText('[data-account-roles]', roles.map((role) => roleLabels[role] || humanizeIdentifier(role)).join(' · '), 'No role');
  setOptionalRow('[data-account-phone-row]', phone);
  setOptionalRow('[data-account-created-row]', createdAt);

  const mfaRow = target('[data-account-mfa-row]');
  if (mfaRow) {
    const factors = state.authUser ? auth.factorsFromUser(state.authUser) : null;
    mfaRow.hidden = !factors;
    const mfa = target('[data-account-mfa]');
    if (mfa && factors) mfa.textContent = factors.totp.length ? 'On · authenticator app' : 'Off';
  }

  if (resetButton) resetButton.disabled = !authEmail;
}

async function signOutOtherSessions(state) {
  if (signOutOthersPending) return;
  if (!state.session || !state.session.access_token) {
    setSessionsStatus('Sign in again, then try once more.', 'error');
    return;
  }

  const currentSessionId = auth.sessionId(state.session);
  const sessions = Array.isArray(state.accountSessions) ? state.accountSessions : [];
  if (!hasOtherAccountSessions(sessions, currentSessionId)) {
    renderAccountSessions(state);
    return;
  }

  const confirmed = typeof modals.confirm === 'function'
    ? await modals.confirm({
      title: 'Sign out other sessions?',
      message: 'Every other browser signed in to your account will need to sign in again.',
      cancelLabel: 'Cancel',
      confirmLabel: 'Sign out',
      danger: true
    })
    : true;
  if (!confirmed) return;

  signOutOthersPending = true;
  renderAccountSessions(state);
  setSessionsStatus('');

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
    setSessionsStatus('Other sessions signed out.', 'success');
  } catch (error) {
    signOutOthersPending = false;
    renderAccountSessions(state);
    setSessionsStatus(
      error instanceof Error ? error.message : 'Other sessions could not be signed out. Try again.',
      'error'
    );
  }

}

async function requestPasswordReset(state, button) {
  if (!state.session || !state.session.access_token || !state.staff || !state.staff.auth_email) {
    setStatus('Sign in again, then request the link.', 'error');
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
      const error = new Error(body.error || 'Your reset link could not be requested.');
      error.name = body.code || 'PasswordResetError';
      throw error;
    }

    setStatus(
      'Check your email. The link works for 15 minutes, in this browser.',
      'success'
    );
  } catch (error) {
    if (error && error.name === 'AbortError') return;
    if (serverResponded) restoreStoredPkceVerifier(previousPkceRecord);
    setStatus(
      !serverResponded
        ? 'We couldn’t confirm the request. If an email arrives, open the newest link in this browser.'
        : error instanceof Error
          ? error.message
          : 'Your reset link could not be requested.',
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
    <div class="admin-page-body admin-page-narrow admin-account-page">
      <header class="admin-page-header">
        <div><h1 id="account-page-title">Account</h1></div>
      </header>

      <section class="admin-card admin-account-profile" aria-labelledby="account-details-title">
        <div class="admin-account-identity">
          <span class="admin-avatar admin-avatar-lg" data-account-avatar aria-hidden="true"></span>
          <div class="admin-account-identity-copy">
            <h2 id="account-details-title" data-account-name><span class="admin-skeleton admin-skeleton-line admin-skeleton-account-name" aria-hidden="true"></span></h2>
            <p data-account-auth-email><span class="admin-skeleton admin-skeleton-line admin-skeleton-account-email" aria-hidden="true"></span></p>
          </div>
          <span class="admin-chip" data-tone="danger" data-account-status hidden></span>
        </div>
        <dl class="admin-account-facts">
          <div><dt>Roles</dt><dd data-account-roles><span class="admin-skeleton admin-skeleton-line admin-skeleton-line-short" aria-hidden="true"></span></dd></div>
          <div data-account-phone-row hidden><dt>Phone</dt><dd></dd></div>
          <div data-account-created-row hidden><dt>Member since</dt><dd></dd></div>
        </dl>
      </section>

      <section class="admin-card" aria-labelledby="account-signin-title">
        <header class="admin-card-head"><div><h2 id="account-signin-title">Sign-in</h2></div></header>
        <ul class="admin-row-list">
          <li class="admin-row-item admin-row-item--plain">
            <span class="admin-row-text">
              <strong>Password</strong>
              <span class="admin-account-reset-status" data-account-reset-status role="status" aria-live="polite" aria-atomic="true"></span>
            </span>
            <button class="admin-button admin-button-secondary" type="button" data-account-password-reset disabled>Send reset link</button>
          </li>
          <li class="admin-row-item admin-row-item--plain" data-account-mfa-row hidden>
            <span class="admin-row-text"><strong>Two-step sign-in</strong><span data-account-mfa></span></span>
          </li>
        </ul>
      </section>

      <section class="admin-card" aria-labelledby="account-sessions-title">
        <header class="admin-card-head">
          <div>
            <h2 id="account-sessions-title">Sessions</h2>
            <p data-account-session-count><span class="admin-skeleton admin-skeleton-line admin-skeleton-count" aria-hidden="true"></span></p>
          </div>
          <button class="admin-button admin-button-ghost admin-account-sign-out" type="button" data-account-sign-out-others aria-describedby="account-sessions-status" disabled>Sign out other sessions</button>
        </header>
        <ul class="admin-row-list" data-account-sessions aria-busy="true">
          <li class="admin-row-item admin-row-item--plain" aria-hidden="true">
            <span class="admin-row-text"><span class="admin-skeleton admin-skeleton-line admin-skeleton-line-wide"></span><span class="admin-skeleton admin-skeleton-line admin-skeleton-line-medium"></span></span>
          </li>
        </ul>
        <p id="account-sessions-status" class="admin-account-sessions-status" data-account-sessions-status role="status" aria-live="polite" aria-atomic="true"></p>
      </section>
    </div>
  `;
}

export function beforeRender({ state }) {
  renderAccount(state.staff, state);
  renderAccountSessions(state);
}

export function afterEvents({ state }) {
  const resetButton = target('[data-account-password-reset]');
  const signOutOthersButton = target('[data-account-sign-out-others]');
  renderAccount(state.staff, state);
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
