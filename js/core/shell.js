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
        <div class="admin-shell-actions">
          <button
            class="admin-button admin-button-ghost admin-account-trigger"
            type="button"
            data-admin-account-toggle
            aria-haspopup="menu"
            aria-expanded="false"
            aria-controls="admin-account-menu"
          >${ICONS.user}<span data-admin-user>Account</span><span class="admin-account-chevron">${ICONS.next}</span></button>
          <button
            class="admin-button admin-icon-button admin-sync-state"
            type="button"
            data-admin-refresh
            data-admin-sync-state
            data-state="synced"
            aria-label="Synced. Refresh admin data"
            title="Synced. Refresh admin data"
          ><span data-sync-icon="synced">${ICONS.check}</span><span data-sync-icon="loading">${ICONS.refresh}</span><span data-sync-icon="error">${ICONS.alert}</span></button>
        </div>
        <div class="admin-account-menu" id="admin-account-menu" data-admin-account-menu role="menu" aria-label="Account" hidden>
          <a class="admin-account-menu-item" href="${PATHS.account}" data-admin-nav="account" role="menuitem" tabindex="-1" ${page === 'account' ? 'aria-current="page"' : ''}><span class="admin-icon admin-icon-settings" aria-hidden="true"></span><span>Settings</span></a>
          <button class="admin-account-menu-item" type="button" data-admin-logout role="menuitem" tabindex="-1">${ICONS.signOut}<span>Log out</span></button>
        </div>
        <span class="admin-sync-announcement" data-admin-sync-announcement role="status" aria-live="polite" aria-atomic="true"></span>
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

export function setupAccountMenu() {
  const root = document.querySelector('.admin-sidebar-account');
  const trigger = root && root.querySelector('[data-admin-account-toggle]');
  const menu = root && root.querySelector('[data-admin-account-menu]');
  if (!trigger || !menu) return { close() {} };
  const items = Array.from(menu.querySelectorAll('[role="menuitem"]'));

  function close({ restoreFocus = false } = {}) {
    if (menu.hidden) return;
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) trigger.focus({ preventScroll: true });
  }

  function open(index = 0) {
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    items[index].focus({ preventScroll: true });
  }

  trigger.addEventListener('click', () => {
    if (menu.hidden) open();
    else close({ restoreFocus: true });
  });
  trigger.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    open(event.key === 'ArrowUp' ? items.length - 1 : 0);
  });
  menu.addEventListener('keydown', (event) => {
    const index = items.indexOf(document.activeElement);
    let nextIndex;
    if (event.key === 'ArrowDown') nextIndex = (index + 1) % items.length;
    if (event.key === 'ArrowUp') nextIndex = (index - 1 + items.length) % items.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = items.length - 1;
    if (nextIndex !== undefined) {
      event.preventDefault();
      items[nextIndex].focus();
    } else if (event.key === 'Tab') {
      // Leave the menu in the same order as the two visible footer controls.
      event.preventDefault();
      event.stopPropagation();
      close();
      (event.shiftKey ? trigger : root.querySelector('[data-admin-refresh]')).focus();
    } else if (event.key === ' ' && document.activeElement.tagName === 'A') {
      event.preventDefault();
      document.activeElement.click();
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const match = items.find((item) => item.textContent.trim().toLowerCase().startsWith(event.key.toLowerCase()));
      if (match) {
        event.preventDefault();
        match.focus();
      }
    }
  });
  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || menu.hidden) return;
    event.preventDefault();
    event.stopPropagation();
    close({ restoreFocus: true });
  });
  menu.addEventListener('click', (event) => {
    if (event.target.closest('[role="menuitem"]')) close({ restoreFocus: true });
  });
  document.addEventListener('pointerdown', (event) => {
    if (!root.contains(event.target)) close({ restoreFocus: menu.contains(document.activeElement) });
  });
  document.addEventListener('focusin', (event) => {
    if (!menu.contains(event.target) && event.target !== trigger) close();
  });
  window.addEventListener('popstate', () => close());
  return { close };
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
