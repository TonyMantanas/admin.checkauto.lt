export const page = 'customers';

export function renderStaticPage(root) {
  root.innerHTML = `
    <header class="admin-page-heading admin-page-heading-compact">
      <div class="admin-page-title">
        <h1>Customers</h1>
        <p class="admin-count" data-customer-count role="status" aria-live="polite"></p>
      </div>
    </header>

    <section class="admin-customer-layout">
      <section class="admin-panel admin-panel-full" aria-label="Customer profiles">
        <label class="admin-search">
          <span>Search customers</span>
          <input
            type="search"
            data-customer-search
            placeholder="Name, email, phone, booking, vehicle, or invoice"
            autocomplete="off"
          >
        </label>
        <div class="admin-customer-list" data-customer-list></div>
      </section>
    </section>
  `;
}

export async function initPage() {}

export function renderPage() {}

export function destroyPage() {}
