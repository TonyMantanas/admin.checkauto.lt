import { esc } from './reliability-ui.js?v=20261106-7';
import { PATHS } from './routes.js?v=20261105-7';
import { ICONS } from './icons.js?v=20261109-1';
import { formatMoney, formatDateTime, formatDay, relativeDateTime } from './formatting.js?v=20261105-3';

// Each notification is a link to the record it is about. Decisions and
// fixes happen in that record's panel, not here.
const money = cents => formatMoney(cents, 'EUR');
const when = value => value ? formatDateTime(value) : 'Not yet recorded';
const day = value => formatDay(value);
const link = (path, key, id) => `${path}?${key}=${encodeURIComponent(id)}`;
const typeLabel = kind => kind==='contact_inquiry_admin' ? 'Contact inquiry' : ({pending:'Request received',confirmed:'Confirmation',rejected:'Rejection',cancelled:'Cancellation',expired:'Request expired',price:'Price agreement'})[String(kind).split('_')[1]] || (kind==='invoice_customer' ? 'Invoice' : 'Email');
const statusLabel = status => ({failed:'not sent',bounced:'bounced',suppressed:'blocked',needs_review:'needs review',accepted:'delivery unconfirmed',delayed:'delayed',queued:'still waiting to send',processing:'stuck sending'})[status] || 'needs attention';

// route: open a panel on this page instead of loading another page.
function row({id, category, icon, title, description, href, route, external=false}) {
  const routeAttrs = route ? ` data-notification-route="${route.type}" data-notification-route-id="${esc(route.id)}"` : '';
  return `<a class="admin-notification-item" href="${esc(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}${routeAttrs} data-notification-item data-category="${category}" data-item-id="${esc(id)}">
    <span class="admin-notification-icon" aria-hidden="true">${icon || ICONS.alert}</span>
    <span class="admin-notification-copy"><strong>${title}</strong><span>${description}</span></span>
    <span class="admin-notification-go" aria-hidden="true">${external ? ICONS.external : ICONS.next}</span>
  </a>`;
}

function emailHref(n) {
  if (n.invoice_id) return { href: link(PATHS.invoices, 'invoice', n.invoice_id) };
  if (n.booking_id) return { href: link(PATHS.bookings, 'booking', n.booking_id) };
  return { href: link(PATHS.notifications, 'email', n.id), route: { type: 'email', id: n.id } };
}

export function renderActionCenter(data, filter='all') {
  const counts=data.counts || {}, items=[];
  for(const b of data.pending_bookings || []) items.push(row({id:b.id,category:'bookings',icon:ICONS.booking,title:`Review booking ${esc(b.public_reference)}`,description:b.requested_start_at ? 'Requested '+esc(relativeDateTime(b.requested_start_at)) : 'Awaiting a decision',href:link(PATHS.bookings,'booking',b.id)}));
  for(const c of data.reconciliation_cases || []) items.push(row({id:c.invoice_id,category:'billing',icon:ICONS.invoice,title:'Resolve a voided invoice’s payment',description:`${money(c.historical_amount_cents)} recorded${c.historical_paid_at ? ' · '+when(c.historical_paid_at) : ''}`,href:link(PATHS.invoices,'invoice',c.invoice_id)}));
  for(const i of data.inquiries || []) items.push(row({id:i.id,category:'inquiries',icon:ICONS.phone,title:`Reply to ${esc(i.customer_name || 'a contact inquiry')}`,description:esc([i.details?.inspectionLabel || i.details?.inspectionType, i.customer_phone || i.customer_email].filter(Boolean).join(' · ') || 'Waiting for a reply'),href:link(PATHS.notifications,'inquiry',i.id),route:{type:'inquiry',id:i.id}}));
  for(const n of data.notifications || []) items.push(row({id:n.id,category:'notifications',icon:ICONS.send,title:`${esc(typeLabel(n.kind))} email ${esc(statusLabel(n.status))}`,description:`To ${esc(n.recipient_email || 'a customer')} · ${esc(when(n.created_at))}`,...emailHref(n)}));
  for(const s of data.availability || []) if(s.warning && data.can_manage!==false) items.push(row({id:'availability-'+s.service_code,category:'availability',icon:ICONS.booking,title:s.warning==='empty' ? 'Publish inspection availability' : 'Extend inspection availability',description:s.warning==='empty' ? 'No times published' : s.last_slot_at ? `Published through ${day(s.last_slot_at)}` : 'Ends within seven days',href:PATHS.availability}));
  for(const c of data.redaction_candidates || []) items.push(row({id:'privacy-'+c.id,category:'privacy',icon:ICONS.user,title:'Review customer data retention',description:esc(c.name),href:link(PATHS.customers,'customer',c.id)}));
  for(const issue of data.system_issues || []) items.push(row({id:issue.id,category:'system',icon:ICONS.alert,title:esc(issue.title),description:issue.id==='webhook' ? 'Resend webhook or its signing secret' : 'Scheduled task',href:`https://supabase.com/dashboard/project/ddhhhieitupjixynjrry/${issue.id==='maintenance' ? 'integrations/cron/overview' : 'functions'}`,external:true}));
  const categories=[['all','All',data.action_count || 0],...Object.entries({bookings:'Bookings',inquiries:'Inquiries',notifications:'Email',billing:'Payments',availability:'Availability',privacy:'Privacy',system:'System'}).filter(([key])=>counts[key]>0).map(([key,label])=>[key,label,counts[key]])];
  const healthIssues=(data.system_issues || []).length;
  return `<div class="admin-notifications-toolbar"><div class="admin-notification-filters" role="group" aria-label="Filter actions">${categories.map(([key,label,count])=>`<button type="button" class="admin-notification-filter${filter===key ? ' is-active' : ''}" data-notification-filter="${key}" aria-pressed="${filter===key}">${label}<span>${count}</span></button>`).join('')}</div></div>
    <div class="admin-notification-list" data-notification-list>${items.length ? items.join('') : `<div class="admin-notifications-empty">${ICONS.check}<h2>All caught up</h2></div>`}</div>
    ${Object.entries({bookings:data.pending_bookings,inquiries:data.inquiries,notifications:data.notifications,billing:data.reconciliation_cases,privacy:data.redaction_candidates}).some(([category,records])=>counts[category]>(records || []).length) ? '<p class="admin-notification-limit">Showing the first 100 in each category.</p>' : ''}
    <details class="admin-notifications-health"><summary>System status <span>${healthIssues ? 'Needs attention' : !data.worker?.finished_at ? 'Waiting for the next run' : 'Running normally'}</span></summary><p>Email processing: ${when(data.worker?.finished_at)}</p>${data.can_review_privacy ? `<p>Last maintenance: ${when(data.maintenance?.finished_at)}</p>` : ''}</details>`;
}

export function bindActionCenter(root, onFilter, onOpenRoute) {
  root.querySelectorAll('[data-notification-filter]').forEach(button=>button.addEventListener('click',()=>{onFilter(button.dataset.notificationFilter);applyActionFilter(root,button.dataset.notificationFilter);}));
  root.querySelectorAll('[data-notification-route]').forEach(item=>item.addEventListener('click',event=>{
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || typeof onOpenRoute !== 'function') return;
    event.preventDefault();
    onOpenRoute(item.dataset.notificationRoute, item.dataset.notificationRouteId);
  }));
}

export function applyActionFilter(root,filter) {
  root.querySelectorAll('[data-notification-item]').forEach(item=>{item.hidden=filter!=='all' && item.dataset.category!==filter;});
  root.querySelectorAll('[data-notification-filter]').forEach(button=>{button.classList.toggle('is-active',button.dataset.notificationFilter===filter);button.setAttribute('aria-pressed',String(button.dataset.notificationFilter===filter));});
}

// The list holds no forms any more, so there is never a draft to keep.
export const actionCenterHasDraft = () => false;
