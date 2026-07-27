import { ICONS } from '../core/icons.js?v=20260727-3';

export const page = 'availability';

export function renderStaticPage(root) {
  root.innerHTML = `
    <header class="admin-page-heading admin-page-heading-compact">
      <h1>Availability</h1>
      <div class="admin-page-actions">
        <button
          class="admin-button admin-button-secondary admin-icon-button"
          type="button"
          data-confirmation-schedule-jump
          aria-label="Go to confirmation schedule"
          title="Confirmation schedule"
        >${ICONS.booking}</button>
        <button
          class="admin-button admin-button-primary"
          type="button"
          data-admin-slot-open
          aria-haspopup="dialog"
          aria-controls="admin-slot-editor"
        >${ICONS.add}<span>Add slot</span></button>
      </div>
    </header>

    <section class="admin-availability-calendar-layout">
      <section class="admin-panel admin-calendar-panel admin-availability-calendar-panel" aria-labelledby="availability-calendar-title">
        <div class="admin-panel-header admin-panel-header-compact">
          <h2 id="availability-calendar-title" data-admin-calendar-title>Availability</h2>
          <div class="admin-calendar-controls">
            <button class="admin-button admin-button-secondary admin-icon-button" type="button" data-calendar-prev aria-label="Previous period" title="Previous period">${ICONS.previous}</button>
            <button class="admin-button admin-button-secondary" type="button" data-calendar-today>Today</button>
            <button class="admin-button admin-button-secondary admin-icon-button" type="button" data-calendar-next aria-label="Next period" title="Next period">${ICONS.next}</button>
            <div class="admin-segmented" data-calendar-view role="group" aria-label="Availability calendar view">
              <button class="is-active" type="button" data-view="week" aria-pressed="true">Week</button>
              <button type="button" data-view="day" aria-pressed="false">Day</button>
            </div>
            <label class="admin-date-jump">
              <span>Jump to</span>
              <input type="date" autocomplete="off" data-calendar-date>
            </label>
          </div>
        </div>
        <div class="admin-calendar-legend" id="availability-calendar-legend" data-admin-calendar-legend></div>
        <div
          class="admin-calendar"
          data-admin-calendar
          role="region"
          aria-label="Availability calendar"
          aria-describedby="availability-calendar-legend"
        ></div>
      </section>
    </section>

    <section
      class="admin-panel admin-confirmation-schedule-panel"
      aria-labelledby="confirmation-schedule-title"
      data-confirmation-schedule-panel
      tabindex="-1"
    >
      <div class="admin-panel-header">
        <div class="admin-confirmation-schedule-heading">
          <h2 id="confirmation-schedule-title">Confirmation schedule</h2>
          <p>Pending bookings count down only during this review time. Appointment availability is separate.</p>
        </div>
        <span class="admin-status-pill" data-confirmation-schedule-access>Owner managed</span>
      </div>

      <form class="admin-confirmation-schedule-form" data-confirmation-schedule-form novalidate>
        <div class="admin-confirmation-settings">
          <label>
            <span>Time to confirm</span>
            <span class="admin-select-wrap">
              <select name="confirmationDurationMinutes" data-confirmation-duration required>
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
                <option value="90">1 hour 30 minutes</option>
                <option value="120">2 hours</option>
                <option value="180">3 hours</option>
                <option value="240">4 hours</option>
                <option value="480">8 hours</option>
                <option value="1440">24 hours</option>
              </select>
            </span>
          </label>
          <div class="admin-confirmation-timezone">
            <span>Time zone</span>
            <strong data-confirmation-timezone>Europe/Vilnius</strong>
          </div>
        </div>

        <fieldset class="admin-confirmation-week">
          <legend>Review hours</legend>
          ${[
            [1, 'Monday'],
            [2, 'Tuesday'],
            [3, 'Wednesday'],
            [4, 'Thursday'],
            [5, 'Friday'],
            [6, 'Saturday'],
            [7, 'Sunday']
          ].map(([isoWeekday, label]) => `
            <div class="admin-confirmation-day" data-confirmation-day="${isoWeekday}">
              <label class="admin-checkbox admin-confirmation-day-toggle">
                <input type="checkbox" name="confirmationDay${isoWeekday}" data-confirmation-day-enabled>
                <span>${label}</span>
              </label>
              <label>
                <span>From</span>
                <input type="time" name="confirmationDay${isoWeekday}Start" step="900" data-confirmation-day-start>
              </label>
              <label>
                <span>Until</span>
                <input type="time" name="confirmationDay${isoWeekday}End" step="900" data-confirmation-day-end>
              </label>
            </div>
          `).join('')}
        </fieldset>

        <div class="admin-form-error" data-confirmation-schedule-status role="status" aria-live="polite"></div>
        <div class="admin-action-buttons">
          <button class="admin-button admin-button-secondary" type="submit" data-confirmation-schedule-submit>Save schedule</button>
        </div>
      </form>
    </section>

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

        <form class="admin-slot-form" data-admin-slot-form novalidate>
          <input type="hidden" name="slotId" data-admin-slot-id>
          <input type="hidden" name="serviceCode" value="all" data-admin-slot-service>
          <label>Date<input name="date" type="date" required data-admin-slot-date></label>
          <fieldset class="admin-time-range">
            <legend>Time</legend>
            <label><span>Start</span><span class="admin-select-wrap"><select name="startTime" required data-admin-slot-start></select></span></label>
            <label><span>End</span><span class="admin-select-wrap"><select name="endTime" required data-admin-slot-end></select></span></label>
          </fieldset>
          <label>Assign to<span class="admin-select-wrap"><select name="assignedStaffId" data-admin-slot-staff></select></span></label>
          <label class="admin-field-wide">Note<input name="internalNote" type="text" maxlength="500" placeholder="Optional internal note"></label>
          <fieldset class="admin-repeat">
            <label class="admin-checkbox admin-repeat-toggle">
              <input type="checkbox" name="repeatWeekly" data-admin-repeat-toggle>
              <span>Repeat weekly</span>
            </label>
            <label data-admin-repeat-weeks-wrap>Weeks<span class="admin-select-wrap"><select name="repeatWeeks" data-admin-repeat-weeks disabled>
              <option value="2">2 weeks</option>
              <option value="3">3 weeks</option>
              <option value="4" selected>4 weeks</option>
              <option value="6">6 weeks</option>
              <option value="8">8 weeks</option>
            </select></span></label>
          </fieldset>
          <p class="admin-slot-mode-note" data-admin-slot-mode-note>Choose a date and time for this slot.</p>
          <div class="admin-form-error" data-admin-slot-error role="status" aria-live="polite"></div>
          <div class="admin-action-buttons">
            <button class="admin-button admin-button-primary" type="submit" data-admin-slot-submit>Create slot</button>
            <button class="admin-button admin-button-secondary" type="button" data-admin-slot-reset hidden>New slot</button>
            <button class="admin-button admin-button-danger" type="button" data-admin-slot-delete hidden>Delete slot</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

export async function initPage() {}

export function renderPage() {}

export function destroyPage() {}
