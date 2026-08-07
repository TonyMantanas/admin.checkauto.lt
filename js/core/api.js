const SUPABASE_URL = 'https://ddhhhieitupjixynjrry.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkaGhoaWVpdHVwaml4eW5qcnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNDAyOTQsImV4cCI6MjA5NzcxNjI5NH0.PXAxGc3TSFUnbcyWdizhkiJkKqJlqD1Ic8PHAjHSFIc';
const STAFF_USERS_ENDPOINT = `${SUPABASE_URL}/functions/v1/admin-staff-users`;

export class AdminApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'AdminApiError';
    this.code = String(options.code || '');
    this.status = Number(options.status || 0);
    this.details = options.details || null;
  }
}

async function requestStaffUsers(session, payload, options = {}) {
  if (!session || !session.access_token) {
    throw new AdminApiError('Sign in again before managing users.', {
      code: 'authentication_required',
      status: 401
    });
  }

  const response = await fetch(STAFF_USERS_ENDPOINT, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    },
    cache: 'no-store',
    signal: options.signal,
    body: JSON.stringify(payload || {})
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AdminApiError(body.error || 'User management could not be completed.', {
      code: body.code,
      status: response.status,
      details: body.details || null
    });
  }
  return body;
}

export const api = {
  staffUsers: {
    request: requestStaffUsers
  }
};
