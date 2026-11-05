import { skeletons } from '../core/skeletons.js?v=20260821-2';
import { bookingRequestFieldsHtml } from '../core/settings-forms.js?v=20261105-5';

export const page = 'organization';

const optional = '<span class="admin-optional">(optional)</span>';

function field(label, control, options = {}) {
  return `<label${options.wide ? ' class="admin-field-wide"' : ''}><span class="admin-field-label">${label}${options.optional ? ' ' + optional : ' <span class="admin-required-marker" aria-hidden="true">*</span>'}</span>${control}</label>`;
}

export function renderStaticPage(root) {
  root.innerHTML = `
    <div class="admin-page-body admin-page-narrow admin-organization-page">
      <header class="admin-page-header">
        <div>
          <h1 id="organization-page-title">Organization</h1>
        </div>
      </header>

      <div class="admin-page-body">
        <section class="admin-card" aria-labelledby="organization-invoice-title">
          <header class="admin-card-head">
            <div>
              <h2 id="organization-invoice-title">Invoice details</h2>
              <p>Shown on every invoice.</p>
            </div>
            <span class="admin-chip" data-tone="warning" data-organization-readiness hidden></span>
          </header>
          <div data-organization-invoice-loading>
            ${skeletons.formFields(10, { wideEvery: 5 })}
          </div>
          <form class="admin-organization-form admin-form-plain" data-organization-settings-form data-organization-invoice-content novalidate hidden>
            <fieldset class="admin-form-group">
              <legend>Company</legend>
              ${field('Company name', '<input name="sellerName" type="text" maxlength="180" autocomplete="organization" required>', { wide: true })}
              ${field('Company code', '<input name="sellerCompanyCode" type="text" maxlength="80" autocomplete="off" required>')}
              ${field('VAT code', '<input name="sellerVatCode" type="text" maxlength="80" autocomplete="off">', { optional: true })}
              ${field('Address', '<textarea name="sellerAddress" maxlength="500" rows="2" autocomplete="street-address" required></textarea>', { wide: true })}
              ${field('Email', '<input name="sellerEmail" type="email" maxlength="254" autocomplete="email" required>')}
              ${field('Phone', '<input name="sellerPhone" type="tel" maxlength="50" autocomplete="tel">', { optional: true })}
            </fieldset>

            <fieldset class="admin-form-group">
              <legend>Bank</legend>
              ${field('Bank', '<input name="bankName" type="text" maxlength="180" autocomplete="off" required>')}
              ${field('Account holder', '<input name="bankRecipientName" type="text" maxlength="180" autocomplete="off" required>')}
              ${field('IBAN', '<input name="bankAccountIban" type="text" maxlength="42" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" required>')}
              ${field('SWIFT / BIC', '<input name="bankSwiftBic" type="text" maxlength="14" autocomplete="off" autocapitalize="characters" spellcheck="false">', { optional: true })}
              ${field('Payment note', '<textarea name="paymentInstructions" maxlength="500" rows="2"></textarea>', { wide: true, optional: true })}
            </fieldset>

            <div class="admin-card-footer">
              <p class="admin-form-error" data-organization-settings-status role="status" aria-live="polite"></p>
              <button class="admin-button admin-button-primary" type="submit" data-organization-settings-submit aria-label="Save invoice details" disabled>Save</button>
            </div>
          </form>
        </section>

        <section class="admin-card" aria-labelledby="organization-booking-requests-title">
          <header class="admin-card-head">
            <div>
              <h2 id="organization-booking-requests-title">Booking requests</h2>
              <p>How long you have to accept a new request, and when that time counts.</p>
            </div>
          </header>
          <div data-organization-schedule-loading>
            ${skeletons.confirmationSchedule()}
          </div>
          <form class="admin-booking-request-form admin-form-plain" data-confirmation-schedule-form data-organization-schedule-content novalidate hidden>
            ${bookingRequestFieldsHtml()}
            <div class="admin-card-footer">
              <p class="admin-form-error" data-confirmation-schedule-status role="status" aria-live="polite"></p>
              <button class="admin-button admin-button-primary" type="submit" data-confirmation-schedule-submit aria-label="Save booking request settings" disabled>Save</button>
            </div>
          </form>
        </section>
      </div>
    </div>
  `;
}

export async function initPage() {}

export function renderPage() {}

export function destroyPage() {}
