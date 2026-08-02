import { ICONS } from '../core/icons.js?v=20260802-1';
import { skeletons } from '../core/skeletons.js?v=20260802-1';

export const page = 'bookings';

export function renderStaticPage(root) {
  root.innerHTML = `
    <section class="admin-workbench admin-bookings-workbench">
      <section class="admin-panel admin-list-panel" aria-label="Booking queue">
        <div class="admin-panel-header admin-workspace-header admin-bookings-workspace-header">
          <div class="admin-page-title">
            <h1>Bookings</h1>
            <p class="admin-count" data-admin-booking-count role="status" aria-live="polite">${skeletons.block('admin-skeleton-line admin-skeleton-count')}</p>
          </div>
          <div class="admin-workspace-controls">
            <div class="admin-segmented" data-admin-filters role="group" aria-label="Filter bookings">
              <button class="is-active" type="button" data-filter="pending" aria-pressed="true" disabled>Review</button>
              <button type="button" data-filter="today" aria-pressed="false" disabled>Today</button>
              <button type="button" data-filter="confirmed" aria-pressed="false" disabled>Confirmed</button>
              <button type="button" data-filter="completed" aria-pressed="false" disabled>Done</button>
              <button type="button" data-filter="all" aria-pressed="false" disabled>All</button>
            </div>
            <div class="admin-segmented" data-admin-booking-sort role="group" aria-label="Sort bookings">
              <button class="is-active admin-segmented-icon" type="button" data-booking-sort="asc" aria-pressed="true" aria-label="Earliest first" title="Earliest first" disabled>${ICONS.sortAscending}</button>
              <button class="admin-segmented-icon" type="button" data-booking-sort="desc" aria-pressed="false" aria-label="Latest first" title="Latest first" disabled>${ICONS.sortDescending}</button>
            </div>
          </div>
        </div>
        <div class="admin-booking-list" data-admin-booking-list>${skeletons.list('bookings')}</div>
      </section>
    </section>
  `;
}

export async function initPage() {}

export function renderPage() {}

export function destroyPage() {}
