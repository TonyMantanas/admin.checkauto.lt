import { ICONS } from '../core/icons.js?v=20261109-3';
import { skeletons } from '../core/skeletons.js?v=20261106-4';

export const page = 'availability';

export function renderStaticPage(root) {
  root.innerHTML = `
    <div class="admin-list-page admin-availability-calendar-layout">
      <header class="admin-page-header">
        <div>
          <h1 id="availability-page-title">Availability</h1>
        </div>
        <div class="admin-page-actions admin-availability-actions">
          <button
            class="admin-button admin-button-secondary admin-availability-add-button"
            type="button"
            data-admin-slot-open
            aria-label="Add availability slot"
            aria-haspopup="dialog"
            aria-controls="admin-slot-editor"
            title="Add slot"
            disabled
          >${ICONS.add}<span class="admin-availability-add-label">Add slot</span></button>
          <button
            class="admin-button admin-button-primary admin-availability-day-button"
            type="button"
            data-admin-day-schedule-open
            aria-label="Create day schedule"
            aria-haspopup="dialog"
            title="Create day schedule"
            disabled
          >${ICONS.add}<span>Create schedule</span></button>
        </div>
      </header>
      <section
        class="admin-card admin-card--flush admin-list-card admin-availability-calendar-panel"
        aria-labelledby="availability-page-title availability-calendar-title"
      >
        <div class="admin-card-toolbar admin-list-toolbar admin-calendar-toolbar">
          <div class="admin-calendar-nav">
            <button class="admin-button admin-button-secondary admin-icon-button" type="button" data-calendar-prev aria-label="Previous period" title="Previous period" disabled>${ICONS.previous}</button>
            <button class="admin-button admin-button-secondary" type="button" data-calendar-today disabled>Today</button>
            <button class="admin-button admin-button-secondary admin-icon-button" type="button" data-calendar-next aria-label="Next period" title="Next period" disabled>${ICONS.next}</button>
          </div>
          <p
            class="admin-calendar-range"
            id="availability-calendar-title"
            data-admin-calendar-title
            aria-live="polite"
            aria-atomic="true"
          >${skeletons.block('admin-skeleton-line admin-skeleton-calendar-range')}</p>
          <div class="admin-calendar-view-controls">
            <div class="admin-segmented" data-calendar-view role="group" aria-label="Availability calendar view">
              <button class="is-active" type="button" data-view="week" aria-pressed="true" disabled>Week</button>
              <button type="button" data-view="day" aria-pressed="false" disabled>Day</button>
            </div>
            <label class="admin-date-jump">
              <span>Jump to</span>
              <input type="date" autocomplete="off" data-calendar-date disabled>
            </label>
          </div>
        </div>
        <div
          class="admin-calendar"
          data-admin-calendar
          role="region"
          aria-label="Availability calendar"
         aria-busy="true"></div>
      </section>
    </div>

    <div class="admin-slot-editor-root" id="admin-slot-editor" data-admin-slot-editor hidden>
      <button
        class="admin-slot-editor-backdrop"
        type="button"
        data-admin-slot-editor-close
        aria-label="Close slot editor"
        tabindex="-1"
      ></button>
      <section
        class="admin-slot-editor-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-slot-editor-title"
        tabindex="-1"
      >
        <div class="admin-modal-header">
          <h2 id="admin-slot-editor-title" data-admin-slot-form-title>New slot</h2>
          <button
            class="admin-preview-close admin-icon-button"
            type="button"
            data-admin-slot-editor-close
            aria-label="Close slot editor"
            title="Close"
          >${ICONS.close}</button>
        </div>

        <form class="admin-slot-form admin-form-plain" data-admin-slot-form novalidate>
          <input type="hidden" name="slotId" data-admin-slot-id>
          <input type="hidden" name="serviceCode" value="all" data-admin-slot-service>
          <div class="admin-schedule-layout">
            <div class="admin-schedule-fields">
              <div class="admin-form-row admin-form-row-time">
                <label><span class="admin-field-label">Date</span><input name="date" type="date" required data-admin-slot-date></label>
                <label><span class="admin-field-label">From</span><input name="startTime" type="time" step="900" required data-admin-slot-start></label>
                <label><span class="admin-field-label">Until</span><input name="endTime" type="time" step="900" required data-admin-slot-end></label>
              </div>
              <p class="admin-slot-series" data-admin-slot-series hidden>${ICONS.repeat}<span>Repeating slot</span></p>
              <label><span class="admin-field-label">Inspector</span><span class="admin-select-wrap"><select name="assignedStaffId" data-admin-slot-staff></select></span></label>
              <div class="admin-field-group" data-admin-slot-repeat>
                <span class="admin-field-label">Repeat</span>
                <div class="admin-choice-group" role="radiogroup" aria-label="Repeat">
                  <label><input type="radio" name="repeat" value="none" checked><span>Doesn’t repeat</span></label>
                  <label><input type="radio" name="repeat" value="weekly"><span>Weekly</span></label>
                </div>
              </div>
              <div class="admin-schedule-repeat" data-schedule-repeat hidden>
                <div class="admin-field-group">
                  <span class="admin-field-label">On</span>
                  <div class="admin-filter-check-grid admin-weekday-pills" role="group" aria-label="Days of the week">
                    <label><input type="checkbox" name="weekday" value="1"><span>Mon</span></label>
                    <label><input type="checkbox" name="weekday" value="2"><span>Tue</span></label>
                    <label><input type="checkbox" name="weekday" value="3"><span>Wed</span></label>
                    <label><input type="checkbox" name="weekday" value="4"><span>Thu</span></label>
                    <label><input type="checkbox" name="weekday" value="5"><span>Fri</span></label>
                    <label><input type="checkbox" name="weekday" value="6"><span>Sat</span></label>
                    <label><input type="checkbox" name="weekday" value="7"><span>Sun</span></label>
                  </div>
                </div>
                <label><span class="admin-field-label">For</span><span class="admin-select-wrap"><select name="repeatWeeks" data-schedule-weeks>
                  <option value="2">2 weeks</option>
                  <option value="3">3 weeks</option>
                  <option value="4" selected>4 weeks</option>
                  <option value="6">6 weeks</option>
                  <option value="8">8 weeks</option>
                  <option value="12">12 weeks</option>
                </select></span></label>
              </div>
            </div>
            <section class="admin-schedule-preview" data-admin-slot-preview aria-label="Day preview" aria-live="polite"></section>
          </div>
          <div class="admin-form-error" data-admin-slot-error role="status" aria-live="polite"></div>
          <div class="admin-modal-footer admin-slot-editor-actions">
            <button class="admin-button admin-button-ghost admin-button-quiet-danger" type="button" data-admin-slot-delete hidden>Delete slot</button>
            <button class="admin-button admin-button-secondary" type="button" data-admin-slot-editor-close>Close</button>
            <button class="admin-button admin-button-primary" type="submit" data-admin-slot-submit>Add slot</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

export async function initPage() {}

export function renderPage() {}

export function destroyPage() {}
