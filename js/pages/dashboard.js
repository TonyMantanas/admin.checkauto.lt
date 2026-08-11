import { skeletons } from '../core/skeletons.js?v=20260802-1';

export const page = 'dashboard';

function dashboardKpiSkeletons() {
  return Array.from({ length: 4 }, (_, index) => `
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
      <section class="admin-dashboard-operations-board" aria-label="Today's operations">
        <section class="admin-dashboard-today" aria-labelledby="dashboard-today-title">
          <header class="admin-dashboard-board-heading">
            <h2 id="dashboard-today-title">Today</h2>
            <p>Schedule, staffing, and bookable time.</p>
          </header>
          <div data-dashboard-today>${dashboardListSkeletons(4)}</div>
        </section>

        <aside class="admin-dashboard-action-rail" aria-labelledby="dashboard-attention-title">
          <header class="admin-dashboard-board-heading">
            <h2 id="dashboard-attention-title" data-dashboard-attention-title>Needs action</h2>
            <p data-dashboard-attention-summary>Bookings that need review or assignment.</p>
          </header>
          <div data-dashboard-attention>${dashboardListSkeletons(2)}</div>
        </aside>
      </section>

      <section class="admin-dashboard-metrics-band" aria-labelledby="dashboard-overview-title">
        <div class="admin-dashboard-metrics-heading">
          <h2 id="dashboard-overview-title">Month to date</h2>
          <p>Compared with the same elapsed period last month.</p>
        </div>
        <div class="admin-dashboard-kpis" data-dashboard-kpis aria-label="Business key performance indicators">
          ${dashboardKpiSkeletons()}
        </div>
        <details class="admin-dashboard-more-metrics" data-dashboard-more-metrics hidden>
          <summary>More business metrics</summary>
          <dl data-dashboard-secondary-kpis></dl>
        </details>
      </section>

      <section class="admin-dashboard-performance-board admin-dashboard-trend" aria-labelledby="dashboard-trend-title">
        <header class="admin-dashboard-trend-heading">
          <h2 id="dashboard-trend-title">Bookings and completed inspections</h2>
          <div class="admin-segmented" data-dashboard-trend-range role="group" aria-label="Booking trend period">
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
          <aside class="admin-dashboard-period-readout" aria-label="Selected period totals">
            <div data-dashboard-period-readout>
              <h3>Selected period</h3>
              <p>Loading period totals...</p>
            </div>
          </aside>
        </div>
      </section>

      <section class="admin-dashboard-secondary-grid">
        <section class="admin-dashboard-support-section admin-dashboard-revenue" data-dashboard-revenue-panel aria-labelledby="dashboard-revenue-title" hidden>
          <header class="admin-dashboard-support-heading">
            <h2 id="dashboard-revenue-title">Paid revenue</h2>
            <p>Paid, non-void invoices only.</p>
          </header>
          <div data-dashboard-revenue></div>
        </section>

        <section class="admin-dashboard-support-section admin-dashboard-staff" aria-labelledby="dashboard-staff-title">
          <header class="admin-dashboard-support-heading">
            <h2 id="dashboard-staff-title">Inspector output</h2>
            <p data-dashboard-staff-period>Completed inspections during the last 30 days.</p>
          </header>
          <div data-dashboard-staff>${dashboardListSkeletons(4)}</div>
        </section>
      </section>

      <details class="admin-dashboard-activity-disclosure admin-dashboard-activity">
        <summary id="dashboard-activity-title">
          <span>Recent activity</span>
          <small data-dashboard-activity-count>Latest booking and invoice changes</small>
        </summary>
        <div role="region" aria-labelledby="dashboard-activity-title" data-dashboard-activity>${dashboardListSkeletons(5)}</div>
      </details>
    </div>
  `;
}

export function afterInit() {}

export async function initPage() {}

export function renderPage() {}

export function destroyPage() {}
