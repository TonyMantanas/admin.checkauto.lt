import { skeletons } from '../core/skeletons.js?v=20261004-4';

export const page = 'notifications';

export function renderStaticPage(root) {
  root.innerHTML = `
    <section class="admin-notifications-workspace">
      <header class="admin-panel-header admin-workspace-header">
        <div class="admin-page-title"><h1>Notifications</h1></div>
      </header>
      <div data-notifications-content role="region" aria-busy="true" aria-label="Notification actions">${skeletons.notifications()}</div>
    </section>
  `;
}
