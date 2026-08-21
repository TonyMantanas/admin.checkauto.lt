function block(className) {
  return `<span class="admin-skeleton ${className || ''}" aria-hidden="true"></span>`;
}

function listRow(columns, index) {
  return `
    <div class="admin-data-row admin-skeleton-row" aria-hidden="true" style="--admin-skeleton-delay: ${index * 70}ms">
      ${columns.map((column, columnIndex) => {
        if (column === 'admin-row-primary') {
          return `<span class="${column} admin-skeleton-primary">${block('admin-skeleton-line admin-skeleton-line-wide')}${block('admin-skeleton-line admin-skeleton-line-medium')}</span>`;
        }
        if (column === 'admin-row-status') {
          return `<span class="${column}">${block('admin-skeleton-pill')}</span>`;
        }
        return `<span class="${column}">${block(`admin-skeleton-line ${columnIndex % 2 ? 'admin-skeleton-line-medium' : 'admin-skeleton-line-short'}`)}</span>`;
      }).join('')}
    </div>
  `;
}

function list(kind, count = 6) {
  const columns = {
    bookings: ['admin-row-primary', 'admin-row-status', 'admin-row-service', 'admin-row-date', 'admin-row-meta'],
    customers: ['admin-row-primary', 'admin-row-status', 'admin-row-service', 'admin-row-meta'],
    invoices: ['admin-row-primary', 'admin-row-status', 'admin-row-service', 'admin-row-date', 'admin-row-amount', 'admin-row-meta']
  }[kind] || ['admin-row-primary', 'admin-row-status', 'admin-row-meta'];

  return Array.from({ length: count }, (_, index) => listRow(columns, index)).join('');
}

function stats() {
  return Array.from({ length: 3 }, (_, index) => `
    <div class="admin-stat admin-skeleton-stat" aria-hidden="true" style="--admin-skeleton-delay: ${index * 90}ms">
      ${block('admin-skeleton-line admin-skeleton-line-wide')}
      ${block('admin-skeleton-number')}
    </div>
  `).join('');
}

function calendarDay(index) {
  const eventCount = index % 3 === 0 ? 2 : 1;
  return `
    <div class="admin-skeleton-calendar-day">
      ${Array.from({ length: eventCount }, (_, eventIndex) => block(`admin-skeleton-calendar-event admin-skeleton-calendar-event-${(index + eventIndex) % 3 + 1}`)).join('')}
    </div>
  `;
}

function calendar() {
  return `
    <div class="admin-calendar-skeleton" aria-hidden="true">
      <div class="admin-skeleton-calendar-scroll">
        <div class="admin-skeleton-calendar-grid">
          <div class="admin-skeleton-calendar-head">
            <span></span>
            ${Array.from({ length: 7 }, (_, index) => block(`admin-skeleton-calendar-label admin-skeleton-calendar-label-${index + 1}`)).join('')}
          </div>
          <div class="admin-skeleton-calendar-body">
            <div class="admin-skeleton-calendar-times">
              ${Array.from({ length: 7 }, () => block('admin-skeleton-calendar-time')).join('')}
            </div>
            <div class="admin-skeleton-calendar-days">
              ${Array.from({ length: 7 }, (_, index) => calendarDay(index)).join('')}
            </div>
          </div>
        </div>
      </div>
      <div class="admin-skeleton-calendar-agenda">
        ${Array.from({ length: 5 }, (_, index) => `
          <div class="admin-skeleton-agenda-row" style="--admin-skeleton-delay: ${index * 70}ms">
            ${block('admin-skeleton-line admin-skeleton-line-short')}
            <span class="admin-skeleton-agenda-copy">${block('admin-skeleton-line admin-skeleton-line-wide')}${block('admin-skeleton-line admin-skeleton-line-medium')}</span>
            ${block('admin-skeleton-pill')}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function campaigns(count = 4) {
  return Array.from({ length: count }, (_, index) => `
    <div class="admin-mini-item admin-skeleton-mini-item" aria-hidden="true" style="--admin-skeleton-delay: ${index * 80}ms">
      <span>${block('admin-skeleton-line admin-skeleton-line-wide')}</span>
      <span>${block('admin-skeleton-pill')}</span>
      <span>${block('admin-skeleton-line admin-skeleton-line-medium')}</span>
      <span>${block('admin-skeleton-line admin-skeleton-line-wide')}</span>
    </div>
  `).join('');
}

function formFields(count = 6, options = {}) {
  const wideEvery = Math.max(0, Number(options.wideEvery) || 0);
  return `
    <div class="admin-skeleton-form-grid" aria-hidden="true">
      ${Array.from({ length: count }, (_, index) => `
        <div class="admin-skeleton-field${wideEvery && (index + 1) % wideEvery === 0 ? ' admin-skeleton-field-wide' : ''}" style="--admin-skeleton-delay: ${index * 45}ms">
          ${block(`admin-skeleton-line ${index % 3 === 0 ? 'admin-skeleton-line-medium' : 'admin-skeleton-line-short'}`)}
          ${block(`admin-skeleton-control${index % 4 === 1 ? ' admin-skeleton-control-tall' : ''}`)}
        </div>
      `).join('')}
    </div>
  `;
}

function confirmationSchedule() {
  return `
    <div class="admin-skeleton-confirmation" aria-hidden="true">
      <div class="admin-skeleton-confirmation-settings">
        <div class="admin-skeleton-field">
          ${block('admin-skeleton-line admin-skeleton-line-medium')}
          ${block('admin-skeleton-control')}
        </div>
        <div class="admin-skeleton-field">
          ${block('admin-skeleton-line admin-skeleton-line-short')}
          ${block('admin-skeleton-line admin-skeleton-line-wide')}
        </div>
      </div>
      <div class="admin-skeleton-confirmation-week">
        ${Array.from({ length: 7 }, (_, index) => `
          <div class="admin-skeleton-confirmation-day" style="--admin-skeleton-delay: ${index * 45}ms">
            ${block('admin-skeleton-square')}
            ${block('admin-skeleton-line admin-skeleton-line-medium')}
            ${block('admin-skeleton-control')}
            ${block('admin-skeleton-control')}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function preview() {
  return `
    <div class="admin-skeleton-preview" data-admin-preview-skeleton role="status" aria-label="Loading email preview">
      <div aria-hidden="true">
        ${block('admin-skeleton-line admin-skeleton-line-medium')}
        ${block('admin-skeleton-line admin-skeleton-line-wide')}
        ${block('admin-skeleton-line admin-skeleton-line-wide')}
        ${block('admin-skeleton-line admin-skeleton-line-short')}
        ${block('admin-skeleton-preview-block')}
        ${block('admin-skeleton-line admin-skeleton-line-wide')}
      </div>
    </div>
  `;
}

export const skeletons = Object.freeze({
  block,
  calendar,
  campaigns,
  confirmationSchedule,
  formFields,
  list,
  preview,
  stats
});
