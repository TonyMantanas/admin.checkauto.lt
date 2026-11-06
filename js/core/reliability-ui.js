import { moneyCents, vilniusCandidates } from './reliability.js?v=20261106-6';
import { formatMoney } from './formatting.js?v=20261105-3';
export const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = value => formatMoney(value, 'EUR');
const latest = (operations,id) => (operations?.quotes || []).filter(q=>q.booking_id===id).sort((a,b)=>b.revision-a.revision)[0];
export function currentAgreement(operations,id) { return latest(operations,id); }
export function invoiceDeliveredToClient(invoice,operations) {
  if (invoice?.invoice_status !== 'issued' || !invoice.customer_email) return false;
  const recipient=invoice.customer_email.trim().toLowerCase();
  return (operations?.notifications || []).some(notification=>notification.invoice_id===invoice.id && notification.kind==='invoice_customer' && notification.status==='delivered' && String(notification.recipient_email || '').trim().toLowerCase()===recipient);
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
}
