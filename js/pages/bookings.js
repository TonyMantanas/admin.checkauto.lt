const SORT_EARLIEST = `
  <svg class="admin-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8 6h10M8 12h7M8 18h4M4 18V6m0 0L2 8m2-2 2 2"></path>
  </svg>
`;

const SORT_LATEST = `
  <svg class="admin-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8 6h4M8 12h7M8 18h10M4 6v12m0 0-2-2m2 2 2-2"></path>
  </svg>
`;

export const page = 'bookings';

export function renderStaticPage(root) {
  root.innerHTML = `
    <header class="admin-page-heading admin-page-heading-compact">
      <div class="admin-page-title">
        <h1>Bookings</h1>
        <p class="admin-count" data-admin-booking-count role="status" aria-live="polite"></p>
      </div>
    </header>

    <section class="admin-workbench admin-bookings-workbench">
      <section class="admin-panel admin-list-panel" aria-label="Booking queue">
        <div class="admin-panel-header admin-operational-toolbar">
          <div class="admin-segmented" data-admin-filters role="group" aria-label="Filter bookings">
            <button class="is-active" type="button" data-filter="pending" aria-pressed="true">Review</button>
            <button type="button" data-filter="today" aria-pressed="false">Today</button>
            <button type="button" data-filter="confirmed" aria-pressed="false">Confirmed</button>
            <button type="button" data-filter="completed" aria-pressed="false">Done</button>
            <button type="button" data-filter="all" aria-pressed="false">All</button>
          </div>
          <div class="admin-segmented" data-admin-booking-sort role="group" aria-label="Sort bookings">
            <button class="is-active admin-segmented-icon" type="button" data-booking-sort="asc" aria-pressed="true" aria-label="Earliest first" title="Earliest first">${SORT_EARLIEST}</button>
            <button class="admin-segmented-icon" type="button" data-booking-sort="desc" aria-pressed="false" aria-label="Latest first" title="Latest first">${SORT_LATEST}</button>
          </div>
        </div>
        <div class="admin-booking-list" data-admin-booking-list></div>
      </section>
    </section>
  `;
}

export async function initPage() {}

export function renderPage() {}

export function destroyPage() {}
