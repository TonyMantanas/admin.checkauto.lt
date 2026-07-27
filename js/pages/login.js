export const page = 'login';

export function renderStaticPage(root) {
  root.innerHTML = `
    <section class="admin-login" aria-labelledby="admin-login-title">
      <div class="admin-login-panel">
        <div class="admin-brand">check<span>auto</span>.lt</div>
        <h1 id="admin-login-title">Sign in</h1>
        <p class="admin-login-session" data-admin-login-session role="status" aria-live="polite">Checking session…</p>
        <form data-admin-login-form hidden>
          <label>Email<input name="email" type="email" autocomplete="email" required></label>
          <label>Password<input name="password" type="password" autocomplete="current-password" required></label>
          <p class="admin-status" data-admin-login-status role="status" aria-live="polite"></p>
          <button class="admin-button admin-button-primary" type="submit">Sign in</button>
        </form>
      </div>
    </section>
  `;
}

export async function initPage() {}

export function renderPage() {}

export function destroyPage() {}
