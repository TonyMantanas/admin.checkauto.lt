export const page = 'login';

// One heading per step: the runtime sets the h1 text for whichever step is
// shown, and each step is labelled by it.
export function renderStaticPage(root) {
  root.innerHTML = `
    <section class="admin-login" aria-label="Admin account access">
      <div class="admin-login-stack">
        <div class="admin-brand admin-login-brand">check<span>auto</span>.lt</div>
        <div class="admin-login-panel">
          <h1 id="admin-login-title">Sign in</h1>
          <p class="admin-login-session" data-admin-login-session role="status" aria-live="polite" hidden></p>
          <div class="admin-auth-form-skeleton" data-admin-login-loading role="status" aria-label="Checking account session">
            <div aria-hidden="true">
              <span class="admin-skeleton admin-skeleton-line admin-skeleton-line-short"></span>
              <span class="admin-skeleton admin-skeleton-control"></span>
              <span class="admin-skeleton admin-skeleton-line admin-skeleton-line-short"></span>
              <span class="admin-skeleton admin-skeleton-control"></span>
              <span class="admin-skeleton admin-skeleton-control"></span>
            </div>
          </div>
          <form class="admin-form-plain" data-admin-login-form hidden novalidate>
            <label><span class="admin-field-label">Email <span class="admin-required-marker" aria-hidden="true">*</span></span><input name="email" type="email" autocomplete="email" required></label>
            <label><span class="admin-field-label">Password <span class="admin-required-marker" aria-hidden="true">*</span></span><input name="password" type="password" autocomplete="current-password" required></label>
            <p class="admin-status" data-admin-login-status role="status" aria-live="polite"></p>
            <button class="admin-button admin-button-primary" type="submit">Sign in</button>
          </form>

          <section class="admin-mfa-step" data-admin-temp-password hidden aria-labelledby="admin-login-title">
            <p>Your password was set by an owner. Choose your own to continue.</p>
            <form class="admin-form-plain" data-admin-temp-password-form novalidate>
              <label>
                <span class="admin-field-label">New password <span class="admin-required-marker" aria-hidden="true">*</span></span>
                <input
                  name="newPassword"
                  type="password"
                  autocomplete="new-password"
                  autocapitalize="none"
                  spellcheck="false"
                  data-admin-description-id="admin-temp-password-requirements"
                  aria-describedby="admin-temp-password-requirements"
                  required
                >
              </label>
              <label>
                <span class="admin-field-label">Repeat password <span class="admin-required-marker" aria-hidden="true">*</span></span>
                <input
                  name="newPasswordConfirmation"
                  type="password"
                  autocomplete="new-password"
                  autocapitalize="none"
                  spellcheck="false"
                  data-admin-description-id="admin-temp-password-requirements"
                  aria-describedby="admin-temp-password-requirements"
                  required
                >
              </label>
              <p class="admin-password-guidance" id="admin-temp-password-requirements">At least 14 characters.</p>
              <p class="admin-status" data-admin-temp-password-status role="status" aria-live="polite"></p>
              <div class="admin-mfa-actions">
                <button class="admin-button admin-button-primary" type="submit">Change password</button>
                <button class="admin-button admin-button-ghost" type="button" data-admin-temp-password-sign-out>Sign out</button>
              </div>
            </form>
          </section>

          <section class="admin-mfa-step" data-admin-mfa-enroll hidden aria-labelledby="admin-login-title">
            <p>Scan this code with an authenticator app, then enter the 6-digit code it shows.</p>
            <div class="admin-mfa-qr" data-admin-mfa-qr></div>
            <details class="admin-mfa-manual">
              <summary>Can’t scan it? Enter a setup key</summary>
              <div class="admin-mfa-secret">
                <code data-admin-mfa-secret></code>
                <button class="admin-button admin-button-secondary" type="button" data-admin-mfa-copy>Copy</button>
              </div>
            </details>
            <form class="admin-form-plain" data-admin-mfa-enroll-form novalidate>
              <label>
                <span class="admin-field-label">6-digit code <span class="admin-required-marker" aria-hidden="true">*</span></span>
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
              <p class="admin-status" data-admin-mfa-enroll-status role="status" aria-live="polite"></p>
              <button class="admin-button admin-button-primary" type="submit">Verify</button>
            </form>
          </section>

          <section class="admin-mfa-step" data-admin-mfa-challenge hidden aria-labelledby="admin-login-title">
            <form class="admin-form-plain" data-admin-mfa-challenge-form novalidate>
              <label>
                <span class="admin-field-label">6-digit code from your authenticator app <span class="admin-required-marker" aria-hidden="true">*</span></span>
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
                <span>Keep me signed in on this device for 60 days</span>
              </label>
              <p class="admin-status" data-admin-mfa-challenge-status role="status" aria-live="polite"></p>
              <div class="admin-mfa-actions">
                <button class="admin-button admin-button-primary" type="submit">Verify</button>
                <button class="admin-button admin-button-ghost" type="button" data-admin-mfa-use-recovery>Use a recovery code</button>
              </div>
            </form>
          </section>

          <section class="admin-mfa-step" data-admin-mfa-recovery hidden aria-labelledby="admin-login-title">
            <p>You’ll set up two-step sign-in again afterwards.</p>
            <form class="admin-form-plain" data-admin-mfa-recovery-form novalidate>
              <label>
                <span class="admin-field-label">Recovery code <span class="admin-required-marker" aria-hidden="true">*</span></span>
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
                <button class="admin-button admin-button-primary" type="submit">Recover account</button>
                <button class="admin-button admin-button-ghost" type="button" data-admin-mfa-back>Back</button>
              </div>
            </form>
          </section>

          <section class="admin-mfa-step" data-admin-mfa-codes hidden aria-labelledby="admin-login-title">
            <p>Each code works once, and you won’t see them again.</p>
            <ol class="admin-mfa-code-list" data-admin-mfa-code-list></ol>
            <div class="admin-mfa-code-tools">
              <button class="admin-button admin-button-secondary" type="button" data-admin-mfa-copy-codes>Copy codes</button>
              <button class="admin-button admin-button-secondary" type="button" data-admin-mfa-download>Download</button>
            </div>
            <div class="admin-mfa-actions">
              <button class="admin-button admin-button-primary" type="button" data-admin-mfa-finish>Continue</button>
            </div>
            <p class="admin-status" data-admin-mfa-codes-status role="status" aria-live="polite"></p>
          </section>
        </div>
      </div>
    </section>
  `;
}

export async function initPage() {}

export function renderPage() {}

export function destroyPage() {}
