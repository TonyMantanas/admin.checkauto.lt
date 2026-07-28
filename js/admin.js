import { api } from './core/api.js?v=20260727-3';
import { auth } from './core/auth.js?v=20260727-3';
import { calendar } from './core/calendar.js?v=20260727-3';
import { controls } from './core/controls.js?v=20260727-3';
import { drawers } from './core/drawers.js?v=20260727-3';
import { formatters } from './core/formatting.js?v=20260727-3';
import { modals } from './core/modals.js?v=20260727-3';
import { realtime } from './core/realtime.js?v=20260727-3';
import { PATHS, PAGE_TITLES } from './core/routes.js?v=20260727-3';
import { initAdminRuntime } from './core/runtime.js?v=20260728-5';
import { renderShell } from './core/shell.js?v=20260727-3';
import { state } from './core/state.js?v=20260727-3';
import { toast } from './core/toast.js?v=20260727-3';
import { validators } from './core/validation.js?v=20260727-3';

const pageControllers = {
  dashboard: () => import('./pages/dashboard.js?v=20260727-3'),
  bookings: () => import('./pages/bookings.js?v=20260727-3'),
  availability: () => import('./pages/availability.js?v=20260728-4'),
  customers: () => import('./pages/customers.js?v=20260727-3'),
  invoices: () => import('./pages/invoices.js?v=20260727-3'),
  marketing: () => import('./pages/marketing.js?v=20260727-3'),
  login: () => import('./pages/login.js?v=20260727-3')
};

function createContext(page) {
  return {
    page,
    state,
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

function renderBootstrapError(error) {
  const root = document.querySelector('[data-page-root]') || document.body;
  root.innerHTML = `
    <section class="admin-loading">
      <div>
        <div class="admin-brand">check<span>auto</span>.lt</div>
        <p>Admin console could not start.</p>
        <p class="admin-form-status">${error instanceof Error ? error.message : 'Unknown startup error.'}</p>
      </div>
    </section>
  `;
}

async function boot() {
  const page = document.body.dataset.adminPage || 'dashboard';
  const loadController = pageControllers[page] || pageControllers.dashboard;
  const context = createContext(page);
  const controller = await loadController();

  renderShell(page);

  const root = document.querySelector('[data-page-root]');
  if (root && typeof controller.renderStaticPage === 'function') {
    controller.renderStaticPage(root, context);
  }

  if (typeof controller.initPage === 'function') {
    await controller.initPage(context);
  }

  initAdminRuntime(controller);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () {
    boot().catch(renderBootstrapError);
  });
} else {
  boot().catch(renderBootstrapError);
}
