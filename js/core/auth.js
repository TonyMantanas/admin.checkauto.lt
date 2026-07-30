const SUPABASE_URL = 'https://ddhhhieitupjixynjrry.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkaGhoaWVpdHVwaml4eW5qcnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNDAyOTQsImV4cCI6MjA5NzcxNjI5NH0.PXAxGc3TSFUnbcyWdizhkiJkKqJlqD1Ic8PHAjHSFIc';

function authErrorMessage(status, body, fallback) {
  if (status === 429) return 'Too many attempts. Wait a moment and try again.';
  const code = String(body && (body.code || body.error_code) || '');
  if (code === 'mfa_verification_failed' || code === 'invalid_totp') {
    return 'That verification code is not valid. Try the newest code from your authenticator app.';
  }
  return fallback;
}

async function request(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1${path}`, {
    method: options.method || 'GET',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      ...(options.session && options.session.access_token
        ? { Authorization: `Bearer ${options.session.access_token}` }
        : {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store'
  });

  const body = response.status === 204
    ? null
    : await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(authErrorMessage(
      response.status,
      body,
      options.errorMessage || 'Authentication could not be completed.'
    ));
    error.status = response.status;
    error.code = body && (body.code || body.error_code) || '';
    throw error;
  }

  return body;
}

function decodeJwt(token) {
  try {
    const encoded = String(token || '').split('.')[1];
    if (!encoded) return {};
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
    const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    return {};
  }
}

function normalizeSession(data) {
  if (!data || !data.access_token || !data.refresh_token) return null;
  return {
    ...data,
    expires_at: Number(data.expires_at) || Math.round(Date.now() / 1000) + Number(data.expires_in || 3600)
  };
}

function factorsFromUser(user) {
  const all = Array.isArray(user && user.factors) ? user.factors : [];
  return {
    all,
    totp: all.filter((factor) => factor.factor_type === 'totp' && factor.status === 'verified'),
    unverifiedTotp: all.filter((factor) => factor.factor_type === 'totp' && factor.status !== 'verified')
  };
}

async function signInWithPassword(email, password) {
  const session = await request('/token?grant_type=password', {
    method: 'POST',
    body: { email, password },
    errorMessage: 'Sign in failed. Check your email and password.'
  });
  return normalizeSession(session);
}

async function exchangeRecoveryCode(code, codeVerifier) {
  const session = await request('/token?grant_type=pkce', {
    method: 'POST',
    body: {
      auth_code: code,
      code_verifier: codeVerifier
    },
    errorMessage: 'This reset link is invalid, expired, or was opened in a different browser.'
  });
  return normalizeSession(session);
}

async function getUser(session) {
  return request('/user', {
    session,
    errorMessage: 'Your sign-in session has expired.'
  });
}

async function listFactors(session) {
  return factorsFromUser(await getUser(session));
}

async function enrollTotp(session) {
  const factor = await request('/factors', {
    method: 'POST',
    session,
    body: {
      friendly_name: 'checkauto.lt admin',
      factor_type: 'totp',
      issuer: 'checkauto.lt'
    },
    errorMessage: 'The authenticator could not be set up. Try again.'
  });

  if (factor && factor.type === 'totp' && factor.totp && factor.totp.qr_code) {
    factor.totp.qr_code = `data:image/svg+xml;utf-8,${factor.totp.qr_code}`;
  }
  return factor;
}

async function removeFactor(session, factorId) {
  return request(`/factors/${encodeURIComponent(factorId)}`, {
    method: 'DELETE',
    session,
    errorMessage: 'The incomplete authenticator setup could not be reset.'
  });
}

async function challengeTotp(session, factorId) {
  return request(`/factors/${encodeURIComponent(factorId)}/challenge`, {
    method: 'POST',
    session,
    body: { factorId },
    errorMessage: 'A verification challenge could not be started. Try again.'
  });
}

async function verifyTotp(session, factorId, challengeId, code) {
  const verified = await request(`/factors/${encodeURIComponent(factorId)}/verify`, {
    method: 'POST',
    session,
    body: {
      challenge_id: challengeId,
      code
    },
    errorMessage: 'That verification code is not valid. Try the newest code from your authenticator app.'
  });
  return normalizeSession(verified);
}

async function signOut(session, scope = 'global') {
  if (!session || !session.access_token) return;
  await request(`/logout?scope=${encodeURIComponent(scope)}`, {
    method: 'POST',
    session,
    errorMessage: 'The server could not revoke this session.'
  });
}

function assuranceLevel(session) {
  return String(decodeJwt(session && session.access_token).aal || 'aal1');
}

function sessionId(session) {
  return String(decodeJwt(session && session.access_token).session_id || '');
}

export const auth = {
  assuranceLevel,
  challengeTotp,
  decodeJwt,
  enrollTotp,
  exchangeRecoveryCode,
  factorsFromUser,
  getUser,
  listFactors,
  normalizeSession,
  removeFactor,
  sessionId,
  signInWithPassword,
  signOut,
  verifyTotp
};
