import { esc, bindPriceTotals } from './reliability-ui.js?v=20261106-7';
import { PATHS } from './routes.js?v=20261105-7';
import { ICONS } from './icons.js?v=20261106-5';
import { formatMoney, formatDateTime, formatDay, relativeDateTime } from './formatting.js?v=20261105-3';

const money = cents => formatMoney(cents, 'EUR');
const when = value => value ? formatDateTime(value) : 'Not yet recorded';
const day = value => formatDay(value);
const hidden = (name, value) => `<input type="hidden" name="${name}" value="${esc(value)}">`;
const endForm = label => `<p class="admin-form-error" data-action-error role="status" aria-live="polite"></p><button class="admin-button admin-button-primary" type="submit">${label}</button></form>`;
const link = (path, key, id) => `${path}?${key}=${encodeURIComponent(id)}`;
const typeLabel = kind => kind==='contact_inquiry_admin' ? 'Contact inquiry' : ({pending:'New booking request',confirmed:'Booking confirmation',rejected:'Booking rejection',cancelled:'Booking cancellation',expired:'Expired request',price:'Price agreement'})[String(kind).split('_')[1]] || (kind==='invoice_customer' ? 'Invoice email' : 'Customer email');
const statusLabel = status => ({failed:'Send failed',bounced:'Email bounced',suppressed:'Email was suppressed',needs_review:'Delivery needs review',accepted:'Delivery unconfirmed',delayed:'Delivery delayed',queued:'Email is overdue',processing:'Email processing stalled'})[status] || status;

function row({id, category, icon, title, description, action, details=''}) {
  return `<article class="admin-notification-item${details ? ' has-review' : ''}" data-notification-item data-category="${category}" data-item-id="${esc(id)}">
    <span class="admin-notification-icon" aria-hidden="true">${icon || ICONS.alert}</span>
    <div class="admin-notification-copy"><h2>${title}</h2><p>${description}</p></div>
    ${details ? `<details class="admin-notification-review" data-review-id="${esc(id)}"><summary class="admin-button admin-button-secondary">${action}</summary><div class="admin-notification-review-body">${details}</div></details>` : action}
  </article>`;
}

const choice = (name, value, label, attrs='') => `<label><input type="radio" name="${name}" value="${value}" required ${attrs}><span>${label}</span></label>`;
const recordLinks = (bookingId, invoiceId) => [
  invoiceId ? `<a class="admin-context-action" href="${link(PATHS.invoices,'invoice',invoiceId)}">${ICONS.invoice}<span>Open invoice</span></a>` : '',
  bookingId ? `<a class="admin-context-action" href="${link(PATHS.bookings,'booking',bookingId)}">${ICONS.booking}<span>Open booking</span></a>` : ''
].filter(Boolean).join('');

function reconciliationForm(c) {
  return `<div class="admin-notification-links">${recordLinks(null, c.invoice_id)}</div>
    <form class="admin-action-form admin-form-plain" data-admin-action-form data-action="resolvePaymentReconciliation">${hidden('invoiceId',c.invoice_id)}
    <fieldset class="admin-choice-list" data-reconciliation-outcome><legend class="admin-field-label">What happened to the money?</legend>
      ${choice('disposition','retained_payment','We received it and kept it')}
      ${choice('disposition','already_refunded','We received it and refunded it')}
      ${choice('disposition','duplicate_or_incorrect','The payment record is wrong')}
    </fieldset>
    <fieldset class="admin-notification-refund" data-refund-fields hidden disabled><legend class="admin-field-label">The refund</legend>
      <div class="admin-form-row"><label><span class="admin-field-label">Refunded on</span><input name="refundOccurredLocal" type="datetime-local" required></label>
      <label><span class="admin-field-label">Method</span><span class="admin-select-wrap"><select name="refundMethod" required><option value="">Choose…</option><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="card">Card</option><option value="other">Other</option></select></span></label></div>
      <label hidden>When clocks go back<span class="admin-select-wrap"><select name="refundFold"><option value="">Choose if a time repeats</option><option value="first">First occurrence (summer time)</option><option value="second">Second occurrence (winter time)</option></select></span></label>
    </fieldset>
    <label data-outcome-note hidden><span class="admin-field-label">How you checked</span><textarea name="note" required maxlength="1000" disabled></textarea></label>
    ${endForm('Save outcome')}`;
}

function notificationForm(n) {
  const retry = ['failed','bounced','needs_review','accepted','delayed','queued','processing'].includes(n.status);
  return `<form class="admin-action-form admin-form-plain" data-admin-action-form data-action="" data-notification-resolution>${hidden('notificationId',n.id)}
    <fieldset class="admin-choice-list" data-notification-resolution-choice><legend class="admin-field-label">What do you want to do?</legend>
      ${retry ? choice('resolution','retryNotification','Send the email again') : ''}
      ${choice('resolution','acknowledgeContact','I contacted them another way')}
    </fieldset>
    <div data-resolution-fields hidden><p class="admin-step-note" data-retry-guidance hidden>Check in Resend first that it really didn’t arrive, so they don’t get it twice.</p>
    <label><span class="admin-field-label" data-resolution-note-label>Note</span><textarea name="note" required maxlength="1000" disabled></textarea></label></div>
    ${endForm('Save')}`;
}

export function renderActionCenter(data, filter='all') {
  const counts=data.counts || {}, items=[];
  for(const b of data.pending_bookings || []) items.push(row({id:b.id,category:'bookings',icon:ICONS.booking,title:`Review booking ${esc(b.public_reference)}`,description:b.requested_start_at ? 'Requested '+esc(relativeDateTime(b.requested_start_at)) : 'Awaiting a decision',action:`<a class="admin-button admin-button-secondary" href="${link(PATHS.bookings,'booking',b.id)}">Review booking</a>`}));
  for(const c of data.reconciliation_cases || []) items.push(row({id:c.invoice_id,category:'billing',icon:ICONS.invoice,title:'Review a voided invoice’s payment',description:`${money(c.historical_amount_cents)} recorded${c.historical_paid_at ? ' · '+when(c.historical_paid_at) : ''}`,action:'Review payment',details:reconciliationForm(c)}));
  for(const i of data.inquiries || []) items.push(row({id:i.id,category:'inquiries',icon:ICONS.phone,title:`Reply to ${esc(i.customer_name || 'a contact inquiry')}`,description:esc([i.details?.inspectionLabel || i.details?.inspectionType, i.customer_phone || i.customer_email].filter(Boolean).join(' · ') || 'A customer is waiting for a response'),action:'Review inquiry',details:`<div class="admin-notification-contact">${i.customer_phone ? `<a href="tel:${esc(i.customer_phone)}">${esc(i.customer_phone)}</a>` : ''}${i.customer_email ? `<a href="mailto:${esc(i.customer_email)}">${esc(i.customer_email)}</a>` : ''}</div><blockquote class="admin-notification-quote">${esc(i.details?.message || 'No message.')}</blockquote><dl class="admin-facts">${[['Vehicle',i.details?.vehicle],['Location',i.details?.vehicleLocation],['Preferred time',i.details?.preferredTime]].filter(([,value])=>value).map(([label,value])=>`<div class="admin-fact"><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl><form class="admin-action-form admin-form-plain" data-admin-action-form data-action="resolveInquiry">${hidden('inquiryId',i.id)}<label><span class="admin-field-label">What you told them</span><textarea name="note" required maxlength="1000"></textarea></label>${endForm('Mark resolved')}`}));
  for(const n of data.notifications || []) items.push(row({id:n.id,category:'notifications',icon:ICONS.send,title:'Check email delivery',description:`${esc(typeLabel(n.kind))} to ${esc(n.recipient_email || 'a customer')} · ${esc(String(statusLabel(n.status) || 'needs attention').toLowerCase())}`,action:'Review email',details:`${n.last_error ? `<p class="admin-notification-guidance">${esc(n.last_error)}</p>` : ''}<p class="admin-step-note">First sent ${esc(when(n.created_at))} · ${Number(n.attempts || 0)} ${Number(n.attempts || 0) === 1 ? 'attempt' : 'attempts'}${n.provider_message_id ? ` · Resend ID <span class="admin-notification-reference">${esc(n.provider_message_id)}</span>` : ''}</p><div class="admin-notification-links">${recordLinks(n.booking_id, n.invoice_id)}</div>${notificationForm(n)}`}));
  for(const s of data.availability || []) if(s.warning && data.can_manage!==false) items.push(row({id:'availability-'+s.service_code,category:'availability',icon:ICONS.booking,title:s.warning==='empty' ? 'Publish inspection availability' : 'Extend inspection availability',description:s.warning==='empty' ? 'No times published' : s.last_slot_at ? `Published through ${day(s.last_slot_at)}` : 'Ends within seven days',action:`<a class="admin-button admin-button-secondary" href="${PATHS.availability}">${s.warning==='empty' ? 'Publish availability' : 'Add more dates'}</a>`}));
  for(const c of data.redaction_candidates || []) items.push(row({id:'privacy-'+c.id,category:'privacy',icon:ICONS.user,title:'Review customer data retention',description:esc(c.name),action:`<a class="admin-button admin-button-secondary" href="${link(PATHS.customers,'customer',c.id)}">Review customer</a>`}));
  for(const issue of data.system_issues || []) items.push(row({id:issue.id,category:'system',icon:ICONS.alert,title:esc(issue.title),description:issue.id==='webhook' ? 'Check the Resend webhook and its Supabase signing secret.' : 'The scheduled task needs an administrator’s attention.',action:`<a class="admin-button admin-button-secondary" href="https://supabase.com/dashboard/project/ddhhhieitupjixynjrry/${issue.id==='maintenance' ? 'integrations/cron/overview' : 'functions'}" target="_blank" rel="noopener noreferrer">Open Supabase</a>`}));
  const categories=[['all','All',data.action_count || 0],...Object.entries({bookings:'Bookings',inquiries:'Inquiries',notifications:'Email',billing:'Payments',availability:'Availability',privacy:'Privacy',system:'System'}).filter(([key])=>counts[key]>0).map(([key,label])=>[key,label,counts[key]])];
  const healthIssues=(data.system_issues || []).length;
  return `<div class="admin-notifications-toolbar"><div class="admin-notification-filters" role="group" aria-label="Filter actions">${categories.map(([key,label,count])=>`<button type="button" class="admin-notification-filter${filter===key ? ' is-active' : ''}" data-notification-filter="${key}" aria-pressed="${filter===key}">${label}<span>${count}</span></button>`).join('')}</div></div>
    <div class="admin-notification-list" data-notification-list>${items.length ? items.join('') : `<div class="admin-notifications-empty">${ICONS.check}<h2>All caught up</h2></div>`}</div>
    ${Object.entries({bookings:data.pending_bookings,inquiries:data.inquiries,notifications:data.notifications,billing:data.reconciliation_cases,privacy:data.redaction_candidates}).some(([category,records])=>counts[category]>(records || []).length) ? '<p class="admin-notification-limit">Showing the first 100 records in each category. Resolve actions and refresh to see more.</p>' : ''}
    <details class="admin-notifications-health"><summary>System status <span>${healthIssues ? 'Needs attention' : !data.worker?.finished_at ? 'Waiting for the next run' : 'Running normally'}</span></summary><p>Email processing: ${when(data.worker?.finished_at)}</p>${data.can_review_privacy ? `<p>Last maintenance: ${when(data.maintenance?.finished_at)}</p>` : ''}</details>`;
}

export function bindActionCenter(root, onFilter) {
  root.querySelectorAll('[data-reconciliation-outcome]').forEach(group=>{
    const form=group.closest('form');
    const update=()=>{const value=form.elements.disposition.value,refund=form.querySelector('[data-refund-fields]'),note=form.querySelector('[data-outcome-note]');refund.hidden=value!=='already_refunded';refund.disabled=refund.hidden;note.hidden=!value;note.querySelector('textarea').disabled=note.hidden;};
    group.addEventListener('change',update);update();
  });
  root.querySelectorAll('[data-notification-resolution-choice]').forEach(group=>{
    const form=group.closest('form');
    const update=()=>{const value=form.elements.resolution.value || '',fields=form.querySelector('[data-resolution-fields]');form.dataset.action=value;fields.hidden=!value;fields.querySelector('textarea').disabled=fields.hidden;form.querySelector('[data-retry-guidance]').hidden=value!=='retryNotification';form.querySelector('[data-resolution-note-label]').textContent=value==='retryNotification' ? 'How you checked it didn’t arrive' : 'How you reached them';form.querySelector('button[type="submit"]').textContent=value==='retryNotification' ? 'Send again' : 'Save';};
    group.addEventListener('change',update);update();
  });
  root.querySelectorAll('[data-notification-filter]').forEach(button=>button.addEventListener('click',()=>{onFilter(button.dataset.notificationFilter);applyActionFilter(root,button.dataset.notificationFilter);}));
  bindPriceTotals(root);
  root.querySelectorAll('form').forEach(form=>{form.dataset.initialFields=JSON.stringify([...new FormData(form)]);});
}

export function applyActionFilter(root,filter) {
  root.querySelectorAll('[data-notification-item]').forEach(item=>{item.hidden=filter!=='all' && item.dataset.category!==filter;});
  root.querySelectorAll('[data-notification-filter]').forEach(button=>{button.classList.toggle('is-active',button.dataset.notificationFilter===filter);button.setAttribute('aria-pressed',String(button.dataset.notificationFilter===filter));});
}
export const actionCenterHasDraft = root => [...root.querySelectorAll('form')].some(form=>form.dataset.initialFields!==JSON.stringify([...new FormData(form)]));
