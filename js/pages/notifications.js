import { skeletons } from '../core/skeletons.js?v=20261004-4';

export const page = 'notifications';

export function renderStaticPage(root) {
  root.innerHTML = `
    <div class="admin-page-body admin-notifications-workspace">
      <header class="admin-page-header">
        <div>
          <h1>Notifications</h1>
          <p class="admin-page-meta admin-count" data-notifications-count role="status" aria-live="polite"></p>
        </div>
      </header>
      <section class="admin-card admin-card--flush" data-notifications-content role="region" aria-busy="true" aria-label="Notification actions">${skeletons.notifications()}</section>
    </div>
  `;
}
