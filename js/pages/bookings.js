import { ICONS } from '../core/icons.js?v=20260802-1';
import { skeletons } from '../core/skeletons.js?v=20260821-2';

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
            <label class="admin-search admin-search-inline admin-search-compact">
              <span>Search bookings</span>
              <input type="search" data-booking-search placeholder="Reference, customer, vehicle, service" autocomplete="off" disabled>
            </label>
            <details class="admin-filter-menu" data-booking-filter-menu>
              <summary aria-expanded="false"><span>Filters</span><span class="admin-filter-count" data-booking-filter-count hidden>0</span></summary>
              <div class="admin-filter-popover" aria-label="Booking filters">
                <header class="admin-filter-popover-header">
                  <strong>Filter bookings</strong>
                  <button class="admin-icon-button admin-filter-close" type="button" data-filter-close aria-label="Close booking filters" title="Close">${ICONS.close}</button>
                </header>
                <div class="admin-filter-popover-body">
                  <fieldset class="admin-filter-statuses">
                    <legend>Status</legend>
                    <div class="admin-filter-check-grid">
                      <label><input type="checkbox" value="pending" data-booking-status><span>Pending review</span></label>
                      <label><input type="checkbox" value="confirmed" data-booking-status><span>Confirmed</span></label>
                      <label><input type="checkbox" value="completed" data-booking-status><span>Completed</span></label>
                      <label><input type="checkbox" value="rejected" data-booking-status><span>Rejected</span></label>
                      <label><input type="checkbox" value="cancelled" data-booking-status><span>Cancelled</span></label>
                      <label><input type="checkbox" value="expired" data-booking-status><span>Expired</span></label>
                    </div>
                  </fieldset>
                  <div class="admin-filter-date-grid">
                    <label>Date event<span class="admin-select-wrap"><select data-booking-date-field>
                      <option value="received">Booking received</option>
                      <option value="inspection">Inspection date</option>
                      <option value="confirmed">Confirmed date</option>
                      <option value="completed">Completed date</option>
                      <option value="rejected">Rejected date</option>
                      <option value="cancelled">Cancelled date</option>
                      <option value="expired">Expired date</option>
                    </select></span></label>
                    <label>From<input type="date" data-booking-date-from></label>
                    <label>To<input type="date" data-booking-date-to></label>
                  </div>
                  <div class="admin-filter-shortcuts" aria-label="Date shortcuts">
                    <button class="admin-button admin-button-secondary" type="button" data-booking-range="today">Today</button>
                    <button class="admin-button admin-button-secondary" type="button" data-booking-range="month">Month to date</button>
                  </div>
                </div>
                <div class="admin-filter-actions">
                  <button class="admin-button admin-button-ghost" type="button" data-booking-filters-reset>Reset</button>
                  <button class="admin-button admin-button-primary" type="button" data-filter-close>Done</button>
                </div>
              </div>
            </details>
            <div class="admin-segmented" data-admin-booking-sort role="group" aria-label="Sort bookings">
              <button class="admin-segmented-icon" type="button" data-booking-sort="asc" aria-pressed="false" aria-label="Oldest first" title="Oldest first" disabled>${ICONS.sortAscending}</button>
              <button class="is-active admin-segmented-icon" type="button" data-booking-sort="desc" aria-pressed="true" aria-label="Newest first" title="Newest first" disabled>${ICONS.sortDescending}</button>
            </div>
          </div>
        </div>
        <div class="admin-booking-list" data-admin-booking-list>${skeletons.list('bookings')}</div>
        <div class="admin-list-pagination" data-booking-pagination hidden>
          <button class="admin-button admin-button-secondary" type="button" data-booking-load-more>Load more bookings</button>
        </div>
      </section>
    </section>
  `;
}

export async function initPage() {}

export function renderPage() {}

export function destroyPage() {}
