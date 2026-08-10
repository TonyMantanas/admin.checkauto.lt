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
        <p data-dashboard-generated aria-live="polite">Loading the latest business data...</p>
      </div>
    </header>

    <div class="admin-dashboard-load-error" data-dashboard-status hidden></div>

    <div class="admin-dashboard-content" data-dashboard-content>
      <section class="admin-dashboard-command-grid" aria-label="Current operations">
        <section class="admin-panel admin-dashboard-attention-panel" aria-labelledby="dashboard-attention-title">
          <div class="admin-panel-header admin-panel-header-compact admin-dashboard-section-header">
            <div>
              <span>Action queue</span>
              <h2 id="dashboard-attention-title">Needs attention</h2>
            </div>
          </div>
          <div data-dashboard-attention>${dashboardListSkeletons(2)}</div>
        </section>

        <section class="admin-panel admin-dashboard-today" aria-labelledby="dashboard-today-title">
          <div class="admin-panel-header admin-panel-header-compact admin-dashboard-section-header">
            <div>
              <span>Today</span>
              <h2 id="dashboard-today-title">Daily operations</h2>
            </div>
          </div>
          <div data-dashboard-today>${dashboardListSkeletons(4)}</div>
        </section>
      </section>

      <section class="admin-dashboard-overview" aria-labelledby="dashboard-overview-title">
        <div class="admin-dashboard-overview-heading">
          <div>
            <h2 id="dashboard-overview-title">Business overview</h2>
            <p>The measures that best describe this month's performance.</p>
          </div>
        </div>
        <div class="admin-dashboard-kpis" data-dashboard-kpis aria-label="Business key performance indicators">
          ${dashboardKpiSkeletons()}
        </div>
        <details class="admin-dashboard-more-metrics" data-dashboard-more-metrics hidden>
          <summary>More business metrics</summary>
          <dl data-dashboard-secondary-kpis></dl>
        </details>
      </section>

      <section class="admin-panel admin-dashboard-trend" aria-labelledby="dashboard-trend-title">
        <div class="admin-panel-header admin-dashboard-chart-header">
          <div>
            <span class="admin-dashboard-section-kicker">Demand and delivery</span>
            <h2 id="dashboard-trend-title">Bookings and completed inspections</h2>
            <p data-dashboard-trend-summary>Loading booking history...</p>
          </div>
          <div class="admin-segmented" data-dashboard-trend-range role="group" aria-label="Booking trend period">
            <button type="button" data-trend-days="7" aria-pressed="false" disabled>7 days</button>
            <button type="button" data-trend-days="30" aria-pressed="true" class="is-active" disabled>30 days</button>
            <button type="button" data-trend-days="90" aria-pressed="false" disabled>3 months</button>
            <button type="button" data-trend-days="365" aria-pressed="false" disabled>12 months</button>
          </div>
        </div>
        <div data-dashboard-trend-chart aria-hidden="true">
          <div class="admin-dashboard-chart-loading">
            ${skeletons.block('admin-dashboard-skeleton-chart')}
          </div>
        </div>
      </section>

      <section class="admin-dashboard-secondary-grid">
        <section class="admin-panel admin-dashboard-revenue" data-dashboard-revenue-panel aria-labelledby="dashboard-revenue-title" hidden>
          <div class="admin-panel-header admin-panel-header-compact admin-dashboard-section-header">
            <div>
              <span>Financials</span>
              <h2 id="dashboard-revenue-title">Paid revenue</h2>
              <p>Paid, non-void invoices only.</p>
            </div>
          </div>
          <div data-dashboard-revenue></div>
        </section>

        <section class="admin-panel admin-dashboard-staff" aria-labelledby="dashboard-staff-title">
          <div class="admin-panel-header admin-panel-header-compact admin-dashboard-section-header">
            <div>
              <span>Last 30 days</span>
              <h2 id="dashboard-staff-title">Inspector output</h2>
            </div>
          </div>
          <div data-dashboard-staff>${dashboardListSkeletons(4)}</div>
        </section>

        <section class="admin-panel admin-dashboard-activity" aria-labelledby="dashboard-activity-title">
          <div class="admin-panel-header admin-panel-header-compact admin-dashboard-section-header">
            <div>
              <span>Latest changes</span>
              <h2 id="dashboard-activity-title">Recent activity</h2>
            </div>
          </div>
          <div data-dashboard-activity>${dashboardListSkeletons(5)}</div>
        </section>
      </section>
    </div>
  `;
}

export function afterInit() {}

export async function initPage() {}

export function renderPage() {}

export function destroyPage() {}
