import { skeletons } from '../core/skeletons.js?v=20260821-2';

export const page = 'organization';

const weekdays = [
  [1, 'Monday'],
  [2, 'Tuesday'],
  [3, 'Wednesday'],
  [4, 'Thursday'],
  [5, 'Friday'],
  [6, 'Saturday'],
  [7, 'Sunday']
];

export function renderStaticPage(root) {
  root.innerHTML = `
    <section class="admin-workbench admin-organization-workbench">
      <section class="admin-panel admin-organization-shell" aria-labelledby="organization-page-title">
        <header class="admin-panel-header admin-panel-header-compact admin-workspace-header admin-organization-workspace-header">
          <div class="admin-page-title">
            <h1 id="organization-page-title">Organization</h1>
          </div>
        </header>

        <div class="admin-organization-sections">
          <section class="admin-organization-section" aria-labelledby="organization-invoice-title">
            <header class="admin-organization-section-header">
            <div>
              <h2 id="organization-invoice-title">Invoice details</h2>
            </div>
            </header>
            <div data-organization-invoice-loading>
              ${skeletons.formFields(11, { wideEvery: 4 })}
            </div>
            <form class="admin-organization-form" data-organization-settings-form data-organization-invoice-content novalidate hidden>
              <fieldset>
                <legend>Legal company details</legend>
                <div class="admin-organization-form-grid">
                  <label class="admin-field-wide"><span class="admin-field-label">Legal seller name <span class="admin-required-marker" aria-hidden="true">*</span></span><input name="sellerName" type="text" maxlength="180" autocomplete="organization" required></label>
                  <label class="admin-field-wide"><span class="admin-field-label">Registered address <span class="admin-required-marker" aria-hidden="true">*</span></span><textarea name="sellerAddress" maxlength="500" rows="2" autocomplete="street-address" required></textarea></label>
                  <label><span class="admin-field-label">Company code <span class="admin-required-marker" aria-hidden="true">*</span></span><input name="sellerCompanyCode" type="text" maxlength="80" autocomplete="off" required></label>
                  <label><span class="admin-field-label">VAT code</span><input name="sellerVatCode" type="text" maxlength="80" autocomplete="off"></label>
                  <label><span class="admin-field-label">Email <span class="admin-required-marker" aria-hidden="true">*</span></span><input name="sellerEmail" type="email" maxlength="254" autocomplete="email" required></label>
                  <label><span class="admin-field-label">Phone</span><input name="sellerPhone" type="tel" maxlength="50" autocomplete="tel"></label>
                </div>
              </fieldset>

              <fieldset>
                <legend>Bank details</legend>
                <div class="admin-organization-form-grid">
                  <label><span class="admin-field-label">Bank name <span class="admin-required-marker" aria-hidden="true">*</span></span><input name="bankName" type="text" maxlength="180" autocomplete="off" required></label>
                  <label><span class="admin-field-label">Account recipient <span class="admin-required-marker" aria-hidden="true">*</span></span><input name="bankRecipientName" type="text" maxlength="180" autocomplete="off" required></label>
                  <label><span class="admin-field-label">IBAN <span class="admin-required-marker" aria-hidden="true">*</span></span><input name="bankAccountIban" type="text" maxlength="42" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" required></label>
                  <label><span class="admin-field-label">SWIFT / BIC</span><input name="bankSwiftBic" type="text" maxlength="14" autocomplete="off" autocapitalize="characters" spellcheck="false"></label>
                  <label class="admin-field-wide"><span class="admin-field-label">Payment instructions</span><textarea name="paymentInstructions" maxlength="500" rows="2"></textarea></label>
                </div>
              </fieldset>

              <p class="admin-form-error" data-organization-settings-status role="status" aria-live="polite"></p>
              <div class="admin-action-buttons">
                <button class="admin-button admin-button-primary" type="submit" data-organization-settings-submit disabled>Save invoice details</button>
              </div>
            </form>
          </section>

          <section class="admin-organization-section" aria-labelledby="organization-confirmation-title">
            <header class="admin-organization-section-header">
              <div>
                <h2 id="organization-confirmation-title">Booking review window</h2>
              </div>
            </header>
            <div data-organization-schedule-loading>
              ${skeletons.confirmationSchedule()}
            </div>
            <form class="admin-confirmation-schedule-form admin-confirmation-schedule-page-form" data-confirmation-schedule-form data-organization-schedule-content novalidate hidden>
              <div class="admin-confirmation-settings">
                <label>
                  <span class="admin-field-label">Decision window <span class="admin-required-marker" aria-hidden="true">*</span></span>
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
                ${weekdays.map(([isoWeekday, label]) => `
                  <div class="admin-confirmation-day" data-confirmation-day="${isoWeekday}">
                    <label class="admin-checkbox admin-confirmation-day-toggle">
                      <input type="checkbox" name="confirmationDay${isoWeekday}" data-confirmation-day-enabled>
                      <span>${label}</span>
                    </label>
                    <label><span class="admin-field-label">From <span class="admin-required-marker" data-confirmation-time-required aria-hidden="true" hidden>*</span></span><input type="time" name="confirmationDay${isoWeekday}Start" step="900" data-confirmation-day-start></label>
                    <label><span class="admin-field-label">Until <span class="admin-required-marker" data-confirmation-time-required aria-hidden="true" hidden>*</span></span><input type="time" name="confirmationDay${isoWeekday}End" step="900" data-confirmation-day-end></label>
                  </div>
                `).join('')}
              </fieldset>
              <p class="admin-form-error" data-confirmation-schedule-status role="status" aria-live="polite"></p>
              <div class="admin-action-buttons">
                <button class="admin-button admin-button-primary" type="submit" data-confirmation-schedule-submit>Save review window</button>
              </div>
            </form>
          </section>
        </div>
      </section>
    </section>
  `;
}

export async function initPage() {}

export function renderPage() {}

export function destroyPage() {}
