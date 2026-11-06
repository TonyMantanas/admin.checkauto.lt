import { skeletons } from '../core/skeletons.js?v=20261106-4';

export const page = 'customers';

export function renderStaticPage(root) {
  root.innerHTML = `
    <div class="admin-list-page admin-customer-layout">
      <header class="admin-page-header">
        <div>
          <h1>Customers</h1>
          <p class="admin-page-meta admin-count" data-customer-count role="status" aria-live="polite">${skeletons.block('admin-skeleton-line admin-skeleton-count')}</p>
        </div>
      </header>
      <section class="admin-card admin-card--flush admin-list-card" aria-label="Customer profiles">
        <div class="admin-card-toolbar admin-list-toolbar">
          <label class="admin-search admin-search-compact">
            <span>Search customers</span>
            <input
              type="search"
              data-customer-search
              placeholder="Search customers"
              autocomplete="off"
              disabled
            >
          </label>
        </div>
        <div class="admin-list-scroll">
          <div class="admin-data-head admin-customer-data-head" aria-hidden="true">
            <span>Customer</span>
            <span>Contact</span>
            <span>Bookings and invoices</span>
          </div>
          <div class="admin-customer-list" data-customer-list>${skeletons.list('customers')}</div>
        </div>
      </section>
    </div>
  `;
}

export async function initPage() {}

export function renderPage() {}

export function destroyPage() {}
