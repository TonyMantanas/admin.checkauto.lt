export const page = 'invoices';

export function renderStaticPage(root) {
  root.innerHTML = `
    <header class="admin-page-heading admin-page-heading-compact">
      <div class="admin-page-title">
        <h1>Invoices</h1>
        <p class="admin-count" data-invoice-count role="status" aria-live="polite"></p>
      </div>
    </header>

    <section class="admin-request-layout admin-request-layout-list">
      <section class="admin-panel" aria-label="Invoice ledger">
        <div class="admin-panel-header admin-operational-toolbar">
          <label class="admin-search admin-search-inline">
            <span>Search invoices</span>
            <input
              type="search"
              data-invoice-search
              placeholder="Invoice, customer, booking, or vehicle"
              autocomplete="off"
            >
          </label>
          <div class="admin-segmented" data-invoice-filters role="group" aria-label="Filter invoices">
            <button type="button" data-invoice-filter="all" aria-pressed="false">All</button>
            <button class="is-active" type="button" data-invoice-filter="unpaid" aria-pressed="true">Unpaid</button>
            <button type="button" data-invoice-filter="paid" aria-pressed="false">Paid</button>
            <button type="button" data-invoice-filter="void" aria-pressed="false">Void</button>
          </div>
        </div>
        <div class="admin-invoice-list" data-invoice-list></div>
      </section>
    </section>
  `;
}

export async function initPage() {}

export function renderPage() {}

export function destroyPage() {}
