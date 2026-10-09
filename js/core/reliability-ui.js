import { moneyCents, vilniusCandidates } from './reliability.js?v=20261004-1';
export const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = value => new Intl.NumberFormat('en-GB',{style:'currency',currency:'EUR'}).format(Number(value || 0)/100);
const date = value => value ? new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Vilnius',dateStyle:'medium',timeStyle:'short'}).format(new Date(value)) : 'Unknown';
const hidden = (name,value) => `<input type="hidden" name="${name}" value="${esc(value)}">`;
const amountInput = (name,label,value='',required=true) => `<label><span class="admin-field-label">${label}${required ? ' <span class="admin-required-marker" aria-hidden="true">*</span>' : ''}</span><input name="${name}" type="text" inputmode="decimal"${required ? ' required' : ''} value="${esc(value)}" placeholder="0.00"></label>`;
const formEnd = label => `<div class="admin-form-error" data-action-error role="status" aria-live="polite"></div><button class="admin-button admin-button-secondary" type="submit">${label}</button></form>`;
const latest = (operations,id) => (operations?.quotes || []).filter(q=>q.booking_id===id).sort((a,b)=>b.revision-a.revision)[0];
export function currentAgreement(operations,id) { return latest(operations,id); }
export function invoiceDeliveredToClient(invoice,operations) {
  if (invoice?.invoice_status !== 'issued' || !invoice.customer_email) return false;
  const recipient=invoice.customer_email.trim().toLowerCase();
  return (operations?.notifications || []).some(notification=>notification.invoice_id===invoice.id && notification.kind==='invoice_customer' && notification.status==='delivered' && String(notification.recipient_email || '').trim().toLowerCase()===recipient);
}
export function priceFields(agreement,revision=false,compact=false) {
  return `<fieldset class="admin-price-agreement"><legend>${compact ? (revision ? 'Edit agreed price' : 'Agreed price') : 'Customer agreement'}</legend><div class="admin-action-grid">${amountInput('serviceAmount','Service amount (€)',agreement ? (agreement.service_amount_cents/100).toFixed(2) : '')}${amountInput('travelAmount','Travel fee (€)',agreement ? (agreement.travel_amount_cents/100).toFixed(2) : '',false)}</div><p data-price-total${compact ? ' data-compact="true"' : ''} role="status">${compact ? '' : 'Enter the service amount.'}</p><label class="admin-checkbox-row"><input name="customerAgreed" type="checkbox" required><span>${compact ? 'Customer agreed to this total' : 'I confirm the customer agreed to this final total.'} <span class="admin-required-marker" aria-hidden="true">*</span></span></label><label data-price-note data-revision="${revision}"${revision ? '' : ' hidden'}><span class="admin-field-label">${revision ? 'Reason for revision' : 'Reason for a free service'} <span class="admin-required-marker" aria-hidden="true">*</span></span><textarea name="priceReason" maxlength="1000"${revision ? ' required' : ''}></textarea></label>${compact ? '' : '<small>The final amount includes any VAT selected when invoicing.</small>'}</fieldset>`;
}
export function bindPriceTotals(root) {
  root.querySelectorAll('[name="occurredLocal"],[name="refundOccurredLocal"]').forEach(input=>{
    if(input.dataset.timeChoiceBound) return;input.dataset.timeChoiceBound='true';
    const form=input.form,select=form.elements[input.name==='occurredLocal' ? 'paymentFold' : 'refundFold'];
    if(!select)return;
    const update=()=>{const [day,time]=input.value.split('T'),ambiguous=vilniusCandidates(day || '',time || '').length===2;select.closest('label').hidden=!ambiguous;select.required=ambiguous;if(!ambiguous)select.value='';};
    input.addEventListener('input',update);update();
  });
  root.querySelectorAll('[data-price-total]').forEach(target=>{
    const form=target.closest('form');
    const update=()=>{const service=moneyCents(form.elements.serviceAmount?.value),travel=moneyCents(form.elements.travelAmount?.value?.trim() ? form.elements.travelAmount.value : '0');target.textContent=service===null||travel===null ? (target.dataset.compact==='true' ? '' : 'Enter the service amount and a valid travel fee.') : `${target.dataset.compact==='true' ? 'Total: ' : 'Final customer amount: '}${money(service+travel)}`;const note=form.querySelector('[data-price-note]');if(note){note.hidden=note.dataset.revision!=='true' && !(service===0 && travel===0);note.querySelector('textarea').disabled=note.hidden;note.querySelector('textarea').required=!note.hidden;}};
    form.addEventListener('input',update);update();
  });
  root.querySelectorAll('[data-action="correctPayment"]').forEach(form=>{
    const movement=form.querySelector('[data-payment-movement]');if(!movement)return;
    const update=()=>{movement.hidden=moneyCents(form.elements.paidAmount.value,true)===0;movement.disabled=movement.hidden;};
    form.addEventListener('input',update);update();
  });
}
export function priceSection(booking,operations,canManage,hasInvoice=false) {
  if (booking.status === 'pending') return '';
  const quotes=(operations?.quotes || []).filter(q=>q.booking_id===booking.id).sort((a,b)=>b.revision-a.revision), agreement=quotes[0];
  const canEdit=canManage && !hasInvoice && !operations?.detail_pending && ['confirmed','completed'].includes(booking.status);
  return `<section class="admin-detail-section admin-agreed-price-section">
    <div class="admin-agreed-price-heading"><h2>Agreed price</h2>${canEdit ? `<button class="admin-icon-button admin-agreed-price-edit" type="button" data-price-edit-toggle aria-label="${agreement ? 'Edit agreed price' : 'Set agreed price'}" aria-expanded="false" aria-controls="booking-price-editor" title="${agreement ? 'Edit agreed price' : 'Set agreed price'}"><span class="admin-icon admin-icon-pencil" aria-hidden="true"></span></button>` : ''}</div>
    ${agreement ? `<p class="admin-agreed-price-summary"><strong>${money(agreement.total_amount_cents)}</strong><span>Service ${money(agreement.service_amount_cents)} · travel ${money(agreement.travel_amount_cents)}</span></p>` : (operations?.detail_pending ? '<p role="status">Loading agreed price…</p>' : '<p>No agreed price recorded.</p>')}
    ${canEdit ? `<div class="admin-agreed-price-editor" id="booking-price-editor" hidden><form class="admin-action-form" data-admin-action-form data-action="recordAgreedPrice">${hidden('bookingId',booking.id)}${priceFields(agreement,Boolean(agreement),true)}${formEnd('Save agreed price')}</div>` : ''}
    ${quotes.length > 1 ? `<details class="admin-disclosure admin-price-history"><summary>Price history</summary>${quotes.map(q=>`<p>Revision ${q.revision}: ${money(q.total_amount_cents)} · ${esc(date(q.agreed_at))}${q.revision_reason ? `<br>${esc(q.revision_reason)}` : ''}</p>`).join('')}</details>` : ''}
  </section>`;
}
function paymentForm(bookingId,kind,entries,inline=false) {
  const label={recordPayment:'Record money received',recordRefund:'Record a refund',correctPayment:'Correct an entry'}[kind];
  const form=`<form class="admin-action-form" data-admin-action-form data-action="${kind}">${hidden('bookingId',bookingId)}${kind==='correctPayment' ? `<label><span class="admin-field-label">Original entry <span class="admin-required-marker" aria-hidden="true">*</span></span><select name="paymentEntryId" required><option value="">Choose an entry</option>${entries.filter(e=>['receipt','refund','opening_receipt'].includes(e.entry_kind)&&!entries.some(r=>r.reverses_entry_id===e.id)).map(e=>`<option value="${esc(e.id)}" data-method="${esc(e.method)}" data-occurred-at="${esc(e.occurred_at)}">${e.occurred_at_is_estimate ? 'Movement date unknown; opening record dated '+esc(date(e.occurred_at)) : esc(date(e.occurred_at))} · ${esc(e.entry_kind)} · ${money(Math.abs(e.signed_amount_cents))}</option>`).join('')}</select></label>` : ''}${amountInput('paidAmount',kind==='correctPayment' ? 'Corrected amount (€), including 0 to reverse a mistake' : 'Actual amount (€)')}<fieldset class="admin-payment-movement-fields" data-payment-movement><label>Payment method<select name="paymentMethod"><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="card">Card</option><option value="other">Other</option></select></label><label><span class="admin-field-label">${kind==='correctPayment' ? 'Date for the corrected entry (Vilnius)' : 'Date money moved (Vilnius)'} <span class="admin-required-marker" aria-hidden="true">*</span></span><input name="occurredLocal" type="datetime-local" required></label><label>For a repeated clock-change time<select name="paymentFold"><option value="">Choose if a time repeats</option><option value="first">First occurrence</option><option value="second">Second occurrence</option></select></label></fieldset><label><span class="admin-field-label">${kind==='recordPayment' ? 'Note' : 'Reason'}${kind==='recordPayment' ? '' : ' <span class="admin-required-marker" aria-hidden="true">*</span>'}</span><textarea name="paymentNote" maxlength="1000"${kind==='recordPayment' ? '' : ' required'}></textarea></label>${formEnd(label)}`;
  return inline ? `<div class="admin-payment-editor" id="booking-payment-${kind}" data-payment-action-panel="${kind}" hidden><h3>${label}</h3>${form}</div>` : `<details class="admin-disclosure"><summary>${label}</summary>${form}</details>`;
}
export function paymentSection(booking,operations,canBill,compact=false) {
  const entries=(operations?.payment_entries || []).filter(e=>e.booking_id===booking.id), summary=operations?.payment_summaries?.[booking.id];
  if (!canBill || booking.status === 'pending') return '';
  const editable=entries.filter(e=>['receipt','refund','opening_receipt'].includes(e.entry_kind)&&!entries.some(r=>r.reverses_entry_id===e.id));
  const actions=summary && booking.status==='completed' ? ['recordPayment',...(Number(summary.net_paid_cents)>0 ? ['recordRefund'] : []),...(editable.length ? ['correctPayment'] : [])] : [];
  const history=entries.map(e=>`<article class="admin-mini-item"><div><strong>${esc(String(e.entry_kind).replaceAll('_',' '))}: ${money(e.signed_amount_cents)}</strong><p>${e.occurred_at_is_estimate ? 'Movement date unknown; opening record dated '+esc(date(e.occurred_at)) : esc(date(e.occurred_at))} · ${esc(e.method)} · staff ${esc(e.actor_staff_id || 'Historical opening record')}</p><p>${esc(e.reason || '')}${e.reverses_entry_id ? ' · reversal of '+esc(e.reverses_entry_id) : ''}${e.correction_of_entry_id ? ' · correction of '+esc(e.correction_of_entry_id) : ''}</p></div></article>`).join('');
  if (compact) {
    const icons={recordPayment:'plus',recordRefund:'refund',correctPayment:'pencil'};
    const labels={recordPayment:'Record money received',recordRefund:'Record a refund',correctPayment:'Correct an entry'};
    return `<section class="admin-detail-section admin-payment-section"><div class="admin-payment-heading"><h2>Money received and refunds</h2>${actions.length || entries.length ? `<div class="admin-payment-actions" role="group" aria-label="Payment options">${actions.map(kind=>`<button class="admin-icon-button admin-payment-action" type="button" data-payment-action-choice="${kind}" aria-label="${labels[kind]}" title="${labels[kind]}" aria-expanded="false" aria-controls="booking-payment-${kind}"><span class="admin-icon admin-icon-${icons[kind]}" aria-hidden="true"></span></button>`).join('')}${entries.length ? `<button class="admin-icon-button admin-payment-action" type="button" data-payment-action-choice="history" aria-label="Payment history (${entries.length})" title="Payment history (${entries.length})" aria-expanded="false" aria-controls="booking-payment-history"><span class="admin-icon admin-icon-history" aria-hidden="true"></span></button>` : ''}</div>` : ''}</div>${summary ? `<div class="admin-payment-summary"><span>Received <strong>${money(summary.received_cents)}</strong></span>${Number(summary.refunded_cents)>0 ? `<span>Refunded <strong>${money(summary.refunded_cents)}</strong></span>` : ''}<span>Remaining <strong>${summary.agreed_or_invoiced_cents===null ? 'Unknown' : money(summary.remaining_cents)}</strong></span>${Number(summary.credit_cents)>0 ? `<span>Credit <strong>${money(summary.credit_cents)}</strong></span>` : ''}</div>${summary.unallocated_cents ? `<p class="admin-payment-alert" role="alert">${money(summary.unallocated_cents)} is not allocated to an invoice.</p>` : ''}` : '<p>Payment balance is unavailable. Refresh before recording money.</p>'}${actions.map(kind=>paymentForm(booking.id,kind,entries,true)).join('')}${entries.length ? `<div class="admin-payment-editor admin-payment-history" id="booking-payment-history" data-payment-action-panel="history" hidden><h3>Payment history (${entries.length})</h3>${history}</div>` : ''}</section>`;
  }
  return `<section class="admin-detail-section"><h2>Money received and refunds</h2>${summary ? `<div class="admin-detail-list"><p>Receipts: <strong>${money(summary.received_cents)}</strong></p><p>Refunds: <strong>${money(summary.refunded_cents)}</strong></p><p>Net paid: <strong>${money(summary.net_paid_cents)}</strong></p><p>Remaining: <strong>${summary.agreed_or_invoiced_cents===null ? 'Unknown' : money(summary.remaining_cents)}</strong> · credit ${money(summary.credit_cents)}</p><p>Status: ${esc(String(summary.state || '').replaceAll('_',' '))}</p>${summary.unallocated_cents ? `<p role="alert">${money(summary.unallocated_cents)} has no current invoice allocation. Use it on a later or replacement invoice, or record the actual refund separately.</p>` : ''}</div>` : '<p>Payment balance is unavailable. Refresh before recording money.</p>'}${actions.map(kind=>paymentForm(booking.id,kind,entries)).join('')}<details class="admin-disclosure"><summary>Permanent payment history (${entries.length})</summary>${history || '<p>No recorded money movements.</p>'}</details></section>`;
}
export function communicationStatusList(booking,operations) {
  const notifications=(operations?.notifications || []).filter(n=>n.booking_id===booking.id);
  const role = kind => kind.endsWith('_customer') ? 'Client' : kind.endsWith('_staff') || kind.endsWith('_admin') ? 'Staff' : 'Email';
  const status = value => String(value || 'unknown').replaceAll('_',' ');
  const tone = value => value === 'delivered' ? 'success' : ['bounced','failed','suppressed','needs_review'].includes(value) ? 'error' : ['delayed','queued','processing'].includes(value) ? 'warning' : 'neutral';
  return `<div class="admin-email-notification-list">${notifications.length ? notifications.map(n=>`<div class="admin-email-notification"><span>${role(n.kind)}</span><span class="admin-status-pill" data-status="${tone(n.status)}">${esc(status(n.status))}</span></div>`).join('') : `<p>${operations?.detail_pending ? 'Loading…' : 'No email notifications.'}</p>`}</div>`;
}
export function communicationSection(booking,operations) {
  return `<details class="admin-detail-section admin-disclosure admin-email-notifications"><summary>Email notifications</summary>${communicationStatusList(booking,operations)}</details>`;
}
function noteAction(action,idName,id,label) {
  return `<form class="admin-action-form" data-admin-action-form data-action="${action}">${hidden(idName,id)}<label>${action==='retryNotification' ? 'Reconciliation and reason for a new attempt' : 'Contact method and outcome'}<textarea name="note" required maxlength="1000"></textarea></label>${formEnd(label)}`;
}
