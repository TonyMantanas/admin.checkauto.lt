import { ICONS } from './icons.js?v=20260727-3';

/* ==========================================================================
   admin.js - CheckAuto admin app

   Static admin frontend. Data and mutations stay behind Supabase Auth,
   staff_profiles, and the admin-bookings Edge Function.
   ========================================================================== */

export function initAdminRuntime(pageController) {
  'use strict';

  var SUPABASE_URL = 'https://ddhhhieitupjixynjrry.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkaGhoaWVpdHVwaml4eW5qcnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNDAyOTQsImV4cCI6MjA5NzcxNjI5NH0.PXAxGc3TSFUnbcyWdizhkiJkKqJlqD1Ic8PHAjHSFIc';
  var ADMIN_ENDPOINT = SUPABASE_URL + '/functions/v1/admin-bookings';
  var ADMIN_BASE_PATH = (
    window.location.pathname === '/admin' ||
    window.location.pathname.startsWith('/admin/')
  ) ? '/admin' : '';
  function adminPath(path) {
    return ADMIN_BASE_PATH + path;
  }
  var PATHS = {
    dashboard: adminPath('/'),
    bookings: adminPath('/bookings/'),
    availability: adminPath('/availability/'),
    customers: adminPath('/customers/'),
    invoices: adminPath('/invoices/'),
    marketing: adminPath('/marketing/'),
    login: adminPath('/login/')
  };
  var SESSION_KEY = 'checkauto-admin-session';
  var DASHBOARD_CACHE_KEY = 'checkauto-admin-dashboard-cache';
  var DASHBOARD_CACHE_VERSION = 2;
  var DASHBOARD_CACHE_MAX_AGE_MS = 2 * 60 * 1000;
  var SESSION_REFRESH_MARGIN_MS = 60 * 1000;
  var TIME_ZONE = 'Europe/Vilnius';
  var EXPIRY_TICK_MS = 30 * 1000;
  var DEFAULT_START_HOUR = 8;
  var DEFAULT_END_HOUR = 22;
  var HOUR_HEIGHT = 56;
  var SLOT_STEP_MINUTES = 15;

  var state = {
    page: '',
    session: null,
    staff: null,
    bookings: [],
    services: [],
    slots: [],
    staffList: [],
    events: [],
    notes: [],
    customers: [],
    invoices: [],
    customerEvents: [],
    marketingCampaigns: [],
    marketingRecipients: [],
    maintenancePreview: null,
    confirmationSettings: null,
    filter: 'pending',
    slotFilter: 'all',
    invoiceFilter: 'unpaid',
    bookingSort: 'asc',
    selectedBookingId: null,
    selectedSlotId: null,
    selectedCustomerId: null,
    selectedInvoiceId: null,
    selectedCampaignId: null,
    customerSearch: '',
    invoiceSearch: '',
    calendarView: 'week',
    calendarAnchor: '',
    slotEditorOpen: false,
    realtimeSocket: null,
    realtimeHeartbeat: null,
    realtimeRefreshTimer: null,
    expiryTimer: null,
    realtimeRef: 1,
    hasRendered: false,
    isRefreshing: false
  };

  var els = {};
  var dialogId = 0;
  var modalReturnFocus = null;
  var modalReturnFocusSelector = '';
  var confirmReturnFocus = null;
  var slotEditorReturnFocus = null;
  var slotEditorReturnFocusSelector = '';
  var slotEditorBaseline = '';
  var calendarMediaQuery = null;
  var ICON_BACK = ICONS.back;
  var ICON_BOOKING = ICONS.booking;
  var ICON_CLOSE = ICONS.close;
  var ICON_EMAIL = ICONS.email;
  var ICON_EXTERNAL = ICONS.external;
  var ICON_INVOICE = ICONS.invoice;
  var ICON_MAP = ICONS.map;
  var ICON_PHONE = ICONS.phone;
  var ICON_REFRESH = ICONS.refresh;
  var ICON_USER = ICONS.user;

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $all(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function escapeSelectorValue(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(String(value || ''));
    }
    return String(value || '').replace(/["\\]/g, '\\$&');
  }

  function focusSelectorFor(element) {
    if (!element || element === document.body || !element.getAttribute) return '';
    var attributes = [
      'data-booking-id',
      'data-customer-id',
      'data-invoice-id',
      'data-campaign-id',
      'data-calendar-event',
      'data-admin-slot-open',
      'data-admin-nav-toggle'
    ];
    for (var i = 0; i < attributes.length; i += 1) {
      var value = element.getAttribute(attributes[i]);
      if (value !== null) {
        return '[' + attributes[i] + '="' + escapeSelectorValue(value) + '"]';
      }
    }
    return element.id ? '#' + escapeSelectorValue(element.id) : '';
  }

  function focusElement(element, fallbackSelector) {
    window.requestAnimationFrame(function () {
      var target = element && document.body.contains(element) ? element : null;
      if (!target && fallbackSelector) {
        var candidates = $all(fallbackSelector);
        target = candidates.find(function (item) {
          return !item.hidden && item.getClientRects().length > 0;
        }) || candidates[0] || null;
      }
      if (target && typeof target.focus === 'function' && document.body.contains(target)) target.focus();
    });
  }

  function focusableElements(root) {
    if (!root) return [];
    return $all(
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), ' +
      'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      root
    ).filter(function (item) {
      return item.tabIndex >= 0 && !item.hidden && item.getAttribute('aria-hidden') !== 'true';
    });
  }

  function bindDialogKeyboard(root, onEscape) {
    if (!root) return;
    if (root._adminDialogKeydown) {
      root.removeEventListener('keydown', root._adminDialogKeydown);
    }
    root._adminDialogKeydown = function (event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (onEscape) onEscape();
        return;
      }
      if (event.key !== 'Tab') return;
      var items = focusableElements(root);
      if (!items.length) {
        event.preventDefault();
        var panel = $('[role="dialog"]', root);
        if (panel) panel.focus();
        return;
      }
      var first = items[0];
      var last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    root.addEventListener('keydown', root._adminDialogKeydown);
  }

  function labelDialog(panel, fallbackLabel) {
    if (!panel) return;
    panel.setAttribute('tabindex', '-1');
    var heading = $('h1, h2, h3', panel);
    if (heading) {
      if (!heading.id) {
        dialogId += 1;
        heading.id = 'admin-dialog-title-' + dialogId;
      }
      panel.setAttribute('aria-labelledby', heading.id);
      panel.removeAttribute('aria-label');
    } else {
      panel.setAttribute('aria-label', fallbackLabel || 'Details');
    }
  }

  function setPageInteractionBlocked(blocked) {
    var consoleRoot = $('.admin-console');
    if (!consoleRoot) return;
    if (blocked) {
      consoleRoot.setAttribute('inert', '');
      consoleRoot.setAttribute('aria-hidden', 'true');
    } else {
      consoleRoot.removeAttribute('inert');
      consoleRoot.removeAttribute('aria-hidden');
    }
  }

  function setUnderlyingModalBlocked(blocked) {
    var root = ensureModalRoot();
    var panel = $('.admin-modal-panel', root);
    if (!panel || root.hidden) return;
    if (blocked) {
      panel.setAttribute('inert', '');
      panel.setAttribute('aria-hidden', 'true');
    } else {
      panel.removeAttribute('inert');
      panel.removeAttribute('aria-hidden');
    }
  }

  function setPressed(button, pressed) {
    if (!button) return;
    button.classList.toggle('is-active', Boolean(pressed));
    button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  }

  function emptyState(message, actionLabel, actionAttribute) {
    return '<div class="admin-empty-state admin-empty-state-compact" role="status">' +
      '<p>' + escapeHtml(message) + '</p>' +
      (actionLabel && actionAttribute
        ? '<button class="admin-button admin-button-secondary" type="button" ' + actionAttribute + '>' + escapeHtml(actionLabel) + '</button>'
        : '') +
    '</div>';
  }

  function setPageBusy(busy, label) {
    var pageRoot = $('[data-page-root]');
    if (pageRoot) pageRoot.setAttribute('aria-busy', busy ? 'true' : 'false');
    if (els.loading) {
      els.loading.setAttribute('role', 'status');
      els.loading.setAttribute('aria-live', 'polite');
      els.loading.setAttribute('aria-label', label || 'Loading admin data');
    }
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function (char) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[char];
    });
  }

  function partsToMap(parts) {
    return parts.reduce(function (map, part) {
      if (part.type !== 'literal') map[part.type] = part.value;
      return map;
    }, {});
  }

  function dateParts(value) {
    return partsToMap(new Intl.DateTimeFormat('lt-LT', {
      timeZone: TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date(value)));
  }

  function timeParts(value) {
    return partsToMap(new Intl.DateTimeFormat('lt-LT', {
      timeZone: TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      hourCycle: 'h23'
    }).formatToParts(new Date(value)));
  }

  function dateTimeParts(value) {
    return partsToMap(new Intl.DateTimeFormat('lt-LT', {
      timeZone: TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      hourCycle: 'h23'
    }).formatToParts(new Date(value)));
  }

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function formatDate(value) {
    var parts = dateParts(value);
    return parts.year + '-' + parts.month + '-' + parts.day;
  }

  function formatTime(value) {
    var parts = timeParts(value);
    return parts.hour + ':' + parts.minute;
  }

  function formatDateTime(value) {
    if (!value) return 'Not provided';
    return formatDate(value) + ' ' + formatTime(value);
  }

  function formatRange(start, end) {
    if (!start || !end) return 'Not provided';
    if (formatDate(start) === formatDate(end)) {
      return formatDate(start) + ', ' + formatTime(start) + '-' + formatTime(end);
    }
    return formatDateTime(start) + ' - ' + formatDateTime(end);
  }

  function expiryDurationLabel(remainingMs) {
    if (remainingMs <= 0) return '';
    var totalMinutes = Math.max(1, Math.ceil(remainingMs / (60 * 1000)));
    var days = Math.floor(totalMinutes / (24 * 60));
    var hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    var minutes = totalMinutes % 60;

    if (days) return days + 'd' + (hours ? ' ' + hours + 'h' : '');
    if (hours) return hours + 'h' + (minutes ? ' ' + minutes + 'm' : '');
    return totalMinutes + 'm';
  }

  function expiryCountdownState(expiresAt, createdAt, nowValue) {
    var expiresMs = new Date(expiresAt || '').getTime();
    if (!Number.isFinite(expiresMs)) return null;

    var nowMs = nowValue instanceof Date ? nowValue.getTime() : Number(nowValue || Date.now());
    var createdMs = new Date(createdAt || '').getTime();
    var remainingMs = expiresMs - nowMs;
    var totalMs = Number.isFinite(createdMs) && expiresMs > createdMs
      ? expiresMs - createdMs
      : Math.max(remainingMs, 1);
    var progress = remainingMs <= 0
      ? 0
      : Math.max(0, Math.min(100, (remainingMs / totalMs) * 100));
    var tone = remainingMs <= 0
      ? 'due'
      : (remainingMs <= 30 * 60 * 1000
        ? 'urgent'
        : (progress <= 50 ? 'warning' : 'scheduled'));

    return {
      expiresMs: expiresMs,
      remainingMs: remainingMs,
      progress: progress,
      tone: tone,
      shortLabel: expiryDurationLabel(remainingMs)
    };
  }

  function expiryCountdownLabel(timer, variant) {
    if (!timer || timer.remainingMs <= 0) {
      return variant === 'compact' ? 'Expiry processing' : 'Automatic expiry pending';
    }
    return timer.shortLabel + (variant === 'compact' ? ' left' : ' remaining');
  }

  function expiryCountdownHtml(booking, variant) {
    if (!booking || booking.status !== 'pending' || !booking.pending_expires_at) return '';
    var timer = expiryCountdownState(booking.pending_expires_at, booking.created_at);
    if (!timer) return '';

    var mode = variant === 'compact' ? 'compact' : 'full';
    var label = expiryCountdownLabel(timer, mode);
    var exact = formatDateTime(booking.pending_expires_at);
    var attributes =
      ' data-admin-expiry' +
      ' data-expiry-variant="' + mode + '"' +
      ' data-expires-at="' + escapeHtml(booking.pending_expires_at) + '"' +
      ' data-created-at="' + escapeHtml(booking.created_at || '') + '"' +
      ' data-tone="' + escapeHtml(timer.tone) + '"' +
      ' aria-label="Review deadline: ' + escapeHtml(label) + '. Expires ' + escapeHtml(exact) + '."';

    if (mode === 'compact') {
      return '<span class="admin-expiry-compact"' + attributes + '>' +
        '<span data-admin-expiry-remaining>' + escapeHtml(label) + '</span>' +
      '</span>';
    }

    return '<div class="admin-expiry-panel"' + attributes + '>' +
      '<div class="admin-expiry-copy">' +
        '<span>Review deadline</span>' +
        '<strong data-admin-expiry-remaining>' + escapeHtml(label) + '</strong>' +
        '<time datetime="' + escapeHtml(booking.pending_expires_at) + '">Expires ' + escapeHtml(exact) + '</time>' +
      '</div>' +
      '<span class="admin-expiry-track" aria-hidden="true">' +
        '<span data-admin-expiry-bar style="width: ' + timer.progress.toFixed(2) + '%"></span>' +
      '</span>' +
    '</div>';
  }

  function updateExpiryCountdowns() {
    var now = Date.now();
    $all('[data-admin-expiry]').forEach(function (countdown) {
      var timer = expiryCountdownState(countdown.dataset.expiresAt, countdown.dataset.createdAt, now);
      if (!timer) return;
      var variant = countdown.dataset.expiryVariant === 'compact' ? 'compact' : 'full';
      var label = expiryCountdownLabel(timer, variant);
      var remaining = $('[data-admin-expiry-remaining]', countdown);
      var progress = $('[data-admin-expiry-bar]', countdown);
      var exact = formatDateTime(countdown.dataset.expiresAt);

      countdown.dataset.tone = timer.tone;
      countdown.setAttribute('aria-label', 'Review deadline: ' + label + '. Expires ' + exact + '.');
      if (remaining) remaining.textContent = label;
      if (progress) progress.style.width = timer.progress.toFixed(2) + '%';

      var bookingRow = countdown.closest('.admin-booking-item');
      if (bookingRow && bookingRow.dataset.bookingBaseLabel) {
        bookingRow.setAttribute('aria-label', bookingRow.dataset.bookingBaseLabel + ', review deadline ' + label);
      }
    });
  }

  function startExpiryTicker() {
    if (state.expiryTimer) window.clearInterval(state.expiryTimer);
    updateExpiryCountdowns();
    state.expiryTimer = window.setInterval(updateExpiryCountdowns, EXPIRY_TICK_MS);
    window.addEventListener('pagehide', function () {
      if (state.expiryTimer) {
        window.clearInterval(state.expiryTimer);
        state.expiryTimer = null;
      }
    }, { once: true });
  }

  function isValidYmd(value) {
    var match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;
    var date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return date.getUTCFullYear() === Number(match[1]) &&
      date.getUTCMonth() === Number(match[2]) - 1 &&
      date.getUTCDate() === Number(match[3]);
  }

  function isValidHm(value) {
    var match = String(value || '').match(/^(\d{2}):(\d{2})$/);
    if (!match) return false;
    var hours = Number(match[1]);
    var minutes = Number(match[2]);
    return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
  }

  function utcNoonFromYmd(value) {
    var parts = String(value).split('-').map(Number);
    return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0));
  }

  function ymdFromUtcDate(date) {
    return date.getUTCFullYear() + '-' + pad2(date.getUTCMonth() + 1) + '-' + pad2(date.getUTCDate());
  }

  function addDaysYmd(value, days) {
    var date = utcNoonFromYmd(value);
    date.setUTCDate(date.getUTCDate() + days);
    return ymdFromUtcDate(date);
  }

  function startOfWeekYmd(value) {
    var date = utcNoonFromYmd(value);
    var day = date.getUTCDay();
    var mondayOffset = (day + 6) % 7;
    date.setUTCDate(date.getUTCDate() - mondayOffset);
    return ymdFromUtcDate(date);
  }

  function todayYmd() {
    return formatDate(new Date());
  }

  function compareYmd(a, b) {
    return String(a).localeCompare(String(b));
  }

  function timeToMinutes(value) {
    var parts = String(value || '').split(':').map(Number);
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  }

  function minutesToTime(minutes) {
    var normalized = Math.max(0, Math.min(23 * 60 + 45, minutes));
    return pad2(Math.floor(normalized / 60)) + ':' + pad2(normalized % 60);
  }

  function isoFromVilniusInput(dateValue, timeValue) {
    if (!isValidYmd(dateValue) || !isValidHm(timeValue)) {
      return null;
    }

    var datePartsRaw = dateValue.split('-').map(Number);
    var timePartsRaw = timeValue.split(':').map(Number);
    var utcGuess = Date.UTC(
      datePartsRaw[0],
      datePartsRaw[1] - 1,
      datePartsRaw[2],
      timePartsRaw[0],
      timePartsRaw[1]
    );
    var zonedParts = dateTimeParts(new Date(utcGuess).toISOString());
    var zonedTime = Date.UTC(
      Number(zonedParts.year),
      Number(zonedParts.month) - 1,
      Number(zonedParts.day),
      Number(zonedParts.hour),
      Number(zonedParts.minute)
    );
    return new Date(utcGuess - (zonedTime - utcGuess)).toISOString();
  }

  function dateInputValue(value) {
    return value ? formatDate(value) : todayYmd();
  }

  function timeInputValue(value) {
    return value ? formatTime(value) : '08:00';
  }

  function roundUpToStep(minutes, step) {
    return Math.ceil(minutes / step) * step;
  }

  function defaultSlotDateTime() {
    var now = dateTimeParts(new Date());
    var date = now.year + '-' + now.month + '-' + now.day;
    var minutes = Number(now.hour) * 60 + Number(now.minute) + 30;
    minutes = roundUpToStep(minutes, SLOT_STEP_MINUTES);

    if (minutes < DEFAULT_START_HOUR * 60) {
      minutes = DEFAULT_START_HOUR * 60;
    }

    if (minutes > DEFAULT_END_HOUR * 60) {
      date = addDaysYmd(date, 1);
      minutes = DEFAULT_START_HOUR * 60;
    }

    return { date: date, time: minutesToTime(minutes) };
  }

  function serviceById(id) {
    return state.services.find(function (service) { return service.id === id; }) || null;
  }

  function serviceByCode(code) {
    return state.services.find(function (service) { return service.code === code; }) || null;
  }

  function staffById(id) {
    return state.staffList.find(function (staff) { return staff.id === id; }) || null;
  }

  function customerById(id) {
    return state.customers.find(function (customer) { return customer.id === id; }) || null;
  }

  function customerForBooking(booking) {
    if (!booking || !booking.customer_id) return null;
    return customerById(booking.customer_id);
  }

  function invoicesForBooking(bookingId) {
    return state.invoices.filter(function (invoice) { return invoice.booking_id === bookingId; });
  }

  function activeInvoiceForBooking(bookingId) {
    return invoicesForBooking(bookingId).find(function (invoice) { return invoice.invoice_status !== 'void'; }) || null;
  }

  function invoicesForCustomer(customerId) {
    return state.invoices.filter(function (invoice) { return invoice.customer_id === customerId; });
  }

  function invoiceById(id) {
    return state.invoices.find(function (invoice) { return invoice.id === id; }) || null;
  }

  function bookingById(id) {
    return state.bookings.find(function (booking) { return booking.id === id; }) || null;
  }

  function slotById(id) {
    return state.slots.find(function (slot) { return slot.id === id; }) || null;
  }

  function campaignById(id) {
    return state.marketingCampaigns.find(function (campaign) { return campaign.id === id; }) || null;
  }

  function recipientsForCampaign(campaignId) {
    return state.marketingRecipients.filter(function (recipient) { return recipient.campaign_id === campaignId; });
  }

  function bookingsForCustomer(customerId) {
    return state.bookings.filter(function (booking) {
      return booking.customer_id === customerId && !booking.pii_redacted_at;
    });
  }

  function allBookingsForCustomer(customerId) {
    return state.bookings.filter(function (booking) {
      return booking.customer_id === customerId;
    });
  }

  function eventsForCustomer(customerId) {
    return state.customerEvents.filter(function (event) { return event.customer_id === customerId; });
  }

  function consentedCustomers() {
    return state.customers.filter(function (customer) {
      return customer.marketing_consent_status === 'opted_in' &&
        !customer.marketing_consent_withdrawn_at &&
        !customer.pii_redacted_at;
    });
  }

  function hasActiveLegalHold(record) {
    return Boolean(record && record.legal_hold_until && new Date(record.legal_hold_until) > new Date());
  }

  function customerRedactionBlockReasons(customer, bookings) {
    var reasons = [];
    if (hasActiveLegalHold(customer)) reasons.push('a legal hold is active');
    if (customer.marketing_consent_status === 'opted_in') reasons.push('withdraw marketing permission first');
    if (bookings.some(function (booking) { return ['pending', 'confirmed'].includes(booking.status); })) reasons.push('finish or cancel active bookings first');
    if (bookings.some(function (booking) { return hasActiveLegalHold(booking); })) reasons.push('a linked booking has a legal hold');
    if (customer.pii_redacted_at) reasons.push('the profile is already redacted');
    return reasons;
  }

  function customerDeleteBlockReasons(customer, bookings) {
    var reasons = [];
    if (!customer.pii_redacted_at) reasons.push('redact personal data first');
    if (hasActiveLegalHold(customer)) reasons.push('a legal hold is active');
    if (customer.marketing_consent_status === 'opted_in') reasons.push('withdraw marketing permission first');
    if (bookings.some(function (booking) { return ['pending', 'confirmed'].includes(booking.status); })) reasons.push('finish or cancel active bookings first');
    if (bookings.some(function (booking) { return hasActiveLegalHold(booking); })) reasons.push('a linked booking has a legal hold');
    if (bookings.some(function (booking) { return !booking.pii_redacted_at; })) reasons.push('a linked booking still contains personal data');
    return reasons;
  }

  function serviceNameById(id) {
    if (!id) return 'All inspection types';
    var service = serviceById(id);
    return service ? (service.name_en || service.name_lt) : 'Service';
  }

  function serviceNameForBooking(booking) {
    return serviceNameById(booking.service_id);
  }

  function statusLabel(status) {
    return {
      available: 'Available',
      pending: 'Needs review',
      confirmed: 'Confirmed',
      rejected: 'Rejected',
      cancelled: 'Cancelled',
      completed: 'Completed',
      expired: 'Expired',
      open: 'Available',
      sent: 'Sent',
      failed: 'Failed',
      partial: 'Partially sent',
      sending: 'Sending now'
    }[status] || status;
  }

  function statusTone(status) {
    if (status === 'available' || status === 'open') return 'available';
    if (status === 'pending') return 'pending';
    if (status === 'confirmed') return 'confirmed';
    if (status === 'completed') return 'completed';
    if (status === 'sent') return 'completed';
    if (['rejected', 'cancelled', 'expired', 'failed'].includes(status)) return status;
    if (status === 'partial' || status === 'sending') return 'confirmed';
    return 'neutral';
  }

  function bookingStatusDescription(status) {
    return {
      pending: 'The requested time still needs an admin decision.',
      confirmed: 'The time is scheduled and the customer has been notified.',
      completed: 'The service is finished. Payment and invoicing can now be reviewed.',
      rejected: 'The request was declined and is no longer active.',
      cancelled: 'The confirmed booking was cancelled.',
      expired: 'The request was not confirmed before its review deadline.'
    }[status] || 'Current booking workflow state.';
  }

  function invoiceStatusLabel(invoice) {
    if (!invoice) return 'No invoice';
    if (invoice.invoice_status === 'void') return 'Void';
    if (invoice.payment_status === 'paid') return 'Paid';
    if (invoice.due_date && compareYmd(invoice.due_date, todayYmd()) < 0) return 'Overdue';
    return 'Unpaid';
  }

  function invoiceTone(invoice) {
    if (!invoice) return 'available';
    if (invoice.invoice_status === 'void') return 'void';
    return invoice.payment_status === 'paid' ? 'paid' : 'unpaid';
  }

  function invoiceStatusDescription(invoice) {
    if (invoice.invoice_status === 'void') {
      return 'This invoice is cancelled for accounting. Its number and PDF remain retained.';
    }
    if (invoice.payment_status === 'paid') {
      return 'Payment has been recorded. The invoice remains available as a retained record.';
    }
    if (invoice.due_date && compareYmd(invoice.due_date, todayYmd()) < 0) {
      return 'Payment is overdue. The PDF can be reviewed or resent to the customer.';
    }
    return 'Payment has not been recorded. The PDF can be reviewed or resent.';
  }

  function emailStatusLabel(status) {
    return {
      sent: 'Sent successfully',
      delivered: 'Delivered',
      failed: 'Delivery failed',
      bounced: 'Delivery bounced',
      pending: 'Waiting to send',
      not_sent: 'Not sent'
    }[status] || (status ? String(status).replace(/_/g, ' ') : 'Not sent');
  }

  function paymentLabel(status) {
    return {
      unpaid: 'Unpaid',
      paid: 'Paid',
      invoice_unpaid: 'Invoice unpaid',
      invoice_paid: 'Invoice paid',
      not_required: 'Not required'
    }[status] || 'Unpaid';
  }

  function formatMoney(cents, currency) {
    return (currency || 'EUR') + ' ' + ((Number(cents) || 0) / 100).toFixed(2);
  }

  function defaultInvoiceAmount(booking) {
    var service = booking && serviceById(booking.service_id);
    if (service && service.code === 'computer_diagnostics') return '20.00';
    if (service && service.code === 'full_inspection') return '100.00';
    return '100.00';
  }

  function defaultInvoiceDueDate() {
    return addDaysYmd(todayYmd(), 7);
  }

  function isScheduleStatus(status) {
    return ['pending', 'confirmed', 'completed'].includes(status);
  }

  function isActiveBookingStatus(status) {
    return ['pending', 'confirmed'].includes(status);
  }

  function getStoredSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    } catch (error) {
      return null;
    }
  }

  function storeSession(session) {
    state.session = session;
    if (session) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(SESSION_KEY);
      clearDashboardCache();
    }
  }

  function decodeJwtPayload(token) {
    try {
      var payload = String(token || '').split('.')[1];
      if (!payload) return null;
      var normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      normalized += '='.repeat((4 - normalized.length % 4) % 4);
      return JSON.parse(atob(normalized));
    } catch (error) {
      return null;
    }
  }

  function sessionUserId(session) {
    if (session && session.user && session.user.id) return session.user.id;
    var payload = decodeJwtPayload(session && session.access_token);
    return payload && payload.sub ? payload.sub : '';
  }

  function dashboardDataSnapshot() {
    return {
      staff: state.staff,
      bookings: state.bookings,
      services: state.services,
      slots: state.slots,
      staffList: state.staffList,
      events: state.events,
      notes: state.notes,
      customers: state.customers,
      invoices: state.invoices,
      customerEvents: state.customerEvents,
      marketingCampaigns: state.marketingCampaigns,
      marketingRecipients: state.marketingRecipients,
      maintenancePreview: state.maintenancePreview,
      confirmationSettings: state.confirmationSettings
    };
  }

  function clearDashboardCache() {
    try {
      sessionStorage.removeItem(DASHBOARD_CACHE_KEY);
    } catch (error) {
      // Browser storage may be unavailable in private or restricted contexts.
    }
  }

  function saveDashboardCache() {
    try {
      sessionStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify({
        version: DASHBOARD_CACHE_VERSION,
        savedAt: Date.now(),
        userId: sessionUserId(state.session),
        data: dashboardDataSnapshot()
      }));
    } catch (error) {
      // Cache is an enhancement only.
    }
  }

  function applyDashboardData(data) {
    if (!data || typeof data !== 'object') return;
    if (data.staff) state.staff = data.staff;
    [
      'bookings',
      'services',
      'slots',
      'staffList',
      'events',
      'notes',
      'customers',
      'invoices',
      'customerEvents',
      'marketingCampaigns',
      'marketingRecipients'
    ].forEach(function (key) {
      if (Array.isArray(data[key])) state[key] = data[key];
    });
    if (Object.prototype.hasOwnProperty.call(data, 'maintenancePreview')) {
      state.maintenancePreview = data.maintenancePreview && typeof data.maintenancePreview === 'object' ? data.maintenancePreview : null;
    }
    if (Object.prototype.hasOwnProperty.call(data, 'confirmationSettings')) {
      state.confirmationSettings = data.confirmationSettings && typeof data.confirmationSettings === 'object'
        ? data.confirmationSettings
        : null;
    }
  }

  function restoreDashboardCache() {
    try {
      var cached = JSON.parse(sessionStorage.getItem(DASHBOARD_CACHE_KEY) || 'null');
      if (!cached || cached.version !== DASHBOARD_CACHE_VERSION || !cached.data) return false;
      if (Date.now() - Number(cached.savedAt || 0) > DASHBOARD_CACHE_MAX_AGE_MS) return false;
      var currentUserId = sessionUserId(state.session);
      if (cached.userId && currentUserId && cached.userId !== currentUserId) return false;
      applyDashboardData(cached.data);
      return Boolean(state.staff);
    } catch (error) {
      return false;
    }
  }

  function redirectTo(path) {
    if (window.location.pathname !== path) {
      window.location.replace(path);
    }
  }

  function isSessionExpired(session) {
    return Boolean(
      session &&
      session.expires_at &&
      Number(session.expires_at) * 1000 <= Date.now() + SESSION_REFRESH_MARGIN_MS
    );
  }

  async function refreshSession(session) {
    if (!session || !session.refresh_token) return null;

    var response = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ refresh_token: session.refresh_token })
    });

    if (!response.ok) return null;
    return response.json();
  }

  async function getActiveSession() {
    var session = getStoredSession();
    if (!session || !session.access_token) return null;

    if (!isSessionExpired(session)) {
      state.session = session;
      return session;
    }

    try {
      var refreshed = await refreshSession(session);
      if (refreshed && refreshed.access_token) {
        storeSession(refreshed);
        return refreshed;
      }
    } catch (error) {
      // Fall through to clearing the unusable session.
    }

    storeSession(null);
    return null;
  }

  function authHeaders() {
    return {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + state.session.access_token
    };
  }

  async function login(email, password) {
    var response = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ email: email, password: password })
    });

    if (!response.ok) {
      throw new Error('Sign in failed. Check your email and password.');
    }

    return response.json();
  }

  async function loadDashboard() {
    var response = await fetch(ADMIN_ENDPOINT + '?view=' + encodeURIComponent(adminViewForPage()), {
      method: 'GET',
      headers: authHeaders()
    });

    if (response.status === 401 || response.status === 403) {
      storeSession(null);
      throw new Error('This account is not approved for admin access or the session has expired.');
    }

    if (!response.ok) throw new Error('Could not load admin data.');

    applyDashboardData(await response.json());
    saveDashboardCache();
  }

  function adminViewForPage() {
    return {
      dashboard: 'schedule',
      availability: 'schedule',
      bookings: 'bookings',
      customers: 'customers',
      invoices: 'invoices',
      marketing: 'marketing'
    }[state.page] || 'all';
  }

  async function adminAction(payload) {
    var response = await fetch(ADMIN_ENDPOINT, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });

    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      throw new Error(data.error || 'The action could not be completed.');
    }
    return data;
  }

  function ensureToastRoot() {
    var root = $('[data-admin-toast-root]');
    if (!root) {
      root = document.createElement('div');
      root.className = 'admin-toast-root';
      root.setAttribute('data-admin-toast-root', '');
      root.setAttribute('aria-label', 'Notifications');
      document.body.appendChild(root);
    }
    return root;
  }

  function showToast(message, type, options) {
    var opts = options || {};
    var root = ensureToastRoot();
    var existing = $all('.admin-toast', root).find(function (item) {
      return item.dataset.message === String(message || '') && item.dataset.type === String(type || 'info');
    });
    if (existing) return existing;

    var toast = document.createElement('div');
    toast.className = 'admin-toast';
    toast.dataset.type = type || 'info';
    toast.dataset.message = String(message || '');
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    toast.setAttribute('aria-atomic', 'true');
    toast.innerHTML =
      '<span class="admin-toast-message">' + escapeHtml(message) + '</span>' +
      '<button class="admin-toast-close" type="button" aria-label="Dismiss notification">×</button>';
    root.appendChild(toast);

    function dismiss() {
      if (!toast.parentNode || toast.classList.contains('is-leaving')) return;
      toast.classList.add('is-leaving');
      window.setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 220);
    }

    $('.admin-toast-close', toast).addEventListener('click', dismiss);

    var persistent = Object.prototype.hasOwnProperty.call(opts, 'persistent')
      ? Boolean(opts.persistent)
      : type === 'error';
    if (!persistent) {
      window.setTimeout(dismiss, Number(opts.duration || (type === 'success' ? 5200 : 6500)));
    }
    return toast;
  }

  function scheduleRealtimeRefresh() {
    if (!state.session || !['dashboard', 'availability', 'bookings'].includes(state.page)) return;
    window.clearTimeout(state.realtimeRefreshTimer);
    state.realtimeRefreshTimer = window.setTimeout(function () {
      refresh().catch(function (error) {
        showToast(error instanceof Error ? error.message : 'Live refresh failed.', 'error');
      });
    }, 650);
  }

  function realtimeSend(topic, event, payload) {
    if (!state.realtimeSocket || state.realtimeSocket.readyState !== WebSocket.OPEN) return;
    state.realtimeRef += 1;
    state.realtimeSocket.send(JSON.stringify({
      topic: topic,
      event: event,
      payload: payload || {},
      ref: String(state.realtimeRef)
    }));
  }

  function closeRealtime() {
    if (state.realtimeHeartbeat) {
      window.clearInterval(state.realtimeHeartbeat);
      state.realtimeHeartbeat = null;
    }
    if (state.realtimeSocket) {
      state.realtimeSocket.onclose = null;
      state.realtimeSocket.close();
      state.realtimeSocket = null;
    }
  }

  function startRealtime() {
    if (!state.session || !state.staff || state.realtimeSocket) return;
    if (!('WebSocket' in window)) return;
    var socketUrl = SUPABASE_URL.replace(/^http/, 'ws') + '/realtime/v1/websocket?apikey=' + encodeURIComponent(SUPABASE_ANON_KEY) + '&vsn=1.0.0';
    var topic = 'realtime:admin-schedule-' + state.staff.organization_id;
    var socket = new WebSocket(socketUrl);
    state.realtimeSocket = socket;

    socket.onopen = function () {
      realtimeSend(topic, 'phx_join', {
        config: {
          broadcast: { self: false },
          presence: { key: '' },
          postgres_changes: [
            { event: '*', schema: 'public', table: 'availability_slots', filter: 'organization_id=eq.' + state.staff.organization_id },
            { event: '*', schema: 'public', table: 'bookings', filter: 'organization_id=eq.' + state.staff.organization_id }
          ]
        },
        access_token: state.session.access_token
      });
      state.realtimeHeartbeat = window.setInterval(function () {
        realtimeSend('phoenix', 'heartbeat', {});
      }, 25000);
    };

    socket.onmessage = function (event) {
      var message = {};
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message.event === 'postgres_changes') {
        scheduleRealtimeRefresh();
      }
    };

    socket.onclose = function () {
      if (state.realtimeSocket === socket) state.realtimeSocket = null;
      if (state.realtimeHeartbeat) {
        window.clearInterval(state.realtimeHeartbeat);
        state.realtimeHeartbeat = null;
      }
      if (state.session && ['dashboard', 'availability', 'bookings'].includes(state.page)) {
        window.setTimeout(startRealtime, 10000);
      }
    };

    socket.onerror = function () {
      socket.close();
    };
  }

  function ensureModalRoot() {
    var root = $('[data-admin-modal-root]');
    if (!root) {
      root = document.createElement('div');
      root.className = 'admin-modal-root';
      root.setAttribute('data-admin-modal-root', '');
      root.hidden = true;
      document.body.appendChild(root);
    }
    return root;
  }

  function ensureConfirmRoot() {
    var root = $('[data-admin-confirm-root]');
    if (!root) {
      root = document.createElement('div');
      root.className = 'admin-modal-root admin-confirm-root';
      root.setAttribute('data-admin-confirm-root', '');
      root.hidden = true;
      document.body.appendChild(root);
    }
    return root;
  }

  function closeConfirmDialog(options) {
    var opts = options || {};
    var root = ensureConfirmRoot();
    root.hidden = true;
    root.innerHTML = '';
    setUnderlyingModalBlocked(false);
    if (ensureModalRoot().hidden) {
      document.body.classList.remove('admin-modal-open');
      setPageInteractionBlocked(false);
    }
    if (opts.restoreFocus) focusElement(confirmReturnFocus);
    confirmReturnFocus = null;
  }

  function modalIsDirty() {
    var root = ensureModalRoot();
    return !root.hidden && root.dataset.dirty === 'true';
  }

  function markModalClean() {
    ensureModalRoot().dataset.dirty = 'false';
  }

  function rememberModalReturnFocus(element) {
    if (!element || ensureModalRoot().contains(element)) return;
    modalReturnFocus = element;
    modalReturnFocusSelector = focusSelectorFor(element);
  }

  function closeModal(options) {
    var opts = options || {};
    var root = ensureModalRoot();
    root.hidden = true;
    root.innerHTML = '';
    root.dataset.dirty = 'false';
    if (ensureConfirmRoot().hidden) {
      document.body.classList.remove('admin-modal-open');
      setPageInteractionBlocked(false);
    }
    if (opts.restoreFocus) {
      focusElement(modalReturnFocus, modalReturnFocusSelector);
      modalReturnFocus = null;
      modalReturnFocusSelector = '';
    }
  }

  function modalRouteFromUrl() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('confirmationSchedule')) return { type: 'confirmationSchedule', id: params.get('confirmationSchedule') };
    if (params.get('invoice')) return { type: 'invoice', id: params.get('invoice') };
    if (params.get('booking')) return { type: 'booking', id: params.get('booking') };
    if (params.get('customer')) return { type: 'customer', id: params.get('customer') };
    if (params.get('campaign')) return { type: 'campaign', id: params.get('campaign') };
    return null;
  }

  function modalUrl(route) {
    var url = new URL(window.location.href);
    ['customer', 'booking', 'invoice', 'campaign', 'confirmationSchedule'].forEach(function (key) {
      url.searchParams.delete(key);
    });
    if (route && route.type && route.id) {
      url.searchParams.set(route.type, route.id);
    }
    return url.pathname + url.search + url.hash;
  }

  function modalHistoryDepth() {
    return Number(history.state && history.state.adminModalDepth || 0);
  }

  function modalHistoryState(route, depth) {
    return {
      checkautoAdmin: true,
      adminModalRoute: route || null,
      adminModalDepth: Math.max(0, Number(depth || 0))
    };
  }

  function replaceCurrentHistoryState() {
    var route = modalRouteFromUrl();
    var depth = history.state && history.state.checkautoAdmin ? modalHistoryDepth() : (route ? 1 : 0);
    history.replaceState(modalHistoryState(route, depth), '', window.location.href);
  }

  function syncSelectedModalState(route) {
    state.selectedBookingId = null;
    state.selectedCustomerId = null;
    state.selectedInvoiceId = null;
    state.selectedCampaignId = null;

    if (!route) return;
    if (route.type === 'booking') state.selectedBookingId = route.id;
    if (route.type === 'customer') state.selectedCustomerId = route.id;
    if (route.type === 'invoice') state.selectedInvoiceId = route.id;
    if (route.type === 'campaign') state.selectedCampaignId = route.id;
  }

  function renderModalRoute(route) {
    if (!route) {
      closeModal({ restoreFocus: true });
      return;
    }

    if (route.type === 'booking') {
      var booking = bookingById(route.id);
      if (booking) renderBookingModal(booking);
      else closeModal({ restoreFocus: true });
      return;
    }

    if (route.type === 'customer') {
      if (customerById(route.id)) renderCustomerModal(route.id);
      else closeModal({ restoreFocus: true });
      return;
    }

    if (route.type === 'invoice') {
      if (invoiceById(route.id)) renderInvoiceModal(route.id);
      else closeModal({ restoreFocus: true });
      return;
    }

    if (route.type === 'campaign') {
      if (campaignById(route.id)) renderCampaignModal(route.id);
      else closeModal({ restoreFocus: true });
      return;
    }

    if (route.type === 'confirmationSchedule') {
      if (state.page === 'availability' && state.staff && state.staff.role === 'owner') {
        renderConfirmationScheduleModal();
      } else {
        history.replaceState(modalHistoryState(null, 0), '', modalUrl(null));
        syncSelectedModalState(null);
        closeModal({ restoreFocus: true });
      }
    }
  }

  function renderModalFromCurrentUrl() {
    var route = modalRouteFromUrl();
    syncSelectedModalState(route);
    renderModalRoute(route);
  }

  function applyUrlModalState() {
    syncSelectedModalState(modalRouteFromUrl());
    renderPage();
    renderModalFromCurrentUrl();
  }

  async function navigateToModal(type, id, options) {
    if (!type || !id) return;
    var opts = options || {};
    var route = { type: type, id: id };
    var current = modalRouteFromUrl();
    if (current && current.type === route.type && current.id === route.id) {
      renderModalRoute(route);
      return;
    }

    if (current && modalIsDirty() && !opts.force) {
      var discard = await openConfirmDialog({
        title: 'Discard changes?',
        message: 'Unsaved changes in this detail view will be lost.',
        cancelLabel: 'Keep editing',
        confirmLabel: 'Discard changes',
        danger: true
      });
      if (!discard) return;
      markModalClean();
    }

    if (!current) rememberModalReturnFocus(document.activeElement);
    history.pushState(modalHistoryState(route, modalHistoryDepth() + 1), '', modalUrl(route));
    applyUrlModalState();
  }

  async function closeModalRoute(options) {
    var opts = options || {};
    if (modalIsDirty() && !opts.force) {
      var discard = await openConfirmDialog({
        title: 'Discard changes?',
        message: 'Close this view and discard the changes you entered?',
        cancelLabel: 'Keep editing',
        confirmLabel: 'Discard changes',
        danger: true
      });
      if (!discard) return;
      markModalClean();
    }

    if (modalRouteFromUrl()) {
      history.replaceState(modalHistoryState(null, 0), '', modalUrl(null));
      syncSelectedModalState(null);
      closeModal({ restoreFocus: true });
      renderPage();
      return;
    }
    closeModal({ restoreFocus: true });
  }

  function openModal(html, size) {
    var root = ensureModalRoot();
    var route = modalRouteFromUrl();
    var canGoBack = Boolean(route && modalHistoryDepth() > 1);
    var navHtml = canGoBack
      ? '<div class="admin-modal-nav">' +
          '<button class="admin-button admin-button-secondary admin-icon-button admin-modal-back" type="button" data-admin-modal-back aria-label="Back" title="Back">' + ICON_BACK + '</button>' +
        '</div>'
      : '';

    root.hidden = false;
    root.innerHTML = '<div class="admin-modal-backdrop" data-admin-modal-close></div>' +
      '<section class="admin-modal-panel" data-size="' + escapeHtml(size || 'md') + '" role="dialog" aria-modal="true">' +
        navHtml +
        html +
      '</section>';
    document.body.classList.add('admin-modal-open');
    setPageInteractionBlocked(true);
    root.dataset.dirty = 'false';
    var panel = $('.admin-modal-panel', root);
    labelDialog(panel, 'Admin details');
    $all('[data-admin-modal-close]', root).forEach(function (item) {
      item.addEventListener('click', function () {
        closeModalRoute();
      });
    });
    var backButton = $('[data-admin-modal-back]', root);
    if (backButton) {
      backButton.addEventListener('click', function () {
        history.back();
      });
    }
    if (root._adminDirtyInput) root.removeEventListener('input', root._adminDirtyInput);
    if (root._adminDirtyChange) root.removeEventListener('change', root._adminDirtyChange);
    root._adminDirtyInput = function (event) {
      if (event.target && event.target.closest('form')) root.dataset.dirty = 'true';
    };
    root._adminDirtyChange = root._adminDirtyInput;
    root.addEventListener('input', root._adminDirtyInput);
    root.addEventListener('change', root._adminDirtyChange);
    bindDialogKeyboard(root, function () {
      closeModalRoute();
    });
    var firstInput = $('[data-admin-modal-back], [autofocus], input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), a[href]', root);
    if (firstInput) firstInput.focus();
    else if (panel) panel.focus();
    return root;
  }

  function openConfirmDialog(options) {
    return new Promise(function (resolve) {
      var root = ensureConfirmRoot();
      confirmReturnFocus = document.activeElement;
      root.hidden = false;
      root.innerHTML = '<div class="admin-modal-backdrop"></div>' +
        '<section class="admin-modal-panel admin-confirm-panel" data-size="sm" role="dialog" aria-modal="true">' +
          '<div class="admin-modal-header">' +
            '<div><span class="section-label">Confirm</span><h2>' + escapeHtml(options.title || 'Confirm action') + '</h2></div>' +
          '</div>' +
          '<p data-confirm-message>' + escapeHtml(options.message || 'Continue?') + '</p>' +
          '<div class="admin-action-buttons admin-modal-actions">' +
            '<button class="admin-button admin-button-secondary" type="button" data-confirm-no>' + escapeHtml(options.cancelLabel || 'Cancel') + '</button>' +
            '<button class="admin-button ' + escapeHtml(options.danger ? 'admin-button-danger' : 'admin-button-primary') + '" type="button" data-confirm-yes>' + escapeHtml(options.confirmLabel || 'Continue') + '</button>' +
          '</div>' +
        '</section>';
      document.body.classList.add('admin-modal-open');
      setPageInteractionBlocked(true);
      setUnderlyingModalBlocked(true);
      var panel = $('.admin-confirm-panel', root);
      labelDialog(panel, options.title || 'Confirm action');
      var message = $('[data-confirm-message]', root);
      if (panel && message) {
        dialogId += 1;
        message.id = 'admin-dialog-description-' + dialogId;
        panel.setAttribute('aria-describedby', message.id);
      }

      function finish(value) {
        closeConfirmDialog({ restoreFocus: true });
        resolve(value);
      }

      $('[data-confirm-no]', root).addEventListener('click', function () { finish(false); });
      $('[data-confirm-yes]', root).addEventListener('click', function () { finish(true); });
      bindDialogKeyboard(root, function () { finish(false); });
      $('[data-confirm-no]', root).focus();
    });
  }

  function openSlotDeleteDialog(slot) {
    if (!slot || !slot.recurrence_series_id) {
      return openConfirmDialog(confirmOptionsForAction('deleteSlot')).then(function (confirmed) {
        return confirmed ? 'single' : null;
      });
    }

    return new Promise(function (resolve) {
      var root = ensureConfirmRoot();
      confirmReturnFocus = document.activeElement;
      root.hidden = false;
      root.innerHTML = '<div class="admin-modal-backdrop"></div>' +
        '<section class="admin-modal-panel admin-confirm-panel" data-size="sm" role="dialog" aria-modal="true">' +
          '<div class="admin-modal-header">' +
            '<div><span class="section-label">Confirm</span><h2>Delete availability</h2></div>' +
          '</div>' +
          '<p data-confirm-message>' + escapeHtml(formatRange(slot.start_at, slot.end_at)) + ' is part of a weekly series. Deleted availability cannot be restored here.</p>' +
          '<div class="admin-action-buttons admin-modal-actions">' +
            '<button class="admin-button admin-button-secondary" type="button" data-confirm-no>Cancel</button>' +
            '<button class="admin-button admin-button-danger" type="button" data-confirm-single>Only this slot</button>' +
            '<button class="admin-button admin-button-danger" type="button" data-confirm-series>Whole series</button>' +
          '</div>' +
        '</section>';
      document.body.classList.add('admin-modal-open');
      setPageInteractionBlocked(true);
      setUnderlyingModalBlocked(true);
      var panel = $('.admin-confirm-panel', root);
      labelDialog(panel, 'Delete availability');
      var message = $('[data-confirm-message]', root);
      if (panel && message) {
        dialogId += 1;
        message.id = 'admin-dialog-description-' + dialogId;
        panel.setAttribute('aria-describedby', message.id);
      }

      function finish(value) {
        closeConfirmDialog({ restoreFocus: true });
        resolve(value);
      }

      $('[data-confirm-no]', root).addEventListener('click', function () { finish(null); });
      $('[data-confirm-single]', root).addEventListener('click', function () { finish('single'); });
      $('[data-confirm-series]', root).addEventListener('click', function () { finish('series'); });
      bindDialogKeyboard(root, function () { finish(null); });
      $('[data-confirm-no]', root).focus();
    });
  }

  function openMarketingSendConfirm(subject, body) {
    return new Promise(function (resolve) {
      var root = ensureConfirmRoot();
      var audienceCount = consentedCustomers().length;
      confirmReturnFocus = document.activeElement;
      root.hidden = false;
      root.innerHTML = '<div class="admin-modal-backdrop"></div>' +
        '<section class="admin-modal-panel admin-confirm-panel" data-size="lg" role="dialog" aria-modal="true">' +
          '<div class="admin-modal-header">' +
            '<div><span class="section-label">Confirm</span><h2>Send marketing email</h2></div>' +
          '</div>' +
          '<p data-confirm-message>Send this email to ' + audienceCount + ' customer' + (audienceCount === 1 ? '' : 's') + ' with active marketing consent?</p>' +
          '<div class="admin-email-preview admin-email-preview-modal"><iframe title="Marketing send preview" sandbox="" data-confirm-marketing-preview></iframe></div>' +
          '<div class="admin-action-buttons admin-modal-actions">' +
            '<button class="admin-button admin-button-secondary" type="button" data-confirm-no>Cancel</button>' +
            '<button class="admin-button admin-button-primary" type="button" data-confirm-yes>Send campaign</button>' +
          '</div>' +
        '</section>';
      document.body.classList.add('admin-modal-open');
      setPageInteractionBlocked(true);
      setUnderlyingModalBlocked(true);
      var panel = $('.admin-confirm-panel', root);
      labelDialog(panel, 'Send marketing email');
      var message = $('[data-confirm-message]', root);
      if (panel && message) {
        dialogId += 1;
        message.id = 'admin-dialog-description-' + dialogId;
        panel.setAttribute('aria-describedby', message.id);
      }

      var frame = $('[data-confirm-marketing-preview]', root);
      if (frame) {
        frame.srcdoc = '<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;color:#667085;padding:24px;">Loading preview...</body>';
        adminAction({
          action: 'previewMarketingEmail',
          marketingSubject: subject,
          marketingBody: body
        }).then(function (response) {
          frame.srcdoc = response.result && response.result.html ? response.result.html : '';
        }).catch(function (error) {
          frame.srcdoc = '<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;color:#b42318;padding:24px;">' + escapeHtml(error instanceof Error ? error.message : 'Preview unavailable.') + '</body>';
        });
      }

      function finish(value) {
        closeConfirmDialog({ restoreFocus: true });
        resolve(value);
      }

      $('[data-confirm-no]', root).addEventListener('click', function () { finish(false); });
      $('[data-confirm-yes]', root).addEventListener('click', function () { finish(true); });
      bindDialogKeyboard(root, function () { finish(false); });
      $('[data-confirm-no]', root).focus();
    });
  }

  function confirmOptionsForAction(action) {
    return {
      confirmBooking: {
        title: 'Confirm booking',
        message: 'Confirm this booking and send the confirmation email?',
        confirmLabel: 'Confirm booking'
      },
      rejectBooking: {
        title: 'Reject booking',
        message: 'Reject this booking and email the customer?',
        confirmLabel: 'Reject booking',
        danger: true
      },
      cancelBooking: {
        title: 'Cancel booking',
        message: 'Cancel this booking and email the customer?',
        confirmLabel: 'Cancel booking',
        danger: true
      },
      completeBooking: {
        title: 'Mark done',
        message: 'Mark this booking as done?',
        confirmLabel: 'Mark done'
      },
      markCustomerErasureRequest: {
        title: 'Record erasure request',
        message: 'Record that this customer requested erasure? This documents the request only. It does not redact or delete retained invoice, legal-hold, or active operational records.',
        confirmLabel: 'Record request'
      },
      setCustomerLegalHold: {
        title: 'Start legal hold',
        message: 'Start this legal hold? Redaction and deletion will be blocked until the hold is released or expires.',
        confirmLabel: 'Start legal hold'
      },
      releaseCustomerLegalHold: {
        title: 'Release legal hold',
        message: 'Release this legal hold? Eligible redaction and deletion actions can become available again. No data is deleted by this action.',
        confirmLabel: 'Release hold'
      },
      withdrawCustomerMarketingConsent: {
        title: 'Withdraw marketing permission',
        message: 'Stop future marketing emails to this customer? Transactional booking and invoice messages are unaffected.',
        confirmLabel: 'Withdraw permission'
      },
      createAndSendInvoice: {
        title: 'Create and send invoice',
        message: 'Create an invoice PDF, send it to the customer, and mark it unpaid?',
        confirmLabel: 'Create invoice'
      },
      markBookingPaid: {
        title: 'Mark booking paid',
        message: 'Mark this Done booking as paid without creating an invoice?',
        confirmLabel: 'Mark paid'
      },
      markInvoicePaid: {
        title: 'Mark invoice paid',
        message: 'Mark this invoice as paid?',
        confirmLabel: 'Mark paid'
      },
      resendInvoice: {
        title: 'Resend invoice',
        message: 'Send this invoice PDF to the customer again?',
        confirmLabel: 'Resend invoice'
      },
      voidInvoice: {
        title: 'Void invoice',
        message: 'Void this invoice? The number and PDF stay retained and this cannot be undone.',
        confirmLabel: 'Void invoice',
        danger: true
      },
      deleteSlot: {
        title: 'Delete availability',
        message: 'Delete this availability slot entirely?',
        confirmLabel: 'Delete slot',
        danger: true
      },
      deleteSlotSeries: {
        title: 'Delete availability series',
        message: 'Delete every open slot in this weekly series?',
        confirmLabel: 'Delete series',
        danger: true
      },
      redactBookingPii: {
        title: 'Redact booking PII',
        message: 'Redact personal data from this booking? This cannot be undone.',
        confirmLabel: 'Redact booking',
        danger: true
      },
      redactCustomerPii: {
        title: 'Redact personal data',
        message: 'Permanently remove direct identifiers from this profile and linked non-active bookings? Invoice records remain retained. This cannot be undone.',
        confirmLabel: 'Redact personal data',
        danger: true
      },
      deleteCustomerProfile: {
        title: 'Delete redacted profile',
        message: 'Permanently delete this eligible redacted profile and linked non-active bookings? Retained invoices are not deleted. This cannot be undone.',
        confirmLabel: 'Delete redacted profile',
        danger: true
      },
      sendMarketingCampaign: {
        title: 'Send marketing email',
        message: 'Send this email to every customer with active marketing consent?',
        confirmLabel: 'Send campaign'
      }
    }[action] || null;
  }

  function showConsole(options) {
    var wasHidden = Boolean(els.console && els.console.hidden);
    if (els.loading) els.loading.hidden = true;
    if (els.console) els.console.hidden = false;
    if (wasHidden && !(options && options.preserveScroll)) {
      window.scrollTo(0, 0);
    }
  }

  function navIsOpen() {
    return document.body.classList.contains('is-nav-open');
  }

  function setNavOpen(open, options) {
    var opts = options || {};
    var consoleRoot = $('.admin-console');
    var sidebar = $('#admin-sidebar');
    var toggle = $('[data-admin-nav-toggle]');
    var pageRoot = $('[data-page-root]');
    document.body.classList.toggle('is-nav-open', Boolean(open));
    if (consoleRoot) consoleRoot.classList.toggle('is-nav-open', Boolean(open));
    if (toggle) {
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-controls', 'admin-sidebar');
      toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
      toggle.setAttribute('title', open ? 'Close navigation' : 'Open navigation');
    }
    if (sidebar) sidebar.classList.toggle('is-nav-open', Boolean(open));
    if (pageRoot) {
      if (open) {
        pageRoot.setAttribute('inert', '');
        pageRoot.setAttribute('aria-hidden', 'true');
      } else {
        pageRoot.removeAttribute('inert');
        pageRoot.removeAttribute('aria-hidden');
      }
    }

    if (open && opts.focus !== false) {
      var currentLink = sidebar && ($('[aria-current="page"]', sidebar) || $('[data-admin-nav]', sidebar));
      window.setTimeout(function () {
        if (!navIsOpen()) return;
        var target = currentLink || sidebar;
        if (!target || !document.body.contains(target) || typeof target.focus !== 'function') return;
        try {
          target.focus({ preventScroll: true });
        } catch (error) {
          target.focus();
        }
      }, 80);
    } else if (!open && opts.restoreFocus) {
      focusElement(toggle);
    }
  }

  function setActiveNav() {
    $all('[data-admin-nav]').forEach(function (link) {
      var active = link.dataset.adminNav === state.page;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function setUserLabel() {
    var target = $('[data-admin-user]');
    if (target && state.staff) {
      target.textContent = state.staff.display_name + ' - ' + state.staff.role;
    }
  }

  function renderStats() {
    if (!els.stats) return;
    var today = todayYmd();
    var pending = state.bookings.filter(function (booking) {
      return booking.status === 'pending' && (!booking.pending_expires_at || new Date(booking.pending_expires_at) >= new Date());
    }).length;
    var confirmedToday = state.bookings.filter(function (booking) {
      var start = booking.final_start_at || booking.requested_start_at;
      return booking.status === 'confirmed' && start && formatDate(start) === today;
    }).length;
    var openNext7 = state.slots.filter(function (slot) {
      return slot.status === 'open' &&
        compareYmd(formatDate(slot.start_at), today) >= 0 &&
        compareYmd(formatDate(slot.start_at), addDaysYmd(today, 7)) < 0 &&
        !slotHasScheduleBooking(slot.id);
    }).length;

    els.stats.innerHTML =
      '<a class="admin-stat admin-stat-link" data-tone="' + (pending ? 'urgent' : 'neutral') + '" href="' + PATHS.bookings + '?filter=pending">' +
        '<span>Pending review</span><strong>' + pending + '</strong>' +
      '</a>' +
      '<a class="admin-stat admin-stat-link" data-tone="' + (confirmedToday ? 'active' : 'neutral') + '" href="' + PATHS.bookings + '?filter=confirmed">' +
        '<span>Confirmed today</span><strong>' + confirmedToday + '</strong>' +
      '</a>' +
      '<a class="admin-stat admin-stat-link" data-tone="' + (openNext7 ? 'available' : 'warning') + '" href="' + PATHS.availability + '">' +
        '<span>Open next 7 days</span><strong>' + openNext7 + '</strong>' +
      '</a>';
  }

  function latestBookingsBySlot(predicate) {
    var map = {};
    state.bookings.slice().sort(function (a, b) {
      return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
    }).forEach(function (booking) {
      if (predicate && !predicate(booking)) return;
      if (booking.availability_slot_id && !map[booking.availability_slot_id]) {
        map[booking.availability_slot_id] = booking;
      }
    });
    return map;
  }

  function slotHasActiveBooking(slotId) {
    return state.bookings.some(function (booking) {
      return booking.availability_slot_id === slotId && ['pending', 'confirmed'].includes(booking.status);
    });
  }

  function slotHasScheduleBooking(slotId) {
    return state.bookings.some(function (booking) {
      return booking.availability_slot_id === slotId && isScheduleStatus(booking.status);
    });
  }

  function buildCalendarEvents() {
    var bookingBySlot = latestBookingsBySlot(function (booking) {
      return isScheduleStatus(booking.status);
    });
    var events = [];

    state.slots.forEach(function (slot) {
      if (slot.status !== 'open') return;
      var booking = bookingBySlot[slot.id];
      if (booking) {
        events.push(calendarEventFromBooking(booking, slot));
        return;
      }

      events.push({
        id: 'slot:' + slot.id,
        type: 'slot',
        slotId: slot.id,
        status: 'available',
        start: slot.start_at,
        end: slot.end_at,
        title: serviceNameById(slot.service_id),
        meta: (staffById(slot.assigned_staff_id) || {}).display_name || 'Unassigned',
        href: PATHS.availability + '?slot=' + encodeURIComponent(slot.id)
      });
    });

    state.bookings.forEach(function (booking) {
      if (booking.availability_slot_id) return;
      if (!isScheduleStatus(booking.status)) return;
      events.push(calendarEventFromBooking(booking, null));
    });

    return events.sort(function (a, b) {
      return new Date(a.start) - new Date(b.start);
    });
  }

  function calendarEventFromBooking(booking, slot) {
    var start = booking.final_start_at || booking.requested_start_at || (slot && slot.start_at);
    var end = booking.final_end_at || booking.requested_end_at || (slot && slot.end_at);
    return {
      id: 'booking:' + booking.id,
      type: 'booking',
      bookingId: booking.id,
      slotId: booking.availability_slot_id || (slot && slot.id) || null,
      status: booking.status,
      start: start,
      end: end,
      title: booking.public_reference + ' - ' + booking.customer_name,
      meta: booking.vehicle || serviceNameForBooking(booking),
      href: PATHS.bookings + '?booking=' + encodeURIComponent(booking.id)
    };
  }

  function calendarRange() {
    if (state.calendarView === 'day') {
      return {
        start: state.calendarAnchor,
        endExclusive: addDaysYmd(state.calendarAnchor, 1),
        days: [state.calendarAnchor]
      };
    }

    var start = startOfWeekYmd(state.calendarAnchor);
    var days = [];
    for (var i = 0; i < 7; i += 1) days.push(addDaysYmd(start, i));
    return { start: start, endExclusive: addDaysYmd(start, 7), days: days };
  }

  function eventIsInRange(event, range) {
    var date = formatDate(event.start);
    return compareYmd(date, range.start) >= 0 && compareYmd(date, range.endExclusive) < 0;
  }

  function eventMinutes(value) {
    var parts = dateTimeParts(value);
    return Number(parts.hour) * 60 + Number(parts.minute);
  }

  function calendarHours(events) {
    var min = DEFAULT_START_HOUR;
    var max = DEFAULT_END_HOUR;

    events.forEach(function (event) {
      min = Math.min(min, Math.floor(eventMinutes(event.start) / 60));
      max = Math.max(max, Math.ceil(eventMinutes(event.end) / 60));
    });

    min = Math.max(0, min);
    max = Math.min(24, Math.max(min + 1, max));
    return { start: min, end: max };
  }

  function dayLabel(dateValue) {
    var weekday = new Intl.DateTimeFormat('en-GB', {
      timeZone: TIME_ZONE,
      weekday: 'short'
    }).format(utcNoonFromYmd(dateValue));
    return weekday + ' ' + dateValue.slice(5);
  }

  function compactCalendarDate(dateValue, options) {
    var opts = options || {};
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: TIME_ZONE,
      weekday: opts.weekday ? 'short' : undefined,
      day: 'numeric',
      month: 'short',
      year: opts.year ? 'numeric' : undefined
    }).format(utcNoonFromYmd(dateValue));
  }

  function calendarRangeTitle(range, compact) {
    if (state.calendarView === 'day') {
      return compactCalendarDate(range.start, { weekday: true, year: !compact });
    }

    var end = addDaysYmd(range.endExclusive, -1);
    var crossesYear = range.start.slice(0, 4) !== end.slice(0, 4);
    return compactCalendarDate(range.start, { year: crossesYear }) +
      ' - ' +
      compactCalendarDate(end, { year: crossesYear || !compact });
  }

  function bookingRowHtml(booking, attributeName) {
    var start = booking.final_start_at || booking.requested_start_at;
    var end = booking.final_end_at || booking.requested_end_at;
    var serviceName = serviceNameForBooking(booking);
    var dateRange = formatRange(start, end);
    var vehicle = booking.vehicle || 'No vehicle';
    var rowLabel = [
      booking.public_reference,
      booking.customer_name,
      statusLabel(booking.status),
      serviceName,
      dateRange,
      vehicle
    ].join(', ');
    var expiryTimer = expiryCountdownState(booking.pending_expires_at, booking.created_at);
    var expiryLabel = booking.status === 'pending' && expiryTimer
      ? ', review deadline ' + expiryCountdownLabel(expiryTimer, 'compact')
      : '';
    return '<button class="admin-booking-item admin-data-row' + (booking.id === state.selectedBookingId ? ' is-selected' : '') + '" type="button" aria-label="' + escapeHtml(rowLabel + expiryLabel) + '" data-booking-base-label="' + escapeHtml(rowLabel) + '" ' +
      attributeName + '="' + escapeHtml(booking.id) + '">' +
        '<span class="admin-row-primary admin-booking-item-header">' +
          '<span class="admin-booking-title"><strong>' + escapeHtml(booking.public_reference) + '</strong><span>' + escapeHtml(booking.customer_name) + '</span></span>' +
        '</span>' +
        '<span class="admin-row-status admin-booking-row-state"><span class="admin-status-pill" data-status="' + escapeHtml(statusTone(booking.status)) + '">' + escapeHtml(statusLabel(booking.status)) + '</span>' + expiryCountdownHtml(booking, 'compact') + '</span>' +
        '<span class="admin-row-service admin-booking-meta">' + escapeHtml(serviceName) + '</span>' +
        '<span class="admin-row-date admin-booking-meta">' + escapeHtml(dateRange) + '</span>' +
        '<span class="admin-row-meta admin-booking-meta">' + escapeHtml(vehicle) + '</span>' +
      '</button>';
  }

  function renderDashboardPage() {
    els.stats = $('[data-admin-stats]');
    renderStats();
    renderCalendar();
  }

  function calendarIsCompact() {
    if (calendarMediaQuery) return Boolean(calendarMediaQuery.matches);
    return Boolean(window.matchMedia && window.matchMedia('(max-width: 820px)').matches);
  }

  function applyCalendarLayout(calendar) {
    if (!calendar) return;
    var compact = calendarIsCompact();
    calendar.classList.toggle('is-compact', compact);
    calendar.dataset.calendarLayout = compact ? 'agenda' : 'grid';
  }

  function setupCalendarMedia() {
    if (!window.matchMedia || calendarMediaQuery) return;
    calendarMediaQuery = window.matchMedia('(max-width: 820px)');
    var handleChange = function () {
      renderCalendar();
    };
    if (typeof calendarMediaQuery.addEventListener === 'function') {
      calendarMediaQuery.addEventListener('change', handleChange);
    } else if (typeof calendarMediaQuery.addListener === 'function') {
      calendarMediaQuery.addListener(handleChange);
    }
  }

  function renderCalendar() {
    var calendar = $('[data-admin-calendar]');
    if (!calendar) return;
    applyCalendarLayout(calendar);

    var range = calendarRange();
    var events = buildCalendarEvents().filter(function (event) { return eventIsInRange(event, range); });
    var hours = calendarHours(events);
    var hourCount = hours.end - hours.start;
    var calendarTitle = $('[data-admin-calendar-title]');
    var dateInput = $('[data-calendar-date]');

    if (calendarTitle) {
      calendarTitle.textContent = calendarRangeTitle(range, calendarIsCompact());
      calendarTitle.setAttribute('title', calendarRangeTitle(range, false));
    }
    if (dateInput) dateInput.value = state.calendarAnchor;

    var byDay = {};
    range.days.forEach(function (day) { byDay[day] = []; });
    events.forEach(function (event) {
      var day = formatDate(event.start);
      if (byDay[day]) byDay[day].push(event);
    });

    calendar.innerHTML =
      '<div class="admin-calendar-scroll">' +
        '<div class="admin-calendar-grid" style="--day-count:' + range.days.length + ';--calendar-height:' + (hourCount * HOUR_HEIGHT) + 'px;">' +
          '<div class="admin-calendar-head">' +
            '<div class="admin-calendar-corner"></div>' +
            range.days.map(function (day) {
              return '<div class="admin-calendar-day-head" data-past="' + (compareYmd(day, todayYmd()) < 0 ? 'true' : 'false') + '">' + escapeHtml(dayLabel(day)) + '</div>';
            }).join('') +
          '</div>' +
          '<div class="admin-calendar-body">' +
            '<div class="admin-calendar-times">' + renderTimeRail(hours) + '</div>' +
            '<div class="admin-calendar-days">' + range.days.map(function (day) {
              return renderCalendarDay(day, byDay[day], hours);
            }).join('') + '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      renderCalendarAgenda(range, byDay);

    $all('[data-calendar-event]').forEach(function (button) {
      button.addEventListener('click', function () {
        var event = events.find(function (item) { return item.id === button.dataset.calendarEvent; });
        if (!event) return;
        if (state.page === 'availability') {
          if (event.type === 'slot' && event.slotId) {
            slotEditorReturnFocus = button;
            slotEditorReturnFocusSelector = focusSelectorFor(button);
            selectSlotForEdit(event.slotId);
            return;
          }
          if (event.type === 'booking' && event.bookingId) {
            navigateToModal('booking', event.bookingId);
            return;
          }
        }
        if (event.type === 'booking' && event.bookingId) {
          navigateToModal('booking', event.bookingId);
          return;
        }
        if (event.href) window.location.href = event.href;
      });
    });
  }

  function renderCalendarAgenda(range, byDay) {
    return '<div class="admin-calendar-agenda" aria-label="Calendar agenda">' +
      range.days.map(function (day) {
        var events = byDay[day] || [];
        return '<section class="admin-calendar-agenda-day">' +
          '<div class="admin-calendar-agenda-date">' +
            '<span>' + escapeHtml(dayLabel(day)) + '</span>' +
            '<span>' + events.length + ' event' + (events.length === 1 ? '' : 's') + '</span>' +
          '</div>' +
          '<div class="admin-calendar-agenda-events">' +
            (events.length ? events.map(function (event) {
              var eventLabel = formatTime(event.start) + ' to ' + formatTime(event.end) + ', ' + event.title +
                (event.meta ? ', ' + event.meta : '') + ', ' + statusLabel(event.status);
              return '<button class="admin-calendar-agenda-event' + (event.slotId && event.slotId === state.selectedSlotId ? ' is-selected' : '') + '" type="button" aria-label="' + escapeHtml(eventLabel) + '" data-tone="' + escapeHtml(statusTone(event.status)) + '" data-calendar-event="' + escapeHtml(event.id) + '">' +
                '<span class="admin-calendar-agenda-time">' + escapeHtml(formatTime(event.start) + '–' + formatTime(event.end)) + '</span>' +
                '<span class="admin-calendar-agenda-meta"><strong>' + escapeHtml(event.title) + '</strong><span>' + escapeHtml(event.meta || '') + '</span></span>' +
                '<span class="admin-status-pill" data-status="' + escapeHtml(statusTone(event.status)) + '">' + escapeHtml(statusLabel(event.status)) + '</span>' +
              '</button>';
            }).join('') : '<p class="admin-calendar-agenda-empty">No scheduled items.</p>') +
          '</div>' +
        '</section>';
      }).join('') +
    '</div>';
  }

  function renderTimeRail(hours) {
    var html = '';
    for (var hour = hours.start; hour < hours.end; hour += 1) {
      html += '<div class="admin-calendar-time" style="height:' + HOUR_HEIGHT + 'px;">' + pad2(hour) + ':00</div>';
    }
    return html;
  }

  function renderCalendarDay(day, events, hours) {
    var lines = '';
    for (var hour = hours.start; hour < hours.end; hour += 1) {
      lines += '<div class="admin-calendar-line" style="height:' + HOUR_HEIGHT + 'px;"></div>';
    }

    return '<div class="admin-calendar-day" data-day="' + escapeHtml(day) + '" data-past="' + (compareYmd(day, todayYmd()) < 0 ? 'true' : 'false') + '">' +
      lines +
      events.map(function (event) { return renderCalendarEvent(event, hours); }).join('') +
    '</div>';
  }

  function renderCalendarEvent(event, hours) {
    var start = eventMinutes(event.start);
    var end = eventMinutes(event.end);
    var top = Math.max(0, start - hours.start * 60) / 60 * HOUR_HEIGHT;
    var height = Math.max(34, (Math.max(end, start + 15) - start) / 60 * HOUR_HEIGHT);
    var tone = statusTone(event.status);
    var eventLabel = formatTime(event.start) + ' to ' + formatTime(event.end) + ', ' +
      event.title + ', ' + statusLabel(event.status);
    return '<button class="admin-calendar-event' + (event.slotId && event.slotId === state.selectedSlotId ? ' is-selected' : '') + (state.page === 'availability' && event.type === 'booking' ? ' is-readonly' : '') + '" type="button" aria-label="' + escapeHtml(eventLabel) + '" data-tone="' + escapeHtml(tone) + '" data-calendar-event="' + escapeHtml(event.id) + '" style="top:' + top + 'px;height:' + height + 'px;">' +
      '<strong>' + escapeHtml(formatTime(event.start) + '-' + formatTime(event.end)) + '</strong>' +
      '<span>' + escapeHtml(statusLabel(event.status) + ': ' + event.title) + '</span>' +
    '</button>';
  }

  function bookingScheduleStart(booking) {
    return booking.final_start_at || booking.requested_start_at || booking.created_at || '';
  }

  function getFilteredBookings() {
    var bookings = state.bookings.slice();
    if (state.filter === 'today') {
      var today = todayYmd();
      bookings = bookings.filter(function (booking) {
        var start = bookingScheduleStart(booking);
        return start && ['pending', 'confirmed'].includes(booking.status) && formatDate(start) === today;
      });
    } else if (state.filter === 'completed') {
      bookings = bookings.filter(function (booking) { return booking.status === 'completed'; });
    } else if (state.filter !== 'all') {
      bookings = bookings.filter(function (booking) { return booking.status === state.filter; });
    }
    return bookings.sort(function (a, b) {
      var priority = { pending: 0, confirmed: 1, cancelled: 2, rejected: 3, expired: 4, completed: 5 };
      var direction = state.bookingSort === 'desc' ? -1 : 1;
      var dateCompare = (new Date(bookingScheduleStart(a)).getTime() || 0) - (new Date(bookingScheduleStart(b)).getTime() || 0);
      return (dateCompare * direction) ||
        ((priority[a.status] || 9) - (priority[b.status] || 9)) ||
        (new Date(b.created_at) - new Date(a.created_at));
    });
  }

  function renderBookingsPage() {
    els.bookingList = $('[data-admin-booking-list]');
    renderBookings();
  }

  function renderBookings() {
    var bookings = getFilteredBookings();
    if (!els.bookingList) return;
    var count = $('[data-admin-booking-count]');
    if (count) {
      count.textContent = bookings.length + ' booking' + (bookings.length === 1 ? '' : 's');
      count.setAttribute('role', 'status');
      count.setAttribute('aria-live', 'polite');
      count.setAttribute('aria-atomic', 'true');
    }

    if (!bookings.length) {
      els.bookingList.innerHTML = emptyState(
        state.filter === 'all' ? 'No bookings yet.' : 'No bookings match this filter.',
        state.filter === 'all' ? '' : 'Show all bookings',
        'data-empty-bookings-all'
      );
      var showAll = $('[data-empty-bookings-all]', els.bookingList);
      if (showAll) {
        showAll.addEventListener('click', function () {
          var allButton = $('[data-filter="all"]');
          if (allButton) allButton.click();
        });
      }
      return;
    }

    els.bookingList.innerHTML = bookings.map(function (booking) {
      return bookingRowHtml(booking, 'data-booking-id');
    }).join('');

    $all('[data-booking-id]', els.bookingList).forEach(function (button) {
      button.addEventListener('click', function () {
        state.selectedBookingId = button.dataset.bookingId;
        navigateToModal('booking', button.dataset.bookingId);
      });
    });
    updateExpiryCountdowns();
  }

  function detailRow(label, value) {
    return '<span><strong>' + escapeHtml(label) + ':</strong> ' + escapeHtml(value || 'Not provided') + '</span>';
  }

  function renderBookingModal(booking) {
    var assigned = staffById(booking.assigned_to_staff_id);
    var requested = formatRange(booking.requested_start_at, booking.requested_end_at);
    var finalTime = booking.final_start_at ? formatRange(booking.final_start_at, booking.final_end_at) : 'Not confirmed yet';
    var reviewTimeLabel = booking.final_start_at ? 'Scheduled time' : 'Requested time';
    var reviewTime = booking.final_start_at ? finalTime : requested;
    var mapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(booking.vehicle_location || '');
    var customer = customerForBooking(booking);
    var vehicleActions =
      (booking.vehicle_location
        ? '<a class="admin-context-action" href="' + escapeHtml(mapsUrl) + '" target="_blank" rel="noopener noreferrer">' + ICON_MAP + '<span>Open map</span></a>'
        : '') +
      (booking.listing_url
        ? '<a class="admin-context-action" href="' + escapeHtml(booking.listing_url) + '" target="_blank" rel="noopener noreferrer">' + ICON_EXTERNAL + '<span>Open listing</span></a>'
        : '');
    var customerActions =
      (booking.customer_phone
        ? '<a class="admin-context-action" href="tel:' + escapeHtml(booking.customer_phone) + '">' + ICON_PHONE + '<span>Call</span></a>'
        : '') +
      (booking.customer_email
        ? '<a class="admin-context-action" href="mailto:' + escapeHtml(booking.customer_email) + '">' + ICON_EMAIL + '<span>Email</span></a>'
        : '') +
      (customer
        ? '<button class="admin-context-action" type="button" data-open-customer="' + escapeHtml(customer.id) + '">' + ICON_USER + '<span>Customer profile</span></button>'
        : '');

    var html =
      '<div class="admin-modal-header">' +
        '<div>' +
          '<div class="admin-modal-status-line">' +
            '<span class="admin-status-pill" data-status="' + escapeHtml(statusTone(booking.status)) + '">' + escapeHtml(statusLabel(booking.status)) + '</span>' +
            '<span class="admin-status-explanation">' + escapeHtml(bookingStatusDescription(booking.status)) + '</span>' +
          '</div>' +
          '<h2>' + escapeHtml(booking.public_reference) + '</h2>' +
        '</div>' +
        '<button class="admin-preview-close admin-icon-button" type="button" data-admin-modal-close aria-label="Close booking" title="Close">' + ICON_CLOSE + '</button>' +
      '</div>' +
      '<section class="admin-detail-section admin-booking-overview">' +
        '<span class="admin-section-kicker">Review first</span>' +
        '<h3>Booking details</h3>' +
        expiryCountdownHtml(booking, 'full') +
        '<div class="admin-booking-overview-grid">' +
          '<div class="admin-booking-primary-fact">' +
            '<span>' + escapeHtml(reviewTimeLabel) + '</span>' +
            '<strong>' + escapeHtml(reviewTime) + '</strong>' +
            '<span>' + escapeHtml(serviceNameForBooking(booking)) + '</span>' +
          '</div>' +
          '<div class="admin-booking-key-facts">' +
            '<div class="admin-booking-key-fact">' +
              '<span>Vehicle</span>' +
              '<strong>' + escapeHtml(booking.vehicle || 'Not provided') + '</strong>' +
              '<span>' + escapeHtml(booking.vehicle_location || 'Location not provided') + '</span>' +
              (vehicleActions ? '<div class="admin-context-actions">' + vehicleActions + '</div>' : '') +
            '</div>' +
            '<div class="admin-booking-key-fact">' +
              '<span>Customer</span>' +
              '<strong>' + escapeHtml(booking.customer_name || 'Not provided') + '</strong>' +
              '<span>' + escapeHtml(booking.customer_phone || 'Phone not provided') + '</span>' +
              '<span>' + escapeHtml(booking.customer_email || 'Email not provided') + '</span>' +
              (customerActions ? '<div class="admin-context-actions">' + customerActions + '</div>' : '') +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="admin-booking-overview-meta">' +
          '<span>Assigned to: <strong>' + escapeHtml(assigned ? assigned.display_name : 'Unassigned') + '</strong></span>' +
          (booking.final_start_at ? '<span>Originally requested: <strong>' + escapeHtml(requested) + '</strong></span>' : '') +
          (booking.pending_expires_at && booking.status !== 'pending' ? '<span>Review deadline: <strong>' + escapeHtml(formatDateTime(booking.pending_expires_at)) + '</strong></span>' : '') +
        '</div>' +
      '</section>' +
      renderRequestActions(booking) +
      (booking.customer_message
        ? '<div class="admin-detail-section admin-booking-note"><h3>Customer note</h3><p>' + escapeHtml(booking.customer_message) + '</p></div>'
        : '') +
      renderBookingInvoiceActions(booking);

    var modal = openModal(html, 'lg');
    updateExpiryCountdowns();

    $all('[data-admin-action-form]', modal).forEach(function (form) {
      form.addEventListener('submit', handleActionSubmit);
    });

    var completeButton = $('[data-complete-booking]', modal);
    if (completeButton) {
      completeButton.addEventListener('click', async function () {
        await runAction({ action: 'completeBooking', bookingId: completeButton.dataset.completeBooking }, 'completeBooking', completeButton);
      });
    }

    var customerButton = $('[data-open-customer]', modal);
    if (customerButton) {
      customerButton.addEventListener('click', function () {
        navigateToModal('customer', customerButton.dataset.openCustomer);
      });
    }

    var invoiceButton = $('[data-open-invoice]', modal);
    if (invoiceButton) {
      invoiceButton.addEventListener('click', function () {
        navigateToModal('invoice', invoiceButton.dataset.openInvoice);
      });
    }
  }

  function hiddenInput(name, value) {
    return '<input type="hidden" name="' + escapeHtml(name) + '" value="' + escapeHtml(value || '') + '">';
  }

  function renderInlineActionForm(action, label, buttonClass, fields, disabled, title) {
    var inputs = Object.keys(fields).map(function (name) {
      return hiddenInput(name, fields[name]);
    }).join('');
    return '<form class="admin-inline-action-form" data-admin-action-form data-action="' + escapeHtml(action) + '">' +
      inputs +
      '<button class="admin-button ' + escapeHtml(buttonClass) + '" type="submit"' + (disabled ? ' disabled' : '') + (title ? ' title="' + escapeHtml(title) + '"' : '') + '>' + escapeHtml(label) + '</button>' +
      '<div class="admin-form-error" data-action-error role="status" aria-live="polite"></div>' +
    '</form>';
  }

  function renderSetHoldForm(customer, holdDefaultDate) {
    return '<form class="admin-action-form admin-privacy-form" data-admin-action-form data-action="setCustomerLegalHold">' +
      hiddenInput('customerId', customer.id) +
      '<div class="admin-action-grid">' +
        '<label>Hold until date<input name="holdUntilDate" type="text" inputmode="numeric" required value="' + escapeHtml(holdDefaultDate) + '" placeholder="2026-12-31"></label>' +
        '<label>Hold until time<input name="holdUntilTime" type="time" step="60" required value="23:59"></label>' +
      '</div>' +
      '<label>Reason<textarea name="legalHoldReason" maxlength="500" required placeholder="Required legal or dispute reason"></textarea></label>' +
      '<div class="admin-form-error" data-action-error role="status" aria-live="polite"></div>' +
      '<div class="admin-action-buttons"><button class="admin-button admin-button-secondary" type="submit">Start legal hold</button></div>' +
    '</form>';
  }

  function renderReleaseHoldForm(customer) {
    return '<form class="admin-action-form admin-privacy-form" data-admin-action-form data-action="releaseCustomerLegalHold">' +
      hiddenInput('customerId', customer.id) +
      '<div class="admin-form-error" data-action-error role="status" aria-live="polite"></div>' +
      '<div class="admin-action-buttons"><button class="admin-button admin-button-secondary" type="submit">Release legal hold</button></div>' +
    '</form>';
  }

  function paymentMethodOptions(selected) {
    return [
      ['cash', 'Cash'],
      ['bank_transfer', 'Bank transfer'],
      ['card', 'Card'],
      ['other', 'Other']
    ].map(function (item) {
      return '<option value="' + item[0] + '"' + (item[0] === selected ? ' selected' : '') + '>' + item[1] + '</option>';
    }).join('');
  }

  function renderCreateInvoiceForm(booking) {
    return '<form class="admin-action-form" data-admin-action-form data-action="createAndSendInvoice">' +
      hiddenInput('bookingId', booking.id) +
      '<div class="admin-action-grid">' +
        '<label>Amount<input name="amount" type="text" inputmode="decimal" required value="' + escapeHtml(defaultInvoiceAmount(booking)) + '" placeholder="100.00"></label>' +
        '<label>Due date<input name="dueDate" type="text" inputmode="numeric" required value="' + escapeHtml(defaultInvoiceDueDate()) + '" placeholder="2026-12-31"></label>' +
      '</div>' +
      '<div class="admin-action-grid">' +
        '<label>VAT<span class="admin-select-wrap"><select name="vatMode"><option value="none">No VAT</option><option value="included">VAT included</option></select></span></label>' +
        '<label>VAT rate %<input name="vatRate" type="text" inputmode="decimal" value="21" placeholder="21"></label>' +
      '</div>' +
      '<label>Service description<input name="serviceDescription" type="text" maxlength="300" value="' + escapeHtml(serviceNameForBooking(booking)) + '"></label>' +
      '<label>Billing details<textarea name="billingDetails" maxlength="1000" placeholder="Optional billing address, company code, VAT code..."></textarea></label>' +
      '<div class="admin-form-error" data-action-error role="status" aria-live="polite"></div>' +
      '<div class="admin-action-buttons"><button class="admin-button admin-button-primary" type="submit">Create and send invoice</button></div>' +
    '</form>';
  }

  function renderMarkBookingPaidForm(booking) {
    return '<form class="admin-action-form" data-admin-action-form data-action="markBookingPaid">' +
      hiddenInput('bookingId', booking.id) +
      '<div class="admin-action-grid">' +
        '<label>Payment method<span class="admin-select-wrap"><select name="paymentMethod">' + paymentMethodOptions('cash') + '</select></span></label>' +
        '<label>Payment note<input name="paymentNote" type="text" maxlength="500" placeholder="Optional"></label>' +
      '</div>' +
      '<div class="admin-form-error" data-action-error role="status" aria-live="polite"></div>' +
      '<div class="admin-action-buttons"><button class="admin-button admin-button-secondary" type="submit">Mark paid without invoice</button></div>' +
    '</form>';
  }

  function renderBookingInvoiceActions(booking) {
    if (booking.status !== 'completed') return '';
    var invoice = activeInvoiceForBooking(booking.id);

    if (invoice) {
      return '<div class="admin-detail-section">' +
        '<h2>Invoice and payment</h2>' +
        '<div class="admin-modal-status-line">' +
          '<span class="admin-status-pill" data-status="' + escapeHtml(invoiceTone(invoice)) + '">' + escapeHtml(invoiceStatusLabel(invoice)) + '</span>' +
          '<span class="admin-status-explanation">' + escapeHtml(invoiceStatusDescription(invoice)) + '</span>' +
        '</div>' +
        '<div class="admin-detail-list">' +
          detailRow('Invoice', invoice.invoice_number) +
          detailRow('Amount', formatMoney(invoice.amount_cents, invoice.currency)) +
          detailRow('Email delivery', emailStatusLabel(invoice.email_status)) +
        '</div>' +
        '<div class="admin-context-actions">' +
          '<button class="admin-context-action" type="button" data-open-invoice="' + escapeHtml(invoice.id) + '">' + ICON_INVOICE + '<span>Invoice details</span></button>' +
        '</div>' +
      '</div>';
    }

    if (booking.payment_status === 'paid') {
      return '<div class="admin-detail-section">' +
        '<h2>Invoice and payment</h2>' +
        '<div class="admin-detail-list">' +
          detailRow('Payment', paymentLabel(booking.payment_status)) +
          detailRow('Paid at', booking.paid_at ? formatDateTime(booking.paid_at) : '') +
          detailRow('Method', booking.payment_method) +
          detailRow('Note', booking.payment_note) +
        '</div>' +
      '</div>';
    }

    return '<div class="admin-detail-section">' +
      '<h2>Invoice and payment</h2>' +
      '<p class="admin-detail-note">Create an invoice only when needed. If the customer paid cash and no invoice is needed, mark this booking paid without invoice.</p>' +
      renderCreateInvoiceForm(booking) +
      renderMarkBookingPaidForm(booking) +
    '</div>';
  }

  function renderRequestActions(booking) {
    if (booking.status === 'pending') {
      return '<div class="admin-detail-section admin-booking-decision">' +
        '<h2>Review decision</h2>' +
        '<form class="admin-action-form" data-admin-action-form data-action="confirmBooking">' +
          '<input type="hidden" name="bookingId" value="' + escapeHtml(booking.id) + '">' +
          '<div class="admin-action-grid">' +
            '<label>Date<input name="date" type="text" inputmode="numeric" required value="' + escapeHtml(dateInputValue(booking.requested_start_at)) + '" placeholder="2026-12-31"></label>' +
            '<label>Start<input name="startTime" type="time" step="900" required value="' + escapeHtml(timeInputValue(booking.requested_start_at)) + '"></label>' +
            '<label>End<input name="endTime" type="time" step="900" required value="' + escapeHtml(timeInputValue(booking.requested_end_at)) + '"></label>' +
          '</div>' +
          '<label>Assign to<span class="admin-select-wrap"><select name="assignedStaffId" required>' + staffOptions(booking.assigned_to_staff_id || (state.staff && state.staff.id)) + '</select></span></label>' +
          '<label>Internal note<textarea name="internalNote" maxlength="1000"></textarea></label>' +
          '<div class="admin-form-error" data-action-error role="status" aria-live="polite"></div>' +
          '<div class="admin-action-buttons"><button class="admin-button admin-button-primary" type="submit">Confirm booking</button></div>' +
        '</form>' +
      '</div>' +
      '<div class="admin-detail-section admin-booking-rejection">' +
        '<h2>Reject booking</h2>' +
        '<form class="admin-action-form" data-admin-action-form data-action="rejectBooking">' +
          '<input type="hidden" name="bookingId" value="' + escapeHtml(booking.id) + '">' +
          '<label>Customer-visible reason<textarea name="customerReason" maxlength="700"></textarea></label>' +
          '<label>Internal note<textarea name="internalNote" maxlength="1000"></textarea></label>' +
          '<div class="admin-form-error" data-action-error role="status" aria-live="polite"></div>' +
          '<div class="admin-action-buttons"><button class="admin-button admin-button-danger" type="submit">Reject booking</button></div>' +
        '</form>' +
      '</div>';
    }

    if (booking.status === 'confirmed') {
      return '<div class="admin-detail-section admin-booking-decision">' +
        '<h2>Actions</h2>' +
        '<form class="admin-action-form" data-admin-action-form data-action="cancelBooking">' +
          '<input type="hidden" name="bookingId" value="' + escapeHtml(booking.id) + '">' +
          '<label>Customer-visible cancellation reason<textarea name="customerReason" maxlength="700"></textarea></label>' +
          '<label>Internal note<textarea name="internalNote" maxlength="1000"></textarea></label>' +
          '<div class="admin-form-error" data-action-error role="status" aria-live="polite"></div>' +
          '<div class="admin-action-buttons">' +
            '<button class="admin-button admin-button-danger" type="submit">Cancel booking</button>' +
            '<button class="admin-button admin-button-primary" type="button" data-complete-booking="' + escapeHtml(booking.id) + '">Mark completed</button>' +
          '</div>' +
        '</form>' +
      '</div>';
    }

    return '';
  }

  function normalizeSearch(value) {
    return String(value || '').toLowerCase().trim();
  }

  function customerSearchText(customer) {
    var bookings = bookingsForCustomer(customer.id);
    var invoices = invoicesForCustomer(customer.id);
    return [
      customer.id,
      customer.display_name,
      customer.email,
      customer.phone,
      customer.preferred_language,
      customer.marketing_consent_status,
      customer.marketing_consent_source,
      customer.marketing_consent_text_version,
      customer.legal_hold_reason,
      customer.pii_redacted_at ? 'redacted' : '',
      customer.erasure_requested_at ? 'erasure requested' : '',
      bookings.map(function (booking) {
        return [
          booking.public_reference,
          booking.status,
          booking.customer_name,
          booking.customer_email,
          booking.customer_phone,
          booking.vehicle,
          booking.vehicle_location,
          booking.listing_url,
          booking.customer_message,
          serviceNameForBooking(booking)
        ].join(' ');
      }).join(' '),
      invoices.map(function (invoice) {
        return [invoice.invoice_number, invoice.invoice_status, invoice.currency, invoice.amount_cents].join(' ');
      }).join(' ')
    ].join(' ').toLowerCase();
  }

  function getFilteredCustomers() {
    var query = normalizeSearch(state.customerSearch);
    var customers = state.customers.slice();
    if (query) {
      var parts = query.split(/\s+/).filter(Boolean);
      customers = customers.filter(function (customer) {
        var text = customerSearchText(customer);
        return parts.every(function (part) { return text.indexOf(part) !== -1; });
      });
    }
    return customers.sort(function (a, b) {
      return String(a.display_name || '').localeCompare(String(b.display_name || ''));
    });
  }

  function renderCustomersPage() {
    var search = $('[data-customer-search]');
    if (search && search.value !== state.customerSearch) search.value = state.customerSearch;
    var clear = $('[data-customer-clear]');
    if (clear) {
      clear.hidden = !state.customerSearch;
      clear.disabled = !state.customerSearch;
    }
    renderCustomerList();
  }

  function renderCustomerList() {
    var list = $('[data-customer-list]');
    if (!list) return;
    var customers = getFilteredCustomers();
    var count = $('[data-customer-count]');
    if (count) {
      count.textContent = customers.length + ' customer' + (customers.length === 1 ? '' : 's');
      count.setAttribute('role', 'status');
      count.setAttribute('aria-live', 'polite');
      count.setAttribute('aria-atomic', 'true');
    }

    if (!customers.length) {
      list.innerHTML = state.customerSearch
        ? emptyState('No customers match this search.', 'Clear search', 'data-empty-customers-clear')
        : emptyState('No customer profiles yet.');
      var emptyClear = $('[data-empty-customers-clear]', list);
      if (emptyClear) {
        emptyClear.addEventListener('click', function () {
          state.customerSearch = '';
          renderCustomersPage();
          var search = $('[data-customer-search]');
          if (search) search.focus();
        });
      }
      return;
    }

    list.innerHTML = customers.map(function (customer) {
      var bookings = bookingsForCustomer(customer.id);
      var invoices = invoicesForCustomer(customer.id);
      var customerName = customer.display_name || 'Unnamed customer';
      var customerEmail = customer.email || 'No email';
      var lastBooking = customer.last_booking_at ? formatDateTime(customer.last_booking_at) : 'No bookings yet';
      var customerMeta = (customer.phone || 'No phone') + ' · ' + bookings.length + ' booking' + (bookings.length === 1 ? '' : 's') + ' · ' + invoices.length + ' invoice' + (invoices.length === 1 ? '' : 's');
      var customerSummary = lastBooking + ' · ' + customerMeta;
      var customerLabel = [customerName, marketingLabel(customer.marketing_consent_status), customerEmail, lastBooking, customerMeta].join(', ');
      return '<button class="admin-customer-item admin-data-row' + (customer.id === state.selectedCustomerId ? ' is-selected' : '') + '" type="button" aria-label="' + escapeHtml(customerLabel) + '" data-customer-id="' + escapeHtml(customer.id) + '">' +
        '<span class="admin-row-primary admin-booking-item-header"><span class="admin-booking-title">' + escapeHtml(customerName) + '</span></span>' +
        '<span class="admin-row-status"><span class="admin-status-pill" data-status="' + escapeHtml(marketingTone(customer.marketing_consent_status)) + '">' + escapeHtml(marketingLabel(customer.marketing_consent_status)) + '</span></span>' +
        '<span class="admin-row-service admin-booking-meta">' + escapeHtml(customerEmail) + '</span>' +
        '<span class="admin-row-meta admin-booking-meta">' + escapeHtml(customerSummary) + '</span>' +
      '</button>';
    }).join('');

    $all('[data-customer-id]', list).forEach(function (button) {
      button.addEventListener('click', function () {
        navigateToModal('customer', button.dataset.customerId);
      });
    });
  }

  function marketingTone(status) {
    if (status === 'opted_in') return 'confirmed';
    if (status === 'suppressed') return 'warning';
    return 'neutral';
  }

  function marketingLabel(status) {
    return {
      opted_in: 'Marketing allowed',
      withdrawn: 'Consent withdrawn',
      suppressed: 'Marketing blocked',
      not_asked: 'No marketing consent'
    }[status] || 'No marketing consent';
  }

  function marketingStatusDescription(status) {
    return {
      opted_in: 'The customer can receive marketing emails.',
      withdrawn: 'The customer withdrew permission. Marketing emails must not be sent.',
      suppressed: 'Marketing delivery is blocked for this customer.',
      not_asked: 'No permission to send marketing emails is recorded.'
    }[status] || 'No permission to send marketing emails is recorded.';
  }

  function renderCustomerModal(customerId) {
    var customer = customerById(customerId);
    if (!customer) return;
    state.selectedCustomerId = customer.id;

    var bookings = bookingsForCustomer(customer.id).sort(function (a, b) {
      return new Date(b.created_at) - new Date(a.created_at);
    });
    var linkedBookings = allBookingsForCustomer(customer.id);
    var invoices = invoicesForCustomer(customer.id);
    var events = eventsForCustomer(customer.id).slice(0, 8);
    var holdActive = hasActiveLegalHold(customer);
    var redactionBlockReasons = customerRedactionBlockReasons(customer, bookings);
    var redactionDisabled = redactionBlockReasons.length > 0;
    var redactionBlockText = redactionDisabled ? 'Unavailable: ' + redactionBlockReasons.join('; ') + '.' : '';
    var deleteBlockReasons = customerDeleteBlockReasons(customer, linkedBookings);
    var deleteDisabled = deleteBlockReasons.length > 0;
    var deleteBlockText = deleteDisabled ? 'Unavailable: ' + deleteBlockReasons.join('; ') + '.' : '';
    var erasureRequestDisabled = Boolean(customer.erasure_requested_at);
    var erasureRequestTitle = erasureRequestDisabled ? 'Erasure request already recorded.' : '';
    var holdStatus = holdActive
      ? 'Active until ' + formatDateTime(customer.legal_hold_until)
      : 'No active legal hold';
    var holdDescription = holdActive
      ? 'Redaction and deletion are blocked until this hold is released or expires.'
      : 'Eligible personal data actions are not being blocked by a customer-level hold.';
    var erasureStatus = customer.erasure_completed_at
      ? 'Completed ' + formatDateTime(customer.erasure_completed_at)
      : (customer.erasure_requested_at ? 'Requested ' + formatDateTime(customer.erasure_requested_at) : 'No request recorded');
    var erasureDescription = customer.erasure_completed_at
      ? 'The recorded erasure workflow has been completed.'
      : (customer.erasure_requested_at
        ? 'A request is recorded. Retained invoice, legal, and active operational records may remain.'
        : 'Recording a request documents the customer request but does not delete data.');
    var profileStatus = customer.pii_redacted_at
      ? 'Redacted ' + formatDateTime(customer.pii_redacted_at)
      : 'Personal data present';
    var profileDescription = customer.pii_redacted_at
      ? 'Direct identifiers have been removed from the profile.'
      : 'The profile still contains identifying contact information.';
    var contactActions =
      (customer.phone
        ? '<a class="admin-context-action" href="tel:' + escapeHtml(customer.phone) + '">' + ICON_PHONE + '<span>Call</span></a>'
        : '') +
      (customer.email
        ? '<a class="admin-context-action" href="mailto:' + escapeHtml(customer.email) + '">' + ICON_EMAIL + '<span>Email</span></a>'
        : '');

    var html =
      '<div class="admin-modal-header" data-customer-modal="' + escapeHtml(customer.id) + '">' +
        '<div>' +
          '<div class="admin-modal-status-line">' +
            '<span class="admin-status-pill" data-status="' + escapeHtml(marketingTone(customer.marketing_consent_status)) + '">' + escapeHtml(marketingLabel(customer.marketing_consent_status)) + '</span>' +
            '<span class="admin-status-explanation">' + escapeHtml(marketingStatusDescription(customer.marketing_consent_status)) + '</span>' +
          '</div>' +
          '<h2>' + escapeHtml(customer.display_name) + '</h2>' +
        '</div>' +
        '<button class="admin-preview-close admin-icon-button" type="button" data-admin-modal-close aria-label="Close customer" title="Close">' + ICON_CLOSE + '</button>' +
      '</div>' +
      (contactActions
        ? '<div class="admin-modal-toolbar"><span class="admin-modal-toolbar-label">Contact customer</span>' + contactActions + '</div>'
        : '') +
      '<div class="admin-detail-section admin-customer-bookings-section">' +
        '<h2>Bookings (' + escapeHtml(bookings.length) + ')</h2>' +
        renderCustomerBookings(bookings) +
      '</div>' +
      '<div class="admin-detail-section">' +
        '<h3>Customer details</h3>' +
        '<div class="admin-detail-list">' +
          detailRow('Email', customer.email) +
          detailRow('Phone', customer.phone) +
          detailRow('Language', customer.preferred_language) +
          detailRow('Last booking', customer.last_booking_at ? formatDateTime(customer.last_booking_at) : '') +
          detailRow('Last invoice', customer.last_invoice_at ? formatDateTime(customer.last_invoice_at) : '') +
        '</div>' +
      '</div>' +
      '<div class="admin-detail-section">' +
        '<h2>Invoices</h2>' +
        renderCustomerInvoices(invoices) +
      '</div>' +
      '<details class="admin-detail-section admin-disclosure admin-privacy-controls">' +
        '<summary>Privacy, consent, and legal controls</summary>' +
        '<div class="admin-privacy-overview">' +
          '<div>' +
            '<h3>Current data status</h3>' +
            '<div class="admin-privacy-status-grid">' +
              '<div class="admin-privacy-status-card"><span>Marketing permission</span><strong>' + escapeHtml(marketingLabel(customer.marketing_consent_status)) + '</strong><p>' + escapeHtml(marketingStatusDescription(customer.marketing_consent_status)) + '</p></div>' +
              '<div class="admin-privacy-status-card"><span>Legal retention</span><strong>' + escapeHtml(holdStatus) + '</strong><p>' + escapeHtml(holdDescription) + '</p></div>' +
              '<div class="admin-privacy-status-card"><span>Erasure request</span><strong>' + escapeHtml(erasureStatus) + '</strong><p>' + escapeHtml(erasureDescription) + '</p></div>' +
              '<div class="admin-privacy-status-card"><span>Profile data</span><strong>' + escapeHtml(profileStatus) + '</strong><p>' + escapeHtml(profileDescription) + '</p></div>' +
            '</div>' +
          '</div>' +
          '<details class="admin-privacy-record-details">' +
            '<summary>View consent and retention dates</summary>' +
            '<div class="admin-detail-list">' +
              detailRow('Consent recorded', customer.marketing_consent_at ? formatDateTime(customer.marketing_consent_at) : '') +
              detailRow('Consent source', customer.marketing_consent_source) +
              detailRow('Consent version', customer.marketing_consent_text_version) +
              detailRow('Re-permission due', customer.marketing_repermission_due_at ? formatDateTime(customer.marketing_repermission_due_at) : '') +
              detailRow('Legal hold review', customer.legal_hold_review_at ? formatDateTime(customer.legal_hold_review_at) : 'Not scheduled') +
              detailRow('Erasure completed', customer.erasure_completed_at ? formatDateTime(customer.erasure_completed_at) : 'Not completed') +
            '</div>' +
          '</details>' +
          '<div>' +
            '<h3>Available actions</h3>' +
            '<div class="admin-privacy-action-list">' +
              (customer.marketing_consent_status === 'opted_in'
                ? '<div class="admin-privacy-action-card">' +
                    '<div class="admin-privacy-action-heading"><h4>Withdraw marketing permission</h4><p>Stops future marketing emails. Transactional booking and invoice messages are unaffected.</p></div>' +
                    renderInlineActionForm('withdrawCustomerMarketingConsent', 'Withdraw permission', 'admin-button-secondary', { customerId: customer.id }) +
                  '</div>'
                : '') +
              '<div class="admin-privacy-action-card">' +
                '<div class="admin-privacy-action-heading"><h4>' + (holdActive ? 'Release legal hold' : 'Start a legal hold') + '</h4><p>' +
                  (holdActive
                    ? 'Allows eligible redaction and deletion checks to proceed again. Releasing the hold does not delete data.'
                    : 'Temporarily blocks redaction and deletion for a legal, dispute, or retention reason.') +
                '</p></div>' +
                (holdActive ? renderReleaseHoldForm(customer) : renderSetHoldForm(customer, addDaysYmd(todayYmd(), 180))) +
              '</div>' +
              '<div class="admin-privacy-action-card">' +
                '<div class="admin-privacy-action-heading"><h4>Record an erasure request</h4><p>Documents the customer request. It does not redact or delete records by itself.</p></div>' +
                renderInlineActionForm('markCustomerErasureRequest', 'Record request', 'admin-button-secondary', { customerId: customer.id }, erasureRequestDisabled, erasureRequestTitle) +
                (erasureRequestDisabled ? '<p class="admin-action-meta">A request is already recorded for this customer.</p>' : '') +
              '</div>' +
              '<div class="admin-privacy-action-card" data-tone="danger">' +
                '<div class="admin-privacy-action-heading"><h4>Redact personal data</h4><p>Irreversibly removes direct identifiers from this profile and linked non-active bookings. Invoice records remain retained.</p></div>' +
                renderInlineActionForm('redactCustomerPii', 'Redact personal data', 'admin-button-danger', { customerId: customer.id }, redactionDisabled, redactionBlockText) +
                (redactionDisabled ? '<p class="admin-action-meta" data-tone="warning">' + escapeHtml(redactionBlockText) + '</p>' : '') +
              '</div>' +
              '<div class="admin-privacy-action-card" data-tone="danger">' +
                '<div class="admin-privacy-action-heading"><h4>Delete the redacted profile</h4><p>Irreversibly removes an eligible redacted profile and linked non-active bookings. Retained invoices are not deleted.</p></div>' +
                renderInlineActionForm('deleteCustomerProfile', 'Delete redacted profile', 'admin-button-danger', { customerId: customer.id }, deleteDisabled, deleteBlockText) +
                (deleteDisabled ? '<p class="admin-action-meta" data-tone="warning">' + escapeHtml(deleteBlockText) + '</p>' : '') +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</details>' +
      '<details class="admin-detail-section admin-disclosure">' +
        '<summary>Customer activity (' + escapeHtml(events.length) + ')</summary>' +
        renderCustomerEvents(events) +
      '</details>';

    var modal = openModal(html, 'lg');
    renderCustomerList();

    $all('[data-admin-action-form]', modal).forEach(function (form) {
      form.addEventListener('submit', handleActionSubmit);
    });
    $all('[data-open-booking]', modal).forEach(function (button) {
      button.addEventListener('click', function () {
        navigateToModal('booking', button.dataset.openBooking);
      });
    });
    $all('[data-open-invoice]', modal).forEach(function (button) {
      button.addEventListener('click', function () {
        navigateToModal('invoice', button.dataset.openInvoice);
      });
    });
  }

  function renderCustomerBookings(bookings) {
    if (!bookings.length) return '<p>No bookings linked to this customer.</p>';
    return '<div class="admin-mini-list">' + bookings.map(function (booking) {
      var start = booking.final_start_at || booking.requested_start_at;
      var end = booking.final_end_at || booking.requested_end_at;
      var invoice = activeInvoiceForBooking(booking.id);
      var service = serviceNameForBooking(booking);
      var time = formatRange(start, end);
      var vehicle = booking.vehicle || 'No vehicle';
      var status = statusLabel(booking.status);
      var payment = paymentLabel(booking.payment_status);
      var invoiceStatus = invoiceStatusLabel(invoice);
      var bookingLabel = [service, time, status, vehicle, booking.public_reference, payment, invoiceStatus].join(', ');
      return '<button class="admin-mini-item admin-customer-booking" type="button" aria-label="' + escapeHtml('Open booking: ' + bookingLabel) + '" data-open-booking="' + escapeHtml(booking.id) + '">' +
        '<span class="admin-customer-booking-main">' +
          '<strong>' + escapeHtml(service) + '</strong>' +
          '<span class="admin-customer-booking-time">' + escapeHtml(time) + '</span>' +
        '</span>' +
        '<span class="admin-status-pill" data-status="' + escapeHtml(statusTone(booking.status)) + '">' + escapeHtml(status) + '</span>' +
        '<span class="admin-customer-booking-vehicle">' + escapeHtml(vehicle) + '</span>' +
        '<span class="admin-customer-booking-meta">' + escapeHtml(booking.public_reference) + ' · ' + escapeHtml(payment) + ' · ' + escapeHtml(invoiceStatus) + '</span>' +
      '</button>';
    }).join('') + '</div>';
  }

  function renderCustomerInvoices(invoices) {
    if (!invoices.length) return '<p>No invoices linked to this customer.</p>';
    return '<div class="admin-mini-list">' + invoices.map(function (invoice) {
      var invoiceLabel = invoiceStatusLabel(invoice);
      var amount = formatMoney(invoice.amount_cents, invoice.currency);
      var issued = invoice.issued_at ? formatDateTime(invoice.issued_at) : 'Not issued';
      var emailState = emailStatusLabel(invoice.email_status);
      var openInvoiceLabel = [invoice.invoice_number, amount, invoiceLabel, issued, emailState].join(', ');
      return '<button class="admin-mini-item admin-customer-invoice" type="button" aria-label="' + escapeHtml('Open invoice: ' + openInvoiceLabel) + '" data-open-invoice="' + escapeHtml(invoice.id) + '">' +
        '<span class="admin-customer-invoice-main"><strong>' + escapeHtml(invoice.invoice_number) + '</strong><span>' + escapeHtml(amount) + '</span></span>' +
        '<span class="admin-status-pill" data-status="' + escapeHtml(invoiceTone(invoice)) + '">' + escapeHtml(invoiceLabel) + '</span>' +
        '<span class="admin-customer-invoice-meta">Issued ' + escapeHtml(issued) + ' · ' + escapeHtml(emailState) + '</span>' +
      '</button>';
    }).join('') + '</div>';
  }

  function renderCustomerEvents(events) {
    if (!events.length) return '<p>No customer events yet.</p>';
    return '<div class="admin-mini-list">' + events.map(function (event) {
      return '<div class="admin-mini-item">' +
        '<span><strong>' + escapeHtml(event.event_type) + '</strong></span>' +
        '<span>' + escapeHtml(formatDateTime(event.created_at)) + '</span>' +
        '<span>' + escapeHtml(event.message || '') + '</span>' +
      '</div>';
    }).join('') + '</div>';
  }

  function invoiceSearchText(invoice) {
    var customer = customerById(invoice.customer_id);
    var booking = bookingById(invoice.booking_id);
    return [
      invoice.invoice_number,
      invoice.invoice_status,
      invoice.payment_status,
      invoice.email_status,
      invoice.customer_name,
      invoice.customer_email,
      invoice.service_description,
      invoice.amount_cents,
      customer && customer.display_name,
      booking && booking.public_reference,
      booking && booking.vehicle
    ].join(' ').toLowerCase();
  }

  function filteredInvoices() {
    var invoices = state.invoices.slice().sort(function (a, b) {
      return new Date(b.issued_at || b.created_at) - new Date(a.issued_at || a.created_at);
    });
    if (state.invoiceFilter === 'unpaid') {
      invoices = invoices.filter(function (invoice) {
        return invoice.invoice_status === 'issued' && invoice.payment_status !== 'paid';
      });
    } else if (state.invoiceFilter === 'paid') {
      invoices = invoices.filter(function (invoice) {
        return invoice.invoice_status === 'issued' && invoice.payment_status === 'paid';
      });
    } else if (state.invoiceFilter === 'void') {
      invoices = invoices.filter(function (invoice) { return invoice.invoice_status === 'void'; });
    }
    var query = normalizeSearch(state.invoiceSearch);
    if (query) {
      var parts = query.split(/\s+/).filter(Boolean);
      invoices = invoices.filter(function (invoice) {
        var text = invoiceSearchText(invoice);
        return parts.every(function (part) { return text.indexOf(part) !== -1; });
      });
    }
    return invoices;
  }

  function renderInvoicesPage() {
    var search = $('[data-invoice-search]');
    if (search && search.value !== state.invoiceSearch) search.value = state.invoiceSearch;
    var clear = $('[data-invoice-clear]');
    if (clear) {
      clear.hidden = !state.invoiceSearch;
      clear.disabled = !state.invoiceSearch;
    }
    renderInvoiceList();
  }

  function renderInvoiceList() {
    var list = $('[data-invoice-list]');
    if (!list) return;
    var invoices = filteredInvoices();
    var count = $('[data-invoice-count]');
    if (count) {
      count.textContent = invoices.length + ' invoice' + (invoices.length === 1 ? '' : 's');
      count.setAttribute('role', 'status');
      count.setAttribute('aria-live', 'polite');
      count.setAttribute('aria-atomic', 'true');
    }
    if (!invoices.length) {
      var hasRefinement = state.invoiceFilter !== 'all' || Boolean(state.invoiceSearch);
      list.innerHTML = emptyState(
        hasRefinement ? 'No invoices match the current search and filter.' : 'No invoices yet.',
        hasRefinement ? 'Clear filters' : '',
        hasRefinement ? 'data-empty-invoices-clear' : ''
      );
      var emptyClear = $('[data-empty-invoices-clear]', list);
      if (emptyClear) {
        emptyClear.addEventListener('click', function () {
          state.invoiceSearch = '';
          state.invoiceFilter = 'all';
          var allButton = $('[data-invoice-filter="all"]');
          if (allButton) allButton.click();
          else renderInvoicesPage();
          var search = $('[data-invoice-search]');
          if (search) search.focus();
        });
      }
      return;
    }

    list.innerHTML = invoices.map(function (invoice) {
      var booking = bookingById(invoice.booking_id);
      var customer = customerById(invoice.customer_id);
      var invoiceCustomer = customer ? customer.display_name : invoice.customer_name;
      var invoiceBooking = booking ? booking.public_reference : 'No booking';
      var invoiceDate = invoice.issued_at ? formatDateTime(invoice.issued_at) : 'Not issued';
      var invoiceAmount = formatMoney(invoice.amount_cents, invoice.currency);
      var invoiceMeta = 'Due ' + (invoice.due_date || 'not set') + ' · Email ' + (invoice.email_status || 'not sent');
      var invoiceLabel = [invoice.invoice_number, invoiceCustomer, invoiceStatusLabel(invoice), invoiceBooking, invoiceDate, invoiceAmount, invoiceMeta].join(', ');
      return '<button class="admin-booking-item admin-data-row' + (invoice.id === state.selectedInvoiceId ? ' is-selected' : '') + '" type="button" aria-label="' + escapeHtml(invoiceLabel) + '" data-invoice-id="' + escapeHtml(invoice.id) + '">' +
        '<span class="admin-row-primary admin-booking-item-header"><span class="admin-booking-title"><strong>' + escapeHtml(invoice.invoice_number) + '</strong><span>' + escapeHtml(invoiceCustomer) + '</span></span></span>' +
        '<span class="admin-row-status"><span class="admin-status-pill" data-status="' + escapeHtml(invoiceTone(invoice)) + '">' + escapeHtml(invoiceStatusLabel(invoice)) + '</span></span>' +
        '<span class="admin-row-service admin-booking-meta">' + escapeHtml(invoiceBooking) + '</span>' +
        '<span class="admin-row-date admin-booking-meta">' + escapeHtml(invoiceDate) + '</span>' +
        '<span class="admin-row-amount">' + escapeHtml(invoiceAmount) + '</span>' +
        '<span class="admin-row-meta admin-booking-meta">' + escapeHtml(invoiceMeta) + '</span>' +
      '</button>';
    }).join('');

    $all('[data-invoice-id]', list).forEach(function (button) {
      button.addEventListener('click', function () {
        navigateToModal('invoice', button.dataset.invoiceId);
      });
    });
  }

  function renderMarkInvoicePaidForm(invoice) {
    return '<form class="admin-action-form" data-admin-action-form data-action="markInvoicePaid">' +
      hiddenInput('invoiceId', invoice.id) +
      '<div class="admin-action-grid">' +
        '<label>Payment method<span class="admin-select-wrap"><select name="paymentMethod">' + paymentMethodOptions('bank_transfer') + '</select></span></label>' +
        '<label>Payment note<input name="paymentNote" type="text" maxlength="500" placeholder="Optional"></label>' +
      '</div>' +
      '<div class="admin-form-error" data-action-error role="status" aria-live="polite"></div>' +
      '<div class="admin-action-buttons"><button class="admin-button admin-button-primary" type="submit">Mark invoice paid</button></div>' +
    '</form>';
  }

  function renderVoidInvoiceForm(invoice) {
    if (invoice.invoice_status === 'void') return '';
    return '<form class="admin-action-form" data-admin-action-form data-action="voidInvoice">' +
      hiddenInput('invoiceId', invoice.id) +
      '<label>Void reason<textarea name="voidReason" maxlength="700" required placeholder="Required reason"></textarea></label>' +
      '<div class="admin-form-error" data-action-error role="status" aria-live="polite"></div>' +
      '<div class="admin-action-buttons"><button class="admin-button admin-button-danger" type="submit">Void invoice</button></div>' +
    '</form>';
  }

  function renderInvoiceModal(invoiceId) {
    var invoice = invoiceById(invoiceId);
    if (!invoice) return;
    state.selectedInvoiceId = invoice.id;
    var booking = bookingById(invoice.booking_id);
    var customer = customerById(invoice.customer_id);
    var customerName = customer ? customer.display_name : invoice.customer_name;
    var invoiceAmount = formatMoney(invoice.amount_cents, invoice.currency);
    var invoiceLabel = invoiceStatusLabel(invoice);
    var isUnpaidIssued = invoice.invoice_status === 'issued' && invoice.payment_status !== 'paid';
    var amountLabel = isUnpaidIssued ? 'Amount due' : 'Invoice amount';
    var dueSummary = invoice.invoice_status === 'void'
      ? 'No payment is due'
      : (invoice.payment_status === 'paid' ? 'Payment recorded' : 'Due ' + (invoice.due_date || 'date not set'));
    var customerActions =
      (invoice.customer_phone
        ? '<a class="admin-context-action" href="tel:' + escapeHtml(invoice.customer_phone) + '">' + ICON_PHONE + '<span>Call</span></a>'
        : '') +
      (invoice.customer_email
        ? '<a class="admin-context-action" href="mailto:' + escapeHtml(invoice.customer_email) + '">' + ICON_EMAIL + '<span>Email</span></a>'
        : '') +
      (customer
        ? '<button class="admin-context-action" type="button" data-open-customer="' + escapeHtml(customer.id) + '">' + ICON_USER + '<span>Customer profile</span></button>'
        : '');
    var bookingActions = booking
      ? '<button class="admin-context-action" type="button" data-open-booking="' + escapeHtml(booking.id) + '">' + ICON_BOOKING + '<span>Booking details</span></button>'
      : '';
    var documentActions =
      (invoice.pdf_path
        ? '<button class="admin-button admin-button-primary" type="button" data-view-invoice-pdf="' + escapeHtml(invoice.id) + '">' + ICON_INVOICE + '<span>View PDF</span></button>'
        : '') +
      (invoice.invoice_status === 'issued'
        ? '<button class="admin-button admin-button-secondary" type="button" data-resend-invoice="' + escapeHtml(invoice.id) + '">' + ICON_REFRESH + '<span>Resend invoice</span></button>'
        : '');
    var html =
      '<div class="admin-modal-header">' +
        '<div>' +
          '<div class="admin-modal-status-line">' +
            '<span class="admin-status-pill" data-status="' + escapeHtml(invoiceTone(invoice)) + '">' + escapeHtml(invoiceLabel) + '</span>' +
            '<span class="admin-status-explanation">' + escapeHtml(invoiceStatusDescription(invoice)) + '</span>' +
          '</div>' +
          '<h2>' + escapeHtml(invoice.invoice_number) + '</h2>' +
        '</div>' +
        '<button class="admin-preview-close admin-icon-button" type="button" data-admin-modal-close aria-label="Close invoice" title="Close">' + ICON_CLOSE + '</button>' +
      '</div>' +
      '<section class="admin-detail-section admin-invoice-overview">' +
        '<span class="admin-section-kicker">Review first</span>' +
        '<h3>Invoice details</h3>' +
        '<div class="admin-invoice-overview-grid">' +
          '<div class="admin-invoice-primary-fact">' +
            '<span>' + escapeHtml(amountLabel) + '</span>' +
            '<strong>' + escapeHtml(invoiceAmount) + '</strong>' +
            '<span>' + escapeHtml(dueSummary) + '</span>' +
          '</div>' +
          '<div class="admin-invoice-context-grid">' +
            '<div class="admin-invoice-context-card">' +
              '<span>Customer</span>' +
              '<strong>' + escapeHtml(customerName || 'Not provided') + '</strong>' +
              '<span>' + escapeHtml(invoice.customer_email || invoice.customer_phone || 'Contact not provided') + '</span>' +
              (customerActions ? '<div class="admin-context-actions">' + customerActions + '</div>' : '') +
            '</div>' +
            '<div class="admin-invoice-context-card">' +
              '<span>Booking</span>' +
              '<strong>' + escapeHtml(booking ? booking.public_reference : 'No linked booking') + '</strong>' +
              '<span>' + escapeHtml(invoice.service_description || 'Service not provided') + '</span>' +
              (bookingActions ? '<div class="admin-context-actions">' + bookingActions + '</div>' : '') +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="admin-invoice-overview-meta">' +
          '<span>Issued: <strong>' + escapeHtml(invoice.issued_at ? formatDateTime(invoice.issued_at) : 'Not issued') + '</strong></span>' +
          '<span>Email: <strong>' + escapeHtml(emailStatusLabel(invoice.email_status)) + '</strong></span>' +
          (invoice.last_sent_at ? '<span>Last sent: <strong>' + escapeHtml(formatDateTime(invoice.last_sent_at)) + '</strong></span>' : '') +
        '</div>' +
      '</section>' +
      (documentActions
        ? '<div class="admin-modal-toolbar"><span class="admin-modal-toolbar-label">Invoice document</span>' + documentActions + '</div>'
        : '') +
      (invoice.last_email_error
        ? '<p class="admin-detail-note admin-detail-note-warning admin-modal-alert">Last delivery failed: ' + escapeHtml(invoice.last_email_error) + '</p>'
        : '') +
      (isUnpaidIssued
        ? '<section class="admin-detail-section admin-workflow-section">' +
            '<h3>Record payment</h3>' +
            '<p class="admin-detail-note">Use this only after payment is received. It records the payment method and marks the invoice paid.</p>' +
            renderMarkInvoicePaidForm(invoice) +
          '</section>'
        : '') +
      '<details class="admin-detail-section admin-disclosure">' +
        '<summary>Invoice record details</summary>' +
        '<div class="admin-detail-list">' +
          detailRow('Invoice state', invoice.invoice_status === 'issued' ? 'Issued' : invoiceLabel) +
          detailRow('Payment state', paymentLabel(invoice.payment_status)) +
          detailRow('Due date', invoice.due_date) +
          detailRow('VAT', formatMoney(invoice.tax_cents, invoice.currency)) +
          detailRow('Email delivery', emailStatusLabel(invoice.email_status)) +
          detailRow('Retention until', invoice.retention_hold_until) +
        '</div>' +
      '</details>' +
      (invoice.invoice_status !== 'void'
        ? '<details class="admin-detail-section admin-disclosure admin-danger-disclosure">' +
            '<summary>Void invoice</summary>' +
            '<p class="admin-detail-note">Voiding cancels this invoice for accounting. The invoice number and PDF remain retained, and the action cannot be undone.</p>' +
            renderVoidInvoiceForm(invoice) +
          '</details>'
        : '');

    var modal = openModal(html, 'lg');
    renderInvoiceList();

    $all('[data-admin-action-form]', modal).forEach(function (form) {
      form.addEventListener('submit', handleActionSubmit);
    });
    var customerButton = $('[data-open-customer]', modal);
    if (customerButton) {
      customerButton.addEventListener('click', function () {
        navigateToModal('customer', customerButton.dataset.openCustomer);
      });
    }
    var bookingButton = $('[data-open-booking]', modal);
    if (bookingButton) {
      bookingButton.addEventListener('click', function () {
        navigateToModal('booking', bookingButton.dataset.openBooking);
      });
    }
    var resendButton = $('[data-resend-invoice]', modal);
    if (resendButton) {
      resendButton.addEventListener('click', function () {
        runAction({ action: 'resendInvoice', invoiceId: resendButton.dataset.resendInvoice }, 'resendInvoice', resendButton);
      });
    }
    var pdfButton = $('[data-view-invoice-pdf]', modal);
    if (pdfButton) {
      pdfButton.addEventListener('click', async function () {
        var pdfWindow = window.open('about:blank', '_blank');
        if (pdfWindow) {
          pdfWindow.opener = null;
          pdfWindow.document.title = 'Loading invoice PDF...';
        }

        try {
          setButtonBusy(pdfButton, true, busyLabelForAction('getInvoicePdfUrl'));
          var data = await adminAction({ action: 'getInvoicePdfUrl', invoiceId: pdfButton.dataset.viewInvoicePdf });
          if (data.result && data.result.url) {
            if (pdfWindow) {
              pdfWindow.location.href = data.result.url;
            } else {
              window.location.href = data.result.url;
            }
          } else if (pdfWindow) {
            pdfWindow.close();
          }
        } catch (error) {
          if (pdfWindow) pdfWindow.close();
          showToast(error instanceof Error ? error.message : 'Could not open invoice PDF.', 'error');
        } finally {
          if (document.body.contains(pdfButton)) setButtonBusy(pdfButton, false);
        }
      });
    }
  }

  function recipientStatusText(recipient) {
    return [
      recipient.status || 'unknown',
      recipient.sent_at ? formatDateTime(recipient.sent_at) : '',
      recipient.error_message ? recipient.error_message : ''
    ].filter(Boolean).join(' - ');
  }

  function renderCampaignModal(campaignId) {
    var campaign = campaignById(campaignId);
    if (!campaign) return;
    var recipients = recipientsForCampaign(campaign.id);
    var modal = openModal(
      '<div class="admin-modal-header">' +
        '<div>' +
          '<span class="admin-status-pill" data-status="' + escapeHtml(statusTone(campaign.status)) + '">' + escapeHtml(statusLabel(campaign.status || 'sent')) + '</span>' +
          '<h2>' + escapeHtml(campaign.subject) + '</h2>' +
        '</div>' +
        '<button class="admin-preview-close admin-icon-button" type="button" data-admin-modal-close aria-label="Close campaign" title="Close">' + ICON_CLOSE + '</button>' +
      '</div>' +
      '<div class="admin-campaign-layout">' +
        '<section class="admin-detail-section">' +
          '<h3>Summary</h3>' +
          '<div class="admin-detail-list">' +
            detailRow('Created', formatDateTime(campaign.created_at)) +
            detailRow('Sent', campaign.sent_at ? formatDateTime(campaign.sent_at) : '') +
            detailRow('Recipients', Number(campaign.audience_count || 0) + ' total') +
            detailRow('Delivery', Number(campaign.sent_count || 0) + ' sent / ' + Number(campaign.failed_count || 0) + ' failed') +
          '</div>' +
        '</section>' +
        '<details class="admin-detail-section admin-disclosure">' +
          '<summary>Recipients (' + recipients.length + ')</summary>' +
          '<div class="admin-mini-list admin-recipient-list">' +
            (recipients.length ? recipients.map(function (recipient) {
              return '<div class="admin-mini-item">' +
                '<span><strong>' + escapeHtml(recipient.recipient_email) + '</strong></span>' +
                '<span>' + escapeHtml(recipientStatusText(recipient)) + '</span>' +
              '</div>';
            }).join('') : '<div class="admin-empty-state admin-empty-state-compact"><p>No recipient records found for this campaign.</p></div>') +
          '</div>' +
        '</details>' +
        '<section class="admin-detail-section admin-field-wide">' +
          '<h3>Email preview</h3>' +
          '<div class="admin-email-preview admin-email-preview-modal"><iframe title="Campaign email preview" sandbox="" data-campaign-preview></iframe></div>' +
        '</section>' +
      '</div>',
      'lg'
    );

    var frame = $('[data-campaign-preview]', modal);
    if (frame) {
      frame.srcdoc = '<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;color:#667085;padding:24px;">Loading preview...</body>';
      adminAction({
        action: 'previewMarketingEmail',
        marketingSubject: campaign.subject,
        marketingBody: campaign.body_text || ''
      }).then(function (response) {
        frame.srcdoc = response.result && response.result.html ? response.result.html : '';
      }).catch(function (error) {
        frame.srcdoc = '<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;color:#b42318;padding:24px;">' + escapeHtml(error instanceof Error ? error.message : 'Preview unavailable.') + '</body>';
      });
    }
  }

  function renderMarketingPage() {
    var count = $('[data-marketing-audience-count]');
    var customers = consentedCustomers();
    if (count) count.textContent = customers.length + ' recipient' + (customers.length === 1 ? '' : 's');

    var campaigns = $('[data-marketing-campaigns]');
    if (campaigns) {
      campaigns.innerHTML = state.marketingCampaigns.length
        ? state.marketingCampaigns.map(function (campaign) {
          var campaignDelivery = Number(campaign.sent_count || 0) + ' sent · ' + Number(campaign.failed_count || 0) + ' failed · ' + Number(campaign.audience_count || 0) + ' total';
          var campaignLabel = [campaign.subject, statusLabel(campaign.status), formatDateTime(campaign.created_at), campaignDelivery].join(', ');
          return '<button class="admin-mini-item admin-mini-button admin-data-row' + (campaign.id === state.selectedCampaignId ? ' is-selected' : '') + '" type="button" aria-label="' + escapeHtml(campaignLabel) + '" data-campaign-id="' + escapeHtml(campaign.id) + '">' +
            '<span class="admin-row-primary"><strong>' + escapeHtml(campaign.subject) + '</strong></span>' +
            '<span class="admin-row-status"><span class="admin-status-pill" data-status="' + escapeHtml(statusTone(campaign.status)) + '">' + escapeHtml(statusLabel(campaign.status)) + '</span></span>' +
            '<span class="admin-row-date">' + escapeHtml(formatDateTime(campaign.created_at)) + '</span>' +
            '<span class="admin-row-meta">' + escapeHtml(campaignDelivery) + '</span>' +
          '</button>';
        }).join('')
        : emptyState('No marketing campaigns have been sent yet.');

      $all('[data-campaign-id]', campaigns).forEach(function (button) {
        button.addEventListener('click', function () {
          navigateToModal('campaign', button.dataset.campaignId);
        });
      });
    }

    var form = $('[data-marketing-form]');
    if (form && !form.dataset.bound) {
      form.dataset.bound = 'true';
      form.addEventListener('submit', handleActionSubmit);
    }
  }

  function staffOptions(selectedId) {
    return state.staffList.filter(function (staff) { return staff.is_active; }).map(function (staff) {
      return '<option value="' + escapeHtml(staff.id) + '"' + (staff.id === selectedId ? ' selected' : '') + '>' + escapeHtml(staff.display_name) + '</option>';
    }).join('');
  }

  function validateDateTimePair(dateValue, startTime, endTime) {
    if (!isValidYmd(dateValue)) {
      return { error: 'Use the date format YYYY-MM-DD.' };
    }

    var startAt = isoFromVilniusInput(dateValue, startTime);
    var endAt = isoFromVilniusInput(dateValue, endTime);
    if (!startAt || !endAt) {
      return { error: 'Choose a valid start and end time.' };
    }
    if (timeToMinutes(startTime) % SLOT_STEP_MINUTES !== 0 || timeToMinutes(endTime) % SLOT_STEP_MINUTES !== 0) {
      return { error: 'Use 15-minute increments for start and end times.' };
    }
    if (new Date(endAt) <= new Date(startAt)) {
      return { error: 'End time must be after start time.' };
    }
    if (new Date(startAt) <= new Date()) {
      return { error: 'Start time must be in the future.' };
    }
    return { startAt: startAt, endAt: endAt };
  }

  function clearFormValidation(form, errorEl) {
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.remove('is-success');
    }
    $all('[aria-invalid="true"]', form).forEach(function (control) {
      control.removeAttribute('aria-invalid');
      if (Object.prototype.hasOwnProperty.call(control.dataset, 'validationDescribedby')) {
        if (control.dataset.validationDescribedby) {
          control.setAttribute('aria-describedby', control.dataset.validationDescribedby);
        } else {
          control.removeAttribute('aria-describedby');
        }
        delete control.dataset.validationDescribedby;
      }
    });
  }

  function showFieldError(errorEl, message, control) {
    if (errorEl) {
      if (!errorEl.id) {
        dialogId += 1;
        errorEl.id = 'admin-form-error-' + dialogId;
      }
      errorEl.textContent = message;
    }
    if (control) {
      control.setAttribute('aria-invalid', 'true');
      if (!control.dataset.validationDescribedby) {
        control.dataset.validationDescribedby = control.getAttribute('aria-describedby') || '';
      }
      if (errorEl && errorEl.id) control.setAttribute('aria-describedby', errorEl.id);
      focusElement(control);
    }
  }

  function busyLabelForAction(action) {
    return {
      confirmBooking: 'Confirming...',
      rejectBooking: 'Rejecting...',
      cancelBooking: 'Cancelling...',
      completeBooking: 'Marking...',
      createAndSendInvoice: 'Creating...',
      markBookingPaid: 'Saving...',
      markInvoicePaid: 'Saving...',
      resendInvoice: 'Sending...',
      voidInvoice: 'Voiding...',
      deleteSlot: 'Deleting...',
      deleteSlotSeries: 'Deleting...',
      updateSlot: 'Saving...',
      createSlot: 'Creating...',
      setCustomerLegalHold: 'Saving...',
      releaseCustomerLegalHold: 'Saving...',
      markCustomerErasureRequest: 'Saving...',
      withdrawCustomerMarketingConsent: 'Saving...',
      redactBookingPii: 'Redacting...',
      redactCustomerPii: 'Redacting...',
      deleteCustomerProfile: 'Deleting...',
      sendMarketingCampaign: 'Sending...',
      getInvoicePdfUrl: 'Opening...'
    }[action] || 'Working...';
  }

  function successMessageForAction(action) {
    return {
      confirmBooking: 'Booking confirmed.',
      rejectBooking: 'Booking rejected.',
      cancelBooking: 'Booking cancelled.',
      completeBooking: 'Booking marked completed.',
      createAndSendInvoice: 'Invoice created and sent.',
      markBookingPaid: 'Booking marked paid.',
      markInvoicePaid: 'Invoice marked paid.',
      resendInvoice: 'Invoice resent.',
      voidInvoice: 'Invoice voided.',
      deleteSlot: 'Availability slot deleted.',
      deleteSlotSeries: 'Availability series deleted.',
      updateSlot: 'Availability slot updated.',
      createSlot: 'Availability slot created.',
      setCustomerLegalHold: 'Legal hold set.',
      releaseCustomerLegalHold: 'Legal hold released.',
      markCustomerErasureRequest: 'Erasure request recorded.',
      withdrawCustomerMarketingConsent: 'Marketing consent withdrawn.',
      redactBookingPii: 'Booking personal data redacted.',
      redactCustomerPii: 'Customer profile redacted.',
      deleteCustomerProfile: 'Customer profile deleted.',
      sendMarketingCampaign: 'Marketing campaign sent.'
    }[action] || 'Changes saved.';
  }

  function setButtonBusy(button, busy, label) {
    if (!button) return;
    if (busy) {
      if (!button._adminBusyState) {
        button._adminBusyState = {
          html: button.innerHTML,
          disabled: button.disabled,
          ariaLabel: button.getAttribute('aria-label')
        };
      }
      button.disabled = true;
      button.classList.add('is-loading');
      button.setAttribute('aria-busy', 'true');
      button.setAttribute('aria-label', label || 'Working...');
      button.textContent = button.classList.contains('admin-icon-button') ? '' : (label || 'Working...');
      return;
    }

    if (button._adminBusyState) {
      button.innerHTML = button._adminBusyState.html;
      button.disabled = button._adminBusyState.disabled;
      if (button._adminBusyState.ariaLabel) {
        button.setAttribute('aria-label', button._adminBusyState.ariaLabel);
      } else {
        button.removeAttribute('aria-label');
      }
      delete button._adminBusyState;
    } else {
      button.disabled = false;
    }
    button.classList.remove('is-loading');
    button.removeAttribute('aria-busy');
  }

  function setFormBusy(form, busy, label) {
    if (!form) return;
    form.setAttribute('aria-busy', busy ? 'true' : 'false');
    form.classList.toggle('is-busy', busy);
    if (busy) {
      $all('button[type="submit"]', form).forEach(function (button) {
        setButtonBusy(button, true, label);
      });
    }
    $all('button, input, select, textarea', form).forEach(function (control) {
      if (control.matches && control.matches('button[type="submit"]')) return;
      if (busy) {
        if (!control.dataset.busyOriginalDisabled) {
          control.dataset.busyOriginalDisabled = control.disabled ? 'true' : 'false';
        }
        control.disabled = true;
      } else if (control.dataset.busyOriginalDisabled) {
        control.disabled = control.dataset.busyOriginalDisabled === 'true';
        delete control.dataset.busyOriginalDisabled;
      }
    });
    if (!busy) {
      $all('button[type="submit"]', form).forEach(function (button) {
        setButtonBusy(button, false);
      });
    }
  }

  function setSyncState(label, tone) {
    var target = $('[data-admin-sync-state]');
    if (!target) return;
    target.textContent = label;
    target.dataset.state = tone || 'synced';
    target.setAttribute('role', 'status');
    target.setAttribute('aria-live', tone === 'error' ? 'assertive' : 'polite');
    target.setAttribute('aria-atomic', 'true');
  }

  async function runAction(payload, confirmAction, trigger, options) {
    var opts = options || {};
    try {
      var confirmOptions = confirmOptionsForAction(confirmAction || payload.action);
      if (confirmOptions && !opts.skipConfirm) {
        var confirmed = await openConfirmDialog(confirmOptions);
        if (!confirmed) return;
      }
      setButtonBusy(trigger, true, busyLabelForAction(confirmAction || payload.action));
      setSyncState('Saving', 'loading');
      await adminAction(payload);
      markModalClean();
      await refresh({ preserveScroll: true });
      if (payload.invoiceId && invoiceById(payload.invoiceId)) navigateToModal('invoice', payload.invoiceId, { force: true });
      if (payload.bookingId && bookingById(payload.bookingId)) navigateToModal('booking', payload.bookingId, { force: true });
      showToast(successMessageForAction(confirmAction || payload.action), 'success');
    } catch (error) {
      setSyncState('Action failed', 'error');
      showToast(error instanceof Error ? error.message : 'The action could not be completed.', 'error');
    } finally {
      if (trigger && document.body.contains(trigger)) {
        setButtonBusy(trigger, false);
      }
    }
  }

  async function deleteSlotWithChoice(slotId, trigger) {
    var slot = slotById(slotId);
    var scope = await openSlotDeleteDialog(slot);
    if (!scope) return;
    var action = scope === 'series' ? 'deleteSlotSeries' : 'deleteSlot';
    captureSlotEditorBaseline();
    await runAction({ action: action, slotId: slotId }, action, trigger, { skipConfirm: true });
  }

  async function handleActionSubmit(event) {
    event.preventDefault();
    var form = event.currentTarget;
    var data = new FormData(form);
    var action = form.dataset.action;
    var errorEl = $('[data-action-error]', form);
    clearFormValidation(form, errorEl);

    var payload = {
      action: action,
      bookingId: data.get('bookingId'),
      customerId: data.get('customerId'),
      invoiceId: data.get('invoiceId'),
      assignedStaffId: data.get('assignedStaffId') || null,
      customerReason: data.get('customerReason') || null,
      internalNote: data.get('internalNote') || null,
      legalHoldReason: data.get('legalHoldReason') || null,
      paymentMethod: data.get('paymentMethod') || null,
      paymentNote: data.get('paymentNote') || null,
      voidReason: data.get('voidReason') || null
    };

    if (action === 'confirmBooking') {
      var validation = validateDateTimePair(String(data.get('date') || ''), String(data.get('startTime') || ''), String(data.get('endTime') || ''));
      if (validation.error) {
        showFieldError(errorEl, validation.error, form.elements.date);
        return;
      }
      payload.startAt = validation.startAt;
      payload.endAt = validation.endAt;
    }

    if (action === 'setCustomerLegalHold') {
      var holdDate = String(data.get('holdUntilDate') || '');
      var holdTime = String(data.get('holdUntilTime') || '');
      var holdUntil = isoFromVilniusInput(holdDate, holdTime);
      if (!holdUntil || new Date(holdUntil) <= new Date()) {
        showFieldError(errorEl, 'Use a future legal hold date and time in YYYY-MM-DD and HH:mm format.', form.elements.holdUntilDate);
        return;
      }
      if (!String(data.get('legalHoldReason') || '').trim()) {
        showFieldError(errorEl, 'Legal hold reason is required.', form.elements.legalHoldReason);
        return;
      }
      payload.holdUntil = holdUntil;
    }

    if (action === 'sendMarketingCampaign') {
      payload.marketingSubject = data.get('marketingSubject') || null;
      payload.marketingBody = data.get('marketingBody') || null;
      if (!String(payload.marketingSubject || '').trim() || !String(payload.marketingBody || '').trim()) {
        showFieldError(
          errorEl,
          'Subject and message are required.',
          !String(payload.marketingSubject || '').trim() ? form.elements.marketingSubject : form.elements.marketingBody
        );
        return;
      }
    }

    if (action === 'createAndSendInvoice') {
      var amount = String(data.get('amount') || '').replace(',', '.').trim();
      var dueDate = String(data.get('dueDate') || '').trim();
      if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) {
        showFieldError(errorEl, 'Use a valid amount, for example 100.00.', form.elements.amount);
        return;
      }
      if (!isValidYmd(dueDate) || compareYmd(dueDate, todayYmd()) < 0) {
        showFieldError(errorEl, 'Use a due date in YYYY-MM-DD format. It cannot be in the past.', form.elements.dueDate);
        return;
      }
      if (String(data.get('vatMode') || '') === 'included' && !/^\d+(\.\d{1,2})?$/.test(String(data.get('vatRate') || '').replace(',', '.').trim())) {
        showFieldError(errorEl, 'Use a valid VAT rate.', form.elements.vatRate);
        return;
      }
      payload.amount = amount;
      payload.dueDate = dueDate;
      payload.vatMode = data.get('vatMode') || 'none';
      payload.vatRate = data.get('vatRate') || null;
      payload.serviceDescription = data.get('serviceDescription') || null;
      payload.billingDetails = data.get('billingDetails') || null;
    }

    if (action === 'voidInvoice' && !String(data.get('voidReason') || '').trim()) {
      showFieldError(errorEl, 'Void reason is required.', form.elements.voidReason);
      return;
    }

    if (action === 'sendMarketingCampaign') {
      var marketingConfirmed = await openMarketingSendConfirm(String(payload.marketingSubject || ''), String(payload.marketingBody || ''));
      if (!marketingConfirmed) return;
    } else {
      var confirmOptions = confirmOptionsForAction(action);
      if (confirmOptions) {
        var confirmed = await openConfirmDialog(confirmOptions);
        if (!confirmed) return;
      }
    }

    try {
      setFormBusy(form, true, busyLabelForAction(action));
      setSyncState('Saving', 'loading');
      var response = await adminAction(payload);
      markModalClean();
      if (action === 'deleteCustomerProfile') {
        state.selectedCustomerId = null;
        history.replaceState(modalHistoryState(null, 0), '', modalUrl(null));
      }
      await refresh({ preserveScroll: true });
      if (action === 'createAndSendInvoice' && response.result && response.result.id) {
        navigateToModal('invoice', response.result.id, { force: true });
      } else if (action === 'deleteCustomerProfile') {
        closeModal({ restoreFocus: true });
        showToast(successMessageForAction(action), 'success');
        return;
      } else if (payload.invoiceId && invoiceById(payload.invoiceId)) {
        navigateToModal('invoice', payload.invoiceId, { force: true });
      } else if (payload.bookingId && bookingById(payload.bookingId)) {
        navigateToModal('booking', payload.bookingId, { force: true });
      } else if (payload.customerId && customerById(payload.customerId)) {
        navigateToModal('customer', payload.customerId, { force: true });
      }
      showToast(successMessageForAction(action), 'success');
    } catch (error) {
      setSyncState('Action failed', 'error');
      if (errorEl && document.body.contains(errorEl)) {
        errorEl.textContent = error instanceof Error ? error.message : 'The action could not be completed.';
      } else {
        showToast(error instanceof Error ? error.message : 'The action could not be completed.', 'error');
      }
    } finally {
      if (document.body.contains(form)) {
        setFormBusy(form, false);
      }
    }
  }

  function slotEditorFormState(form) {
    if (!form) return '';
    return JSON.stringify($all('input, select, textarea', form).map(function (control) {
      return {
        name: control.name || '',
        type: control.type || '',
        value: control.value,
        checked: Boolean(control.checked),
        disabled: Boolean(control.disabled)
      };
    }));
  }

  function captureSlotEditorBaseline() {
    slotEditorBaseline = slotEditorFormState($('[data-admin-slot-form]'));
  }

  function slotEditorIsDirty() {
    var editor = $('[data-admin-slot-editor]');
    var form = $('[data-admin-slot-form]');
    return Boolean(editor && !editor.hidden && form && slotEditorBaseline && slotEditorFormState(form) !== slotEditorBaseline);
  }

  function setSlotEditorBackgroundBlocked(blocked) {
    var editor = $('[data-admin-slot-editor]');
    if (!editor) return;
    var shell = $('[data-admin-shell]');
    var pageRoot = editor.parentElement;
    if (shell) {
      if (blocked) {
        shell.setAttribute('inert', '');
        shell.setAttribute('aria-hidden', 'true');
      } else {
        shell.removeAttribute('inert');
        shell.removeAttribute('aria-hidden');
      }
    }
    if (pageRoot) {
      Array.prototype.forEach.call(pageRoot.children, function (child) {
        if (child === editor) return;
        if (blocked) {
          child.setAttribute('inert', '');
          child.setAttribute('aria-hidden', 'true');
        } else {
          child.removeAttribute('inert');
          child.removeAttribute('aria-hidden');
        }
      });
    }
  }

  function setSlotEditorOpen(open, options) {
    var opts = options || {};
    var editor = $('[data-admin-slot-editor]');
    var opener = $('[data-admin-slot-open]');
    if (!editor) return;
    state.slotEditorOpen = Boolean(open);
    editor.hidden = !open;
    editor.classList.toggle('is-open', Boolean(open));
    document.body.classList.toggle('admin-slot-editor-open', Boolean(open));
    if (opener) opener.setAttribute('aria-expanded', open ? 'true' : 'false');
    setSlotEditorBackgroundBlocked(Boolean(open));

    if (open) {
      if (opts.returnFocus) {
        slotEditorReturnFocus = opts.returnFocus;
        slotEditorReturnFocusSelector = focusSelectorFor(opts.returnFocus);
      }
      var panel = $('.admin-slot-editor-panel', editor);
      labelDialog(panel, 'Availability slot editor');
      bindDialogKeyboard(editor, function () {
        requestSlotEditorClose();
      });
      if (opts.focus !== false) focusElement(panel);
    } else if (opts.restoreFocus !== false) {
      focusElement(slotEditorReturnFocus || opener, slotEditorReturnFocusSelector);
      slotEditorReturnFocus = null;
      slotEditorReturnFocusSelector = '';
    }
  }

  async function requestSlotEditorClose() {
    if (slotEditorIsDirty()) {
      var discard = await openConfirmDialog({
        title: 'Discard slot changes?',
        message: 'Close the slot editor and discard the changes you entered?',
        cancelLabel: 'Keep editing',
        confirmLabel: 'Discard changes',
        danger: true
      });
      if (!discard) return;
    }
    resetSlotForm({ keepOpen: false, restoreFocus: true });
  }

  function captureSlotEditorDraft() {
    var editor = $('[data-admin-slot-editor]');
    var form = $('[data-admin-slot-form]');
    if (!editor || editor.hidden || !form || !slotEditorIsDirty()) return null;
    var active = document.activeElement;
    return {
      controls: $all('input, select, textarea', form).map(function (control) {
        return {
          name: control.name || '',
          type: control.type || '',
          value: control.value,
          checked: Boolean(control.checked)
        };
      }),
      baseline: slotEditorBaseline,
      scrollTop: ($('.admin-slot-editor-panel', editor) || {}).scrollTop || 0,
      activeName: active && form.contains(active) ? active.name || '' : ''
    };
  }

  function restoreSlotEditorDraft(draft) {
    if (!draft) return;
    var form = $('[data-admin-slot-form]');
    var editor = $('[data-admin-slot-editor]');
    if (!form || !editor) return;
    var occurrences = {};
    draft.controls.forEach(function (saved) {
      var key = saved.name + '|' + saved.type;
      var index = occurrences[key] || 0;
      occurrences[key] = index + 1;
      var controls = $all('[name="' + escapeSelectorValue(saved.name) + '"]', form).filter(function (control) {
        return (control.type || '') === saved.type;
      });
      var control = controls[index];
      if (!control) return;
      if (control.type === 'checkbox' || control.type === 'radio') control.checked = saved.checked;
      else control.value = saved.value;
    });
    setRepeatControlsEnabled(!String(($('[data-admin-slot-id]', form) || {}).value || '').trim());
    slotEditorBaseline = draft.baseline;
    setSlotEditorOpen(true, { focus: false });
    var panel = $('.admin-slot-editor-panel', editor);
    if (panel) panel.scrollTop = draft.scrollTop;
    if (draft.activeName) focusElement($('[name="' + escapeSelectorValue(draft.activeName) + '"]', form));
  }

  function confirmationScheduleHours() {
    var settings = state.confirmationSettings || {};
    return Array.isArray(settings.hours) ? settings.hours : [];
  }

  function confirmationScheduleFormHtml() {
    var weekdays = [
      [1, 'Monday'],
      [2, 'Tuesday'],
      [3, 'Wednesday'],
      [4, 'Thursday'],
      [5, 'Friday'],
      [6, 'Saturday'],
      [7, 'Sunday']
    ];

    return '<div class="admin-modal-header">' +
        '<div>' +
          '<h2>Confirmation schedule</h2>' +
          '<p class="admin-detail-note">Set when pending bookings count down toward automatic expiry.</p>' +
        '</div>' +
        '<button class="admin-preview-close admin-icon-button" type="button" data-admin-modal-close aria-label="Close confirmation schedule" title="Close">' + ICON_CLOSE + '</button>' +
      '</div>' +
      '<form class="admin-confirmation-schedule-form" data-confirmation-schedule-form novalidate>' +
        '<div class="admin-confirmation-settings">' +
          '<label>' +
            '<span>Time to confirm</span>' +
            '<span class="admin-select-wrap">' +
              '<select name="confirmationDurationMinutes" data-confirmation-duration required>' +
                '<option value="15">15 minutes</option>' +
                '<option value="30">30 minutes</option>' +
                '<option value="60">1 hour</option>' +
                '<option value="90">1 hour 30 minutes</option>' +
                '<option value="120">2 hours</option>' +
                '<option value="180">3 hours</option>' +
                '<option value="240">4 hours</option>' +
                '<option value="480">8 hours</option>' +
                '<option value="1440">24 hours</option>' +
              '</select>' +
            '</span>' +
          '</label>' +
          '<div class="admin-confirmation-timezone">' +
            '<span>Time zone</span>' +
            '<strong data-confirmation-timezone>Europe/Vilnius</strong>' +
          '</div>' +
        '</div>' +
        '<fieldset class="admin-confirmation-week">' +
          '<legend>Review hours</legend>' +
          weekdays.map(function (weekday) {
            var isoWeekday = weekday[0];
            var label = weekday[1];
            return '<div class="admin-confirmation-day" data-confirmation-day="' + isoWeekday + '">' +
              '<label class="admin-checkbox admin-confirmation-day-toggle">' +
                '<input type="checkbox" name="confirmationDay' + isoWeekday + '" data-confirmation-day-enabled>' +
                '<span>' + label + '</span>' +
              '</label>' +
              '<label>' +
                '<span>From</span>' +
                '<input type="time" name="confirmationDay' + isoWeekday + 'Start" step="900" data-confirmation-day-start>' +
              '</label>' +
              '<label>' +
                '<span>Until</span>' +
                '<input type="time" name="confirmationDay' + isoWeekday + 'End" step="900" data-confirmation-day-end>' +
              '</label>' +
            '</div>';
          }).join('') +
        '</fieldset>' +
        '<div class="admin-form-error" data-confirmation-schedule-status role="status" aria-live="polite"></div>' +
        '<div class="admin-action-buttons admin-modal-actions">' +
          '<button class="admin-button admin-button-primary" type="submit" data-confirmation-schedule-submit>Save schedule</button>' +
        '</div>' +
      '</form>';
  }

  function renderConfirmationScheduleAccess() {
    var button = $('[data-confirmation-schedule-open]');
    if (!button) return;
    button.hidden = !(state.staff && state.staff.role === 'owner');
  }

  function renderConfirmationScheduleModal() {
    if (!state.staff || state.staff.role !== 'owner') return;
    var modal = openModal(confirmationScheduleFormHtml(), 'lg');
    var form = $('[data-confirmation-schedule-form]', modal);
    if (!form) return;

    renderConfirmationSchedule();
    $all('[data-confirmation-day]', form).forEach(function (row) {
      var toggle = $('[data-confirmation-day-enabled]', row);
      if (toggle) {
        toggle.addEventListener('change', function () {
          updateConfirmationDayState(row);
        });
      }
    });
    form.addEventListener('submit', handleConfirmationScheduleSubmit);
  }

  function confirmationTimeValue(value, fallback) {
    var normalized = String(value || '').slice(0, 5);
    return isValidHm(normalized) ? normalized : fallback;
  }

  function updateConfirmationDayState(row) {
    if (!row) return;
    var toggle = $('[data-confirmation-day-enabled]', row);
    var start = $('[data-confirmation-day-start]', row);
    var end = $('[data-confirmation-day-end]', row);
    var enabled = Boolean(toggle && toggle.checked);
    var editable = row.dataset.confirmationEditable === 'true';
    row.classList.toggle('is-disabled', !enabled);
    if (start) start.disabled = !editable || !enabled;
    if (end) end.disabled = !editable || !enabled;
  }

  function renderConfirmationSchedule() {
    var form = $('[data-confirmation-schedule-form]');
    if (!form) return;

    var settings = state.confirmationSettings;
    var canEdit = Boolean(state.staff && state.staff.role === 'owner');
    var hours = confirmationScheduleHours();
    var hoursByDay = {};
    hours.forEach(function (entry) {
      hoursByDay[Number(entry.iso_weekday)] = entry;
    });

    var duration = $('[data-confirmation-duration]', form);
    var timezone = $('[data-confirmation-timezone]', form);
    var submit = $('[data-confirmation-schedule-submit]', form);
    var status = $('[data-confirmation-schedule-status]', form);

    if (duration) {
      duration.value = String(Number(settings && settings.confirmation_window_minutes) || 120);
      duration.disabled = !canEdit;
    }
    if (timezone) timezone.textContent = String(settings && settings.timezone || TIME_ZONE);
    if (submit) submit.hidden = !canEdit;
    if (status) {
      status.textContent = '';
      status.classList.remove('is-success');
    }

    $all('[data-confirmation-day]', form).forEach(function (row) {
      var isoWeekday = Number(row.dataset.confirmationDay);
      var entry = hoursByDay[isoWeekday] || null;
      var toggle = $('[data-confirmation-day-enabled]', row);
      var start = $('[data-confirmation-day-start]', row);
      var end = $('[data-confirmation-day-end]', row);
      row.dataset.confirmationEditable = canEdit ? 'true' : 'false';
      if (toggle) {
        toggle.checked = Boolean(entry);
        toggle.disabled = !canEdit;
      }
      if (start) start.value = confirmationTimeValue(entry && entry.opens_at, '09:00');
      if (end) end.value = confirmationTimeValue(entry && entry.closes_at, '16:00');
      updateConfirmationDayState(row);
    });

    refreshCustomControls(form);
  }

  async function handleConfirmationScheduleSubmit(event) {
    event.preventDefault();
    var form = event.currentTarget;
    var status = $('[data-confirmation-schedule-status]', form);
    var duration = Number(($('[data-confirmation-duration]', form) || {}).value || 0);

    if (!state.staff || state.staff.role !== 'owner') {
      if (status) status.textContent = 'Only the organization owner can change this schedule.';
      return;
    }

    var schedule = [];
    var firstInvalid = null;
    var enabledDays = 0;

    $all('[data-confirmation-day]', form).forEach(function (row) {
      var toggle = $('[data-confirmation-day-enabled]', row);
      var start = $('[data-confirmation-day-start]', row);
      var end = $('[data-confirmation-day-end]', row);
      var enabled = Boolean(toggle && toggle.checked);
      var opensAt = String(start && start.value || '');
      var closesAt = String(end && end.value || '');

      if (enabled) {
        enabledDays += 1;
        if (!isValidHm(opensAt) || !isValidHm(closesAt) || timeToMinutes(closesAt) <= timeToMinutes(opensAt)) {
          firstInvalid = firstInvalid || start || end || toggle;
        }
      }

      schedule.push({
        isoWeekday: Number(row.dataset.confirmationDay),
        enabled: enabled,
        opensAt: opensAt,
        closesAt: closesAt
      });
    });

    if (!Number.isInteger(duration) || duration < 15 || duration > 1440) {
      showFieldError(status, 'Choose a valid confirmation time.', $('[data-confirmation-duration]', form));
      return;
    }
    if (!enabledDays) {
      showFieldError(status, 'Enable at least one review day.', $('[data-confirmation-day-enabled]', form));
      return;
    }
    if (firstInvalid) {
      showFieldError(status, 'Each enabled day must end after it starts.', firstInvalid);
      return;
    }

    if (status) {
      status.textContent = '';
      status.classList.remove('is-success');
    }

    try {
      setFormBusy(form, true, 'Saving...');
      setSyncState('Saving', 'loading');
      var response = await adminAction({
        action: 'updateConfirmationSchedule',
        confirmationDurationMinutes: duration,
        confirmationSchedule: schedule
      });
      if (response.result && typeof response.result === 'object') {
        state.confirmationSettings = response.result;
      }
      saveDashboardCache();
      markModalClean();
      renderConfirmationSchedule();
      var savedStatus = $('[data-confirmation-schedule-status]');
      if (savedStatus) {
        savedStatus.textContent = 'Confirmation schedule saved. New bookings will use it.';
        savedStatus.classList.add('is-success');
      }
      setSyncState('Synced', 'synced');
      showToast('Confirmation schedule updated.', 'success');
    } catch (error) {
      setSyncState('Action failed', 'error');
      if (status) status.textContent = error instanceof Error ? error.message : 'Could not save the confirmation schedule.';
    } finally {
      if (document.body.contains(form)) setFormBusy(form, false);
    }
  }

  function renderAvailabilityPage() {
    renderAvailabilityOptions();
    syncSlotFormFromSelection();
    renderCalendar();
    renderConfirmationScheduleAccess();
  }

  function selectedSlotHasActiveBooking(slotId) {
    return state.bookings.some(function (booking) {
      return booking.availability_slot_id === slotId && ['pending', 'confirmed'].includes(booking.status);
    });
  }

  function setRepeatControlsEnabled(enabled) {
    var form = $('[data-admin-slot-form]');
    if (!form) return;
    var repeatToggle = $('[data-admin-repeat-toggle]', form);
    var repeatWeeks = $('[data-admin-repeat-weeks]', form);
    var repeatWrap = $('[data-admin-repeat-weeks-wrap]', form);
    if (repeatWeeks) repeatWeeks.disabled = !enabled || !(repeatToggle && repeatToggle.checked);
    if (repeatWrap) repeatWrap.classList.toggle('is-disabled', !enabled || !(repeatToggle && repeatToggle.checked));
    if (repeatToggle) repeatToggle.disabled = !enabled;
  }

  function resetSlotForm(options) {
    var opts = options || {};
    var form = $('[data-admin-slot-form]');
    if (!form) return;
    state.selectedSlotId = null;
    history.replaceState(modalHistoryState(null, 0), '', PATHS.availability);
    form.reset();
    var slotId = $('[data-admin-slot-id]', form);
    if (slotId) slotId.value = '';
    var defaults = defaultSlotDateTime();
    var dateInput = $('[data-admin-slot-date]', form);
    var startSelect = $('[data-admin-slot-start]', form);
    if (dateInput) dateInput.value = defaults.date;
    if (startSelect) startSelect.dataset.pendingDefault = defaults.time;
    renderAvailabilityOptions();
    syncSlotFormFromSelection();
    renderCalendar();
    captureSlotEditorBaseline();
    setSlotEditorOpen(opts.keepOpen !== false, {
      focus: opts.keepOpen !== false,
      restoreFocus: opts.restoreFocus !== false
    });
  }

  function selectSlotForEdit(slotId) {
    var slot = slotById(slotId);
    if (!slot || selectedSlotHasActiveBooking(slotId)) return;
    state.selectedSlotId = slotId;
    state.calendarAnchor = formatDate(slot.start_at);
    history.replaceState(modalHistoryState(null, 0), '', PATHS.availability + '?slot=' + encodeURIComponent(slotId));
    renderAvailabilityPage();
    setSlotEditorOpen(true, { focus: true });
  }

  function syncSlotFormFromSelection() {
    var form = $('[data-admin-slot-form]');
    if (!form) return;
    var slot = state.selectedSlotId ? slotById(state.selectedSlotId) : null;
    if (slot && selectedSlotHasActiveBooking(slot.id)) slot = null;
    if (!slot && state.selectedSlotId) {
      state.selectedSlotId = null;
      history.replaceState(modalHistoryState(null, 0), '', PATHS.availability);
    }

    var title = $('[data-admin-slot-form-title]');
    var note = $('[data-admin-slot-mode-note]');
    var slotId = $('[data-admin-slot-id]', form);
    var serviceSelect = $('[data-admin-slot-service]', form);
    var staffSelect = $('[data-admin-slot-staff]', form);
    var dateInput = $('[data-admin-slot-date]', form);
    var startSelect = $('[data-admin-slot-start]', form);
    var endSelect = $('[data-admin-slot-end]', form);
    var internalNote = $('[name="internalNote"]', form);
    var submit = $('[data-admin-slot-submit]', form);
    var reset = $('[data-admin-slot-reset]', form);
    var del = $('[data-admin-slot-delete]', form);
    var repeatToggle = $('[data-admin-repeat-toggle]', form);

    if (slot) {
      var service = serviceById(slot.service_id);
      if (!state.hasRendered) state.calendarAnchor = formatDate(slot.start_at);
      if (title) title.textContent = 'Edit slot';
      if (note) note.textContent = 'Editing an open slot. Booked slots are read-only in the calendar.';
      if (slotId) slotId.value = slot.id;
      if (serviceSelect) serviceSelect.value = serviceSelect.tagName === 'SELECT' && service ? service.code : 'all';
      if (staffSelect) staffSelect.value = slot.assigned_staff_id || '';
      if (dateInput) dateInput.value = formatDate(slot.start_at);
      if (startSelect) startSelect.dataset.pendingDefault = formatTime(slot.start_at);
      rebuildSlotTimeOptions(true);
      if (startSelect) startSelect.value = formatTime(slot.start_at);
      if (endSelect) endSelect.value = formatTime(slot.end_at);
      if (internalNote) internalNote.value = slot.internal_note || '';
      if (submit) submit.textContent = 'Update slot';
      if (reset) reset.hidden = false;
      if (del) del.hidden = false;
      if (repeatToggle) repeatToggle.checked = false;
      setRepeatControlsEnabled(false);
      refreshCustomControls(form);
      captureSlotEditorBaseline();
      setSlotEditorOpen(true, { focus: false });
      return;
    }

    if (title) title.textContent = 'New slot';
    if (note) note.textContent = 'Select an open slot in the calendar to edit it.';
    if (slotId) slotId.value = '';
    if (submit) submit.textContent = 'Create slot';
    if (reset) reset.hidden = true;
    if (del) del.hidden = true;
    setRepeatControlsEnabled(true);
    refreshCustomControls(form);
    captureSlotEditorBaseline();
  }

  function renderAvailabilityOptions() {
    var serviceSelect = $('[data-admin-slot-service]');
    var staffSelect = $('[data-admin-slot-staff]');
    var dateInput = $('[data-admin-slot-date]');
    var startSelect = $('[data-admin-slot-start]');
    var endSelect = $('[data-admin-slot-end]');
    if (!serviceSelect || !staffSelect || !dateInput || !startSelect || !endSelect) return;

    if (serviceSelect.tagName === 'SELECT') {
      var selectedService = serviceSelect.value || 'all';
      serviceSelect.innerHTML = '<option value="all"' + (selectedService === 'all' ? ' selected' : '') + '>All inspection types</option>' +
        state.services.filter(function (service) { return service.is_public; }).map(function (service) {
          return '<option value="' + escapeHtml(service.code) + '" data-duration="' + escapeHtml(service.default_duration_minutes) + '"' + (service.code === selectedService ? ' selected' : '') + '>' + escapeHtml(service.name_en || service.name_lt) + '</option>';
        }).join('');
    } else {
      serviceSelect.value = serviceSelect.value || 'all';
    }

    var selectedStaff = staffSelect.value;
    staffSelect.innerHTML = '<option value="">Unassigned</option>' + state.staffList.filter(function (staff) { return staff.is_active; }).map(function (staff) {
      return '<option value="' + escapeHtml(staff.id) + '"' + (staff.id === selectedStaff ? ' selected' : '') + '>' + escapeHtml(staff.display_name) + ' - ' + escapeHtml(staff.role) + '</option>';
    }).join('');

    if (!dateInput.value) {
      var defaults = defaultSlotDateTime();
      dateInput.value = defaults.date;
      startSelect.dataset.pendingDefault = defaults.time;
    }

    rebuildSlotTimeOptions();
    refreshCustomControls(document);
  }

  function selectedServiceDuration() {
    var serviceSelect = $('[data-admin-slot-service]');
    var service = serviceByCode(serviceSelect && serviceSelect.value);
    if (service) return Number(service.default_duration_minutes) || 120;
    return state.services.filter(function (item) { return item.is_public; }).reduce(function (max, item) {
      return Math.max(max, Number(item.default_duration_minutes) || 0);
    }, 0) || 120;
  }

  function rebuildSlotTimeOptions(preserveEnd) {
    var dateInput = $('[data-admin-slot-date]');
    var startInput = $('[data-admin-slot-start]');
    var endInput = $('[data-admin-slot-end]');
    if (!dateInput || !startInput || !endInput) return;

    var defaultStart = startInput.value || startInput.dataset.pendingDefault || defaultSlotDateTime().time;
    startInput.value = defaultStart;
    delete startInput.dataset.pendingDefault;

    if (!preserveEnd || !endInput.value || timeToMinutes(endInput.value) <= timeToMinutes(startInput.value)) {
      endInput.value = minutesToTime(timeToMinutes(startInput.value) + selectedServiceDuration());
    }
    refreshCustomControls(document);
  }

  async function handleSlotSubmit(event) {
    event.preventDefault();
    var form = event.currentTarget;
    var errorEl = $('[data-admin-slot-error]', form);
    var data = new FormData(form);
    var dateValue = String(data.get('date') || '');
    var startTime = String(data.get('startTime') || '');
    var endTime = String(data.get('endTime') || '');
    var validation = validateDateTimePair(dateValue, startTime, endTime);
    clearFormValidation(form, errorEl);

    if (validation.error) {
      showFieldError(errorEl, validation.error, $('[data-admin-slot-date]', form));
      return;
    }

    var slotId = String(data.get('slotId') || '').trim();
    if (slotId) {
      try {
        setFormBusy(form, true, busyLabelForAction('updateSlot'));
        setSyncState('Saving', 'loading');
        await adminAction({
          action: 'updateSlot',
          slotId: slotId,
          serviceCode: data.get('serviceCode') || 'all',
          assignedStaffId: data.get('assignedStaffId') || null,
          startAt: validation.startAt,
          endAt: validation.endAt,
          internalNote: data.get('internalNote') || null
        });
        await refresh({ preserveScroll: true });
        if (errorEl) {
          errorEl.textContent = 'Slot updated.';
          errorEl.classList.add('is-success');
        }
        captureSlotEditorBaseline();
      } catch (error) {
        setSyncState('Action failed', 'error');
        if (errorEl) errorEl.textContent = error instanceof Error ? error.message : 'Could not update slot.';
      } finally {
        if (document.body.contains(form)) setFormBusy(form, false);
      }
      return;
    }

    var repeat = data.get('repeatWeekly') === 'on';
    var weeks = repeat ? Number(data.get('repeatWeeks')) || 1 : 1;
    var recurrenceSeriesId = repeat && weeks > 1 && window.crypto && window.crypto.randomUUID
      ? window.crypto.randomUUID()
      : null;
    var failures = [];
    var created = 0;
    setFormBusy(form, true, busyLabelForAction('createSlot'));
    setSyncState('Saving', 'loading');

    for (var i = 0; i < weeks; i += 1) {
      var occurrenceDate = addDaysYmd(dateValue, i * 7);
      var occurrence = validateDateTimePair(occurrenceDate, startTime, endTime);
      if (occurrence.error) {
        failures.push(occurrenceDate + ': ' + occurrence.error);
        continue;
      }

      try {
        await adminAction({
          action: 'createSlot',
          serviceCode: data.get('serviceCode') || 'all',
          assignedStaffId: data.get('assignedStaffId') || null,
          startAt: occurrence.startAt,
          endAt: occurrence.endAt,
          internalNote: data.get('internalNote') || null,
          recurrenceSeriesId: recurrenceSeriesId
        });
        created += 1;
      } catch (error) {
        failures.push(occurrenceDate + ': ' + (error instanceof Error ? error.message : 'Could not create slot.'));
      }
    }

    if (document.body.contains(form)) setFormBusy(form, false);
    await refresh({ preserveScroll: true });

    if (errorEl) {
      if (failures.length) {
        errorEl.textContent = created + ' created. Failed: ' + failures.join(' ');
      } else {
        errorEl.textContent = created === 1 ? 'Slot created.' : created + ' slots created.';
        errorEl.classList.add('is-success');
      }
    }
    if (!failures.length) captureSlotEditorBaseline();
  }

  function renderSlots() {
    var slotList = $('[data-admin-slot-list]');
    if (!slotList) return;
    var bookingBySlot = latestBookingsBySlot(function (booking) {
      return isActiveBookingStatus(booking.status);
    });
    var completedSlotIds = {};
    state.bookings.forEach(function (booking) {
      if (booking.availability_slot_id && booking.status === 'completed') {
        completedSlotIds[booking.availability_slot_id] = true;
      }
    });
    var querySlotId = state.selectedSlotId;
    var slots = state.slots.slice().sort(function (a, b) { return new Date(a.start_at) - new Date(b.start_at); });

    slots = slots.filter(function (slot) {
      if (slot.status !== 'open') return false;
      if (completedSlotIds[slot.id]) return false;
      if (new Date(slot.end_at) < new Date()) return false;
      if (state.slotFilter !== 'all' && slot.status !== state.slotFilter) return false;
      return true;
    }).slice(0, 120);

    if (!slots.length) {
      slotList.innerHTML = '<div class="admin-empty-state admin-empty-state-compact"><p>No slots match this view.</p></div>';
      return;
    }

    slotList.innerHTML = slots.map(function (slot) {
      var service = serviceNameById(slot.service_id);
      var assignee = staffById(slot.assigned_staff_id);
      var booking = bookingBySlot[slot.id];
      var status = booking ? booking.status : 'available';
      var hasActiveBooking = booking && isActiveBookingStatus(booking.status);
      var seriesMeta = slot.recurrence_series_id ? ' - Weekly series' : '';
      return '<div class="admin-slot-item' + (slot.id === querySlotId ? ' is-selected' : '') + '" data-tone="' + escapeHtml(statusTone(status)) + '">' +
        '<div>' +
          '<div class="admin-booking-title">' + escapeHtml(formatRange(slot.start_at, slot.end_at)) + '</div>' +
          '<div class="admin-slot-meta">' + escapeHtml(service) + ' - ' + escapeHtml(assignee ? assignee.display_name : 'Unassigned') + ' - ' + escapeHtml(statusLabel(status) + seriesMeta) + '</div>' +
          (booking ? '<a class="admin-inline-link" href="' + PATHS.bookings + '?booking=' + encodeURIComponent(booking.id) + '">' + escapeHtml(booking.public_reference + ' - ' + booking.customer_name) + '</a>' : '') +
        '</div>' +
        '<div class="admin-slot-actions">' +
          (!hasActiveBooking ? '<button class="admin-button admin-button-danger" type="button" data-delete-slot="' + escapeHtml(slot.id) + '">Delete</button>' : '') +
        '</div>' +
      '</div>';
    }).join('');

    $all('[data-delete-slot]', slotList).forEach(function (button) {
      button.addEventListener('click', async function () {
        await deleteSlotWithChoice(button.dataset.deleteSlot, button);
      });
    });
  }

  function initCustomControls(root) {
    refreshCustomControls(root);
  }

  function refreshCustomControls(root) {
    $all('.admin-select-wrap select', root || document).forEach(function (select) {
      select.classList.remove('is-customized');
      delete select.dataset.customSelectBound;
      if (select.parentElement) select.parentElement.classList.remove('has-custom-select');
      var widget = select.nextElementSibling;
      if (widget && widget.classList.contains('admin-custom-select')) widget.remove();
    });
    $all('.admin-date-picker-widget', root || document).forEach(function (widget) {
      widget.remove();
    });
    var dateInput = $('[data-admin-slot-date]', root || document);
    if (dateInput) delete dateInput.dataset.datePickerBound;
  }

  function setupLoginEvents() {
    var form = $('[data-admin-login-form]');
    if (!form) return;
    var sessionStatus = $('[data-admin-login-session]');
    if (sessionStatus) {
      sessionStatus.textContent = '';
      sessionStatus.hidden = true;
    }
    form.hidden = false;
    var emailInput = $('[name="email"]', form);
    if (emailInput) focusElement(emailInput);

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      var status = $('[data-admin-login-status]');
      if (status && !status.id) status.id = 'admin-login-error';
      var data = new FormData(event.currentTarget);
      status.textContent = '';
      $all('input', form).forEach(function (input) { input.removeAttribute('aria-invalid'); });
      setFormBusy(form, true, 'Signing in...');

      try {
        var session = await login(String(data.get('email') || ''), String(data.get('password') || ''));
        storeSession(session);
        await loadDashboard();
        redirectTo(PATHS.dashboard);
      } catch (error) {
        storeSession(null);
        status.textContent = error instanceof Error ? error.message : 'Sign in failed.';
        $all('input', form).forEach(function (input) {
          input.setAttribute('aria-invalid', 'true');
          if (status.id) input.setAttribute('aria-describedby', status.id);
        });
        focusElement($('[name="email"]', form));
      } finally {
        if (document.body.contains(form)) setFormBusy(form, false);
      }
    });
  }

  function setupShellEvents() {
    var navToggle = $('[data-admin-nav-toggle]');
    var navClose = $('[data-admin-nav-close]');
    var sidebar = $('#admin-sidebar');
    if (sidebar && !sidebar.hasAttribute('tabindex')) sidebar.setAttribute('tabindex', '-1');
    if (navToggle) {
      navToggle.setAttribute('aria-expanded', 'false');
      navToggle.setAttribute('aria-controls', 'admin-sidebar');
      navToggle.addEventListener('click', function () {
        setNavOpen(!navIsOpen(), { focus: true, restoreFocus: true });
      });
    }
    if (navClose) {
      navClose.addEventListener('click', function () {
        setNavOpen(false, { restoreFocus: true });
      });
    }
    $all('[data-admin-nav]').forEach(function (link) {
      link.addEventListener('click', function () {
        setNavOpen(false, { focus: false });
      });
    });
    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape' || !navIsOpen()) return;
      if (!ensureConfirmRoot().hidden || !ensureModalRoot().hidden) return;
      event.preventDefault();
      setNavOpen(false, { restoreFocus: true });
    });

    var refreshButton = $('[data-admin-refresh]');
    if (refreshButton) {
      refreshButton.addEventListener('click', async function () {
        setButtonBusy(refreshButton, true, 'Refreshing...');
        try {
          await refresh({ preserveScroll: true });
          showToast('Admin data refreshed.', 'success');
        } catch (error) {
          showToast(error instanceof Error ? error.message : 'Refresh failed.', 'error');
        } finally {
          if (document.body.contains(refreshButton)) setButtonBusy(refreshButton, false);
        }
      });
    }

    var logoutButton = $('[data-admin-logout]');
    if (logoutButton) {
      logoutButton.addEventListener('click', function () {
        closeRealtime();
        storeSession(null);
        redirectTo(PATHS.login);
      });
    }
  }

  function setupDashboardEvents() {
    var controls = $('[data-calendar-view]');
    if (controls) {
      controls.setAttribute('role', 'group');
      if (!controls.getAttribute('aria-label')) controls.setAttribute('aria-label', 'Calendar view');
      $all('[data-view]', controls).forEach(function (button) {
        setPressed(button, button.dataset.view === state.calendarView);
        button.addEventListener('click', function () {
          state.calendarView = button.dataset.view;
          $all('[data-view]', controls).forEach(function (item) {
            setPressed(item, item === button);
          });
          renderCalendar();
        });
      });
    }

    var todayButton = $('[data-calendar-today]');
    if (todayButton) {
      todayButton.addEventListener('click', function () {
        state.calendarAnchor = todayYmd();
        renderCalendar();
      });
    }

    var prevButton = $('[data-calendar-prev]');
    if (prevButton) {
      prevButton.addEventListener('click', function () {
        state.calendarAnchor = addDaysYmd(state.calendarAnchor, state.calendarView === 'week' ? -7 : -1);
        renderCalendar();
      });
    }

    var nextButton = $('[data-calendar-next]');
    if (nextButton) {
      nextButton.addEventListener('click', function () {
        state.calendarAnchor = addDaysYmd(state.calendarAnchor, state.calendarView === 'week' ? 7 : 1);
        renderCalendar();
      });
    }

    var dateInput = $('[data-calendar-date]');
    if (dateInput) {
      dateInput.addEventListener('change', function () {
        if (isValidYmd(dateInput.value)) {
          state.calendarAnchor = dateInput.value;
          renderCalendar();
        }
      });
    }
  }

  function setupBookingEvents() {
    var filters = $('[data-admin-filters]');
    var sortControls = $('[data-admin-booking-sort]');

    if (filters) {
      filters.setAttribute('role', 'group');
      if (!filters.getAttribute('aria-label')) filters.setAttribute('aria-label', 'Filter bookings');
      $all('[data-filter]', filters).forEach(function (item) {
        setPressed(item, item.dataset.filter === state.filter);
      });
      $all('[data-filter]', filters).forEach(function (button) {
        button.addEventListener('click', function () {
          state.filter = button.dataset.filter;
          $all('[data-filter]', filters).forEach(function (item) {
            setPressed(item, item === button);
          });
          state.selectedBookingId = null;
          history.replaceState(modalHistoryState(null, 0), '', PATHS.bookings + '?filter=' + encodeURIComponent(state.filter) + '&sort=' + encodeURIComponent(state.bookingSort));
          closeModal();
          renderBookingsPage();
        });
      });
    }

    if (sortControls) {
      sortControls.setAttribute('role', 'group');
      if (!sortControls.getAttribute('aria-label')) sortControls.setAttribute('aria-label', 'Sort bookings');
      $all('[data-booking-sort]', sortControls).forEach(function (item) {
        item.textContent = item.dataset.bookingSort === 'desc' ? 'Latest first' : 'Earliest first';
        setPressed(item, item.dataset.bookingSort === state.bookingSort);
      });
      $all('[data-booking-sort]', sortControls).forEach(function (button) {
        button.addEventListener('click', function () {
          state.bookingSort = button.dataset.bookingSort === 'desc' ? 'desc' : 'asc';
          $all('[data-booking-sort]', sortControls).forEach(function (item) {
            setPressed(item, item === button);
          });
          history.replaceState(modalHistoryState(null, 0), '', PATHS.bookings + '?filter=' + encodeURIComponent(state.filter) + '&sort=' + encodeURIComponent(state.bookingSort));
          renderBookingsPage();
        });
      });
    }
  }

  function setupCustomerEvents() {
    var search = $('[data-customer-search]');
    if (search) {
      search.addEventListener('input', function () {
        state.customerSearch = search.value;
        renderCustomersPage();
      });
    }
    var clear = $('[data-customer-clear]');
    if (clear) {
      clear.addEventListener('click', function () {
        state.customerSearch = '';
        if (search) {
          search.value = '';
          search.focus();
        }
        renderCustomersPage();
      });
    }
  }

  function setupInvoiceEvents() {
    var filters = $('[data-invoice-filters]');
    if (filters) {
      filters.setAttribute('role', 'group');
      if (!filters.getAttribute('aria-label')) filters.setAttribute('aria-label', 'Filter invoices');
      $all('[data-invoice-filter]', filters).forEach(function (button) {
        setPressed(button, button.dataset.invoiceFilter === state.invoiceFilter);
        button.addEventListener('click', function () {
          state.invoiceFilter = button.dataset.invoiceFilter;
          $all('[data-invoice-filter]', filters).forEach(function (item) {
            setPressed(item, item === button);
          });
          state.selectedInvoiceId = null;
          var url = new URL(window.location.href);
          ['customer', 'booking', 'invoice', 'campaign'].forEach(function (key) {
            url.searchParams.delete(key);
          });
          url.searchParams.set('filter', state.invoiceFilter);
          history.replaceState(modalHistoryState(null, 0), '', url.pathname + url.search + url.hash);
          closeModal();
          renderInvoicesPage();
        });
      });
    }

    var search = $('[data-invoice-search]');
    if (search) {
      search.addEventListener('input', function () {
        state.invoiceSearch = search.value;
        renderInvoicesPage();
      });
    }
    var clear = $('[data-invoice-clear]');
    if (clear) {
      clear.addEventListener('click', function () {
        state.invoiceSearch = '';
        if (search) {
          search.value = '';
          search.focus();
        }
        renderInvoicesPage();
      });
    }
  }

  function setupAvailabilityEvents() {
    var form = $('[data-admin-slot-form]');
    if (!form) return;

    var editor = $('[data-admin-slot-editor]');
    var openButton = $('[data-admin-slot-open]');
    var scheduleButton = $('[data-confirmation-schedule-open]');
    var repeatToggle = $('[data-admin-repeat-toggle]', form);
    var repeatWeeks = $('[data-admin-repeat-weeks]', form);
    var serviceSelect = $('[data-admin-slot-service]', form);
    var dateInput = $('[data-admin-slot-date]', form);
    var startSelect = $('[data-admin-slot-start]', form);
    var resetButton = $('[data-admin-slot-reset]', form);
    var deleteButton = $('[data-admin-slot-delete]', form);
    var errorEl = $('[data-admin-slot-error]', form);

    if (scheduleButton) {
      scheduleButton.addEventListener('click', function () {
        if (!state.staff || state.staff.role !== 'owner') return;
        navigateToModal('confirmationSchedule', 'edit');
      });
    }

    if (openButton) {
      openButton.setAttribute('aria-expanded', 'false');
      openButton.addEventListener('click', function () {
        slotEditorReturnFocus = openButton;
        slotEditorReturnFocusSelector = focusSelectorFor(openButton);
        resetSlotForm({ keepOpen: true, restoreFocus: false });
      });
    }
    if (editor) {
      $all('[data-admin-slot-editor-close]', editor).forEach(function (button) {
        button.addEventListener('click', function () {
          requestSlotEditorClose();
        });
      });
    }

    if (repeatToggle && repeatWeeks) {
      repeatToggle.addEventListener('change', function () {
        setRepeatControlsEnabled(!String(($('[data-admin-slot-id]', form) || {}).value || '').trim());
      });
    }

    [serviceSelect, dateInput, startSelect].forEach(function (input) {
      if (!input) return;
      input.addEventListener('change', function () {
        rebuildSlotTimeOptions(false);
        refreshCustomControls(form);
      });
    });

    if (dateInput) {
      dateInput.addEventListener('input', function () {
        if (!dateInput.value) return;
        if (!isValidYmd(dateInput.value)) {
          if (errorEl) errorEl.textContent = 'Use the date format YYYY-MM-DD.';
          return;
        }
        if (compareYmd(dateInput.value, todayYmd()) < 0) {
          if (errorEl) errorEl.textContent = 'Past dates cannot be selected.';
          return;
        }
        if (errorEl && errorEl.textContent === 'Past dates cannot be selected.') errorEl.textContent = '';
      });
    }

    if (resetButton) {
      resetButton.addEventListener('click', function () {
        resetSlotForm({ keepOpen: true, restoreFocus: false });
      });
    }

    if (deleteButton) {
      deleteButton.addEventListener('click', async function () {
        var slotId = String(($('[data-admin-slot-id]', form) || {}).value || '').trim();
        if (!slotId) return;
        await deleteSlotWithChoice(slotId, deleteButton);
      });
    }

    form.addEventListener('submit', handleSlotSubmit);

    initCustomControls(form);
    captureSlotEditorBaseline();
  }

  async function refresh(options) {
    var opts = options || {};
    var preserveDirtyModal = modalIsDirty();
    var slotEditorDraft = captureSlotEditorDraft();
    state.isRefreshing = true;
    setPageBusy(true, opts.background ? 'Refreshing admin data' : 'Loading admin data');
    setSyncState(opts.background ? 'Refreshing' : 'Loading', 'loading');
    try {
      await loadDashboard();
      showConsole({ preserveScroll: opts.preserveScroll || state.hasRendered });
      setUserLabel();
      setActiveNav();
      renderPage();
      restoreSlotEditorDraft(slotEditorDraft);
      if (!preserveDirtyModal) {
        renderModalFromCurrentUrl();
      } else if (opts.background) {
        showToast('Live data updated. Unsaved detail changes were kept.', 'info');
      }
      startRealtime();
      state.hasRendered = true;
      setSyncState('Synced', 'synced');
    } catch (error) {
      setSyncState('Sync failed', 'error');
      throw error;
    } finally {
      state.isRefreshing = false;
      setPageBusy(false);
    }
  }

  function renderPage() {
    if (pageController && typeof pageController.beforeRender === 'function') {
      pageController.beforeRender({ state: state });
    }
    if (state.page === 'dashboard') renderDashboardPage();
    if (state.page === 'bookings') renderBookingsPage();
    if (state.page === 'availability') renderAvailabilityPage();
    if (state.page === 'customers') renderCustomersPage();
    if (state.page === 'invoices') renderInvoicesPage();
    if (state.page === 'marketing') renderMarketingPage();
  }

  async function init() {
    state.page = document.body.dataset.adminPage || '';
    state.calendarAnchor = todayYmd();
    var params = new URLSearchParams(window.location.search);
    state.selectedSlotId = params.get('slot');
    if (state.page === 'bookings' && ['pending', 'today', 'confirmed', 'completed', 'all'].includes(params.get('filter'))) {
      state.filter = params.get('filter');
    }
    if (state.page === 'invoices' && ['all', 'unpaid', 'paid', 'void'].includes(params.get('filter'))) {
      state.invoiceFilter = params.get('filter');
    }
    if (['asc', 'desc'].includes(params.get('sort'))) {
      state.bookingSort = params.get('sort');
    }
    syncSelectedModalState(modalRouteFromUrl());
    replaceCurrentHistoryState();

    state.session = await getActiveSession();

    if (state.page === 'login') {
      if (state.session) {
        redirectTo(PATHS.dashboard);
        return;
      }
      setupLoginEvents();
      if (pageController && typeof pageController.afterInit === 'function') {
        pageController.afterInit({ state: state });
      }
      return;
    }

    if (!state.session) {
      redirectTo(PATHS.login);
      return;
    }

    els.loading = $('[data-admin-loading]');
    els.console = $('[data-admin-console]');
    els.stats = $('[data-admin-stats]');

    setupShellEvents();
    window.addEventListener('popstate', applyUrlModalState);
    if (state.page === 'dashboard' || state.page === 'availability') setupCalendarMedia();
    if (state.page === 'dashboard' || state.page === 'availability') setupDashboardEvents();
    if (state.page === 'bookings') setupBookingEvents();
    if (state.page === 'availability') setupAvailabilityEvents();
    if (state.page === 'customers') setupCustomerEvents();
    if (state.page === 'invoices') setupInvoiceEvents();
    if (pageController && typeof pageController.afterEvents === 'function') {
      pageController.afterEvents({ state: state });
    }
    startExpiryTicker();

    if (restoreDashboardCache()) {
      showConsole({ preserveScroll: true });
      setUserLabel();
      setActiveNav();
      renderPage();
      renderModalFromCurrentUrl();
      startRealtime();
      state.hasRendered = true;
      refresh({ background: true, preserveScroll: true }).catch(function (error) {
        if (!state.session) {
          redirectTo(PATHS.login);
          return;
        }
        showToast(error instanceof Error ? error.message : 'Refresh failed.', 'error');
      });
      return;
    }

    try {
      await refresh();
    } catch (error) {
      storeSession(null);
      redirectTo(PATHS.login);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
