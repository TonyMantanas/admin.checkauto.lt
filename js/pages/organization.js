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
      <header class="admin-page-header admin-organization-page-header">
        <div class="admin-page-title">
          <h1 id="organization-page-title">Organization</h1>
          <p>Invoice identity, payment details, and booking review hours.</p>
        </div>
      </header>

      <div class="admin-organization-sections">
        <section class="admin-panel admin-organization-panel" aria-labelledby="organization-invoice-title">
          <header class="admin-panel-header">
            <div>
              <h2 id="organization-invoice-title">Invoice details</h2>
              <p>These legal and bank details are copied into each new invoice.</p>
            </div>
          </header>
          <form class="admin-organization-form" data-organization-settings-form novalidate>
            <fieldset>
              <legend>Legal company details</legend>
              <div class="admin-organization-form-grid">
                <label class="admin-field-wide">Legal seller name<input name="sellerName" type="text" maxlength="180" autocomplete="organization" required></label>
                <label class="admin-field-wide">Registered address<textarea name="sellerAddress" maxlength="500" rows="3" autocomplete="street-address" required></textarea></label>
                <label>Company code<input name="sellerCompanyCode" type="text" maxlength="80" autocomplete="off" required></label>
                <label>VAT code <span class="admin-field-optional">Optional</span><input name="sellerVatCode" type="text" maxlength="80" autocomplete="off"></label>
                <label>Email<input name="sellerEmail" type="email" maxlength="254" autocomplete="email" required></label>
                <label>Phone <span class="admin-field-optional">Optional</span><input name="sellerPhone" type="tel" maxlength="50" autocomplete="tel"></label>
              </div>
            </fieldset>

            <fieldset>
              <legend>Bank details</legend>
              <div class="admin-organization-form-grid">
                <label>Bank name<input name="bankName" type="text" maxlength="180" autocomplete="off" required></label>
                <label>Account recipient<input name="bankRecipientName" type="text" maxlength="180" autocomplete="off" required></label>
                <label>IBAN<input name="bankAccountIban" type="text" maxlength="42" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" required></label>
                <label>SWIFT / BIC <span class="admin-field-optional">Optional</span><input name="bankSwiftBic" type="text" maxlength="14" autocomplete="off" autocapitalize="characters" spellcheck="false"></label>
                <label class="admin-field-wide">Payment instructions <span class="admin-field-optional">Optional</span><textarea name="paymentInstructions" maxlength="500" rows="3"></textarea></label>
              </div>
            </fieldset>

            <p class="admin-form-error" data-organization-settings-status role="status" aria-live="polite"></p>
            <div class="admin-action-buttons">
              <button class="admin-button admin-button-primary" type="submit" data-organization-settings-submit disabled>Save invoice details</button>
            </div>
          </form>
        </section>

        <section class="admin-panel admin-organization-panel" aria-labelledby="organization-confirmation-title">
          <header class="admin-panel-header">
            <div>
              <h2 id="organization-confirmation-title">Booking confirmation schedule</h2>
              <p>Set how long a customer request remains open and when review time counts.</p>
            </div>
          </header>
          <form class="admin-confirmation-schedule-form admin-confirmation-schedule-page-form" data-confirmation-schedule-form novalidate>
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
              ${weekdays.map(([isoWeekday, label]) => `
                <div class="admin-confirmation-day" data-confirmation-day="${isoWeekday}">
                  <label class="admin-checkbox admin-confirmation-day-toggle">
                    <input type="checkbox" name="confirmationDay${isoWeekday}" data-confirmation-day-enabled>
                    <span>${label}</span>
                  </label>
                  <label><span>From</span><input type="time" name="confirmationDay${isoWeekday}Start" step="900" data-confirmation-day-start></label>
                  <label><span>Until</span><input type="time" name="confirmationDay${isoWeekday}End" step="900" data-confirmation-day-end></label>
                </div>
              `).join('')}
            </fieldset>
            <p class="admin-form-error" data-confirmation-schedule-status role="status" aria-live="polite"></p>
            <div class="admin-action-buttons">
              <button class="admin-button admin-button-primary" type="submit" data-confirmation-schedule-submit>Save confirmation schedule</button>
            </div>
          </form>
        </section>
      </div>
    </section>
  `;
}

export async function initPage() {}

export function renderPage() {}

export function destroyPage() {}
