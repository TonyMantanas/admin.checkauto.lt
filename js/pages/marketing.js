const SEND_ICON = `
  <svg class="admin-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="m21 3-7.5 18-3.2-7.3L3 10.5 21 3Z"></path>
    <path d="m10.3 13.7 4-4"></path>
  </svg>
`;

export const page = 'marketing';

export function renderStaticPage(root) {
  root.innerHTML = `
    <header class="admin-page-heading admin-page-heading-compact">
      <h1>Marketing</h1>
    </header>

    <section class="admin-marketing-layout">
      <section class="admin-panel admin-marketing-compose" aria-labelledby="marketing-compose-title">
        <div class="admin-panel-header admin-panel-header-compact">
          <h2 id="marketing-compose-title">New email</h2>
          <p class="admin-count" data-marketing-audience-count role="status" aria-live="polite"></p>
        </div>
        <p class="admin-helper-text" id="marketing-audience-help">Only customers with active marketing consent will receive this email.</p>
        <form class="admin-action-form" data-marketing-form data-admin-action-form data-action="sendMarketingCampaign">
          <label>Subject<input name="marketingSubject" type="text" maxlength="140" required placeholder="Email subject"></label>
          <label>Message<textarea name="marketingBody" maxlength="6000" required placeholder="Write the email message" aria-describedby="marketing-message-help"></textarea></label>
          <p class="admin-helper-text" id="marketing-message-help">A consent and unsubscribe footer is added automatically.</p>
          <div class="admin-form-error" data-action-error role="status" aria-live="polite"></div>
          <div class="admin-action-buttons">
            <button class="admin-button admin-button-primary" type="submit" aria-describedby="marketing-audience-help">${SEND_ICON}<span>Send email</span></button>
          </div>
        </form>
      </section>

      <section class="admin-panel admin-marketing-history-panel" aria-labelledby="marketing-history-title">
        <div class="admin-panel-header admin-panel-header-compact">
          <h2 id="marketing-history-title">Campaigns</h2>
        </div>
        <div class="admin-mini-list" data-marketing-campaigns></div>
      </section>
    </section>
  `;
}

export async function initPage() {}

export function renderPage() {}

export function destroyPage() {}
