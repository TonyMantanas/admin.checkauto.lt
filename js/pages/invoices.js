import { skeletons } from '../core/skeletons.js?v=20260821-2';
import { ICONS } from '../core/icons.js?v=20260802-1';

export const page = 'invoices';

export function renderStaticPage(root) {
  root.innerHTML = `
    <section class="admin-workbench admin-invoices-workbench">
      <section class="admin-panel admin-list-panel" aria-label="Invoice ledger">
        <div class="admin-panel-header admin-workspace-header admin-invoices-workspace-header">
          <div class="admin-page-title">
            <h1>Invoices</h1>
            <p class="admin-count" data-invoice-count role="status" aria-live="polite">${skeletons.block('admin-skeleton-line admin-skeleton-count')}</p>
          </div>
          <div class="admin-workspace-controls">
            <label class="admin-search admin-search-inline admin-search-compact">
              <span>Search invoices</span>
              <input
                type="search"
                data-invoice-search
                placeholder="Number, customer, booking, vehicle"
                autocomplete="off"
                disabled
              >
            </label>
            <details class="admin-filter-menu" data-invoice-filter-menu>
              <summary aria-expanded="false"><span>Filters</span><span class="admin-filter-count" data-invoice-filter-count hidden>0</span></summary>
              <div class="admin-filter-popover" aria-label="Invoice filters">
                <header class="admin-filter-popover-header">
                  <strong>Filter invoices</strong>
                  <button class="admin-icon-button admin-filter-close" type="button" data-filter-close aria-label="Close invoice filters" title="Close">${ICONS.close}</button>
                </header>
                <div class="admin-filter-popover-body">
                  <fieldset class="admin-filter-statuses">
                    <legend>Record type</legend>
                    <div class="admin-filter-check-grid">
                      <label><input type="checkbox" value="draft" data-invoice-status><span>Draft</span></label>
                      <label><input type="checkbox" value="issued" data-invoice-status><span>Invoice</span></label>
                      <label><input type="checkbox" value="payment" data-invoice-status><span>Payment only</span></label>
                      <label><input type="checkbox" value="void" data-invoice-status><span>Void</span></label>
                    </div>
                  </fieldset>
                  <fieldset class="admin-filter-statuses">
                    <legend>Payment</legend>
                    <div class="admin-filter-check-grid">
                      <label><input type="checkbox" value="unpaid" data-invoice-payment-status><span>Unpaid</span></label>
                      <label><input type="checkbox" value="paid" data-invoice-payment-status><span>Paid</span></label>
                      <label><input type="checkbox" value="void" data-invoice-payment-status><span>Void</span></label>
                    </div>
                  </fieldset>
                  <fieldset class="admin-filter-statuses">
                    <legend>Email delivery</legend>
                    <div class="admin-filter-check-grid">
                      <label><input type="checkbox" value="not_sent" data-invoice-email-status><span>Not sent</span></label>
                      <label><input type="checkbox" value="sent" data-invoice-email-status><span>Sent</span></label>
                      <label><input type="checkbox" value="failed" data-invoice-email-status><span>Failed</span></label>
                      <label><input type="checkbox" value="skipped" data-invoice-email-status><span>Not applicable</span></label>
                    </div>
                  </fieldset>
                  <div class="admin-filter-date-grid">
                    <label>Date event<span class="admin-select-wrap"><select data-invoice-date-field>
                      <option value="created">Record created</option>
                      <option value="issued">Invoice issued</option>
                      <option value="due">Due date</option>
                      <option value="paid">Paid date</option>
                      <option value="voided">Voided date</option>
                    </select></span></label>
                    <label>From<input type="date" data-invoice-date-from></label>
                    <label>To<input type="date" data-invoice-date-to></label>
                  </div>
                  <div class="admin-filter-shortcuts" aria-label="Date shortcuts">
                    <button class="admin-button admin-button-secondary" type="button" data-invoice-range="today">Today</button>
                    <button class="admin-button admin-button-secondary" type="button" data-invoice-range="month">Month to date</button>
                  </div>
                  <div class="admin-filter-amount-grid">
                    <label>Amount from<input type="text" inputmode="decimal" placeholder="0.00" data-invoice-amount-min></label>
                    <label>Amount to<input type="text" inputmode="decimal" placeholder="500.00" data-invoice-amount-max></label>
                  </div>
                </div>
                <div class="admin-filter-actions">
                  <button class="admin-button admin-button-ghost" type="button" data-invoice-filters-reset>Reset</button>
                  <button class="admin-button admin-button-primary" type="button" data-filter-close>Done</button>
                </div>
              </div>
            </details>
            <div class="admin-segmented" data-admin-invoice-sort role="group" aria-label="Sort invoices">
              <button class="admin-segmented-icon" type="button" data-invoice-sort="asc" aria-pressed="false" aria-label="Oldest first" title="Oldest first" disabled>${ICONS.sortAscending}</button>
              <button class="is-active admin-segmented-icon" type="button" data-invoice-sort="desc" aria-pressed="true" aria-label="Newest first" title="Newest first" disabled>${ICONS.sortDescending}</button>
            </div>
          </div>
        </div>
        <div class="admin-invoice-list" data-invoice-list>${skeletons.list('invoices')}</div>
        <div class="admin-list-pagination" data-invoice-pagination hidden>
          <button class="admin-button admin-button-secondary" type="button" data-invoice-load-more>Load more records</button>
        </div>
      </section>
    </section>
  `;
}

export async function initPage() {}

export function renderPage() {}

export function destroyPage() {}
