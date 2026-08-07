import { auth } from './core/auth.js?v=20260804-1';

const SUPABASE_URL = 'https://ddhhhieitupjixynjrry.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkaGhoaWVpdHVwaml4eW5qcnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNDAyOTQsImV4cCI6MjA5NzcxNjI5NH0.PXAxGc3TSFUnbcyWdizhkiJkKqJlqD1Ic8PHAjHSFIc';
const PASSWORD_RESET_ENDPOINT = `${SUPABASE_URL}/functions/v1/admin-password-reset`;
const SESSION_KEY = 'checkauto-admin-session';
const PASSWORD_RESET_PKCE_KEY = 'checkauto-admin-password-reset-pkce';
const RECOVERY_MAX_AGE_SECONDS = 15 * 60;
const MIN_PASSWORD_CHARACTERS = 14;
const MAX_PASSWORD_BYTES = 72;

let recoverySession = null;
let recoveryUser = null;
let recoveryFactors = [];
let passwordChangeCompleted = false;

function target(selector, root = document) {
  return root.querySelector(selector);
}

function clearStoredAdminState() {
  for (const storage of [window.localStorage, window.sessionStorage]) {
    try {
      storage.removeItem(SESSION_KEY);
      storage.removeItem('checkauto-admin-dashboard-cache');
    } catch {
      // Storage can be unavailable in hardened browser modes.
    }
  }
}

function revokeRecoverySessionLocally(session) {
  const accessToken = session && session.access_token;
  if (!accessToken) return;
  fetch(`${SUPABASE_URL}/auth/v1/logout?scope=local`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`
    },
    cache: 'no-store',
    keepalive: true
  }).catch(() => undefined);
}

function scrubRecoveryUrl() {
  try {
    window.history.replaceState(null, document.title, window.location.pathname);
  } catch {
    window.location.hash = '';
  }
}

function authenticationMethods(session) {
  const claims = auth.decodeJwt(session && session.access_token);
  const entries = Array.isArray(claims.amr) ? claims.amr : [];
  return {
    claims,
    entries: entries.flatMap((entry) => {
      if (typeof entry === 'string') return [{ method: entry }];
      return entry && typeof entry === 'object' ? [entry] : [];
    })
  };
}

function recoveryTimestamp(methods) {
  const recovery = methods.entries.find((entry) => entry.method === 'recovery');
  const timestamp = Number(recovery && recovery.timestamp);
  if (Number.isFinite(timestamp) && timestamp > 0) return timestamp;
  return Number(methods.claims.iat);
}

function isRecentRecoverySession(session, requireTotp = false) {
  const methods = authenticationMethods(session);
  const now = Math.floor(Date.now() / 1000);
  const recoveredAt = recoveryTimestamp(methods);
  const expiresAt = Number(methods.claims.exp);
  const names = new Set(methods.entries.map((entry) => entry.method));

  return (
    methods.claims.aal === (requireTotp ? 'aal2' : 'aal1') &&
    typeof methods.claims.sub === 'string' &&
    names.has('recovery') &&
    (!requireTotp || names.has('totp')) &&
    Number.isFinite(recoveredAt) &&
    recoveredAt <= now + 60 &&
    now - recoveredAt <= RECOVERY_MAX_AGE_SECONDS &&
    Number.isFinite(expiresAt) &&
    expiresAt > now
  );
}

function setOnlyVisible(section) {
  const successSection = target('[data-reset-success]');
  const sections = [
    target('[data-reset-loading]'),
    target('[data-reset-mfa]'),
    target('[data-reset-password]'),
    target('[data-reset-error]'),
    successSection
  ];
  for (const item of sections) {
    if (item) item.hidden = item !== section;
  }
  const isSuccess = section === successSection;
  const pageTitle = target('[data-reset-page-title]');
  if (pageTitle) pageTitle.textContent = isSuccess ? 'Password changed' : 'Reset password';
  document.title = isSuccess
    ? 'Password changed · checkauto.lt'
    : 'Reset password · checkauto.lt';
  const sectionSelect = section && target('select', section);
  const visibleSelect = sectionSelect && !sectionSelect.closest('[hidden]')
    ? sectionSelect
    : null;
  const focusTarget = isSuccess
    ? pageTitle
    : section && (
      visibleSelect ||
      target('input', section) ||
      target('h2', section) ||
      section
    );
  if (focusTarget) window.requestAnimationFrame(() => focusTarget.focus());
}

function setStatus(status, message, inputs = []) {
  if (!status) return;
  status.textContent = message || '';
  if (!status.id) status.id = `reset-status-${Math.random().toString(36).slice(2)}`;
  for (const input of inputs.filter(Boolean)) {
    if (message) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', status.id);
    } else {
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
    }
  }
}

function setFormBusy(form, busy, busyLabel) {
  const button = target('button[type="submit"]', form);
  if (!button) return;
  if (busy) {
    button.dataset.idleLabel = button.textContent;
    button.textContent = busyLabel;
    button.classList.add('is-loading');
    button.disabled = true;
    form.setAttribute('aria-busy', 'true');
  } else {
    button.textContent = button.dataset.idleLabel || button.textContent;
    button.classList.remove('is-loading');
    button.disabled = false;
    form.removeAttribute('aria-busy');
  }
}

function showFatalError(message) {
  revokeRecoverySessionLocally(recoverySession);
  recoverySession = null;
  recoveryUser = null;
  recoveryFactors = [];
  const errorSection = target('[data-reset-error]');
  const messageTarget = target('[data-reset-error-message]');
  if (messageTarget && message) messageTarget.textContent = message;
  setOnlyVisible(errorSection);
}

function recoveryCodeFromUrl() {
  const query = new URLSearchParams(window.location.search);
  const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const authError = query.get('error') || fragment.get('error');
  const code = query.get('code') || fragment.get('code');
  scrubRecoveryUrl();

  if (authError) {
    throw new Error('The reset link was rejected. Request a new email and use its newest link.');
  }
  if (!code || !/^[A-Za-z0-9-]{20,200}$/.test(code)) {
    throw new Error('This reset link is incomplete, expired, or has already been used.');
  }
  return code;
}

function readPkceVerifier() {
  let value;
  try {
    value = window.localStorage.getItem(PASSWORD_RESET_PKCE_KEY);
  } catch {
    throw new Error('This browser could not access the secure reset request.');
  }

  try {
    const record = JSON.parse(value || 'null');
    const verifier = String(record && record.verifier || '');
    const expiresAt = Number(record && record.expires_at);
    if (
      !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier) ||
      !Number.isFinite(expiresAt) ||
      expiresAt <= Date.now()
    ) {
      throw new Error('The reset request has expired.');
    }
    return verifier;
  } catch {
    throw new Error(
      'Open the newest reset email in the same browser and device where you requested it.'
    );
  }
}

function clearPkceVerifier() {
  try {
    window.localStorage.removeItem(PASSWORD_RESET_PKCE_KEY);
  } catch {
    // Expiration still limits the unusable browser-side record.
  }
}

function passwordValidationMessage(password, confirmation) {
  if (password !== confirmation) return 'The two passwords do not match.';
  if (Array.from(password).length < MIN_PASSWORD_CHARACTERS) {
    return `Use at least ${MIN_PASSWORD_CHARACTERS} characters.`;
  }
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
    return `Use no more than ${MAX_PASSWORD_BYTES} UTF-8 bytes.`;
  }
  if (/[\u0000-\u001f\u007f]/u.test(password) || !/\S/u.test(password)) {
    return 'Choose a password without control characters.';
  }
  const email = String(recoveryUser && recoveryUser.email || '');
  if (email && password.toLocaleLowerCase() === email.toLocaleLowerCase()) {
    return 'The password cannot be your email address.';
  }
  return '';
}

async function initializeRecovery() {
  const code = recoveryCodeFromUrl();
  const codeVerifier = readPkceVerifier();
  try {
    recoverySession = await auth.exchangeRecoveryCode(code, codeVerifier);
  } catch (error) {
    if (
      error &&
      Number(error.status) >= 400 &&
      Number(error.status) < 500 &&
      Number(error.status) !== 429
    ) {
      clearPkceVerifier();
    }
    throw error;
  }
  clearPkceVerifier();
  if (!isRecentRecoverySession(recoverySession)) {
    throw new Error('This reset link has expired or is not a valid recovery link.');
  }

  recoveryUser = await auth.getUser(recoverySession);
  recoveryFactors = auth.factorsFromUser(recoveryUser).totp;
  if (!recoveryFactors.length) {
    throw new Error('This account has no verified authenticator. Contact an administrator.');
  }

  const factorSelect = target('[name="factorId"]');
  const factorRow = target('[data-reset-factor-row]');
  if (factorSelect) {
    factorSelect.replaceChildren(...recoveryFactors.map((factor, index) => {
      const option = document.createElement('option');
      option.value = String(factor.id || '');
      option.textContent = String(
        factor.friendly_name || `Authenticator ${index + 1}`
      );
      return option;
    }));
  }
  if (factorRow) factorRow.hidden = recoveryFactors.length < 2;
  setOnlyVisible(target('[data-reset-mfa]'));
}

const mfaForm = target('[data-reset-mfa-form]');
const passwordForm = target('[data-reset-password-form]');

if (mfaForm) {
  const codeInput = target('[name="verificationCode"]', mfaForm);
  const factorSelect = target('[name="factorId"]', mfaForm);
  codeInput.addEventListener('input', () => {
    codeInput.value = codeInput.value.replace(/\D/g, '').slice(0, 6);
    setStatus(target('[data-reset-mfa-status]'), '', [codeInput]);
  });
  if (factorSelect) {
    factorSelect.addEventListener('change', () => {
      codeInput.value = '';
      setStatus(target('[data-reset-mfa-status]'), '', [codeInput]);
      codeInput.focus();
    });
  }

  mfaForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = target('[data-reset-mfa-status]');
    const code = codeInput.value.replace(/\D/g, '').slice(0, 6);
    setStatus(status, '', [codeInput]);
    if (!/^\d{6}$/.test(code)) {
      setStatus(status, 'Enter the 6-digit code from your authenticator app.', [codeInput]);
      codeInput.focus();
      return;
    }

    setFormBusy(mfaForm, true, 'Verifying…');
    try {
      const selectedFactorId = String(
        factorSelect && factorSelect.value || recoveryFactors[0] && recoveryFactors[0].id || ''
      );
      const recoveryFactor = recoveryFactors.find(
        (factor) => String(factor.id || '') === selectedFactorId
      );
      if (!recoveryFactor) {
        throw new Error('Choose a valid authenticator and try again.');
      }
      const recoveryChallenge = await auth.challengeTotp(
        recoverySession,
        recoveryFactor.id
      );
      const verifiedSession = await auth.verifyTotp(
        recoverySession,
        recoveryFactor.id,
        recoveryChallenge.id,
        code
      );
      if (!verifiedSession || !isRecentRecoverySession(verifiedSession, true)) {
        throw new Error('MFA verification did not produce a valid recovery session.');
      }
      recoveryUser = await auth.getUser(verifiedSession);
      recoverySession = verifiedSession;
      codeInput.value = '';
      setOnlyVisible(target('[data-reset-password]'));
    } catch (error) {
      setStatus(
        status,
        error instanceof Error ? error.message : 'Authenticator verification failed.',
        [codeInput]
      );
      codeInput.select();
    } finally {
      if (document.body.contains(mfaForm)) setFormBusy(mfaForm, false, '');
    }
  });
}

if (passwordForm) {
  const passwordInput = target('[name="password"]', passwordForm);
  const confirmationInput = target('[name="passwordConfirmation"]', passwordForm);
  for (const input of [passwordInput, confirmationInput]) {
    input.addEventListener('input', () => {
      setStatus(target('[data-reset-password-status]'), '', [passwordInput, confirmationInput]);
    });
  }

  passwordForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = target('[data-reset-password-status]');
    setStatus(status, '', [passwordInput, confirmationInput]);
    const validationMessage = passwordValidationMessage(
      passwordInput.value,
      confirmationInput.value
    );
    if (validationMessage) {
      setStatus(status, validationMessage, [passwordInput, confirmationInput]);
      passwordInput.focus();
      return;
    }

    if (!recoverySession || !isRecentRecoverySession(recoverySession, true)) {
      showFatalError('This recovery session has expired. Request a new reset email.');
      return;
    }

    setFormBusy(passwordForm, true, 'Changing…');
    try {
      const response = await fetch(PASSWORD_RESET_ENDPOINT, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${recoverySession.access_token}`,
          'Content-Type': 'application/json'
        },
        cache: 'no-store',
        body: JSON.stringify({
          action: 'complete',
          password: passwordInput.value
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(body.error || 'The password could not be changed.');
        error.code = body.code || '';
        throw error;
      }

      passwordChangeCompleted = true;
      passwordInput.value = '';
      confirmationInput.value = '';
      recoverySession = null;
      recoveryUser = null;
      clearStoredAdminState();
      setOnlyVisible(target('[data-reset-success]'));
    } catch (error) {
      passwordInput.value = '';
      confirmationInput.value = '';
      if (error && error.code === 'session_revocation_failed') {
        passwordChangeCompleted = true;
        clearStoredAdminState();
        showFatalError(
          'The password changed, but session cleanup could not be confirmed. Contact an administrator immediately.'
        );
        return;
      }
      if (error && error.code === 'password_update_unconfirmed') {
        clearStoredAdminState();
        showFatalError(
          'The password change could not be safely confirmed. Request a new reset email before signing in again.'
        );
        return;
      }
      setStatus(
        status,
        error instanceof Error ? error.message : 'The password could not be changed.',
        [passwordInput, confirmationInput]
      );
      passwordInput.focus();
    } finally {
      if (document.body.contains(passwordForm)) setFormBusy(passwordForm, false, '');
    }
  });
}

window.addEventListener('pagehide', () => {
  const accessToken = recoverySession && recoverySession.access_token;
  const passwordInput = target('[name="password"]');
  const confirmationInput = target('[name="passwordConfirmation"]');
  if (passwordInput) passwordInput.value = '';
  if (confirmationInput) confirmationInput.value = '';
  if (!passwordChangeCompleted && accessToken) {
    revokeRecoverySessionLocally({ access_token: accessToken });
  }
});

window.addEventListener('pageshow', (event) => {
  if (event.persisted) window.location.reload();
});

initializeRecovery().catch((error) => {
  showFatalError(
    error instanceof Error
      ? error.message
      : 'This reset link is invalid, expired, or has already been used.'
  );
});
