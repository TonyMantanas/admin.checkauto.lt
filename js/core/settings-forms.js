/* ==========================================================================
   Booking requests form

   One markup source for the response-time settings, used by the
   Organization page and by the dialog that opens from Availability. The
   runtime fills and saves it through the data-confirmation-* hooks.
   ========================================================================== */

const RESPONSE_TIMES = [
  [15, '15 minutes'],
  [30, '30 minutes'],
  [60, '1 hour'],
  [90, '1 hour 30 minutes'],
  [120, '2 hours'],
  [180, '3 hours'],
  [240, '4 hours'],
  [480, '8 hours'],
  [1440, '24 hours']
];

const WEEKDAYS = [
  [1, 'Monday'],
  [2, 'Tuesday'],
  [3, 'Wednesday'],
  [4, 'Thursday'],
  [5, 'Friday'],
  [6, 'Saturday'],
  [7, 'Sunday']
];

// 24-hour times in 15-minute steps, the same in every browser locale.
const QUARTER_HOURS = Array.from({ length: 96 }, (_, index) => {
  const value = String(Math.floor(index / 4)).padStart(2, '0') + ':' + String((index % 4) * 15).padStart(2, '0');
  return `<option value="${value}">${value}</option>`;
}).join('');

export function bookingRequestFieldsHtml() {
  return `
    <label class="admin-booking-request-time">
      <span class="admin-field-label">Time to respond <span class="admin-required-marker" aria-hidden="true">*</span></span>
      <span class="admin-select-wrap">
        <select name="confirmationDurationMinutes" data-confirmation-duration required>
          ${RESPONSE_TIMES.map(([minutes, label]) => `<option value="${minutes}">${label}</option>`).join('')}
        </select>
      </span>
    </label>
    <fieldset class="admin-booking-request-hours">
      <legend>Counted during</legend>
      <div class="admin-booking-request-head" aria-hidden="true"><span>Day</span><span>From</span><span>Until</span></div>
      ${WEEKDAYS.map(([isoWeekday, label]) => `
        <div class="admin-booking-request-day" data-confirmation-day="${isoWeekday}">
          <label class="admin-switch admin-confirmation-day-toggle">
            <input type="checkbox" name="confirmationDay${isoWeekday}" data-confirmation-day-enabled>
            <span class="admin-switch-track" aria-hidden="true"></span>
            <span>${label}</span>
          </label>
          <label>
            <span class="admin-field-label admin-booking-request-time-label">From <span class="admin-required-marker" data-confirmation-time-required aria-hidden="true" hidden>*</span></span>
            <span class="admin-select-wrap"><select name="confirmationDay${isoWeekday}Start" data-confirmation-day-start aria-label="${label} from">${QUARTER_HOURS}</select></span>
          </label>
          <label>
            <span class="admin-field-label admin-booking-request-time-label">Until <span class="admin-required-marker" data-confirmation-time-required aria-hidden="true" hidden>*</span></span>
            <span class="admin-select-wrap"><select name="confirmationDay${isoWeekday}End" data-confirmation-day-end aria-label="${label} until">${QUARTER_HOURS}</select></span>
          </label>
        </div>
      `).join('')}
      <p class="admin-booking-request-zone">Times are in <span data-confirmation-timezone>Europe/Vilnius</span>.</p>
    </fieldset>
  `;
}
