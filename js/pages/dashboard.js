export const page = 'dashboard';

export function renderStaticPage(root, context) {
  const bookingsPath = context.routes.PATHS.bookings;

  root.innerHTML = `
    <header class="admin-page-heading admin-page-heading-compact">
      <h1>Dashboard</h1>
    </header>

    <section class="admin-stats" data-admin-stats aria-label="Today at a glance"></section>

    <section class="admin-dashboard-grid">
      <section class="admin-panel admin-calendar-panel" aria-labelledby="dashboard-schedule-title">
        <div class="admin-panel-header admin-panel-header-compact">
          <h2 id="dashboard-schedule-title" data-admin-calendar-title>Today</h2>
          <div class="admin-calendar-controls">
            <button class="admin-button admin-button-secondary" type="button" data-calendar-prev aria-label="Previous period">‹</button>
            <button class="admin-button admin-button-secondary" type="button" data-calendar-today>Today</button>
            <button class="admin-button admin-button-secondary" type="button" data-calendar-next aria-label="Next period">›</button>
            <div class="admin-segmented" data-calendar-view role="group" aria-label="Schedule view">
              <button class="is-active" type="button" data-view="week" aria-pressed="true">Week</button>
              <button type="button" data-view="day" aria-pressed="false">Day</button>
            </div>
            <label class="admin-date-jump">
              <span>Jump to</span>
              <input type="date" autocomplete="off" data-calendar-date>
            </label>
          </div>
        </div>
        <div class="admin-calendar-legend" id="dashboard-calendar-legend" data-admin-calendar-legend></div>
        <div class="admin-calendar" data-admin-calendar role="region" aria-label="Schedule calendar" aria-describedby="dashboard-calendar-legend"></div>
      </section>

      <section class="admin-panel admin-dashboard-bookings-panel" aria-labelledby="dashboard-bookings-title">
        <div class="admin-panel-header admin-panel-header-compact">
          <h2 id="dashboard-bookings-title">Upcoming bookings</h2>
          <a class="admin-inline-link" href="${bookingsPath}">View all</a>
        </div>
        <div
          class="admin-booking-list admin-dashboard-booking-list"
          data-admin-booking-list
          data-admin-dashboard-booking-list
        ></div>
      </section>
    </section>
  `;
}

export function afterInit() {}

export async function initPage() {}

export function renderPage() {}

export function destroyPage() {}
