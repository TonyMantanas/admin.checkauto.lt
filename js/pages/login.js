export const page = 'login';

export function renderStaticPage(root) {
  root.innerHTML = `
    <section class="admin-login" aria-label="Admin account access">
      <div class="admin-login-panel">
        <div class="admin-brand">check<span>auto</span>.lt</div>
        <h1 id="admin-login-title">Sign in</h1>
        <p class="admin-login-session" data-admin-login-session role="status" aria-live="polite">Checking session…</p>
        <form data-admin-login-form hidden novalidate>
          <label>Email<input name="email" type="email" autocomplete="email" required></label>
          <label>Password<input name="password" type="password" autocomplete="current-password" required></label>
          <p class="admin-status" data-admin-login-status role="status" aria-live="polite"></p>
          <button class="admin-button admin-button-primary" type="submit">Sign in</button>
        </form>

        <section class="admin-mfa-step" data-admin-mfa-enroll hidden aria-labelledby="admin-mfa-enroll-title">
          <h2 id="admin-mfa-enroll-title">Secure your account</h2>
          <p>Scan this code with Microsoft Authenticator, Google Authenticator, 1Password, or another TOTP app.</p>
          <div class="admin-mfa-qr" data-admin-mfa-qr></div>
          <details class="admin-mfa-manual">
            <summary>Can’t scan the QR code?</summary>
            <p>Enter this setup key manually:</p>
            <div class="admin-mfa-secret">
              <code data-admin-mfa-secret></code>
              <button class="admin-button admin-button-secondary" type="button" data-admin-mfa-copy>Copy</button>
            </div>
          </details>
          <form data-admin-mfa-enroll-form novalidate>
            <label>
              6-digit verification code
              <input
                name="verificationCode"
                type="text"
                inputmode="numeric"
                autocomplete="one-time-code"
                pattern="[0-9]{6}"
                maxlength="6"
                required
              >
            </label>
            <label class="admin-checkbox admin-mfa-trust">
              <input name="rememberDevice" type="checkbox">
              <span>Keep me signed in on this device for up to 60 days</span>
            </label>
            <p class="admin-field-help">Leave this off on a shared or public device.</p>
            <p class="admin-status" data-admin-mfa-enroll-status role="status" aria-live="polite"></p>
            <button class="admin-button admin-button-primary" type="submit">Verify and continue</button>
          </form>
        </section>

        <section class="admin-mfa-step" data-admin-mfa-challenge hidden aria-labelledby="admin-mfa-challenge-title">
          <h2 id="admin-mfa-challenge-title">Verify it’s you</h2>
          <p>Enter the current 6-digit code from your authenticator app.</p>
          <form data-admin-mfa-challenge-form novalidate>
            <label>
              Verification code
              <input
                name="verificationCode"
                type="text"
                inputmode="numeric"
                autocomplete="one-time-code"
                pattern="[0-9]{6}"
                maxlength="6"
                required
              >
            </label>
            <label class="admin-checkbox admin-mfa-trust">
              <input name="rememberDevice" type="checkbox">
              <span>Keep me signed in on this device for up to 60 days</span>
            </label>
            <p class="admin-field-help">Leave this off on a shared or public device.</p>
            <p class="admin-status" data-admin-mfa-challenge-status role="status" aria-live="polite"></p>
            <div class="admin-mfa-actions">
              <button class="admin-button admin-button-ghost" type="button" data-admin-mfa-use-recovery>Use a recovery code</button>
              <button class="admin-button admin-button-primary" type="submit">Verify and continue</button>
            </div>
          </form>
        </section>

        <section class="admin-mfa-step" data-admin-mfa-recovery hidden aria-labelledby="admin-mfa-recovery-title">
          <h2 id="admin-mfa-recovery-title">Use a recovery code</h2>
          <p>Enter one unused recovery code. You’ll then sign in again and set up a new authenticator.</p>
          <form data-admin-mfa-recovery-form novalidate>
            <label>
              Recovery code
              <input
                name="recoveryCode"
                type="text"
                inputmode="text"
                autocomplete="one-time-code"
                autocapitalize="characters"
                spellcheck="false"
                maxlength="40"
                required
              >
            </label>
            <p class="admin-status" data-admin-mfa-recovery-status role="status" aria-live="polite"></p>
            <div class="admin-mfa-actions">
              <button class="admin-button admin-button-ghost" type="button" data-admin-mfa-back>Back</button>
              <button class="admin-button admin-button-primary" type="submit">Recover account</button>
            </div>
          </form>
        </section>

        <section class="admin-mfa-step" data-admin-mfa-codes hidden aria-labelledby="admin-mfa-codes-title">
          <h2 id="admin-mfa-codes-title">Save your recovery codes</h2>
          <p>Each code works once. Store them somewhere private and separate from this device. They won’t be shown again.</p>
          <ol class="admin-mfa-code-list" data-admin-mfa-code-list></ol>
          <div class="admin-mfa-actions">
            <button class="admin-button admin-button-secondary" type="button" data-admin-mfa-download>Download codes</button>
            <button class="admin-button admin-button-primary" type="button" data-admin-mfa-finish>Saved — continue</button>
          </div>
          <p class="admin-status" data-admin-mfa-codes-status role="status" aria-live="polite"></p>
        </section>
      </div>
    </section>
  `;
}

export async function initPage() {}

export function renderPage() {}

export function destroyPage() {}
