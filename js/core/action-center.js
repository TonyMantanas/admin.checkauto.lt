import { esc, bindPriceTotals } from './reliability-ui.js?v=20261004-2';
import { PATHS } from './routes.js?v=20261004-2';
import { ICONS } from './icons.js?v=20260802-1';

const money = cents => new Intl.NumberFormat('en-GB', {style:'currency', currency:'EUR'}).format(Number(cents || 0)/100);
const when = value => value ? new Intl.DateTimeFormat('en-GB', {timeZone:'Europe/Vilnius', dateStyle:'medium', timeStyle:'short'}).format(new Date(value)) : 'Not yet recorded';
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

function reconciliationForm(c) {
  return `<form class="admin-action-form" data-admin-action-form data-action="resolvePaymentReconciliation">${hidden('invoiceId',c.invoice_id)}
    <label>What happened to the payment?<select name="disposition" required data-reconciliation-outcome>
      <option value="">Choose the verified outcome</option><option value="retained_payment">The money was received and kept</option><option value="already_refunded">The money was received and refunded</option><option value="duplicate_or_incorrect">The payment record is incorrect</option>
    </select></label>
    <fieldset class="admin-notification-refund" data-refund-fields hidden disabled><legend>Completed refund</legend>
      <div class="admin-action-grid"><label>Refund date and time (Vilnius)<input name="refundOccurredLocal" type="datetime-local" required></label>
      <label>Refund method<select name="refundMethod" required><option value="">Choose a method</option><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="card">Card</option><option value="other">Other</option></select></label></div>
      <label hidden>Which occurrence of this time?<select name="refundFold"><option value="">Choose an occurrence</option><option value="first">First occurrence</option><option value="second">Second occurrence</option></select></label>
    </fieldset>
    <label data-outcome-note hidden>Evidence and outcome<textarea name="note" required maxlength="1000" disabled></textarea></label>
    ${endForm('Save outcome')}`;
}

function notificationForm(n) {
  const retry = ['failed','bounced','needs_review','accepted','delayed','queued','processing'].includes(n.status);
  return `<form class="admin-action-form" data-admin-action-form data-action="" data-notification-resolution>${hidden('notificationId',n.id)}
    <label>How will you resolve this?<select name="resolution" required data-notification-resolution-select><option value="">Choose an action</option>${retry ? '<option value="retryNotification">Retry the email after checking delivery</option>' : ''}<option value="acknowledgeContact">I contacted the recipient directly</option></select></label>
    <div data-resolution-fields hidden><p class="admin-notification-guidance" data-retry-guidance hidden>Check Resend before retrying to avoid sending a duplicate email.</p>
    <label><span data-resolution-note-label>Outcome</span><textarea name="note" required maxlength="1000" disabled></textarea></label></div>
    ${endForm('Save action')}`;
}

export function renderActionCenter(data, filter='all') {
  const counts=data.counts || {}, items=[];
  for(const b of data.pending_bookings || []) items.push(row({id:b.id,category:'bookings',icon:ICONS.calendar,title:`Booking ${esc(b.public_reference)} needs a decision`,description:when(b.requested_start_at),action:`<a class="admin-button admin-button-secondary" href="${link(PATHS.bookings,'booking',b.id)}">Review booking</a>`}));
  for(const c of data.reconciliation_cases || []) items.push(row({id:c.invoice_id,category:'billing',icon:ICONS.invoice,title:'Review a voided invoice’s payment',description:`${money(c.historical_amount_cents)} recorded${c.historical_paid_at ? ' · '+when(c.historical_paid_at) : ''}`,action:'Review payment',details:reconciliationForm(c)}));
  for(const i of data.inquiries || []) items.push(row({id:i.id,category:'inquiries',icon:ICONS.phone,title:esc(i.customer_name || 'Contact inquiry'),description:esc(i.details?.inspectionLabel || i.details?.inspectionType || 'A customer is waiting for a response'),action:'Review inquiry',details:`<div class="admin-notification-contact">${i.customer_phone ? `<a href="tel:${esc(i.customer_phone)}">${esc(i.customer_phone)}</a>` : ''}${i.customer_email ? `<a href="mailto:${esc(i.customer_email)}">${esc(i.customer_email)}</a>` : ''}</div><details class="admin-notification-message"><summary>Original inquiry</summary><p>${esc(i.details?.message || 'No message provided.')}</p>${[['Vehicle',i.details?.vehicle],['Location',i.details?.vehicleLocation],['Requested time',i.details?.preferredTime]].filter(([,value])=>value).map(([label,value])=>`<p><strong>${label}:</strong> ${esc(value)}</p>`).join('')}</details><form class="admin-action-form" data-admin-action-form data-action="resolveInquiry">${hidden('inquiryId',i.id)}<label>Outcome<textarea name="note" required maxlength="1000"></textarea></label>${endForm('Resolve inquiry')}`}));
  for(const n of data.notifications || []) items.push(row({id:n.id,category:'notifications',icon:ICONS.send,title:`${esc(typeLabel(n.kind))} · ${esc(statusLabel(n.status))}`,description:esc(n.recipient_email),action:'Review email',details:`${n.last_error ? `<p class="admin-notification-guidance">${esc(n.last_error)}</p>` : ''}<details class="admin-notification-message"><summary>Delivery details</summary><p>${when(n.created_at)} · ${Number(n.attempts || 0)} attempts</p>${n.provider_message_id ? `<p>Resend reference: <span class="admin-notification-reference">${esc(n.provider_message_id)}</span></p>` : '<p>No provider reference is recorded.</p>'}</details>${notificationForm(n)}`}));
  for(const s of data.availability || []) if(s.warning && data.can_manage!==false) items.push(row({id:'availability-'+s.service_code,category:'availability',icon:ICONS.calendar,title:esc(s.name),description:s.warning==='empty' ? 'No available times are published.' : 'Published availability ends within seven days.',action:`<a class="admin-button admin-button-secondary" href="${PATHS.availability}">Publish availability</a>`}));
  for(const c of data.redaction_candidates || []) items.push(row({id:'privacy-'+c.id,category:'privacy',icon:ICONS.user,title:'Review customer data retention',description:esc(c.name),action:`<a class="admin-button admin-button-secondary" href="${link(PATHS.customers,'customer',c.id)}">Review customer</a>`}));
  for(const issue of data.system_issues || []) items.push(row({id:issue.id,category:'system',icon:ICONS.alert,title:esc(issue.title),description:issue.id==='webhook' ? 'Check the Resend webhook and its Supabase signing secret.' : 'The scheduled task needs an administrator’s attention.',action:`<a class="admin-button admin-button-secondary" href="https://supabase.com/dashboard/project/ddhhhieitupjixynjrry/${issue.id==='maintenance' ? 'integrations/cron/overview' : 'functions'}" target="_blank" rel="noopener noreferrer">Open Supabase</a>`}));
  const categories=[['all','All',data.action_count || 0],...Object.entries({bookings:'Bookings',inquiries:'Inquiries',notifications:'Email',billing:'Payments',availability:'Availability',privacy:'Privacy',system:'System'}).filter(([key])=>counts[key]>0).map(([key,label])=>[key,label,counts[key]])];
  const healthIssues=(data.system_issues || []).length;
  return `<div class="admin-notifications-toolbar"><div class="admin-notification-filters" role="group" aria-label="Filter actions">${categories.map(([key,label,count])=>`<button type="button" class="admin-notification-filter${filter===key ? ' is-active' : ''}" data-notification-filter="${key}" aria-pressed="${filter===key}">${label}<span>${count}</span></button>`).join('')}</div></div>
    <div class="admin-notification-list" data-notification-list>${items.length ? items.join('') : `<div class="admin-notifications-empty">${ICONS.check}<h2>All caught up</h2><p>There are no actions waiting for you.</p></div>`}</div>
    ${Object.entries({bookings:data.pending_bookings,inquiries:data.inquiries,notifications:data.notifications,billing:data.reconciliation_cases,privacy:data.redaction_candidates}).some(([category,records])=>counts[category]>(records || []).length) ? '<p class="admin-notification-limit">Showing the first 100 records in each category. Resolve actions and refresh to see more.</p>' : ''}
    <details class="admin-notifications-health"><summary>System status <span>${healthIssues ? 'Needs attention' : !data.worker?.finished_at ? 'Waiting for the next run' : 'Running normally'}</span></summary><p>Email processing: ${when(data.worker?.finished_at)}</p>${data.can_review_privacy ? `<p>Last maintenance: ${when(data.maintenance?.finished_at)}</p>` : ''}</details>`;
}

export function bindActionCenter(root, onFilter) {
  root.querySelectorAll('[data-reconciliation-outcome]').forEach(select=>{
    const update=()=>{const form=select.form,refund=form.querySelector('[data-refund-fields]'),note=form.querySelector('[data-outcome-note]');refund.hidden=select.value!=='already_refunded';refund.disabled=refund.hidden;note.hidden=!select.value;note.querySelector('textarea').disabled=note.hidden;};
    select.addEventListener('change',update);update();
  });
  root.querySelectorAll('[data-notification-resolution-select]').forEach(select=>{
    const update=()=>{const form=select.form,fields=form.querySelector('[data-resolution-fields]');form.dataset.action=select.value;fields.hidden=!select.value;fields.querySelector('textarea').disabled=fields.hidden;form.querySelector('[data-retry-guidance]').hidden=select.value!=='retryNotification';form.querySelector('[data-resolution-note-label]').textContent=select.value==='retryNotification' ? 'Delivery check and reason to retry' : 'Contact method and outcome';};
    select.addEventListener('change',update);update();
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
