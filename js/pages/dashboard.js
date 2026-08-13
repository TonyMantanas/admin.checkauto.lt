import { skeletons } from '../core/skeletons.js?v=20260802-1';

export const page = 'dashboard';

function dashboardKpiSkeletons() {
  return Array.from({ length: 3 }, (_, index) => `
    <div class="admin-dashboard-kpi admin-dashboard-kpi-skeleton" aria-hidden="true" style="--admin-skeleton-delay: ${index * 55}ms">
      ${skeletons.block('admin-skeleton-line admin-skeleton-line-medium')}
      ${skeletons.block('admin-skeleton-line admin-dashboard-skeleton-value')}
      ${skeletons.block('admin-skeleton-line admin-skeleton-line-short')}
    </div>
  `).join('');
}

function dashboardListSkeletons(count) {
  return Array.from({ length: count }, (_, index) => `
    <div class="admin-dashboard-list-skeleton" aria-hidden="true" style="--admin-skeleton-delay: ${index * 70}ms">
      ${skeletons.block('admin-skeleton-line admin-skeleton-line-short')}
      <span>
        ${skeletons.block('admin-skeleton-line admin-skeleton-line-wide')}
        ${skeletons.block('admin-skeleton-line admin-skeleton-line-medium')}
      </span>
      ${skeletons.block('admin-skeleton-pill')}
    </div>
  `).join('');
}

export function renderStaticPage(root) {
  root.innerHTML = `
    <header class="admin-dashboard-heading">
      <div>
        <h1>Dashboard</h1>
      </div>
      <p data-dashboard-generated aria-live="polite">Loading the latest business data...</p>
    </header>

    <div class="admin-dashboard-load-error" data-dashboard-status hidden></div>

    <div class="admin-dashboard-content" data-dashboard-content>
      <section class="admin-dashboard-command" aria-label="Operational overview">
        <section class="admin-dashboard-action-rail" aria-labelledby="dashboard-attention-title">
          <header class="admin-dashboard-board-heading">
            <div>
              <p class="admin-dashboard-eyebrow">Priority</p>
              <h2 id="dashboard-attention-title" data-dashboard-attention-title>Needs action</h2>
            </div>
            <p data-dashboard-attention-summary>Bookings that need review or assignment.</p>
          </header>
          <div data-dashboard-attention>${dashboardListSkeletons(3)}</div>
        </section>

        <section class="admin-dashboard-today" aria-labelledby="dashboard-today-title">
          <header class="admin-dashboard-board-heading">
            <div>
              <p class="admin-dashboard-eyebrow">Operations</p>
              <h2 id="dashboard-today-title">Today</h2>
            </div>
            <p>Workload and near-term capacity.</p>
          </header>
          <div data-dashboard-today>${dashboardListSkeletons(2)}</div>
        </section>
      </section>

      <section class="admin-dashboard-metrics-band" aria-labelledby="dashboard-overview-title">
        <div class="admin-dashboard-metrics-heading">
          <h2 id="dashboard-overview-title">Month to date</h2>
          <p>Same elapsed period last month</p>
        </div>
        <div class="admin-dashboard-kpis" data-dashboard-kpis aria-label="Business key performance indicators">
          ${dashboardKpiSkeletons()}
        </div>
      </section>

      <section class="admin-dashboard-performance-board admin-dashboard-trend" aria-labelledby="dashboard-trend-title">
        <header class="admin-dashboard-trend-heading">
          <div>
            <h2 id="dashboard-trend-title">Demand and delivery</h2>
            <p>Independent booking-received and inspection-completed event trends.</p>
          </div>
          <div class="admin-segmented" data-dashboard-trend-range role="group" aria-label="Demand and delivery period">
            <button type="button" data-trend-days="7" aria-pressed="false" disabled>7 days</button>
            <button type="button" data-trend-days="30" aria-pressed="true" class="is-active" disabled>30 days</button>
            <button type="button" data-trend-days="90" aria-pressed="false" disabled>3 months</button>
            <button type="button" data-trend-days="365" aria-pressed="false" disabled>12 months</button>
          </div>
        </header>
        <div class="admin-dashboard-performance-body">
          <div class="admin-dashboard-chart-column">
            <p class="admin-dashboard-trend-summary" data-dashboard-trend-summary aria-live="polite">Loading booking history...</p>
            <div data-dashboard-trend-chart aria-hidden="true">
              <div class="admin-dashboard-chart-loading">
                ${skeletons.block('admin-dashboard-skeleton-chart')}
              </div>
            </div>
          </div>
          <aside class="admin-dashboard-period-readout" aria-label="Selected period comparison">
            <div data-dashboard-period-readout>
              <h3>Selected period</h3>
              <p>Loading comparison...</p>
            </div>
          </aside>
        </div>
      </section>

      <section class="admin-dashboard-secondary-grid" aria-label="Secondary business analysis">
        <section class="admin-dashboard-support-section admin-dashboard-revenue" data-dashboard-revenue-panel aria-labelledby="dashboard-revenue-title" hidden>
          <header class="admin-dashboard-support-heading">
            <div>
              <h2 id="dashboard-revenue-title">Payments received</h2>
              <p>Gross paid, non-void invoice totals, including tax.</p>
            </div>
          </header>
          <div data-dashboard-revenue></div>
        </section>

        <details class="admin-dashboard-support-section admin-dashboard-staff" data-dashboard-staff-panel aria-labelledby="dashboard-staff-title">
          <summary class="admin-dashboard-support-heading">
            <span>
              <h2 id="dashboard-staff-title">Inspector workload</h2>
              <p data-dashboard-staff-period>Completed inspections during the last 30 days.</p>
            </span>
          </summary>
          <div data-dashboard-staff>${dashboardListSkeletons(4)}</div>
        </details>
      </section>
    </div>
  `;
}

export function afterInit() {}

export async function initPage() {}

export function renderPage() {}

export function destroyPage() {}
