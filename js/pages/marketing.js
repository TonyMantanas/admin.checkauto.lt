import { ICONS } from '../core/icons.js?v=20260802-1';
import { skeletons } from '../core/skeletons.js?v=20260802-1';

export const page = 'marketing';

export function renderStaticPage(root) {
  root.innerHTML = `
    <section class="admin-marketing-layout">
      <section class="admin-panel admin-marketing-compose" aria-labelledby="marketing-compose-title">
        <div class="admin-panel-header admin-panel-header-compact admin-marketing-workspace-header">
          <h1 id="marketing-compose-title">Marketing</h1>
          <p class="admin-count" data-marketing-audience-count role="status" aria-live="polite">${skeletons.block('admin-skeleton-line admin-skeleton-count')}</p>
        </div>
        <form class="admin-action-form" data-marketing-form data-admin-action-form data-action="sendMarketingCampaign">
          <label>Subject<input name="marketingSubject" type="text" maxlength="140" required placeholder="Email subject"></label>
          <label>Message<textarea name="marketingBody" maxlength="6000" required placeholder="Write the email message"></textarea></label>
          <div class="admin-form-error" data-action-error role="status" aria-live="polite"></div>
          <div class="admin-action-buttons">
            <button class="admin-button admin-button-primary" type="submit">${ICONS.send}<span>Send email</span></button>
          </div>
        </form>
      </section>

      <section class="admin-panel admin-marketing-history-panel" aria-labelledby="marketing-history-title">
        <div class="admin-panel-header admin-panel-header-compact">
          <h2 id="marketing-history-title">Campaigns</h2>
        </div>
        <div class="admin-mini-list" data-marketing-campaigns>${skeletons.campaigns()}</div>
      </section>
    </section>
  `;
}

export async function initPage() {}

export function renderPage() {}

export function destroyPage() {}
