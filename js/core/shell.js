import { PATHS } from './routes.js?v=20260823-1';
import { ICONS } from './icons.js?v=20260802-1';

const groups = [
  {
    label: 'Workspace',
    items: [
      { page: 'dashboard', label: 'Dashboard', href: PATHS.dashboard },
      { page: 'bookings', label: 'Bookings', href: PATHS.bookings },
      { page: 'availability', label: 'Availability', href: PATHS.availability },
      { page: 'customers', label: 'Customers', href: PATHS.customers, accessRight: 'sensitive_data.access' },
      { page: 'invoices', label: 'Billing', href: PATHS.invoices, accessRight: 'sensitive_data.access' },
      { page: 'marketing', label: 'Marketing', href: PATHS.marketing, accessRight: 'sensitive_data.access' }
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
      <div class="admin-sidebar-header">
        <a class="admin-brand admin-sidebar-brand" href="${PATHS.dashboard}" aria-label="checkauto.lt dashboard">check<span>auto</span>.lt</a>
        <button
          class="admin-button admin-button-secondary admin-icon-button admin-sidebar-close"
          type="button"
          data-admin-nav-close
          aria-label="Close navigation"
          title="Close navigation"
        >${ICONS.close}</button>
      </div>
      <nav class="admin-sidebar-nav" aria-label="Primary">
        ${groups.map((group) => {
          const startsHidden = group.items.every((item) => item.accessRight);
          return `
          <section class="admin-nav-group"${startsHidden ? ' hidden' : ''}>
            <p class="admin-nav-group-label">${group.label}</p>
            ${group.items.map((item) => `
              <a
                href="${item.href}"
                data-admin-nav="${item.page}"
                ${item.accessRight ? `data-admin-access="${item.accessRight}" hidden` : ''}
                ${item.page === page ? 'class="is-active" aria-current="page"' : ''}
              >${item.label}</a>
            `).join('')}
          </section>
        `;
        }).join('')}
        <div data-admin-owner-nav></div>
      </nav>
      <div class="admin-sidebar-account">
        <div class="admin-sidebar-user">
          <p class="admin-sync-state" data-admin-sync-state data-state="synced" role="status" aria-live="polite" aria-atomic="true">Up to date</p>
          <p data-admin-user></p>
        </div>
        <div class="admin-shell-actions">
          <a
            class="admin-button admin-button-secondary admin-account-link"
            href="${PATHS.account}"
            data-admin-nav="account"
            ${page === 'account' ? 'aria-current="page"' : ''}
          >${ICONS.user}<span>Account</span></a>
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
      aria-hidden="true"
      tabindex="-1"
    ></button>
  `;
}

function staffRoles(staff) {
  const values = Array.isArray(staff && staff.roles)
    ? staff.roles
    : staff && staff.role
      ? [staff.role]
      : [];
  return values.filter((role, index) => typeof role === 'string' && values.indexOf(role) === index);
}

function staffHasAccess(staff, accessRight, legacyRoles = []) {
  if (!staff) return false;
  if (Array.isArray(staff.access_rights)) {
    return staff.access_rights.includes(accessRight);
  }
  const roles = staffRoles(staff);
  return legacyRoles.some((role) => roles.includes(role));
}

function syncAccessControlledNavigation(staff) {
  document.querySelectorAll('[data-admin-access]').forEach((link) => {
    const accessRight = link.dataset.adminAccess;
    const legacyRoles = accessRight === 'sensitive_data.access' ? ['owner', 'admin'] : [];
    link.hidden = !staffHasAccess(staff, accessRight, legacyRoles);
  });

  document.querySelectorAll('.admin-sidebar-nav > .admin-nav-group').forEach((group) => {
    const links = Array.from(group.querySelectorAll('[data-admin-nav]'));
    group.hidden = links.length > 0 && links.every((link) => link.hidden);
  });
}

export function syncStaffNavigation(staff, page) {
  syncAccessControlledNavigation(staff);

  const target = document.querySelector('[data-admin-owner-nav]');
  if (!target) return;

  if (
    !staffRoles(staff).includes('owner') ||
    !staffHasAccess(staff, 'staff_users.manage', ['owner'])
  ) {
    target.replaceChildren();
    return;
  }

  const section = document.createElement('section');
  const label = document.createElement('p');
  const organizationLink = document.createElement('a');
  const usersLink = document.createElement('a');

  section.className = 'admin-nav-group';
  label.className = 'admin-nav-group-label';
  label.textContent = 'Settings';
  organizationLink.href = PATHS.organization;
  organizationLink.dataset.adminNav = 'organization';
  organizationLink.textContent = 'Organization';
  usersLink.href = PATHS.users;
  usersLink.dataset.adminNav = 'users';
  usersLink.textContent = 'Users';
  if (page === 'organization') {
    organizationLink.className = 'is-active';
    organizationLink.setAttribute('aria-current', 'page');
  }
  if (page === 'users') {
    usersLink.className = 'is-active';
    usersLink.setAttribute('aria-current', 'page');
  }
  section.append(label, organizationLink, usersLink);
  target.replaceChildren(section);
}
