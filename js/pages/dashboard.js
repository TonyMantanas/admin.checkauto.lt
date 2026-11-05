import { skeletons } from '../core/skeletons.js?v=20260821-2';

export const page = 'dashboard';

const line = (size) => skeletons.block('admin-skeleton-line admin-skeleton-line-' + size);

function rowSkeletons(count) {
  return Array.from({ length: count }, (_, index) => `
    <div class="admin-dash-skeleton-row" aria-hidden="true" style="--admin-skeleton-delay: ${index * 70}ms">
      ${skeletons.block('admin-dash-skeleton-dot')}
      <span>${line('wide')}${line('medium')}</span>
    </div>
  `).join('');
}

function tileSkeletons() {
  return Array.from({ length: 3 }, (_, index) => `
    <li class="admin-dash-tile admin-dash-tile-skeleton" aria-hidden="true" style="--admin-skeleton-delay: ${index * 55}ms">
      ${skeletons.block('admin-skeleton-line admin-dash-skeleton-value')}
      ${line('medium')}
      ${line('short')}
    </li>
  `).join('');
}

export function renderStaticPage(root) {
  root.innerHTML = `
    <header class="admin-page-header">
      <div>
        <h1>Dashboard</h1>
        <p data-dashboard-date>&nbsp;</p>
      </div>
      <p class="admin-dash-updated" data-dashboard-generated aria-live="polite"></p>
    </header>

    <div class="admin-dash-error" data-dashboard-status hidden></div>

    <div class="admin-dash" data-dashboard-content>
      <div class="admin-dash-ops">
        <section class="admin-card admin-dash-queue" aria-labelledby="dashboard-attention-title">
          <header class="admin-card-head">
            <h2 id="dashboard-attention-title"><span data-dashboard-attention-title>Needs action</span></h2>
            <span class="admin-dash-count" data-dashboard-attention-count hidden></span>
          </header>
          <div data-dashboard-attention>${rowSkeletons(3)}</div>
        </section>

        <section class="admin-card admin-dash-today" aria-labelledby="dashboard-today-title">
          <header class="admin-card-head">
            <h2 id="dashboard-today-title">Today</h2>
            <div class="admin-dash-progress-wrap" data-dashboard-today-progress></div>
          </header>
          <div data-dashboard-today>${rowSkeletons(3)}</div>
        </section>
      </div>

      <section class="admin-dash-month" aria-labelledby="dashboard-month-title">
        <header class="admin-section-head">
          <h2 id="dashboard-month-title" data-dashboard-month-title>This month so far</h2>
          <p data-dashboard-month-caption></p>
        </header>
        <ul class="admin-dash-tiles" data-dashboard-kpis>${tileSkeletons()}</ul>
      </section>

      <section class="admin-card admin-dash-trend" aria-labelledby="dashboard-trend-title">
        <header class="admin-card-head admin-dash-trend-head">
          <div>
            <h2 id="dashboard-trend-title">Bookings and inspections</h2>
            <p class="admin-dash-legends" data-dashboard-trend-summary aria-live="polite">${line('wide')}</p>
          </div>
          <div class="admin-segmented" data-dashboard-trend-range role="group" aria-label="Period">
            <button type="button" data-trend-days="7" aria-pressed="false" disabled>7 days</button>
            <button type="button" data-trend-days="30" aria-pressed="true" class="is-active" disabled>30 days</button>
            <button type="button" data-trend-days="90" aria-pressed="false" disabled>3 months</button>
            <button type="button" data-trend-days="365" aria-pressed="false" disabled>12 months</button>
          </div>
        </header>
        <div data-dashboard-trend-chart aria-hidden="true">${skeletons.block('admin-dash-skeleton-chart')}</div>
      </section>

      <div class="admin-dash-pair" data-dashboard-secondary>
        <section class="admin-card" data-dashboard-revenue-panel aria-labelledby="dashboard-revenue-title" hidden>
          <header class="admin-card-head">
            <div>
              <h2 id="dashboard-revenue-title">Payments received</h2>
              <p>Paid invoices per month, including tax</p>
            </div>
          </header>
          <div data-dashboard-revenue></div>
        </section>

        <section class="admin-card" data-dashboard-staff-panel aria-labelledby="dashboard-staff-title" hidden>
          <header class="admin-card-head">
            <div>
              <h2 id="dashboard-staff-title">Inspector workload</h2>
              <p>Completed inspections, last 30 days</p>
            </div>
          </header>
          <div data-dashboard-staff></div>
        </section>
      </div>
    </div>
  `;
}

export function afterInit() {}

export async function initPage() {}

export function renderPage() {}

export function destroyPage() {}
