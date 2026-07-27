import { PATHS } from './routes.js?v=20260727-2';
import { ICONS } from './icons.js?v=20260727-2';

const groups = [
  {
    label: 'Today',
    items: [
      { page: 'dashboard', label: 'Dashboard', href: PATHS.dashboard }
    ]
  },
  {
    label: 'Operations',
    items: [
      { page: 'bookings', label: 'Bookings', href: PATHS.bookings },
      { page: 'availability', label: 'Availability', href: PATHS.availability },
      { page: 'customers', label: 'Customers', href: PATHS.customers },
      { page: 'invoices', label: 'Invoices', href: PATHS.invoices }
    ]
  },
  {
    label: 'Growth',
    items: [
      { page: 'marketing', label: 'Marketing', href: PATHS.marketing }
    ]
  }
];

export function renderShell(page) {
  const target = document.querySelector('[data-admin-shell]');
  if (!target || page === 'login') return;

  target.innerHTML = `
    <header class="admin-mobile-header">
      <a class="admin-brand" href="${PATHS.dashboard}" aria-label="checkauto.lt dashboard">check<span>auto</span>.lt</a>
      <button
        class="admin-button admin-button-secondary admin-icon-button admin-nav-toggle"
        type="button"
        data-admin-nav-toggle
        aria-expanded="false"
        aria-controls="admin-sidebar"
        aria-label="Open navigation"
        title="Open navigation"
      >${ICONS.menu}</button>
    </header>

    <aside class="admin-sidebar" id="admin-sidebar" aria-label="Admin navigation">
      <a class="admin-brand admin-sidebar-brand" href="${PATHS.dashboard}" aria-label="checkauto.lt dashboard">check<span>auto</span>.lt</a>
      <nav class="admin-sidebar-nav" aria-label="Primary">
        ${groups.map((group) => `
          <section class="admin-nav-group">
            <p class="admin-nav-group-label">${group.label}</p>
            ${group.items.map((item) => `
              <a
                href="${item.href}"
                data-admin-nav="${item.page}"
                ${item.page === page ? 'class="is-active" aria-current="page"' : ''}
              >${item.label}</a>
            `).join('')}
          </section>
        `).join('')}
      </nav>
      <div class="admin-sidebar-account">
        <div class="admin-sidebar-user">
          <p class="admin-sync-state" data-admin-sync-state data-state="synced" role="status" aria-live="polite" aria-atomic="true">Up to date</p>
          <p data-admin-user></p>
        </div>
        <div class="admin-shell-actions">
          <button
            class="admin-button admin-button-secondary admin-icon-button"
            type="button"
            data-admin-refresh
            aria-label="Refresh admin data"
            title="Refresh"
          >${ICONS.refresh}</button>
          <button
            class="admin-button admin-button-ghost admin-icon-button"
            type="button"
            data-admin-logout
            aria-label="Sign out"
            title="Sign out"
          >${ICONS.signOut}</button>
        </div>
      </div>
    </aside>
    <button
      class="admin-sidebar-scrim"
      type="button"
      data-admin-nav-close
      aria-label="Close navigation"
    ></button>
  `;
}
