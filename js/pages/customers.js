import { skeletons } from '../core/skeletons.js?v=20260802-1';

export const page = 'customers';

export function renderStaticPage(root) {
  root.innerHTML = `
    <section class="admin-customer-layout">
      <section class="admin-panel admin-panel-full" aria-label="Customer profiles">
        <div class="admin-panel-header admin-workspace-header admin-customers-workspace-header">
          <div class="admin-page-title">
            <h1>Customers</h1>
            <p class="admin-count" data-customer-count role="status" aria-live="polite">${skeletons.block('admin-skeleton-line admin-skeleton-count')}</p>
          </div>
          <label class="admin-search admin-search-compact">
            <span>Search customers</span>
            <input
              type="search"
              data-customer-search
              placeholder="Name, email, phone, or reference"
              autocomplete="off"
              disabled
            >
          </label>
        </div>
        <div class="admin-customer-list" data-customer-list>${skeletons.list('customers')}</div>
      </section>
    </section>
  `;
}

export async function initPage() {}

export function renderPage() {}

export function destroyPage() {}
