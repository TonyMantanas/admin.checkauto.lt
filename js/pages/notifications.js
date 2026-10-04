export const page='notifications';
export function renderStaticPage(root) {
  root.innerHTML=`<section class="admin-notifications-workspace"><header class="admin-panel-header admin-workspace-header"><div class="admin-page-title"><h1>Notifications</h1><p class="admin-count" data-notifications-count role="status" aria-live="polite">Loading actions…</p></div></header><div data-notifications-content aria-busy="true"></div></section>`;
}
