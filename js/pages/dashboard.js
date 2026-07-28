import { ICONS } from '../core/icons.js?v=20260727-3';

export const page = 'dashboard';

export function renderStaticPage(root) {
  root.innerHTML = `
    <header class="admin-dashboard-summary">
      <h1>Dashboard</h1>
      <section class="admin-stats" data-admin-stats aria-label="Today at a glance"></section>
    </header>

    <section class="admin-dashboard-grid">
      <section class="admin-panel admin-calendar-panel" aria-labelledby="dashboard-schedule-title">
        <div class="admin-panel-header admin-panel-header-compact">
          <h2 id="dashboard-schedule-title" data-admin-calendar-title>Today</h2>
          <div class="admin-calendar-controls">
            <button class="admin-button admin-button-secondary admin-icon-button" type="button" data-calendar-prev aria-label="Previous period" title="Previous period">${ICONS.previous}</button>
            <button class="admin-button admin-button-secondary" type="button" data-calendar-today>Today</button>
            <button class="admin-button admin-button-secondary admin-icon-button" type="button" data-calendar-next aria-label="Next period" title="Next period">${ICONS.next}</button>
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
        <div class="admin-calendar" data-admin-calendar role="region" aria-label="Schedule calendar"></div>
      </section>
    </section>
  `;
}

export function afterInit() {}

export async function initPage() {}

export function renderPage() {}

export function destroyPage() {}
