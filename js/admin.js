import { api } from './core/api.js?v=20260804-1';
import { auth } from './core/auth.js?v=20260804-1';
import { calendar } from './core/calendar.js?v=20260727-3';
import { controls } from './core/controls.js?v=20260727-3';
import { drawers } from './core/drawers.js?v=20260727-3';
import { formatters } from './core/formatting.js?v=20260727-3';
import { modals } from './core/modals.js?v=20260804-1';
import { realtime } from './core/realtime.js?v=20260727-3';
import { PATHS, PAGE_TITLES, pageFromPathname, pageFromUrl } from './core/routes.js?v=20260823-1';
import { initAdminRuntime } from './core/runtime.js?v=20260823-1';
import { renderShell } from './core/shell.js?v=20260823-1';
import { state } from './core/state.js?v=20260821-2';
import { toast } from './core/toast.js?v=20260804-1';
import { validators } from './core/validation.js?v=20260727-3';

const pageControllers = {
  dashboard: () => import('./pages/dashboard.js?v=20260823-1'),
  bookings: () => import('./pages/bookings.js?v=20260823-1'),
  availability: () => import('./pages/availability.js?v=20260823-1'),
  customers: () => import('./pages/customers.js?v=20260823-1'),
  invoices: () => import('./pages/invoices.js?v=20260823-1'),
  marketing: () => import('./pages/marketing.js?v=20260823-1'),
  organization: () => import('./pages/organization.js?v=20260823-1'),
  users: () => import('./pages/users.js?v=20260823-1'),
  account: () => import('./pages/account.js?v=20260823-1'),
  login: () => import('./pages/login.js?v=20260821-2')
};

function createContext(page, runtimeState = state) {
  return {
    page,
    state: runtimeState,
    api,
    auth,
    routes: { PATHS, PAGE_TITLES },
    shell: { renderShell },
    modals,
    drawers,
    toast,
    realtime,
    formatters,
    validators,
    controls,
    calendar
  };
}

async function mountPage(page, previousController, runtimeState, isCurrent) {
  const loadController = pageControllers[page] || pageControllers.dashboard;
  const controller = await loadController();
  if (typeof isCurrent === 'function' && !isCurrent()) return null;

  const context = createContext(page, runtimeState);
  if (previousController && typeof previousController.destroyPage === 'function') {
    await previousController.destroyPage(createContext(
      previousController.page || document.body.dataset.adminPage || page,
      runtimeState
    ));
  }
  if (typeof isCurrent === 'function' && !isCurrent()) return null;

  document.body.dataset.adminPage = page;
  document.title = `checkauto.lt ${PAGE_TITLES[page] || 'Admin'}`;

  const root = document.querySelector('[data-page-root]');
  if (root && typeof controller.renderStaticPage === 'function') {
    controller.renderStaticPage(root, context);
  }

  if (typeof controller.initPage === 'function') {
    await controller.initPage(context);
  }
  if (typeof isCurrent === 'function' && !isCurrent()) return null;

  return controller;
}

function preloadPage(page) {
  const loadController = pageControllers[page];
  if (!loadController) return Promise.resolve(null);
  return loadController().catch(() => null);
}

function renderBootstrapError(error) {
  console.error('Admin console startup failed.', error);
  const root = document.querySelector('[data-page-root]') || document.body;
  const loading = document.querySelector('[data-admin-loading]');
  const consoleRoot = document.querySelector('[data-admin-console]');
  if (loading) loading.hidden = true;
  if (consoleRoot) consoleRoot.hidden = false;
  root.innerHTML = `
    <section class="admin-loading" role="alert" aria-labelledby="admin-startup-error-title">
      <div>
        <div class="admin-brand">check<span>auto</span>.lt</div>
        <h1 id="admin-startup-error-title">Admin console could not start</h1>
        <p>Check your connection, then try again.</p>
        <button class="admin-button admin-button-primary" type="button" data-admin-bootstrap-retry>Try again</button>
      </div>
    </section>
  `;
  root.querySelector('[data-admin-bootstrap-retry]')?.addEventListener('click', () => {
    window.location.reload();
  });
}

async function boot() {
  const page = document.body.dataset.adminPage || 'dashboard';

  renderShell(page);
  const controller = await mountPage(page, null, state);
  await initAdminRuntime(controller, {
    mountPage,
    preloadPage,
    pageFromPathname,
    pageFromUrl,
    paths: PATHS,
    titles: PAGE_TITLES
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () {
    boot().catch(renderBootstrapError);
  });
} else {
  boot().catch(renderBootstrapError);
}
