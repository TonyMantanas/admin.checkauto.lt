import { vilniusInstant, moneyCents, installTimeChoices, createOperationStore, withSharedSessionLock } from './reliability.js?v=20261106-6';
import { currentAgreement, invoiceDeliveredToClient, bindPriceTotals } from './reliability-ui.js?v=20261106-7';
import { renderActionCenter, bindActionCenter, applyActionFilter, actionCenterHasDraft } from './action-center.js?v=20261106-7';
import { ICONS } from './icons.js?v=20261106-5';
import { modals } from './modals.js?v=20260804-1';
import { state } from './state.js?v=20260821-2';
import { auth } from './auth.js?v=20260804-1';
import { setupFilterMenu } from './filter-menu.js?v=20260821-2';
import { setupAccountMenu, syncStaffNavigation } from './shell.js?v=20261106-5';
import { skeletons } from './skeletons.js?v=20261106-4';
import { normalizeTimeToStep } from './time-inputs.js?v=20260821-2';
import { toast } from './toast.js?v=20260804-1';
import { createDashboardView } from './dashboard-view.js?v=20261105-4';
import { bookingRequestFieldsHtml } from './settings-forms.js?v=20261105-5';
import { formatDay as displayDay, formatDateTime as displayDateTime, formatRange as displayRange, relativeDay as relativeDayLabel } from './formatting.js?v=20261105-3';

/* ==========================================================================
   admin.js - CheckAuto admin app

   Static admin frontend. Data and mutations stay behind Supabase Auth,
   staff_profiles, and the admin-bookings Edge Function.
   ========================================================================== */

export function initAdminRuntime(initialPageController, routerOptions) {
  'use strict';

  var pageController = initialPageController;
  var router = routerOptions || {};

  var SUPABASE_URL = 'https://ddhhhieitupjixynjrry.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkaGhoaWVpdHVwaml4eW5qcnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNDAyOTQsImV4cCI6MjA5NzcxNjI5NH0.PXAxGc3TSFUnbcyWdizhkiJkKqJlqD1Ic8PHAjHSFIc';
  var ADMIN_ENDPOINT = SUPABASE_URL + '/functions/v1/admin-bookings';
  var MFA_RECOVERY_ENDPOINT = SUPABASE_URL + '/functions/v1/admin-mfa-recovery';
  var TEMP_PASSWORD_ENDPOINT = SUPABASE_URL + '/functions/v1/admin-temp-password';
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
    notifications: adminPath('/notifications/'),
    marketing: adminPath('/marketing/'),
    organization: adminPath('/organization/'),
    users: adminPath('/users/'),
    account: adminPath('/account/'),
    login: adminPath('/login/')
  };
  var SESSION_KEY = 'checkauto-admin-session';
  var SESSION_REFRESH_MARGIN_MS = 60 * 1000;
  var VIEW_FOCUS_MAX_AGE_MS = 15 * 1000;
  var MIN_PASSWORD_CHARACTERS = 14;
  var MAX_PASSWORD_BYTES = 72;
  var TIME_ZONE = 'Europe/Vilnius';
  var EXPIRY_TICK_MS = 1000;
  var DEFAULT_START_HOUR = 8;
  var DEFAULT_END_HOUR = 22;
  var HOUR_HEIGHT = 56;
  var SLOT_STEP_MINUTES = 15;
  var DEFAULT_SLOT_DURATION_MINUTES = 60;
  var MONEY_FORMATTERS = Object.create(null);
  var CURRENCY_SYMBOLS = {
    EUR: '€',
    GBP: '£',
    USD: '$',
    JPY: '¥'
  };
  var PAGE_ACCESS_RIGHTS = {
    customers: 'sensitive_data.access',
    invoices: 'sensitive_data.access',
    marketing: 'sensitive_data.access',
    organization: 'staff_users.manage',
    users: 'staff_users.manage'
  };

  var els = {};
  var activeDashboardLoad = null;
  var activeBookingQuery = null;
  var bookingSearchTimer = null;
  var activeInvoiceQuery = null;
  var invoiceSearchTimer = null;
  var customerActivityLoads = Object.create(null);
  var customerActivityLoadSequence = 0;
  var scrollStateTimer = null;
  var refreshActivityId = 0;
  var sessionRefreshPromise = null;
  var sessionRefreshTimer = null;
  var dialogId = 0;
  var modalReturnFocus = null;
  var modalReturnFocusSelector = '';
  var confirmReturnFocus = null;
  var slotEditorReturnFocus = null;
  var slotEditorReturnFocusSelector = '';
  var slotEditorBaseline = '';
  var organizationSettingsBaseline = '';
  var dayScheduleLastResult = null;
  var calendarMediaQuery = null;
  var navigationMediaQuery = null;
  var accountMenu = null;
  var redirectPending = false;
  var ICON_ALERT = ICONS.alert;
  var ICON_BACK = ICONS.back;
  var ICON_BOOKING = ICONS.booking;
  var ICON_CLOSE = ICONS.close;
  var ICON_EMAIL = ICONS.email;
  var ICON_EXTERNAL = ICONS.external;
  var ICON_INVOICE = ICONS.invoice;
  var ICON_INFO = ICONS.info;
  var ICON_MAP = ICONS.map;
  var ICON_PHONE = ICONS.phone;
  var ICON_REFRESH = ICONS.refresh;
  var ICON_SUCCESS = ICONS.check;
  var ICON_USER = ICONS.user;
  var ICON_MORE = ICONS.more;

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $all(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function rolesForStaff(staff) {
    if (!staff) return [];
    var values = Array.isArray(staff.roles)
      ? staff.roles
      : staff.role
        ? [staff.role]
        : [];
    return values.filter(function (role, index) {
      return typeof role === 'string' && role && values.indexOf(role) === index;
    });
  }

  function staffHasRole(staff, role) {
    return rolesForStaff(staff).includes(role);
  }

  function staffHasAccess(staff, accessRight, legacyRoles) {
    if (!staff) return false;
    if (Array.isArray(staff.access_rights)) {
      return staff.access_rights.includes(accessRight);
    }
    return (legacyRoles || []).some(function (role) {
      return staffHasRole(staff, role);
    });
  }

  function staffCanAccessPage(staff, page) {
    if (page === 'marketing') return false;
    var accessRight = PAGE_ACCESS_RIGHTS[page];
    if (!accessRight) return true;
    if (!staff) return false;
    if (['users', 'organization'].includes(page) && !staffHasRole(staff, 'owner')) return false;
    return staffHasAccess(
      staff,
      accessRight,
      accessRight === 'sensitive_data.access' ? ['owner', 'admin'] : ['owner']
    );
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
      'data-user-edit',
      'data-user-create-header',
      'data-calendar-event',
      'data-admin-day-schedule-open',
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
      return item.tabIndex >= 0 &&
        !item.matches(':disabled') &&
        !item.closest('[hidden], [aria-hidden="true"], [inert]') &&
        item.getClientRects().length > 0;
    });
  }

  function bindDialogKeyboard(root, onEscape, options) {
    if (!root) return;
    var trap = !(options && options.trap === false);
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
      if (event.key !== 'Tab' || !trap) return;
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

  function emailPreviewFrame(title, dataAttribute) {
    return '<div class="admin-email-preview admin-email-preview-modal is-loading" data-admin-email-preview>' +
      skeletons.preview() +
      '<iframe title="' + escapeHtml(title) + '" sandbox="" ' + dataAttribute + ' hidden></iframe>' +
    '</div>';
  }

  function setEmailPreviewDocument(frame, html, onLoad) {
    if (!frame) return;
    var shell = frame.closest('[data-admin-email-preview]');
    frame.addEventListener('load', function () {
      frame.hidden = false;
      if (shell) {
        shell.classList.remove('is-loading');
        var previewSkeleton = $('[data-admin-preview-skeleton]', shell);
        if (previewSkeleton) previewSkeleton.remove();
      }
      if (typeof onLoad === 'function') onLoad();
    }, { once: true });
    frame.srcdoc = html || '';
  }

  function renderInvoicePdfWindowSkeleton(pdfWindow) {
    if (!pdfWindow || !pdfWindow.document) return;
    try {
      pdfWindow.document.open();
      pdfWindow.document.write(
        '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<title>Invoice PDF</title><style>' +
        ':root{color-scheme:light;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f5f6f8}' +
        '*{box-sizing:border-box}body{margin:0;min-height:100vh;padding:clamp(16px,3vw,24px);display:grid;place-items:start center;background:#f5f6f8}' +
        '.paper{width:min(100%,760px);min-height:760px;padding:clamp(24px,5vw,48px);display:grid;align-content:start;gap:18px;border:1px solid #d9dee7;border-radius:10px;background:#fff;box-shadow:0 8px 24px rgb(16 24 40 / 8%)}' +
        '.row{display:grid;gap:8px}.split{grid-template-columns:1.15fr .85fr;gap:24px}.line,.block{display:block;border-radius:4px;background:#e5e8ed;animation:pulse 1.9s ease-in-out infinite}.line{height:12px}.short{width:30%}.medium{width:55%}.wide{width:82%}.title{width:44%;height:26px}.block{height:160px;margin-top:12px}' +
        '@keyframes pulse{0%,100%{opacity:.45}50%{opacity:1}}@media(max-width:560px){.paper{min-height:620px}.split{grid-template-columns:1fr}}@media(prefers-color-scheme:dark){:root,body{background:#111315}.paper{border-color:#383d45;box-shadow:0 8px 24px rgb(0 0 0 / 25%)}}@media(prefers-reduced-motion:reduce){.line,.block{animation:none;opacity:.7}}' +
        '</style></head><body><main class="paper" role="status" aria-label="Loading invoice PDF"><div class="row"><span class="line title"></span><span class="line medium"></span></div><div class="split"><div class="row"><span class="line short"></span><span class="line wide"></span><span class="line medium"></span></div><div class="row"><span class="line short"></span><span class="line wide"></span><span class="line medium"></span></div></div><span class="block"></span><div class="row"><span class="line wide"></span><span class="line wide"></span><span class="line medium"></span></div></main></body></html>'
      );
      pdfWindow.document.close();
    } catch (error) {
      // The signed PDF navigation can still continue if the temporary document is unavailable.
    }
  }

  function setPageBusy(busy, label) {
    var pageRoot = $('[data-page-root]');
    if (pageRoot) {
      pageRoot.setAttribute('aria-busy', busy ? 'true' : 'false');
      if (busy && !viewIsLoaded(adminViewForPage(state.page))) {
        pageRoot.dataset.loadState = 'loading';
      } else if (!busy && pageRoot.dataset.loadState !== 'error') {
        delete pageRoot.dataset.loadState;
      }
    }
    if (els.loading) {
      els.loading.setAttribute('role', 'status');
      els.loading.setAttribute('aria-live', 'polite');
      els.loading.setAttribute('aria-label', label || 'Loading admin data');
    }
  }

  function clearPageLoadError() {
    var pageRoot = $('[data-page-root]');
    if (!pageRoot) return;
    var feedback = $('[data-admin-load-feedback]', pageRoot);
    if (feedback) feedback.remove();
    if (pageRoot.dataset.loadState === 'error') delete pageRoot.dataset.loadState;
  }

  function renderPageLoadError() {
    var pageRoot = $('[data-page-root]');
    if (!pageRoot) return;
    clearPageLoadError();
    pageRoot.dataset.loadState = 'error';
    // A failed first load replaces the initial placeholders; they must not
    // continue to imply that the page is still fetching data.
    $all('[data-organization-invoice-loading], [data-organization-schedule-loading]', pageRoot)
      .forEach(function (element) { element.hidden = true; });
    $all('.admin-skeleton-row, .admin-skeleton-group, .admin-skeleton-tile, .admin-skeleton-mini-item, .admin-calendar-skeleton, .admin-skeleton-stat, .admin-notifications-skeleton-filters', pageRoot)
      .forEach(function (element) { element.remove(); });
    $all('.admin-count', pageRoot).forEach(function (element) {
      if ($('.admin-skeleton', element)) element.textContent = 'Unavailable';
    });
    $all('.admin-skeleton', pageRoot).forEach(function (element) { element.remove(); });
    if(state.page==='notifications') {
      var notificationContent=$('[data-notifications-content]');
      if(notificationContent) notificationContent.setAttribute('aria-busy','false');
      var notificationCount=$('[data-notifications-count]');
      if(notificationCount) notificationCount.textContent='Unavailable';
    }

    var feedback = document.createElement('div');
    feedback.className = 'admin-load-feedback';
    feedback.setAttribute('data-admin-load-feedback', '');
    feedback.setAttribute('role', 'alert');
    feedback.innerHTML =
      '<span>This page could not be loaded.</span>' +
      '<button class="admin-button admin-button-secondary" type="button" data-admin-load-retry>Try again</button>';
    pageRoot.prepend(feedback);

    var retry = $('[data-admin-load-retry]', feedback);
    if (retry) {
      retry.addEventListener('click', function () {
        refresh({ preserveScroll: true, force: true, view: adminViewForPage(state.page) })
          .catch(reportNavigationRefreshError);
      });
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

  // Display only. formatDate stays the YYYY-MM-DD key used for logic.
  function formatDateTime(value) {
    if (!value) return 'Not provided';
    return displayDateTime(value);
  }

  function formatRange(start, end) {
    if (!start || !end) return 'Not provided';
    return displayRange(start, end);
  }

  function formatReviewRange(start, end) {
    if (!start || !end) return 'Not provided';
    return displayRange(start, end);
  }

  function formatDueDate(value) {
    return isValidYmd(value) ? displayDay(value) : '';
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

  function expiryDurationExactLabel(remainingMs) {
    if (remainingMs <= 0) return 'Automatic rejection is being processed';
    var totalSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
    var days = Math.floor(totalSeconds / (24 * 60 * 60));
    var hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
    var minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
    var seconds = totalSeconds % 60;
    var parts = [];
    if (days) parts.push(days + 'd');
    if (hours || days) parts.push(hours + 'h');
    if (minutes || hours || days) parts.push(minutes + 'm');
    parts.push(seconds + 's');
    return parts.join(' ') + ' before automatic rejection';
  }

  function expiryCountdownTooltip(timer, expiresAt) {
    var exact = formatDateTime(expiresAt);
    return expiryDurationExactLabel(timer ? timer.remainingMs : 0) + '. Deadline: ' + exact + '.';
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

    var mode = ['compact', 'header'].includes(variant) ? variant : 'full';
    var label = expiryCountdownLabel(timer, mode === 'header' ? 'compact' : mode);
    var exact = formatDateTime(booking.pending_expires_at);
    var tooltip = expiryCountdownTooltip(timer, booking.pending_expires_at);
    var attributes =
      ' data-admin-expiry' +
      ' data-expiry-variant="' + mode + '"' +
      ' data-expires-at="' + escapeHtml(booking.pending_expires_at) + '"' +
      ' data-created-at="' + escapeHtml(booking.created_at || '') + '"' +
      ' data-tone="' + escapeHtml(timer.tone) + '"' +
      ' aria-label="' + escapeHtml(mode === 'header' ? tooltip : 'Review deadline: ' + label + '. Expires ' + exact + '.') + '"';

    if (mode === 'compact') {
      return '<span class="admin-expiry-compact"' + attributes + '>' +
        '<span data-admin-expiry-remaining>' + escapeHtml(label) + '</span>' +
      '</span>';
    }

    if (mode === 'header') {
      return '<span class="admin-expiry-ring" role="img" tabindex="0"' + attributes + ' style="--admin-expiry-progress:' + timer.progress.toFixed(2) + '%" title="' + escapeHtml(tooltip) + '"></span>';
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
      var variant = ['compact', 'header'].includes(countdown.dataset.expiryVariant) ? countdown.dataset.expiryVariant : 'full';
      var label = expiryCountdownLabel(timer, variant === 'header' ? 'compact' : variant);
      var remaining = $('[data-admin-expiry-remaining]', countdown);
      var progress = $('[data-admin-expiry-bar]', countdown);
      var exact = formatDateTime(countdown.dataset.expiresAt);

      countdown.dataset.tone = timer.tone;
      var tooltip = expiryCountdownTooltip(timer, countdown.dataset.expiresAt);
      countdown.setAttribute('aria-label', variant === 'header' ? tooltip : 'Review deadline: ' + label + '. Expires ' + exact + '.');
      if (variant === 'header') countdown.setAttribute('title', tooltip);
      if (remaining) remaining.textContent = label;
      if (progress) progress.style.width = timer.progress.toFixed(2) + '%';
      if (variant === 'header') countdown.style.setProperty('--admin-expiry-progress', timer.progress.toFixed(2) + '%');

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

  function normalizeTimeControl(control) {
    if (!control || !control.value) return;
    var normalized = normalizeTimeToStep(control.value, SLOT_STEP_MINUTES);
    if (normalized && control.value !== normalized) control.value = normalized;
  }

  function isoFromVilniusInput(dateValue, timeValue, fold) {
    return vilniusInstant(dateValue, timeValue, fold || '');
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
    var records = state.invoices.filter(function (invoice) { return invoice.booking_id === bookingId; });
    if (selectedModalRecords.invoice?.booking_id === bookingId && !records.some(function (invoice) { return invoice.id === selectedModalRecords.invoice.id; })) {
      records.push(selectedModalRecords.invoice);
    }
    return records;
  }

  function activeInvoiceForBooking(bookingId) {
    return invoicesForBooking(bookingId).find(function (invoice) { return invoice.invoice_status !== 'void'; }) || null;
  }

  function invoicesForCustomer(customerId) {
    var records = state.invoices.filter(function (invoice) { return invoice.customer_id === customerId; });
    if (selectedModalRecords.invoice?.customer_id === customerId && !records.some(function (invoice) { return invoice.id === selectedModalRecords.invoice.id; })) {
      records.push(selectedModalRecords.invoice);
    }
    return records;
  }

  var selectedModalRecords = { booking: null, invoice: null };

  function invoiceById(id) {
    return state.invoices.find(function (invoice) { return invoice.id === id; }) ||
      (selectedModalRecords.invoice?.id === id ? selectedModalRecords.invoice : null);
  }

  function bookingById(id) {
    return state.bookings.find(function (booking) { return booking.id === id; }) ||
      (selectedModalRecords.booking?.id === id ? selectedModalRecords.booking : null);
  }

  async function loadSelectedModalRecord(route, activityId) {
    if (!route || !['booking', 'invoice'].includes(route.type)) return true;
    var view = route.type === 'booking' ? 'bookings_query' : 'invoices_query';
    var query = new URLSearchParams({ view: view, search: route.id, limit: '25' });
    var response = await fetch(ADMIN_ENDPOINT + '?' + query, { headers: authHeaders(), cache: 'no-store' });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(data.error || 'The open record could not be refreshed.');
    if (activityId !== refreshActivityId) return false;
    var rows = data[route.type === 'booking' ? 'bookingQuery' : 'invoiceQuery']?.rows || [];
    var record = rows.find(function (item) { return item.id === route.id; });
    if (!record) throw new Error('The open record is no longer available. Its draft has been kept.');
    selectedModalRecords[route.type] = record;
    var list = route.type === 'booking' ? state.bookings : state.invoices;
    var index = list.findIndex(function (item) { return item.id === route.id; });
    if (index >= 0) list[index] = record;
    return true;
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
    var records = state.bookings.filter(function (booking) {
      return booking.customer_id === customerId && !booking.pii_redacted_at;
    });
    if (selectedModalRecords.booking?.customer_id === customerId && !selectedModalRecords.booking.pii_redacted_at && !records.some(function (booking) { return booking.id === selectedModalRecords.booking.id; })) {
      records.push(selectedModalRecords.booking);
    }
    return records;
  }

  function allBookingsForCustomer(customerId) {
    var records = state.bookings.filter(function (booking) {
      return booking.customer_id === customerId;
    });
    if (selectedModalRecords.booking?.customer_id === customerId && !records.some(function (booking) { return booking.id === selectedModalRecords.booking.id; })) {
      records.push(selectedModalRecords.booking);
    }
    return records;
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
      bookable: 'Available',
      pending: 'Needs review',
      confirmed: 'Confirmed',
      rejected: 'Rejected',
      cancelled: 'Cancelled',
      completed: 'Completed',
      expired: 'Expired',
      sent: 'Sent',
      failed: 'Failed',
      partial: 'Partially sent',
      sending: 'Sending now'
    }[status] || status;
  }

  function statusTone(status) {
    if (status === 'available' || status === 'bookable') return 'available';
    if (status === 'pending') return 'pending';
    if (status === 'confirmed') return 'confirmed';
    if (status === 'completed') return 'completed';
    if (status === 'sent') return 'completed';
    if (['rejected', 'cancelled', 'expired', 'failed'].includes(status)) return status;
    if (status === 'partial' || status === 'sending') return 'confirmed';
    return 'neutral';
  }

  function invoiceStatusLabel(invoice) {
    if (!invoice) return 'No invoice';
    if (invoice.invoice_status === 'void') return 'Void';
    if (invoice.invoice_status === 'payment') return 'Payment recorded';
    if (invoice.payment_status === 'paid') return 'Paid';
    if (Number(invoice.paid_amount_cents)>0 && Number(invoice.paid_amount_cents)<Number(invoice.amount_cents)) return invoice.due_date && compareYmd(invoice.due_date,todayYmd())<0 ? 'Partially paid · overdue' : 'Partially paid';
    if (invoice.due_date && compareYmd(invoice.due_date, todayYmd()) < 0) return 'Overdue';
    return 'Unpaid';
  }

  function invoiceTone(invoice) {
    if (!invoice) return 'available';
    if (invoice.invoice_status === 'void') return 'void';
    if (invoice.payment_status === 'paid') return 'paid';
    return invoiceIsOverdue(invoice) ? 'overdue' : 'unpaid';
  }

  function invoiceIsOpen(invoice) {
    return Boolean(invoice && invoice.invoice_status === 'issued' && invoice.payment_status !== 'paid');
  }

  function invoiceIsOverdue(invoice) {
    return invoiceIsOpen(invoice) && isValidYmd(invoice.due_date) && compareYmd(invoice.due_date, todayYmd()) < 0;
  }

  function invoiceOutstandingCents(invoice) {
    return Math.max(0, (Number(invoice.amount_cents) || 0) - (Number(invoice.paid_amount_cents) || 0));
  }

  // Short delivery words for the list; the modal keeps the full wording.
  function emailStatusShort(status) {
    return {
      sent: ['Sent', 'neutral'],
      delivered: ['Delivered', 'success'],
      queued: ['Queued', 'warning'],
      processing: ['Sending', 'warning'],
      pending: ['Waiting', 'warning'],
      delayed: ['Delayed', 'warning'],
      needs_review: ['Check delivery', 'danger'],
      failed: ['Failed', 'danger'],
      bounced: ['Bounced', 'danger'],
      not_sent: ['Not sent', 'neutral']
    }[status] || (status === 'skipped' || !status ? ['–', 'none'] : [String(status).replace(/_/g, ' '), 'neutral']);
  }

  function emailStatusLabel(status) {
    return {
      sent: 'Accepted / delivery unknown',
      queued: 'Queued',
      processing: 'Sending',
      delayed: 'Delivery delayed',
      needs_review: 'Reconciliation required',
      delivered: 'Delivered',
      failed: 'Delivery failed',
      bounced: 'Delivery bounced',
      pending: 'Waiting to send',
      not_sent: 'Not sent',
      skipped: 'Not applicable'
    }[status] || (status ? String(status).replace(/_/g, ' ') : 'Not sent');
  }

  function paymentLabel(status) {
    return {
      unpaid: 'Unpaid',
      partial: 'Partially paid',
      overpaid: 'Overpaid / credit',
      needs_review: 'Balance needs review',
      paid: 'Paid',
      invoice_unpaid: 'Invoice unpaid',
      invoice_paid: 'Invoice paid',
      not_required: 'Not required'
    }[status] || 'Unpaid';
  }

  function formatMoney(cents, currency) {
    var currencyCode = String(currency || 'EUR').trim().toUpperCase() || 'EUR';
    var amount = Number(cents);
    amount = Number.isFinite(amount) ? amount / 100 : 0;
    try {
      if (!MONEY_FORMATTERS[currencyCode]) {
        MONEY_FORMATTERS[currencyCode] = new Intl.NumberFormat('lt-LT', {
          style: 'currency',
          currency: currencyCode,
          currencyDisplay: 'narrowSymbol',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });
      }
      var formattedParts = MONEY_FORMATTERS[currencyCode].formatToParts(amount);
      return formattedParts.map(function (part) {
        if (part.type !== 'currency' || part.value !== currencyCode) return part.value;
        return CURRENCY_SYMBOLS[currencyCode] || '¤';
      }).join('');
    } catch (_) {
      return amount.toFixed(2).replace('.', ',') + '\u00a0' + (CURRENCY_SYMBOLS[currencyCode] || '¤');
    }
  }

  function defaultInvoiceAmount(booking) {
    var agreement = currentAgreement(state.bookingOperations?.[booking?.id]?.data || state.operationsState, booking && booking.id);
    return agreement ? (Number(agreement.total_amount_cents) / 100).toFixed(2) : '';
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

  function slotIsBookable(slot) {
    return Boolean(
      slot &&
      slot.is_bookable === true &&
      slot.effective_status === 'bookable'
    );
  }

  function getStoredSession() {
    var sessionValue = null;
    try {
      sessionValue = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      if (sessionValue) {
        state.sessionPersistence = 'session';
        return sessionValue;
      }
    } catch (error) {
      // Continue to durable storage when session storage is unavailable.
    }
    try {
      sessionValue = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      if (sessionValue) state.sessionPersistence = 'local';
      return sessionValue;
    } catch (error) {
      return null;
    }
  }

  function clearLegacyDashboardCache() {
    try {
      sessionStorage.removeItem('checkauto-admin-dashboard-cache');
    } catch (error) {
      // Browser storage may be unavailable in private or restricted contexts.
    }
  }

  function storeSession(session, rememberDevice) {
    state.session = session;
    if (session) {
      if (typeof rememberDevice === 'boolean') {
        state.sessionPersistence = rememberDevice ? 'local' : 'session';
      } else if (!state.sessionPersistence) {
        state.sessionPersistence = 'session';
      }
      try {
        if (state.sessionPersistence === 'local') {
          localStorage.setItem(SESSION_KEY, JSON.stringify(session));
          sessionStorage.removeItem(SESSION_KEY);
        } else {
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
        }
      } catch (error) {
        state.sessionPersistence = 'session';
        try {
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
        } catch (storageError) {
          // Keep the in-memory session for restricted browsing contexts.
        }
      }
      scheduleSessionRefresh(session);
    } else {
      window.clearTimeout(sessionRefreshTimer);
      sessionRefreshTimer = null;
      try {
        if (state.sessionPersistence === 'local') localStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(SESSION_KEY);
      } catch (error) {
        // In-memory state is still cleared below.
      }
      state.sessionPersistence = '';
      clearLegacyDashboardCache();
      if (state.refreshController) state.refreshController.abort();
      state.refreshController = null;
      activeDashboardLoad = null;
      if (activeBookingQuery) activeBookingQuery.abort();
      activeBookingQuery = null;
      window.clearTimeout(bookingSearchTimer);
      if (activeInvoiceQuery) activeInvoiceQuery.abort();
      activeInvoiceQuery = null;
      window.clearTimeout(invoiceSearchTimer);
      Object.keys(customerActivityLoads).forEach(function (customerId) {
        customerActivityLoads[customerId].controller.abort();
      });
      customerActivityLoads = Object.create(null);
      customerActivityLoadSequence += 1;
      state.customerActivityCache = Object.create(null);
      state.staff = null;
      state.accountSessions = [];
      [
        'bookings',
        'services',
        'slots',
        'staffList',
        'staffUsers',
        'events',
        'notes',
        'customers',
        'invoices',
        'customerEvents',
        'marketingCampaigns',
        'marketingRecipients'
      ].forEach(function (key) {
        state[key] = [];
      });
      state.maintenancePreview = null;
      state.confirmationSettings = null;
      state.organizationSettings = null;
      state.invoiceSettingsReadiness = null;
      state.dashboardAnalytics = null;
      state.operationsState = null;
      state.operationsSummary = null;
      state.bookingOperations = Object.create(null);
      state.dashboardTrendDays = 30;
      state.staffUsersLoadedAt = 0;
      state.staffUsersLoadState = 'idle';
      state.staffUsersError = '';
      state.staffUsersAccessDenied = false;
      state.loadedViews = Object.create(null);
    }
  }

  function applyDashboardData(data) {
    if (!data || typeof data !== 'object') return;
    // Views may return a slimmer staff record; keep fields they omit so the
    // account page can't flip to "inactive" or lose the email.
    if (data.staff) {
      state.staff = state.staff && data.staff.id && state.staff.id === data.staff.id
        ? Object.assign({}, state.staff, data.staff)
        : data.staff;
    }
    if (typeof data.recoveryAcknowledgementRequired === 'boolean') state.recoveryAcknowledgementRequired=data.recoveryAcknowledgementRequired;
    if (data.operationsState) state.operationsState = data.operationsState;
    if (data.operationsSummary) state.operationsSummary = data.operationsSummary;
    if (Array.isArray(data.accountSessions)) state.accountSessions = data.accountSessions;
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
    if (Object.prototype.hasOwnProperty.call(data, 'organizationSettings')) {
      state.organizationSettings = data.organizationSettings && typeof data.organizationSettings === 'object'
        ? data.organizationSettings
        : null;
    }
    if (Object.prototype.hasOwnProperty.call(data, 'invoiceSettingsReadiness')) {
      state.invoiceSettingsReadiness = data.invoiceSettingsReadiness && typeof data.invoiceSettingsReadiness === 'object'
        ? data.invoiceSettingsReadiness
        : null;
    }
    if (Object.prototype.hasOwnProperty.call(data, 'dashboardAnalytics')) {
      state.dashboardAnalytics = data.dashboardAnalytics && typeof data.dashboardAnalytics === 'object'
        ? data.dashboardAnalytics
        : null;
    } else if (state.page === 'dashboard') {
      state.dashboardAnalytics = null;
    }
  }

  function redirectTo(path) {
    if (window.location.pathname !== path) {
      redirectPending = true;
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
      signal: AbortSignal.timeout(10000),
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ refresh_token: session.refresh_token })
    });

    if (!response.ok) {
      if ([400, 401].includes(response.status)) return null;
      throw new Error('Session refresh is temporarily unavailable. Try again.');
    }
    return response.json();
  }

  function scheduleSessionRefresh(session, retryDelay) {
    window.clearTimeout(sessionRefreshTimer);
    sessionRefreshTimer = null;
    if (!session || !session.expires_at || !session.refresh_token) return;
    var delay = Number.isFinite(Number(retryDelay))
      ? Number(retryDelay)
      : Number(session.expires_at) * 1000 - Date.now() - SESSION_REFRESH_MARGIN_MS;
    sessionRefreshTimer = window.setTimeout(function () {
      ensureActiveSession().then(function (activeSession) {
        if (!activeSession && state.page !== 'login') redirectTo(PATHS.login);
      }).catch(function () {
        scheduleSessionRefresh(state.session, 15 * 1000);
      });
    }, Math.max(1000, Math.min(delay, 2147483647)));
  }

  async function ensureActiveSession() {
    var session = state.session || getStoredSession();
    if (state.sessionPersistence === 'local') session = getStoredSession();
    if (!session || !session.access_token) return null;
    state.session = session;
    if (!isSessionExpired(session)) { scheduleSessionRefresh(session); return session; }
    if (sessionRefreshPromise) return sessionRefreshPromise;
    sessionRefreshPromise = withSharedSessionLock(
      state.sessionPersistence === 'local' ? auth.sessionId(session) : 'tab-' + auth.sessionId(session),
      async function () {
        if (state.sessionPersistence === 'local') {
          var latest = getStoredSession();
          if (!latest) { storeSession(null); return null; }
          session = latest;
          if (!isSessionExpired(session)) { state.session=session; scheduleSessionRefresh(session); return session; }
        }
        try {
          var refreshed = await refreshSession(session);
          if (!refreshed || !refreshed.access_token) { await revokeAndClearSession(session); return null; }
          storeSession(refreshed); closeRealtime(); startRealtime(); return refreshed;
        } catch (error) {
          scheduleSessionRefresh(session, 15000);
          if (Number(session.expires_at || 0)*1000 > Date.now()) return session;
          throw error;
        }
      }
    );
    try { return await sessionRefreshPromise; } finally { sessionRefreshPromise=null; }
  }

  async function getActiveSession() {
    state.session = getStoredSession();
    return ensureActiveSession();
  }

  function authHeaders() {
    return {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + state.session.access_token
    };
  }

  function isSecuritySessionCode(code) {
    return [
      'authentication_required',
      'mfa_enrollment_required',
      'mfa_challenge_required',
      'session_reauthentication_required',
      'session_expired'
    ].includes(String(code || ''));
  }

  function isTemporaryPasswordCode(code) {
    return String(code || '') === 'temporary_password_change_required';
  }

  function actionNeedsIdempotency(action) {
    return ['createAndSendInvoice', 'resendInvoice', 'sendMarketingCampaign'].includes(action);
  }

  function ensureActionIdempotency(payload) {
    if (!payload || !actionNeedsIdempotency(payload.action) || payload.idempotencyKey) return payload;
    var randomPart = window.crypto && typeof window.crypto.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
    return { ...payload, idempotencyKey: randomPart };
  }

  async function revokeAndClearSession(session) {
    var targetSession = session || state.session;
    try {
      await auth.signOut(targetSession, 'local');
    } catch (error) {
      // The local session must still be removed if it has already expired.
    } finally {
      closeRealtime();
      storeSession(null);
    }
  }

  function adminViewForPage(page) {
    return {
      dashboard: 'dashboard',
      availability: 'schedule',
      bookings: 'bookings',
      customers: 'customers',
      invoices: 'invoices',
      notifications: 'notifications',
      marketing: 'marketing',
      organization: 'organization',
      users: 'auth',
      account: 'auth'
    }[page || state.page] || 'all';
  }

  function isAbortError(error) {
    return Boolean(error && (error.name === 'AbortError' || String(error.message || '').toLowerCase().includes('aborted')));
  }

  function viewIsLoaded(view) {
    return Boolean(state.loadedViews && state.loadedViews[view]);
  }

  function pageDataIsPopulated(page) {
    var targetPage = page || state.page;
    if (!viewIsLoaded(adminViewForPage(targetPage))) return false;
    if (targetPage === 'bookings') return Boolean(state.bookingQuerySignature);
    if (targetPage === 'invoices') return Boolean(state.invoiceQuerySignature);
    return true;
  }

  function cancelDashboardLoad(view) {
    if (!activeDashboardLoad || (view && activeDashboardLoad.view !== view)) return;
    activeDashboardLoad.controller.abort();
    if (state.refreshController === activeDashboardLoad.controller) {
      state.refreshController = null;
    }
    activeDashboardLoad = null;
    state.refreshRequestId += 1;
  }

  async function loadDashboard(view, options) {
    var requestedView = view || adminViewForPage(state.page);
    var opts = options || {};
    if (activeDashboardLoad && activeDashboardLoad.view === requestedView && !opts.force) {
      return activeDashboardLoad.promise;
    }

    if (state.refreshController) state.refreshController.abort();
    var controller = new AbortController();
    var requestId = state.refreshRequestId + 1;
    state.refreshRequestId = requestId;
    state.refreshController = controller;

    var promise = (async function () {
      if (!(await ensureActiveSession())) {
        throw new Error('This account is not approved for admin access or the session has expired.');
      }
      var response = await fetch(ADMIN_ENDPOINT + '?view=' + encodeURIComponent(requestedView) + '&actionCenter=1', {
        method: 'GET',
        headers: authHeaders(),
        cache: 'no-store',
        signal: controller.signal
      });

      var data = await response.json().catch(function () { return {}; });
      if (!response.ok) {
        if (isTemporaryPasswordCode(data.code)) {
          redirectTo(PATHS.login);
          throw new Error(data.error || 'Change your temporary password before opening the admin console.');
        }
        if (response.status === 401 || isSecuritySessionCode(data.code)) {
          await revokeAndClearSession();
          throw new Error('Sign in again to verify your account.');
        }
        if (data.code === 'insufficient_role') {
          redirectTo(PATHS.dashboard);
          throw new Error(data.error || 'Your admin role cannot access this section.');
        }
        throw new Error(data.error || 'Could not load admin data.');
      }
      if (requestId !== state.refreshRequestId || controller.signal.aborted) return false;

      applyDashboardData(data);
      state.loadedViews[requestedView] = {
        loadedAt: Date.now()
      };
      return true;
    })();

    activeDashboardLoad = {
      view: requestedView,
      requestId: requestId,
      controller: controller,
      promise: promise
    };

    try {
      return await promise;
    } finally {
      if (activeDashboardLoad && activeDashboardLoad.requestId === requestId) {
        activeDashboardLoad = null;
      }
      if (state.refreshController === controller) {
        state.refreshController = null;
      }
    }
  }

  var operationStores = Object.create(null);
  function operationStore() {
    var scope = (state.staff && state.staff.id || auth.sessionId(state.session)) + '/' + (state.sessionPersistence || 'session');
    if (!operationStores[scope]) operationStores[scope] = createOperationStore(state.sessionPersistence === 'local' ? localStorage : sessionStorage, scope);
    return operationStores[scope];
  }

  async function adminAction(payload) {
    if (!(await ensureActiveSession())) {
      throw new Error('This account is not approved for admin access or the session has expired.');
    }
    if (payload.action === 'sendMarketingCampaign') payload = ensureActionIdempotency(payload);
    else if (['confirmBooking','rejectBooking','cancelBooking','recordAgreedPrice','createSlotSeries','recordPayment','recordRefund','correctPayment','resolvePaymentReconciliation','retryNotification','acknowledgeContact','createAndSendInvoice','resendInvoice'].includes(payload.action)) {
      payload = await operationStore().attach(payload);
    }
    var response = await fetch(ADMIN_ENDPOINT, {
      method: 'POST',
      headers: authHeaders(),
      cache: 'no-store',
      body: JSON.stringify(payload)
    });

    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      if (isTemporaryPasswordCode(data.code)) {
        redirectTo(PATHS.login);
        throw new Error(data.error || 'Change your temporary password before continuing.');
      }
      if (response.status === 401 || isSecuritySessionCode(data.code)) {
        await revokeAndClearSession();
        redirectTo(PATHS.login);
      }
      throw new Error(data.error || 'The action could not be completed.');
    }
    if (payload.action !== 'sendMarketingCampaign' && data.ok !== true) throw new Error('The response could not be read. Retry the same action to recover its result.');
    if (payload.action !== 'sendMarketingCampaign' && payload.idempotencyKey) operationStore().complete(payload.idempotencyKey);
    return data;
  }

  function ensureToastRoot() {
    var root = $('[data-admin-toast-root]');
    if (!root) {
      root = document.createElement('div');
      root.className = 'admin-toast-root';
      root.setAttribute('data-admin-toast-root', '');
      root.setAttribute('role', 'region');
      root.setAttribute('aria-label', 'Notifications');
      document.body.appendChild(root);
    }
    return root;
  }

  function showToast(message, type, options) {
    var opts = options || {};
    var root = ensureToastRoot();
    var toastType = ['success', 'error', 'info'].includes(type) ? type : 'info';
    var existing = $all('.admin-toast', root).find(function (item) {
      return !item.classList.contains('is-leaving') &&
        item.dataset.message === String(message || '') &&
        item.dataset.type === toastType;
    });
    if (existing) {
      existing.classList.remove('is-leaving');
      existing.classList.add('is-visible');
      if (typeof existing._adminScheduleDismiss === 'function') existing._adminScheduleDismiss();
      return existing;
    }

    var persistent = Object.prototype.hasOwnProperty.call(opts, 'persistent')
      ? Boolean(opts.persistent)
      : toastType === 'error';
    var duration = Number(opts.duration || (toastType === 'success' ? 5200 : 6500));
    var icon = toastType === 'error' ? ICON_ALERT : (toastType === 'success' ? ICON_SUCCESS : ICON_INFO);

    var toast = document.createElement('div');
    toast.className = 'admin-toast';
    toast.dataset.type = toastType;
    toast.dataset.message = String(message || '');
    toast.dataset.persistent = persistent ? 'true' : 'false';
    toast.innerHTML =
      '<span class="admin-toast-icon" aria-hidden="true">' + icon + '</span>' +
      '<span class="admin-toast-message" role="' + (toastType === 'error' ? 'alert' : 'status') + '"' +
        (toastType === 'error' ? '' : ' aria-live="polite"') + ' aria-atomic="true">' + escapeHtml(message) + '</span>' +
      '<button class="admin-toast-close admin-icon-button" type="button" aria-label="Dismiss notification" title="Dismiss">' + ICON_CLOSE + '</button>';
    root.appendChild(toast);

    var dismissTimer = 0;

    function clearDismissTimer() {
      window.clearTimeout(dismissTimer);
      dismissTimer = 0;
    }

    function dismiss(immediate) {
      if (!toast.parentNode || toast.classList.contains('is-leaving')) return;
      clearDismissTimer();
      if (immediate) {
        toast.parentNode.removeChild(toast);
        return;
      }
      toast.classList.add('is-leaving');
      toast.classList.remove('is-visible');
      window.setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 180);
    }

    function scheduleDismiss() {
      clearDismissTimer();
      if (persistent || (document.activeElement && toast.contains(document.activeElement))) return;
      dismissTimer = window.setTimeout(function () { dismiss(false); }, duration);
    }

    toast._adminDismiss = dismiss;
    toast._adminScheduleDismiss = scheduleDismiss;
    $('.admin-toast-close', toast).addEventListener('click', function () { dismiss(false); });
    toast.addEventListener('mouseenter', clearDismissTimer);
    toast.addEventListener('mouseleave', scheduleDismiss);
    toast.addEventListener('focusin', clearDismissTimer);
    toast.addEventListener('focusout', function () {
      window.setTimeout(scheduleDismiss, 0);
    });

    window.requestAnimationFrame(function () {
      if (toast.parentNode) toast.classList.add('is-visible');
    });
    scheduleDismiss();

    while ($all('.admin-toast', root).length > 3) {
      var toasts = $all('.admin-toast', root);
      var oldest = toasts.find(function (item) {
        return item !== toast && item.dataset.persistent !== 'true';
      }) || toasts.find(function (item) { return item !== toast; });
      if (!oldest) break;
      if (typeof oldest._adminDismiss === 'function') oldest._adminDismiss(true);
      else oldest.remove();
    }
    return toast;
  }

  function scheduleRealtimeRefresh() {
    if (!state.session || document.visibilityState === 'hidden' || state.page === 'login' || state.page === 'marketing') return;
    var requestedView = adminViewForPage(state.page);
    window.clearTimeout(state.realtimeRefreshTimer);
    state.realtimeRefreshTimer = window.setTimeout(function () {
      if (adminViewForPage(state.page) !== requestedView) return;
      refresh({ background: true, preserveScroll: true, view: requestedView, force: true }).catch(function (error) {
        if (isAbortError(error)) return;
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
            { event: '*', schema: 'public', table: 'bookings', filter: 'organization_id=eq.' + state.staff.organization_id },
            { event: '*', schema: 'public', table: 'invoices', filter: 'organization_id=eq.' + state.staff.organization_id },
            { event: '*', schema: 'public', table: 'customers', filter: 'organization_id=eq.' + state.staff.organization_id }
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
      if (state.session && state.page !== 'login') {
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
    if (!modalBlocksPage()) {
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

  function modalIsOpen() {
    var root = $('[data-admin-modal-root]');
    return Boolean(root && !root.hidden && $('.admin-modal-panel', root));
  }

  function modalRecordData(route) {
    if (!route) return null;
    if (route.type === 'booking' || route.type === 'invoice') {
      var invoice = route.type === 'invoice' ? invoiceById(route.id) : null;
      var bookingId = route.type === 'booking' ? route.id : invoice?.booking_id;
      var booking = bookingId ? bookingById(bookingId) : null;
      var operations = bookingId && state.bookingOperations?.[bookingId]?.data;
      return {
        booking: booking,
        invoices: route.type === 'booking' ? invoicesForBooking(bookingId) : invoice,
        customer: booking ? customerForBooking(booking) : (invoice ? customerById(invoice.customer_id) : null),
        assignee: booking ? staffById(booking.assigned_to_staff_id) : null,
        operations: operations ? {
          quotes: operations.quotes,
          payment_entries: operations.payment_entries,
          payment_summaries: operations.payment_summaries,
          notifications: operations.notifications
        } : null
      };
    }
    if (route.type === 'customer') return {
      customer: customerById(route.id),
      bookings: bookingsForCustomer(route.id),
      invoices: invoicesForCustomer(route.id),
      events: state.customerEvents?.filter(function (event) { return event.customer_id === route.id; })
    };
    if (route.type === 'staff') return state.staffUsers?.find(function (user) { return user.id === route.id; }) || null;
    if (route.type === 'campaign') return campaignById(route.id);
    if (route.type === 'daySchedule') return { slots: state.slots, staff: state.staffList };
    if (route.type === 'confirmationSchedule') return state.confirmationSettings;
    return null;
  }

  function modalDataSignature(route) {
    return JSON.stringify(modalRecordData(route));
  }

  function modalConflictSignature(route) {
    if (!route) return '';
    if (route.type === 'invoice') {
      var invoice = invoiceById(route.id);
      return JSON.stringify(invoice && [invoice.id, invoice.invoice_status, invoice.payment_status, invoice.amount_cents, invoice.paid_amount_cents, invoice.updated_at]);
    }
    if (route.type === 'booking') {
      var bookingId = route.id;
      var operations = state.bookingOperations?.[bookingId]?.data;
      return JSON.stringify({
        booking: bookingById(bookingId),
        invoices: invoicesForBooking(bookingId).map(function (item) {
          return [item.id, item.invoice_status, item.payment_status, item.amount_cents, item.paid_amount_cents];
        }),
        detailsReady: Boolean(operations),
        quote: operations ? currentAgreement(operations, bookingId) : null,
        payments: operations?.payment_entries || null
      });
    }
    if (route.type === 'customer' || route.type === 'staff') return JSON.stringify(modalRecordData(route));
    return '';
  }

  function markModalClean() {
    var root = ensureModalRoot();
    root.dataset.dirty = 'false';
    root._adminDraftBaseline = null;
    root._adminDraftConflict = false;
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
    root.dataset.mode = '';
    root._adminOpenRouteKey = '';
    document.body.classList.remove('admin-panel-docked');
    root.dataset.dirty = 'false';
    root._adminDataSignature = null;
    root._adminDraftBaseline = null;
    root._adminDraftConflict = false;
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

  function modalRouteFromUrl(value) {
    var search = window.location.search;
    if (value) {
      try {
        search = (value instanceof URL ? value : new URL(String(value), window.location.href)).search;
      } catch (error) {
        search = window.location.search;
      }
    }
    var params = new URLSearchParams(search);
    if (params.get('daySchedule')) return { type: 'daySchedule', id: params.get('daySchedule') };
    if (params.get('confirmationSchedule')) return { type: 'confirmationSchedule', id: params.get('confirmationSchedule') };
    if (params.get('invoice')) return { type: 'invoice', id: params.get('invoice') };
    if (params.get('booking')) return { type: 'booking', id: params.get('booking') };
    if (params.get('customer')) return { type: 'customer', id: params.get('customer') };
    if (params.get('campaign')) return { type: 'campaign', id: params.get('campaign') };
    if (params.get('staff')) return { type: 'staff', id: params.get('staff') };
    return null;
  }

  function modalUrl(route) {
    var url = new URL(window.location.href);
    ['customer', 'booking', 'invoice', 'campaign', 'confirmationSchedule', 'daySchedule', 'staff'].forEach(function (key) {
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

  function modalHistoryState(route, depth, historyIndex, baseIndex) {
    var currentIndex = Number(history.state && history.state.adminHistoryIndex);
    var nextIndex = Number.isFinite(Number(historyIndex))
      ? Number(historyIndex)
      : (Number.isFinite(currentIndex) ? currentIndex : Number(state.historyIndex || 0));
    // The page entry a modal was first pushed from, so closing can step back
    // to it and the browser Back button doesn't land on a duplicate entry.
    var base = arguments.length >= 4 ? baseIndex : (history.state && history.state.adminModalBaseIndex);
    return Object.assign({}, history.state && history.state.checkautoAdmin ? history.state : {}, {
      checkautoAdmin: true,
      adminPage: state.page,
      adminScrollY: Number(history.state && history.state.adminScrollY || 0),
      adminHistoryIndex: nextIndex,
      adminModalRoute: route || null,
      adminModalDepth: Math.max(0, Number(depth || 0)),
      adminModalBaseIndex: route && typeof base === 'number' ? base : null
    });
  }

  function replaceCurrentHistoryState() {
    var route = modalRouteFromUrl();
    var depth = history.state && history.state.checkautoAdmin ? modalHistoryDepth() : (route ? 1 : 0);
    var currentIndex = Number(history.state && history.state.adminHistoryIndex);
    state.historyIndex = Number.isFinite(currentIndex) ? currentIndex : Number(state.historyIndex || 0);
    history.replaceState(modalHistoryState(route, depth, state.historyIndex), '', window.location.href);
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
    if (state.modalStep && (!route || state.modalStep.type !== route.type || String(state.modalStep.id) !== String(route.id))) {
      state.modalStep = null;
    }
    if (state.modalNotice && (!route || state.modalNotice.type !== route.type || String(state.modalNotice.id) !== String(route.id))) {
      state.modalNotice = null;
    }
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
      if (
        state.page === 'availability' &&
        staffHasAccess(state.staff, 'confirmation_schedule.manage', ['owner'])
      ) {
        renderConfirmationScheduleModal();
      } else {
        history.replaceState(modalHistoryState(null, 0), '', modalUrl(null));
        syncSelectedModalState(null);
        closeModal({ restoreFocus: true });
      }
      return;
    }

    if (route.type === 'daySchedule') {
      if (
        state.page === 'availability' &&
        route.id === 'create' &&
        staffHasAccess(state.staff, 'operations.manage', ['owner', 'admin', 'inspector'])
      ) {
        renderDayScheduleModal();
      } else {
        history.replaceState(modalHistoryState(null, 0), '', modalUrl(null));
        syncSelectedModalState(null);
        closeModal({ restoreFocus: true });
      }
      return;
    }

    if (route.type === 'staff') {
      if (
        state.page === 'users' &&
        staffHasRole(state.staff, 'owner') &&
        pageController &&
        typeof pageController.renderModal === 'function' &&
        pageController.renderModal(route, { state: state })
      ) {
        return;
      }
      history.replaceState(modalHistoryState(null, 0), '', modalUrl(null));
      syncSelectedModalState(null);
      closeModal({ restoreFocus: true });
    }
  }

  function renderModalFromCurrentUrl() {
    var route = modalRouteFromUrl();
    syncSelectedModalState(route);
    renderModalRoute(route);
  }

  function captureModalViewState() {
    var route = modalRouteFromUrl();
    var root = ensureModalRoot();
    var panel = $('.admin-modal-panel', root);
    if (!route || root.hidden || !panel) return null;
    var active = document.activeElement;
    var focusedDetails = active && active.closest && active.closest('details');
    var focusMarkers = ['data-admin-step', 'data-payment-action-choice'];
    var focusedMarker = active && focusMarkers.find(function (name) { return active.hasAttribute && active.hasAttribute(name); });
    return {
      routeType: route.type,
      routeId: route.id,
      panelScrollTop: panel.scrollTop,
      activityScrollTop: Number(($('[data-customer-activity-panel]', root) || {}).scrollTop || 0),
      focus: active && panel.contains(active) ? {
        id: active.id || '',
        name: active.getAttribute('name') || '',
        formKey: active.form ? modalFormKey(active.form, panel) : '',
        controlIndex: active.form ? $all('input, select, textarea, button', active.form).indexOf(active) : -1,
        selectionStart: typeof active.selectionStart === 'number' ? active.selectionStart : -1,
        selectionEnd: typeof active.selectionEnd === 'number' ? active.selectionEnd : -1,
        marker: focusedMarker || '',
        markerValue: focusedMarker ? active.getAttribute(focusedMarker) : '',
        summaryIndex: active.tagName === 'SUMMARY' && focusedDetails ? $all('details', panel).indexOf(focusedDetails) : -1,
        close: active.matches('[data-admin-modal-close]')
      } : null,
      disclosures: $all('details', panel).map(function (details, index) {
        return {
          key: details.dataset.disclosureKey || '',
          index: index,
          open: details.open
        };
      })
    };
  }

  function restoreModalViewState(saved) {
    if (!saved) return;
    var route = modalRouteFromUrl();
    if (!route || route.type !== saved.routeType || route.id !== saved.routeId) return;
    var root = ensureModalRoot();
    var panel = $('.admin-modal-panel', root);
    if (!panel) return;
    var detailsList = $all('details', panel);
    saved.disclosures.forEach(function (entry) {
      var details = entry.key
        ? $('[data-disclosure-key="' + escapeSelectorValue(entry.key) + '"]', panel)
        : detailsList[entry.index];
      if (details) details.open = Boolean(entry.open);
    });
    panel.scrollTop = Math.max(0, Number(saved.panelScrollTop || 0));
    var activityPanel = $('[data-customer-activity-panel]', panel);
    if (activityPanel) activityPanel.scrollTop = Math.max(0, Number(saved.activityScrollTop || 0));
    if (saved.focus) {
      var focus = saved.focus;
      var focusTarget = focus.id ? document.getElementById(focus.id) : null;
      if (focusTarget && !panel.contains(focusTarget)) focusTarget = null;
      if (!focusTarget && focus.name) {
        var focusForm = focus.formKey ? findModalForm(panel, focus.formKey) : null;
        focusTarget = $all('[name="' + escapeSelectorValue(focus.name) + '"]', focusForm || panel).find(function (item) {
          return !item.closest('[hidden]');
        }) || null;
      }
      if (!focusTarget && focus.formKey && focus.controlIndex >= 0) {
        var indexedForm = findModalForm(panel, focus.formKey);
        focusTarget = indexedForm && $all('input, select, textarea, button', indexedForm)[focus.controlIndex];
      }
      if (!focusTarget && focus.marker) {
        var markerSelector = '[' + focus.marker + (focus.markerValue ? '="' + escapeSelectorValue(focus.markerValue) + '"' : '') + ']';
        focusTarget = $(markerSelector, panel);
      }
      if (!focusTarget && focus.summaryIndex >= 0) {
        focusTarget = detailsList[focus.summaryIndex] && detailsList[focus.summaryIndex].querySelector('summary');
      }
      if (!focusTarget && focus.close) focusTarget = $('[data-admin-modal-close]', panel);
      if (focusTarget) {
        focusElement(focusTarget);
        if (focus.selectionStart >= 0 && typeof focusTarget.setSelectionRange === 'function') {
          try { focusTarget.setSelectionRange(focus.selectionStart, focus.selectionEnd); } catch (_) {}
        }
      }
    }
    var activityDisclosure = $('[data-customer-activity-disclosure]', panel);
    if (
      route.type === 'customer' &&
      activityDisclosure &&
      activityDisclosure.open &&
      customerActivityCacheEntry(route.id).status === 'idle'
    ) {
      loadCustomerActivity(route.id).catch(function () {});
    }
  }

  function modalFormKey(form, panel) {
    var forms = $all('form', panel);
    var kind = form.dataset.action || (form.hasAttribute('data-user-create-form') ? 'user-create' :
      form.hasAttribute('data-user-edit-form') ? 'user-edit' :
      form.hasAttribute('data-user-temp-password-form') ? 'user-password' : form.id || 'form');
    return kind + ':' + forms.filter(function (item) {
      return (item.dataset.action || (item.hasAttribute('data-user-create-form') ? 'user-create' :
        item.hasAttribute('data-user-edit-form') ? 'user-edit' :
        item.hasAttribute('data-user-temp-password-form') ? 'user-password' : item.id || 'form')) === kind;
    }).indexOf(form);
  }

  function findModalForm(panel, key) {
    return $all('form', panel).find(function (form) { return modalFormKey(form, panel) === key; }) || null;
  }

  function captureModalDraft(panel) {
    return $all('form', panel).map(function (form) {
      return {
        key: modalFormKey(form, panel),
        html: form.outerHTML,
        fields: $all('input, select, textarea', form).map(function (field) {
          var value = field.type === 'checkbox' || field.type === 'radio' ? field.checked : field.value;
          var changed = field.type === 'checkbox' || field.type === 'radio'
            ? field.checked !== field.defaultChecked
            : field.tagName === 'SELECT'
              ? field.value !== ($all('option', field).find(function (option) { return option.defaultSelected; }) || field.options[0])?.value
              : field.value !== field.defaultValue;
          return {
            value: value,
            changed: changed,
            optionLabel: field.tagName === 'SELECT' ? field.selectedOptions[0]?.textContent || '' : ''
          };
        })
      };
    });
  }

  function restoreModalDraft(panel, draft) {
    var missing = false;
    draft.forEach(function (entry) {
      var form = findModalForm(panel, entry.key);
      var fallback = false;
      if (!form && entry.fields.some(function (field) { return field.changed; })) {
        var section = document.createElement('section');
        section.className = 'admin-detail-section admin-stale-draft';
        section.innerHTML = '<h2>Unsaved draft</h2>' + entry.html;
        panel.appendChild(section);
        form = $('form', section);
        fallback = true;
        missing = true;
      }
      if (!form) return;
      $all('input, select, textarea', form).forEach(function (field, index) {
        var saved = entry.fields[index];
        if (!saved || (!saved.changed && !fallback) || field.type === 'hidden') return;
        if (field.type === 'checkbox' || field.type === 'radio') field.checked = Boolean(saved.value);
        else if (field.tagName === 'SELECT') {
          if (!$all('option', field).some(function (option) { return option.value === saved.value; })) {
            field.add(new Option(saved.optionLabel || saved.value, saved.value));
          }
          field.value = saved.value;
        } else field.value = saved.value;
      });
      if (fallback) {
        $all('button[type="submit"]', form).forEach(function (button) { button.disabled = true; });
      }
    });
    bindPriceTotals(panel);
    installTimeChoices(panel);
    return missing;
  }

  function reconcileOpenModal() {
    var route = modalRouteFromUrl();
    var root = ensureModalRoot();
    var panel = $('.admin-modal-panel', root);
    if (!route || root.hidden || !panel) return;
    var nextSignature = modalDataSignature(route);
    if (nextSignature === root._adminDataSignature) return;
    var saved = captureModalViewState();
    var dirty = modalIsDirty();
    var draft = dirty ? captureModalDraft(panel) : null;
    var baseline = root._adminDraftBaseline;
    var currentConflictSignature = modalConflictSignature(route);
    if (dirty && baseline && route.type === 'booking') {
      var original = JSON.parse(baseline);
      var latest = JSON.parse(currentConflictSignature);
      if (!original.detailsReady && latest.detailsReady) {
        original.detailsReady = true;
        original.quote = latest.quote;
        original.payments = latest.payments;
        baseline = JSON.stringify(original);
      }
    }
    var conflict = Boolean(root._adminDraftConflict || (dirty && baseline && baseline !== currentConflictSignature));
    renderModalFromCurrentUrl();
    root = ensureModalRoot();
    panel = $('.admin-modal-panel', root);
    if (!panel) return;
    if (draft) {
      conflict = restoreModalDraft(panel, draft) || conflict;
      root.dataset.dirty = 'true';
      root._adminDraftBaseline = baseline;
    }
    root._adminDraftConflict = conflict;
    if (conflict) {
      var notice = document.createElement('div');
      notice.className = 'admin-live-conflict';
      notice.setAttribute('role', 'alert');
      notice.innerHTML = 'This record changed while you were editing. Your draft is preserved. <button type="button" class="admin-button admin-button-secondary" data-admin-draft-reload>Discard draft and use latest</button>';
      var header = $('.admin-modal-header', panel);
      if (header) header.insertAdjacentElement('afterend', notice);
      else panel.prepend(notice);
      $('[data-admin-draft-reload]', notice).addEventListener('click', function () {
        markModalClean();
        renderModalFromCurrentUrl();
      });
    }
    restoreModalViewState(saved);
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
    saveCurrentScrollPosition();
    var nextHistoryIndex = state.historyIndex + 1;
    var baseIndex = current
      ? (history.state && typeof history.state.adminModalBaseIndex === 'number' ? history.state.adminModalBaseIndex : null)
      : state.historyIndex;
    history.pushState(modalHistoryState(route, modalHistoryDepth() + 1, nextHistoryIndex, baseIndex), '', modalUrl(route));
    state.historyIndex = nextHistoryIndex;
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

    var baseIndex = history.state && history.state.adminModalBaseIndex;
    if (modalRouteFromUrl() && typeof baseIndex === 'number' && baseIndex < state.historyIndex) {
      state.modalStep = null;
      markModalClean();
      history.go(baseIndex - state.historyIndex);
      return;
    }
    if (modalRouteFromUrl()) {
      state.modalStep = null;
      history.replaceState(modalHistoryState(null, 0), '', modalUrl(null));
      syncSelectedModalState(null);
      closeModal({ restoreFocus: true });
      renderPage();
      return;
    }
    closeModal({ restoreFocus: true });
  }

  // Records open in a side panel. On wide screens it sits beside the page,
  // which stays usable; on narrow screens it becomes a modal sheet.
  var panelSheetQuery = window.matchMedia ? window.matchMedia('(max-width: 60rem)') : null;

  function panelIsSheet() {
    return Boolean(panelSheetQuery && panelSheetQuery.matches);
  }

  function modalBlocksPage() {
    var root = $('[data-admin-modal-root]');
    if (!root || root.hidden) return false;
    return root.dataset.mode !== 'panel' || panelIsSheet();
  }

  function syncPanelMode() {
    var root = $('[data-admin-modal-root]');
    var panel = root && $('.admin-modal-panel', root);
    if (!root || root.hidden || !panel || root.dataset.mode !== 'panel') return;
    var blocks = panelIsSheet() || !ensureConfirmRoot().hidden;
    document.body.classList.toggle('admin-panel-docked', !panelIsSheet());
    panel.setAttribute('aria-modal', panelIsSheet() ? 'true' : 'false');
    document.body.classList.toggle('admin-modal-open', blocks);
    setPageInteractionBlocked(blocks);
    bindDialogKeyboard(root, handleModalEscape, { trap: panelIsSheet() });
  }

  if (panelSheetQuery) {
    if (typeof panelSheetQuery.addEventListener === 'function') panelSheetQuery.addEventListener('change', syncPanelMode);
    else if (typeof panelSheetQuery.addListener === 'function') panelSheetQuery.addListener(syncPanelMode);
  }

  // Escape with focus on the page (not in a field or menu) closes a side panel.
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    var root = $('[data-admin-modal-root]');
    if (!root || root.hidden || root.dataset.mode !== 'panel' || !ensureConfirmRoot().hidden) return;
    if (root.contains(event.target)) return;
    var target = event.target;
    if (target && target.closest && target.closest('input, textarea, select, details[open], [role="menu"], [role="dialog"]')) return;
    handleModalEscape();
  });

  function handleModalEscape() {
    var route = modalRouteFromUrl();
    if (route && currentModalStep(route.type, route.id)) closeModalStep();
    else closeModalRoute();
  }

  // Steps: a form that replaces the panel body ("Confirm", "Record payment").
  // The step lives in state, so a live refresh re-renders the same step and
  // the draft survives.
  function currentModalStep(type, id) {
    var step = state.modalStep;
    return step && step.type === type && String(step.id) === String(id) ? step.step : '';
  }

  function currentModalStepData(type, id) {
    return currentModalStep(type, id) ? state.modalStep.data : null;
  }

  async function openModalStep(step, data) {
    var route = modalRouteFromUrl();
    if (!route || !step) return;
    if (modalIsDirty()) {
      var discard = await openConfirmDialog({
        title: 'Discard changes?',
        message: 'What you entered here will be lost.',
        cancelLabel: 'Keep editing',
        confirmLabel: 'Discard changes',
        danger: true
      });
      if (!discard) return;
      markModalClean();
    }
    state.modalStep = { type: route.type, id: route.id, step: step, data: data == null ? null : data };
    state.modalNotice = null;
    renderModalRoute(route);
  }

  async function closeModalStep(options) {
    var opts = options || {};
    var route = modalRouteFromUrl();
    if (!route) return;
    if (modalIsDirty() && !opts.force) {
      var discard = await openConfirmDialog({
        title: 'Discard changes?',
        message: 'Go back and discard what you entered?',
        cancelLabel: 'Keep editing',
        confirmLabel: 'Discard changes',
        danger: true
      });
      if (!discard) return;
    }
    markModalClean();
    state.modalStep = null;
    state.modalNotice = opts.notice ? { type: route.type, id: route.id, text: opts.notice } : null;
    renderModalRoute(route);
  }

  function panelNoticeHtml(type, id) {
    var notice = state.modalNotice;
    if (!notice || notice.type !== type || String(notice.id) !== String(id)) return '';
    return '<p class="admin-panel-notice" role="status">' + ICON_SUCCESS + '<span>' + escapeHtml(notice.text) + '</span></p>';
  }

  // Shared panel markup: title with one state chip, a meta line, close.
  function panelHeaderHtml(opts) {
    return '<header class="admin-panel-head">' +
      '<div class="admin-panel-heading"><h2>' + escapeHtml(opts.title || '') + '</h2>' + (opts.chips || '') + '</div>' +
      (opts.meta ? '<p class="admin-panel-meta">' + opts.meta + '</p>' : '') +
      '<button class="admin-preview-close admin-icon-button" type="button" data-admin-modal-close aria-label="' + escapeHtml(opts.closeLabel || 'Close') + '" title="Close">' + ICON_CLOSE + '</button>' +
    '</header>';
  }

  function panelStepHeaderHtml(title, opts) {
    var o = opts || {};
    return '<header class="admin-panel-head admin-panel-step-head">' +
      '<button class="admin-icon-button admin-panel-back" type="button" data-admin-step-back aria-label="' + escapeHtml(o.backLabel || 'Back') + '" title="' + escapeHtml(o.backLabel || 'Back') + '">' + ICON_BACK + '</button>' +
      '<div class="admin-panel-heading"><h2>' + escapeHtml(title) + '</h2></div>' +
      (o.meta ? '<p class="admin-panel-meta">' + o.meta + '</p>' : '') +
    '</header>';
  }

  // Rare and dangerous actions live behind "More", away from the primary.
  function moreMenuHtml(items) {
    var list = (items || []).filter(Boolean);
    if (!list.length) return '';
    return '<div class="admin-more" data-admin-more>' +
      '<button class="admin-button admin-button-secondary admin-icon-button" type="button" data-admin-more-toggle aria-haspopup="menu" aria-expanded="false" aria-label="More actions" title="More actions">' + ICON_MORE + '</button>' +
      '<div class="admin-more-menu" role="menu" hidden>' +
        list.map(function (item) {
          return '<button class="admin-more-item' + (item.danger ? ' is-danger' : '') + '" type="button" role="menuitem" tabindex="-1" ' + (item.attrs || '') + '>' + escapeHtml(item.label) + '</button>';
        }).join('') +
      '</div>' +
    '</div>';
  }

  function bindMoreMenus(root) {
    $all('[data-admin-more]', root).forEach(function (wrap) {
      var toggle = $('[data-admin-more-toggle]', wrap);
      var menu = $('[role="menu"]', wrap);
      if (!toggle || !menu) return;
      function outside(event) {
        if (!wrap.contains(event.target)) close(false);
      }
      function close(focusToggle) {
        menu.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
        document.removeEventListener('pointerdown', outside, true);
        if (focusToggle) toggle.focus();
      }
      toggle.addEventListener('click', function () {
        if (!menu.hidden) { close(true); return; }
        menu.hidden = false;
        toggle.setAttribute('aria-expanded', 'true');
        document.addEventListener('pointerdown', outside, true);
        var first = $('[role="menuitem"]', menu);
        if (first) first.focus();
      });
      menu.addEventListener('keydown', function (event) {
        var items = $all('[role="menuitem"]', menu);
        var index = items.indexOf(document.activeElement);
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          close(true);
        } else if (event.key === 'ArrowDown') {
          event.preventDefault();
          items[(index + 1) % items.length].focus();
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          items[(index - 1 + items.length) % items.length].focus();
        } else if (event.key === 'Tab') {
          close(false);
        }
      });
      menu.addEventListener('click', function (event) {
        if (event.target.closest('[role="menuitem"]')) close(false);
      });
    });
  }

  function openModal(html, size) {
    var root = ensureModalRoot();
    var route = modalRouteFromUrl();
    var isPanel = size === 'panel';
    var blocksPage = !isPanel || panelIsSheet();
    var routeKey = route ? route.type + ':' + route.id : 'none';
    var isRefresh = !root.hidden && root._adminOpenRouteKey === routeKey;
    var focusWasInside = root.contains(document.activeElement);
    var canGoBack = Boolean(route && modalHistoryDepth() > 1 && !(route && currentModalStep(route.type, route.id)));
    var navHtml = canGoBack
      ? '<div class="admin-modal-nav">' +
          '<button class="admin-button admin-button-secondary admin-icon-button admin-modal-back" type="button" data-admin-modal-back aria-label="Back" title="Back">' + ICON_BACK + '</button>' +
        '</div>'
      : '';

    root.hidden = false;
    root.dataset.mode = isPanel ? 'panel' : 'dialog';
    document.body.classList.toggle('admin-panel-docked', isPanel && !panelIsSheet());
    root._adminOpenRouteKey = routeKey;
    root.innerHTML = '<div class="admin-modal-backdrop" data-admin-modal-close></div>' +
      '<section class="admin-modal-panel" data-size="' + escapeHtml(size || 'md') + '" role="dialog" aria-modal="' + (blocksPage ? 'true' : 'false') + '">' +
        navHtml +
        html +
      '</section>';
    if (blocksPage) {
      document.body.classList.add('admin-modal-open');
      setPageInteractionBlocked(true);
    } else if (ensureConfirmRoot().hidden) {
      document.body.classList.remove('admin-modal-open');
      setPageInteractionBlocked(false);
    }
    root.dataset.dirty = 'false';
    root._adminDataSignature = modalDataSignature(route);
    root._adminRenderedConflictSignature = modalConflictSignature(route);
    root._adminDraftBaseline = null;
    root._adminDraftConflict = false;
    var panel = $('.admin-modal-panel', root);
    labelDialog(panel, 'Admin details');
    installTimeChoices(root); bindPriceTotals(root);
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
    $all('[data-admin-step-back]', root).forEach(function (item) {
      item.addEventListener('click', function () { closeModalStep(); });
    });
    $all('[data-admin-step]', root).forEach(function (item) {
      item.addEventListener('click', function () {
        openModalStep(item.dataset.adminStep, item.dataset.adminStepData || null);
      });
    });
    bindMoreMenus(root);
    if (root._adminDirtyInput) root.removeEventListener('input', root._adminDirtyInput);
    if (root._adminDirtyChange) root.removeEventListener('change', root._adminDirtyChange);
    root._adminDirtyInput = function (event) {
      if (event.target && event.target.closest('form')) {
        if (root.dataset.dirty !== 'true') root._adminDraftBaseline = root._adminRenderedConflictSignature;
        root.dataset.dirty = 'true';
      }
    };
    root._adminDirtyChange = root._adminDirtyInput;
    root.addEventListener('input', root._adminDirtyInput);
    root.addEventListener('change', root._adminDirtyChange);
    if (!root._adminStaleSubmit) {
      root._adminStaleSubmit = function (event) {
        if (!root._adminDraftConflict) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        var error = $('[data-action-error]', event.target);
        if (error) error.textContent = 'This record changed. Discard the draft to use the latest version.';
      };
      root.addEventListener('submit', root._adminStaleSubmit, true);
    }
    bindDialogKeyboard(root, handleModalEscape, { trap: blocksPage });
    // Focus goes to the heading, not the first link or the close button.
    // A background refresh leaves focus where the user is working.
    if (!isRefresh || focusWasInside) {
      var autofocus = $('[autofocus]', panel);
      var heading = panel && $('h1, h2, h3', panel);
      if (autofocus) autofocus.focus();
      else if (heading) {
        heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
      } else if (panel) panel.focus();
    }
    return root;
  }

  function openConfirmDialog(options) {
    return new Promise(function (resolve) {
      var root = ensureConfirmRoot();
      confirmReturnFocus = document.activeElement;
      root.hidden = false;
      root.innerHTML = '<div class="admin-modal-backdrop" data-confirm-dismiss></div>' +
        '<section class="admin-modal-panel admin-confirm-panel" data-size="sm" role="dialog" aria-modal="true">' +
          '<div class="admin-modal-header">' +
            '<div><h2>' + escapeHtml(options.title || 'Confirm action') + '</h2></div>' +
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
      $('[data-confirm-dismiss]', root).addEventListener('click', function () { finish(false); });
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
          '<div><h2>Cancel availability</h2></div>' +
          '</div>' +
          '<p data-confirm-message>' + escapeHtml(formatRange(slot.start_at, slot.end_at)) + ' is part of a weekly series. Cancelled availability remains in history.</p>' +
          '<div class="admin-action-buttons admin-modal-actions">' +
            '<button class="admin-button admin-button-secondary" type="button" data-confirm-no>Cancel</button>' +
            '<button class="admin-button admin-button-danger" type="button" data-confirm-single>Cancel this slot</button>' +
            '<button class="admin-button admin-button-danger" type="button" data-confirm-series>Cancel series</button>' +
          '</div>' +
        '</section>';
      document.body.classList.add('admin-modal-open');
      setPageInteractionBlocked(true);
      setUnderlyingModalBlocked(true);
      var panel = $('.admin-confirm-panel', root);
      labelDialog(panel, 'Cancel availability');
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
            '<div><h2>Send marketing email</h2></div>' +
          '</div>' +
          '<p data-confirm-message>Send this email to ' + audienceCount + ' customer' + (audienceCount === 1 ? '' : 's') + ' with active marketing consent?</p>' +
          emailPreviewFrame('Marketing send preview', 'data-confirm-marketing-preview') +
          '<div class="admin-email-preview-status" data-confirm-preview-state data-tone="loading">' +
            '<span data-confirm-preview-status role="status" aria-live="polite">Loading email preview...</span>' +
            '<button class="admin-button admin-button-secondary" type="button" data-confirm-preview-retry hidden>Retry preview</button>' +
          '</div>' +
          '<div class="admin-action-buttons admin-modal-actions">' +
            '<button class="admin-button admin-button-secondary" type="button" data-confirm-no>Cancel</button>' +
            '<button class="admin-button admin-button-primary" type="button" data-confirm-yes disabled>Send campaign</button>' +
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
      var previewState = $('[data-confirm-preview-state]', root);
      var previewStatus = $('[data-confirm-preview-status]', root);
      var previewRetry = $('[data-confirm-preview-retry]', root);
      var sendButton = $('[data-confirm-yes]', root);

      function setPreviewState(tone, message, canRetry) {
        if (previewState) previewState.dataset.tone = tone;
        if (previewStatus) previewStatus.textContent = message;
        if (previewRetry) previewRetry.hidden = !canRetry;
      }

      function loadMarketingPreview() {
        if (!frame || audienceCount < 1) return;
        if (sendButton) sendButton.disabled = true;
        if (previewRetry) previewRetry.disabled = true;
        setPreviewState('loading', 'Loading email preview…', false);
        adminAction({
          action: 'previewMarketingEmail',
          marketingSubject: subject,
          marketingBody: body
        }).then(function (response) {
          var previewHtml = response.result && response.result.html ? String(response.result.html) : '';
          if (!previewHtml.trim()) throw new Error('Preview unavailable.');
          setEmailPreviewDocument(frame, previewHtml, function () {
            if (root.hidden || $('[data-confirm-marketing-preview]', root) !== frame) return;
            setPreviewState('success', 'Preview ready. Review it before sending.', false);
            if (sendButton) sendButton.disabled = false;
          });
        }).catch(function () {
          if (root.hidden || $('[data-confirm-marketing-preview]', root) !== frame) return;
          setEmailPreviewDocument(frame, '<!doctype html><meta charset="utf-8"><body style="font-family:system-ui,sans-serif;color:#b42318;padding:24px;">Email preview could not be loaded.</body>');
          setPreviewState('error', 'Preview unavailable. Retry before sending.', true);
        }).finally(function () {
          if (previewRetry && document.body.contains(previewRetry)) previewRetry.disabled = false;
        });
      }

      if (previewRetry) previewRetry.addEventListener('click', loadMarketingPreview);
      loadMarketingPreview();

      function finish(value) {
        closeConfirmDialog({ restoreFocus: true });
        resolve(value);
      }

      $('[data-confirm-no]', root).addEventListener('click', function () { finish(false); });
      sendButton.addEventListener('click', function () {
        if (!sendButton.disabled) finish(true);
      });
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
      updateInvoicePaidAmount: {
        title: 'Update paid amount',
        message: 'Replace the currently recorded paid amount with this value?',
        confirmLabel: 'Update amount'
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
        title: 'Cancel availability',
        message: 'Cancel this availability slot?',
        confirmLabel: 'Cancel slot',
        danger: true
      },
      deleteSlotSeries: {
        title: 'Cancel availability series',
        message: 'Cancel every open slot in this weekly series?',
        confirmLabel: 'Cancel series',
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

  async function showConsole(options) {
    var wasHidden = Boolean(els.console && els.console.hidden);
    if (wasHidden) await window.CheckAutoStartup?.finish();
    if (els.loading) els.loading.hidden = true;
    if (els.console) els.console.hidden = false;
    if (wasHidden && !(options && options.preserveScroll)) {
      window.scrollTo(0, 0);
    }
    if (wasHidden && state.page === 'login') {
      var input=$all('.admin-login input:not([type="checkbox"])').find(function(el) {return !el.closest('[hidden]');});
      if(input) focusElement(input);
    }
  }

  function navIsOpen() {
    return document.body.classList.contains('is-nav-open');
  }

  function navigationIsMobile() {
    if (navigationMediaQuery) return Boolean(navigationMediaQuery.matches);
    return Boolean(window.matchMedia && window.matchMedia('(max-width: 60rem)').matches);
  }

  function setNavOpen(open, options) {
    if (accountMenu) accountMenu.close();
    var opts = options || {};
    var consoleRoot = $('.admin-console');
    var sidebar = $('#admin-sidebar');
    var toggle = $('[data-admin-nav-toggle]');
    var mobileHeader = $('.admin-mobile-header');
    var pageRoot = $('[data-page-root]');
    var mobile = navigationIsMobile();
    var shouldOpen = Boolean(open) && mobile;
    document.body.classList.toggle('is-nav-open', shouldOpen);
    if (consoleRoot) consoleRoot.classList.toggle('is-nav-open', shouldOpen);
    if (toggle) {
      toggle.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
      toggle.setAttribute('aria-controls', 'admin-sidebar');
      toggle.setAttribute('aria-label', shouldOpen ? 'Close navigation' : 'Open navigation');
      toggle.setAttribute('title', shouldOpen ? 'Close navigation' : 'Open navigation');
    }
    if (sidebar) {
      sidebar.classList.toggle('is-nav-open', shouldOpen);
      if (!mobile) {
        sidebar.removeAttribute('inert');
        sidebar.removeAttribute('aria-hidden');
        sidebar.removeAttribute('role');
        sidebar.removeAttribute('aria-modal');
      } else if (shouldOpen) {
        sidebar.removeAttribute('inert');
        sidebar.removeAttribute('aria-hidden');
        sidebar.setAttribute('role', 'dialog');
        sidebar.setAttribute('aria-modal', 'true');
      } else {
        sidebar.setAttribute('inert', '');
        sidebar.setAttribute('aria-hidden', 'true');
        sidebar.removeAttribute('role');
        sidebar.removeAttribute('aria-modal');
      }
    }
    if (pageRoot) {
      if (shouldOpen) {
        pageRoot.setAttribute('inert', '');
        pageRoot.setAttribute('aria-hidden', 'true');
      } else {
        pageRoot.removeAttribute('inert');
        pageRoot.removeAttribute('aria-hidden');
      }
    }
    if (mobileHeader) {
      if (shouldOpen) {
        mobileHeader.setAttribute('inert', '');
        mobileHeader.setAttribute('aria-hidden', 'true');
      } else {
        mobileHeader.removeAttribute('inert');
        mobileHeader.removeAttribute('aria-hidden');
      }
    }

    if (shouldOpen && opts.focus !== false) {
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
    } else if (!shouldOpen && opts.restoreFocus && mobile) {
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
    syncStaffNavigation(state.staff, state.page);
    if (target && state.staff) {
      var firstName = String(state.staff.display_name || '').trim().split(/\s+/)[0];
      target.textContent = firstName || 'Account';
      var trigger = $('[data-admin-account-toggle]');
      if (trigger) trigger.setAttribute('aria-label', firstName ? firstName + ', account menu' : 'Account menu');
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
      return slotIsBookable(slot) &&
        compareYmd(formatDate(slot.start_at), today) >= 0 &&
        compareYmd(formatDate(slot.start_at), addDaysYmd(today, 7)) < 0;
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

  function buildCalendarEvents() {
    var bookingBySlot = latestBookingsBySlot(function (booking) {
      return isScheduleStatus(booking.status);
    });
    var events = [];
    var renderedBookingIds = {};

    state.slots.forEach(function (slot) {
      var booking = bookingBySlot[slot.id];
      if (booking) {
        events.push(calendarEventFromBooking(booking, slot));
        renderedBookingIds[booking.id] = true;
        return;
      }

      if (!slotIsBookable(slot)) return;

      events.push({
        id: 'slot:' + slot.id,
        type: 'slot',
        slotId: slot.id,
        status: 'bookable',
        start: slot.start_at,
        end: slot.end_at,
        title: serviceNameById(slot.service_id),
        meta: (staffById(slot.assigned_staff_id) || {}).display_name || 'Unassigned',
        assigneeName: (staffById(slot.assigned_staff_id) || {}).display_name || '',
        href: PATHS.availability + '?slot=' + encodeURIComponent(slot.id)
      });
    });

    state.bookings.forEach(function (booking) {
      if (renderedBookingIds[booking.id]) return;
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
      title: booking.public_reference + ' · ' + booking.customer_name,
      customerName: booking.customer_name || '',
      reference: booking.public_reference || '',
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
    return { start: 0, end: 24 };
  }

  function dayLabel(dateValue) {
    return displayDay(dateValue, { weekday: true, year: false });
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
    var endLabel = compactCalendarDate(end, { year: crossesYear || !compact });
    // "2–8 Nov 2026" inside one month, "28 Oct – 3 Nov 2026" across two.
    if (range.start.slice(0, 7) === end.slice(0, 7)) {
      return Number(range.start.slice(8, 10)) + '–' + endLabel;
    }
    return compactCalendarDate(range.start, { year: crossesYear }) + ' – ' + endLabel;
  }

  // A confirmed inspection can only be marked completed once it has started.
  function bookingCanBeCompleted(booking) {
    var start = booking && (booking.final_start_at || booking.requested_start_at);
    var startMs = start ? new Date(start).getTime() : NaN;
    return Boolean(booking && booking.status === 'confirmed' && Number.isFinite(startMs) && startMs <= Date.now());
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
    return '<article class="admin-booking-row-shell' + (booking.id === state.selectedBookingId ? ' is-selected' : '') + '">' +
      '<button class="admin-booking-item admin-data-row' + (booking.id === state.selectedBookingId ? ' is-selected' : '') + '" type="button" aria-label="' + escapeHtml(rowLabel + expiryLabel) + '" data-booking-base-label="' + escapeHtml(rowLabel) + '" ' +
        attributeName + '="' + escapeHtml(booking.id) + '">' +
        '<span class="admin-row-primary admin-booking-item-header">' +
          '<span class="admin-booking-title"><strong>' + escapeHtml(booking.public_reference) + '</strong><span>' + escapeHtml(booking.customer_name) + '</span></span>' +
        '</span>' +
        '<span class="admin-row-status admin-booking-row-state"><span class="admin-status-pill" data-status="' + escapeHtml(statusTone(booking.status)) + '">' + escapeHtml(statusLabel(booking.status)) + '</span>' + expiryCountdownHtml(booking, 'compact') + '</span>' +
        '<span class="admin-row-service admin-booking-meta">' + escapeHtml(serviceName) + '</span>' +
        '<span class="admin-row-date admin-booking-meta">' + escapeHtml(dateRange) + '</span>' +
        '<span class="admin-row-meta admin-booking-meta">' + escapeHtml(vehicle) + '</span>' +
      '</button>' +
      '<span class="admin-booking-row-action">' +
        (bookingCanBeCompleted(booking) && bookingPermissions().manage
          ? '<button class="admin-button admin-button-ghost admin-booking-row-complete" type="button" data-row-complete-booking="' + escapeHtml(booking.id) + '" aria-label="Mark ' + escapeHtml(booking.public_reference) + ' completed">' + ICON_SUCCESS + '<span>Mark completed</span></button>'
          : '') +
      '</span>' +
    '</article>';
  }

  var dashboardView = createDashboardView({
    state: state,
    paths: PATHS,
    icons: ICONS,
    escapeHtml: escapeHtml,
    formatMoney: formatMoney,
    formatDate: formatDate,
    formatTime: formatTime,
    todayYmd: todayYmd,
    addDaysYmd: addDaysYmd,
    compareYmd: compareYmd,
    utcNoonFromYmd: utcNoonFromYmd,
    isValidYmd: isValidYmd,
    statusTone: statusTone,
    statusLabel: statusLabel,
    expiryCountdownHtml: expiryCountdownHtml,
    staffHasAccess: staffHasAccess,
    setPressed: setPressed,
    notificationCount: function () {
      var summary = state.operationsSummary || state.operationsState;
      var total = summary && Number(summary.action_count);
      return Number.isFinite(total) ? total : 0;
    },
    onRetry: function () {
      return refresh({ preserveScroll: true, force: true, view: 'dashboard' }).catch(reportNavigationRefreshError);
    }
  });

  function renderDashboardUnavailable() {
    dashboardView.renderUnavailable();
  }

  function renderDashboardPage() {
    dashboardView.render();
  }

  function calendarIsCompact() {
    if (calendarMediaQuery) return Boolean(calendarMediaQuery.matches);
    return Boolean(window.matchMedia && window.matchMedia('(max-width: 820px), (pointer: coarse)').matches);
  }

  function applyCalendarLayout(calendar) {
    if (!calendar) return;
    var compact = calendarIsCompact();
    calendar.classList.toggle('is-compact', compact);
    calendar.dataset.calendarLayout = compact ? 'agenda' : 'grid';
  }

  function setupCalendarMedia() {
    if (!window.matchMedia || calendarMediaQuery) return;
    calendarMediaQuery = window.matchMedia('(max-width: 820px), (pointer: coarse)');
    var handleChange = function () {
      if (!viewIsLoaded(adminViewForPage(state.page))) return;
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
    var previousScroller = $('.admin-calendar-scroll', calendar);
    var previousScrollTop = previousScroller ? previousScroller.scrollTop : null;
    var previousScrollLeft = previousScroller ? previousScroller.scrollLeft : 0;
    $all('[data-calendar-prev], [data-calendar-today], [data-calendar-next], [data-calendar-view] button, [data-calendar-date]').forEach(function (control) {
      control.disabled = false;
    });
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
              return '<div class="admin-calendar-day-head" data-past="' + (compareYmd(day, todayYmd()) < 0 ? 'true' : 'false') + '"' + (day === todayYmd() ? ' data-today="true" aria-current="date"' : '') + '>' + escapeHtml(dayLabel(day)) + '</div>';
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

    var calendarScroller = $('.admin-calendar-scroll', calendar);
    if (calendarScroller && !calendarIsCompact()) {
      calendarScroller.scrollLeft = previousScrollLeft;
      if (calendar.dataset.scrollPlaced === 'true' && previousScrollTop !== null) {
        calendarScroller.scrollTop = previousScrollTop;
      } else {
        placeCalendarAtWorkingHours(calendar, calendarScroller, events);
      }
    }

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
        if (event.href) navigateToAdminUrl(event.href);
      });
    });
  }

  // The first time the week grid is visible, start the view just before the
  // working day (or the earliest item, if something starts earlier).
  function placeCalendarAtWorkingHours(calendar, scroller, events) {
    var earliest = events.reduce(function (minutes, event) {
      return Math.min(minutes, eventMinutes(event.start));
    }, DEFAULT_START_HOUR * 60);
    var place = function () {
      if (!scroller.isConnected || scroller.clientHeight === 0) return false;
      scroller.scrollTop = Math.max(0, (earliest / 60 - 0.5) * HOUR_HEIGHT);
      calendar.dataset.scrollPlaced = 'true';
      return true;
    };
    if (place() || !('ResizeObserver' in window)) return;
    var observer = new ResizeObserver(function () {
      if (place() || !scroller.isConnected) observer.disconnect();
    });
    observer.observe(scroller);
  }

  function shortStaffName(name) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length < 2) return parts[0] || '';
    return parts[0] + ' ' + parts[parts.length - 1].charAt(0) + '.';
  }

  // Phones get an agenda: it starts today (earlier days fold away), shows each
  // booking as a row and collapses a day's open times into one line of times.
  function renderCalendarAgenda(range, byDay) {
    var today = todayYmd();
    var earlier = range.days.filter(function (day) { return compareYmd(day, today) < 0; });
    var upcoming = range.days.filter(function (day) { return compareYmd(day, today) >= 0; });
    if (!upcoming.length) {
      upcoming = range.days;
      earlier = [];
    }
    var renderDay = function (day) {
      var events = byDay[day] || [];
      var bookings = events.filter(function (event) { return event.type !== 'slot'; });
      var open = events.filter(function (event) { return event.type === 'slot'; });
      var summary = [
        bookings.length ? bookings.length + (bookings.length === 1 ? ' booking' : ' bookings') : '',
        open.length ? open.length + ' open' : ''
      ].filter(Boolean).join(' · ') || 'Nothing scheduled';
      return '<section class="admin-calendar-agenda-day' + (day === today ? ' is-today' : '') + '">' +
        '<div class="admin-calendar-agenda-date">' +
          '<span>' + escapeHtml(day === today ? 'Today · ' + dayLabel(day) : dayLabel(day)) + '</span>' +
          '<span>' + escapeHtml(summary) + '</span>' +
        '</div>' +
        '<div class="admin-calendar-agenda-events">' +
          bookings.map(function (event) {
            var eventLabel = formatTime(event.start) + ' to ' + formatTime(event.end) + ', ' + (event.customerName || event.title) +
              (event.reference ? ', ' + event.reference : '') + (event.meta ? ', ' + event.meta : '') + ', ' + statusLabel(event.status);
            return '<button class="admin-calendar-agenda-event" type="button" aria-label="' + escapeHtml(eventLabel) + '" data-tone="' + escapeHtml(statusTone(event.status)) + '" data-calendar-event="' + escapeHtml(event.id) + '">' +
              '<span class="admin-calendar-agenda-time">' + escapeHtml(formatTime(event.start) + '–' + formatTime(event.end)) + '</span>' +
              '<span class="admin-calendar-agenda-meta"><strong>' + escapeHtml(event.customerName || event.title) + '</strong><span>' + escapeHtml([event.reference, event.meta].filter(Boolean).join(' · ')) + '</span></span>' +
              '<span class="admin-status-pill" data-status="' + escapeHtml(statusTone(event.status)) + '">' + escapeHtml(statusLabel(event.status)) + '</span>' +
            '</button>';
          }).join('') +
          (open.length
            ? '<div class="admin-calendar-agenda-open"><span>Open</span>' + open.map(function (event) {
                var who = event.assigneeName ? ', ' + event.assigneeName : '';
                return '<button class="admin-calendar-agenda-slot' + (event.slotId && event.slotId === state.selectedSlotId ? ' is-selected' : '') + '" type="button" data-calendar-event="' + escapeHtml(event.id) + '" aria-label="' + escapeHtml('Open time ' + formatTime(event.start) + ' to ' + formatTime(event.end) + who) + '">' + escapeHtml(formatTime(event.start)) + '</button>';
              }).join('') + '</div>'
            : '') +
          (!events.length ? '<p class="admin-calendar-agenda-empty">Nothing scheduled.</p>' : '') +
        '</div>' +
      '</section>';
    };
    return '<div class="admin-calendar-agenda" aria-label="Calendar agenda">' +
      (earlier.length
        ? '<details class="admin-calendar-agenda-earlier" data-disclosure-key="agenda-earlier"><summary>Earlier this ' + (state.calendarView === 'day' ? 'day' : 'week') + ' <span>' + earlier.length + (earlier.length === 1 ? ' day' : ' days') + '</span></summary>' + earlier.map(renderDay).join('') + '</details>'
        : '') +
      upcoming.map(renderDay).join('') +
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
    var isOpen = event.type === 'slot';
    var primary = isOpen ? 'Open' : (event.customerName || event.title);
    var secondary = isOpen ? shortStaffName(event.assigneeName) : (event.reference || '');
    var eventLabel = formatTime(event.start) + ' to ' + formatTime(event.end) + ', ' +
      (isOpen ? 'open time' + (event.assigneeName ? ', ' + event.assigneeName : '') : primary + (secondary ? ', ' + secondary : '') + ', ' + statusLabel(event.status));
    return '<button class="admin-calendar-event' + (isOpen ? ' is-open' : '') + (event.slotId && event.slotId === state.selectedSlotId ? ' is-selected' : '') + (state.page === 'availability' && event.type === 'booking' ? ' is-readonly' : '') + '" type="button" aria-label="' + escapeHtml(eventLabel) + '" data-tone="' + escapeHtml(tone) + '" data-calendar-event="' + escapeHtml(event.id) + '" style="top:' + top + 'px;height:' + height + 'px;">' +
      '<strong>' + escapeHtml(formatTime(event.start) + '–' + formatTime(event.end)) + '</strong>' +
      '<span>' + escapeHtml(primary) + '</span>' +
      (secondary ? '<small>' + escapeHtml(secondary) + '</small>' : '') +
    '</button>';
  }

  function bookingScheduleStart(booking) {
    return booking.final_start_at || booking.requested_start_at || booking.created_at || '';
  }

  function bookingFilterSignature() {
    return JSON.stringify({
      search: state.bookingSearch,
      statuses: state.bookingStatuses.slice().sort(),
      dateField: state.bookingDateField,
      dateFrom: state.bookingDateFrom,
      dateTo: state.bookingDateTo,
      sort: state.bookingSort
    });
  }

  function bookingFilterCount() {
    var count = state.bookingStatuses.length;
    if (state.bookingDateFrom) count += 1;
    if (state.bookingDateTo) count += 1;
    if (state.bookingDateField !== 'received' && (state.bookingDateFrom || state.bookingDateTo)) count += 1;
    return count;
  }

  function syncBookingFilterControls() {
    var search = $('[data-booking-search]');
    if (search && search.value !== state.bookingSearch) search.value = state.bookingSearch;
    $all('[data-booking-status]').forEach(function (checkbox) {
      checkbox.checked = state.bookingStatuses.includes(checkbox.value);
    });
    var dateField = $('[data-booking-date-field]');
    var dateFrom = $('[data-booking-date-from]');
    var dateTo = $('[data-booking-date-to]');
    if (dateField) dateField.value = state.bookingDateField;
    if (dateFrom) dateFrom.value = state.bookingDateFrom;
    if (dateTo) dateTo.value = state.bookingDateTo;
    var count = $('[data-booking-filter-count]');
    var activeCount = bookingFilterCount();
    if (count) {
      count.textContent = String(activeCount);
      count.hidden = activeCount === 0;
    }
    $all('[data-booking-sort]').forEach(function (button) {
      setPressed(button, button.dataset.bookingSort === state.bookingSort);
    });
    refreshCustomControls($('[data-page-root]'));
  }

  function replaceBookingFilterUrl() {
    var url = new URL(PATHS.bookings, window.location.href);
    if (state.bookingSearch) url.searchParams.set('search', state.bookingSearch);
    if (state.bookingStatuses.length) url.searchParams.set('statuses', state.bookingStatuses.join(','));
    if (state.bookingDateField !== 'received') url.searchParams.set('dateField', state.bookingDateField);
    if (state.bookingDateFrom) url.searchParams.set('from', state.bookingDateFrom);
    if (state.bookingDateTo) url.searchParams.set('to', state.bookingDateTo);
    if (state.bookingSort !== 'desc') url.searchParams.set('sort', state.bookingSort);
    var route = modalRouteFromUrl();
    if (route && route.type === 'booking' && route.id) url.searchParams.set('booking', route.id);
    history.replaceState(modalHistoryState(route, route ? 1 : 0), '', url.pathname + url.search);
  }

  // A list that already shows a skeleton keeps it, so its rows and pulse
  // don't restart while a second request is under way.
  function renderListSkeleton(list, count, kind) {
    if (list) {
      list.setAttribute('aria-busy', 'true');
      list.classList.add('is-querying');
      if (!$('.admin-skeleton-row', list)) list.innerHTML = skeletons.list(kind);
    }
    if (count) {
      count.setAttribute('aria-busy', 'true');
      if (!$('.admin-skeleton', count)) count.innerHTML = skeletons.block('admin-skeleton-line admin-skeleton-count');
    }
  }

  function renderBookingQuerySkeleton(list) {
    renderListSkeleton(list || $('[data-admin-booking-list]'), $('[data-admin-booking-count]'), 'bookings');
  }

  async function fetchOperationalPages(query, controller, count, resultKey) {
    var rows=[], last={};
    for(var offset=Number(query.get('offset') || 0);rows.length<count;offset+=100) {
      query.set('offset',String(offset));
      var response=await fetch(ADMIN_ENDPOINT+'?'+query.toString(),{method:'GET',headers:authHeaders(),cache:'no-store',signal:controller.signal});
      var body=await response.json().catch(function(){return {};});
      if(!response.ok) throw new Error(body.error || 'Records could not be refreshed.');
      last=body[resultKey] || {}; var page=Array.isArray(last.rows) ? last.rows : [];
      rows=rows.concat(page);
      if(!last.has_more || !page.length) break;
    }
    return {...last,rows:rows};
  }

  async function loadBookingQuery(options) {
    var opts = options || {};
    var append = opts.append === true;
    var signature = bookingFilterSignature();
    if (!append && !opts.force && state.bookingQuerySignature === signature) return true;
    if (activeBookingQuery) activeBookingQuery.abort();
    var controller = new AbortController();
    activeBookingQuery = controller;
    state.bookingQueryLoading = true;
    var list = $('[data-admin-booking-list]');
    var count = $('[data-admin-booking-count]');
    if (list) {
      list.setAttribute('aria-busy', 'true');
      list.classList.add('is-querying');
    }
    if (count) count.setAttribute('aria-busy', 'true');
    if (!append && list && !opts.silent) {
      renderBookingQuerySkeleton(list);
    }

    try {
      if (!(await ensureActiveSession())) throw new Error('Sign in again before loading bookings.');
      var offset = append ? state.bookings.length : 0;
      var query = new URLSearchParams({
        view: 'bookings_query',
        sort: state.bookingSort,
        offset: String(offset),
        limit: '100'
      });
      if (state.bookingSearch) query.set('search', state.bookingSearch);
      if (state.bookingStatuses.length) query.set('statuses', state.bookingStatuses.join(','));
      if (state.bookingDateField) query.set('dateField', state.bookingDateField);
      if (state.bookingDateFrom) query.set('dateFrom', state.bookingDateFrom);
      if (state.bookingDateTo) query.set('dateTo', state.bookingDateTo);
      var targetCount = !append && opts.preservePages && state.bookingQuerySignature === signature ? Math.max(100,state.bookings.length) : 100;
      var result = await fetchOperationalPages(query,controller,targetCount,'bookingQuery');
      if (controller.signal.aborted || activeBookingQuery !== controller || state.page !== 'bookings' || bookingFilterSignature() !== signature) return false;
      var rows = Array.isArray(result.rows) ? result.rows : [];
      var commit = function () {
        if (state.page !== 'bookings' || bookingFilterSignature() !== signature) return false;
        state.bookings = append ? state.bookings.concat(rows) : rows;
        state.bookingQueryTotal = Number(result.total_count) || 0;
        state.bookingQueryHasMore = Boolean(result.has_more);
        state.bookingQueryOffset = state.bookings.length;
        state.bookingQuerySignature = signature;
        state.bookingQueryLoading = false;
        return true;
      };
      // A deferred caller applies the rows itself once the page data it
      // renders with has arrived as well.
      if (opts.defer) return commit;
      commit();
      renderBookingsPage();
      return true;
    } catch (error) {
      if (isAbortError(error) || controller.signal.aborted) return false;
      state.bookingQueryLoading = false;
      if (list && !state.bookings.length) {
        list.innerHTML = '<div class="admin-empty-state" role="alert"><div><h2>Bookings could not be loaded</h2><p>' + escapeHtml(error instanceof Error ? error.message : 'Try again.') + '</p></div><button class="admin-button admin-button-secondary" type="button" data-booking-query-retry>Try again</button></div>';
        if (count) count.textContent = 'Unavailable';
      } else {
        showToast(error instanceof Error ? error.message : (append ? 'Older bookings could not be loaded.' : 'Bookings could not be refreshed.'), 'error');
      }
      return false;
    } finally {
      if (activeBookingQuery === controller) {
        activeBookingQuery = null;
        if (list) {
          list.removeAttribute('aria-busy');
          list.classList.remove('is-querying');
        }
        if (count) count.removeAttribute('aria-busy');
      }
    }
  }

  function getFilteredBookings() {
    return state.bookings.slice().sort(function (a, b) {
      var direction = state.bookingSort === 'desc' ? -1 : 1;
      return ((new Date(a.created_at).getTime() || 0) - (new Date(b.created_at).getTime() || 0)) * direction || String(a.id).localeCompare(String(b.id)) * direction;
    });
  }

  function renderBookingsPage() {
    els.bookingList = $('[data-admin-booking-list]');
    $all('[data-booking-search], [data-booking-status], [data-booking-date-field], [data-booking-date-from], [data-booking-date-to], [data-booking-sort]').forEach(function (control) {
      control.disabled = false;
    });
    syncBookingFilterControls();
    renderBookings();
  }

  function renderBookings() {
    var bookings = getFilteredBookings();
    if (!els.bookingList) return;
    var count = $('[data-admin-booking-count]');
    if (count) {
      var total = state.bookingQuerySignature ? state.bookingQueryTotal : bookings.length;
      count.textContent = total + ' booking' + (total === 1 ? '' : 's');
      count.setAttribute('role', 'status');
      count.setAttribute('aria-live', 'polite');
      count.setAttribute('aria-atomic', 'true');
    }

    if (!bookings.length) {
      els.bookingList.innerHTML = emptyState(
        bookingFilterCount() === 0 && !state.bookingSearch ? 'No bookings yet.' : 'No bookings match these filters.',
        bookingFilterCount() === 0 && !state.bookingSearch ? '' : 'Reset filters',
        'data-empty-bookings-all'
      );
      var showAll = $('[data-empty-bookings-all]', els.bookingList);
      if (showAll) {
        showAll.addEventListener('click', function () {
          resetBookingFilters();
        });
      }
      return;
    }

    // The list and its paging follow the received time, so rows are grouped
    // by the day each booking came in.
    var groupKey = null;
    els.bookingList.innerHTML = bookings.map(function (booking) {
      var received = booking.created_at && Number.isFinite(new Date(booking.created_at).getTime()) ? booking.created_at : null;
      var key = received ? formatDate(received) : 'unknown';
      var heading = '';
      if (key !== groupKey) {
        groupKey = key;
        var label = received ? relativeDayLabel(received) : 'date unknown';
        heading = '<h2 class="admin-booking-group">Received ' + escapeHtml(label) + '</h2>';
      }
      return heading + bookingRowHtml(booking, 'data-booking-id');
    }).join('');

    $all('[data-booking-id]', els.bookingList).forEach(function (button) {
      button.addEventListener('click', function () {
        state.selectedBookingId = button.dataset.bookingId;
        navigateToModal('booking', button.dataset.bookingId);
      });
    });
    $all('[data-row-complete-booking]', els.bookingList).forEach(function (button) {
      button.addEventListener('click', function () {
        var rowBooking = bookingById(button.dataset.rowCompleteBooking);
        runAction({ action: 'completeBooking', bookingId: button.dataset.rowCompleteBooking }, 'completeBooking', button, {
          confirm: {
            title: 'Mark ' + (rowBooking ? rowBooking.public_reference : 'this booking') + ' completed?',
            message: 'The inspection' + (rowBooking && rowBooking.customer_name ? ' for ' + rowBooking.customer_name : '') + ' is done and ready to invoice.',
            cancelLabel: 'Not yet',
            confirmLabel: 'Mark completed'
          }
        });
      });
    });
    updateExpiryCountdowns();
    var pagination = $('[data-booking-pagination]');
    var loadMore = $('[data-booking-load-more]');
    if (pagination) pagination.hidden = !state.bookingQueryHasMore;
    if (loadMore) loadMore.disabled = state.bookingQueryLoading;
  }

  function detailRow(label, value) {
    return '<span><strong>' + escapeHtml(label) + ':</strong> ' + escapeHtml(value || 'Not provided') + '</span>';
  }

  var bookingOperationsLoads=Object.create(null);
  function loadBookingOperations(bookingId, options) {
    var opts = options || {};
    if (bookingOperationsLoads[bookingId]) {
      return opts.force
        ? bookingOperationsLoads[bookingId].then(function () { return loadBookingOperations(bookingId, { render: opts.render }); })
        : bookingOperationsLoads[bookingId];
    }
    var pending = (async function () {
      try {
        if (!(await ensureActiveSession())) return false;
        var response = await fetch(ADMIN_ENDPOINT + '?view=booking_operations&bookingId=' + encodeURIComponent(bookingId), { headers: authHeaders(), cache: 'no-store' });
        var data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Booking history could not be loaded.');
        state.bookingOperations = state.bookingOperations || {};
        state.bookingOperations[bookingId] = { data: data.bookingOperations, at: Date.now() };
        var route = modalRouteFromUrl();
        if (opts.render !== false && route && (route.type === 'booking' && route.id === bookingId || route.type === 'invoice' && invoiceById(route.id)?.booking_id === bookingId)) {
          reconcileOpenModal();
        }
        return true;
      } catch (error) {
        showToast(error.message, 'error');
        return false;
      } finally {
        delete bookingOperationsLoads[bookingId];
      }
    })();
    bookingOperationsLoads[bookingId] = pending;
    return pending;
  }
  function bookingOperations(bookingId) {
    var detail=state.bookingOperations && state.bookingOperations[bookingId];
    if(!detail || Date.now()-detail.at>30000) loadBookingOperations(bookingId);
    return detail ? detail.data : {...state.operationsState, detail_pending:true};
  }

  // Booking panel ------------------------------------------------------------
  // Overview: who, when, what and the one next step for this state. Forms are
  // steps that replace the body (see openModalStep).

  var EMAIL_STATUS_LABELS = {
    delivered: 'Delivered',
    sent: 'Sent',
    queued: 'Sending',
    processing: 'Sending',
    delayed: 'Delayed',
    bounced: 'Bounced',
    failed: 'Failed',
    suppressed: 'Blocked',
    needs_review: 'Needs review'
  };

  function emailKindLabel(kind) {
    var value = String(kind || '');
    if (value === 'invoice_customer') return 'Invoice';
    if (value === 'contact_inquiry_admin') return 'Contact inquiry';
    return ({
      pending: 'Request received',
      confirmed: 'Confirmation',
      rejected: 'Rejection',
      cancelled: 'Cancellation',
      expired: 'Request expired',
      price: 'Price agreement'
    })[value.split('_')[1]] || 'Email';
  }

  function emailIsProblem(status) {
    return ['bounced', 'failed', 'suppressed', 'needs_review', 'delayed'].includes(status);
  }

  function emailLinesHtml(notifications) {
    return notifications.map(function (notification) {
      var toCustomer = String(notification.kind || '').endsWith('_customer');
      var recipient = toCustomer ? (notification.recipient_email || 'customer') : 'staff';
      return '<span class="admin-email-line' + (emailIsProblem(notification.status) ? ' is-problem' : '') + '">' +
        escapeHtml(emailKindLabel(notification.kind) + ' to ' + recipient) + ' · ' +
        '<strong>' + escapeHtml(EMAIL_STATUS_LABELS[notification.status] || 'Unknown') + '</strong>' +
      '</span>';
    }).join('');
  }

  function factHtml(label, value) {
    if (!value) return '';
    return '<div class="admin-fact"><dt>' + escapeHtml(label) + '</dt><dd>' + value + '</dd></div>';
  }

  function assignableStaffOptions(selectedId) {
    return state.staffList.filter(function (staff) {
      if (!staff.is_active && staff.is_active !== undefined) return false;
      var roles = Array.isArray(staff.roles) ? staff.roles : (staff.role ? [staff.role] : null);
      return !roles || roles.some(function (role) { return ['owner', 'admin', 'inspector'].includes(role); });
    }).map(function (staff) {
      return '<option value="' + escapeHtml(staff.id) + '"' + (staff.id === selectedId ? ' selected' : '') + '>' + escapeHtml(staff.display_name) + '</option>';
    }).join('');
  }

  function bookingPermissions() {
    return {
      manage: staffHasAccess(state.staff, 'operations.manage', ['owner', 'admin', 'inspector']),
      bill: staffHasAccess(state.staff, 'billing_email.manage', ['owner', 'admin'])
    };
  }

  function bookingQuotes(booking, operations) {
    return (operations?.quotes || []).filter(function (quote) { return quote.booking_id === booking.id; })
      .sort(function (a, b) { return b.revision - a.revision; });
  }

  // The price can change until a real invoice exists; payment-only records
  // and void invoices don't lock it.
  function bookingPriceEditable(booking, operations, canManage) {
    if (!canManage || operations?.detail_pending || !['confirmed', 'completed'].includes(booking.status)) return false;
    return !invoicesForBooking(booking.id).some(function (invoice) {
      return !['payment', 'void'].includes(invoice.invoice_status);
    });
  }

  function bookingPriceFact(booking, operations, canManage) {
    if (!['confirmed', 'completed'].includes(booking.status)) return '';
    var quotes = bookingQuotes(booking, operations);
    var agreement = quotes[0];
    var value;
    if (agreement) {
      value = '<strong>' + escapeHtml(formatMoney(agreement.total_amount_cents, 'EUR')) + '</strong>' +
        '<span class="admin-fact-sub">Service ' + escapeHtml(formatMoney(agreement.service_amount_cents, 'EUR')) +
          (Number(agreement.travel_amount_cents) > 0 ? ' + travel ' + escapeHtml(formatMoney(agreement.travel_amount_cents, 'EUR')) : '') + '</span>';
    } else if (operations?.detail_pending) {
      value = '<span class="admin-fact-sub">Loading…</span>';
    } else {
      value = '<span>Not set</span>';
    }
    if (bookingPriceEditable(booking, operations, canManage)) {
      value += '<span class="admin-fact-links"><button class="admin-context-action" type="button" data-admin-step="price">' + (agreement ? 'Change price' : 'Set price') + '</button></span>';
    }
    return factHtml('Price', value);
  }

  function bookingInvoiceFact(booking) {
    var invoice = activeInvoiceForBooking(booking.id);
    if (!invoice) return factHtml('Invoice', '<span>Not created yet</span>');
    if (invoice.invoice_status === 'payment') {
      return factHtml('Payment', '<strong>' + escapeHtml(formatMoney(invoice.paid_amount_cents || invoice.amount_cents, invoice.currency)) + '</strong>' +
        '<span class="admin-fact-sub">' + escapeHtml(invoice.paid_at ? 'Received ' + formatDateTime(invoice.paid_at) : 'Payment recorded') + '</span>' +
        '<span class="admin-fact-links"><button class="admin-context-action" type="button" data-open-invoice="' + escapeHtml(invoice.id) + '">' + ICON_INVOICE + '<span>Open payment</span></button></span>');
    }
    return factHtml('Invoice', '<strong>' + escapeHtml(invoice.invoice_number || 'Invoice') + ' · ' + escapeHtml(invoiceStatusLabel(invoice)) + '</strong>' +
      '<span class="admin-fact-sub">' + escapeHtml(formatMoney(invoice.amount_cents, invoice.currency)) + (invoice.due_date ? ' · due ' + escapeHtml(formatDueDate(invoice.due_date)) : '') + '</span>' +
      '<span class="admin-fact-links"><button class="admin-context-action" type="button" data-open-invoice="' + escapeHtml(invoice.id) + '">' + ICON_INVOICE + '<span>Open invoice</span></button></span>');
  }

  function bookingFooterHtml(booking, permissions) {
    var buttons = '';
    var more = [];
    if (booking.status === 'pending' && permissions.manage) {
      buttons = '<button class="admin-button admin-button-secondary" type="button" data-admin-step="reject">Reject…</button>' +
        '<button class="admin-button admin-button-primary" type="button" data-admin-step="confirm">Confirm…</button>';
    } else if (booking.status === 'confirmed' && permissions.manage) {
      more.push({ label: 'Cancel booking…', attrs: 'data-admin-step="cancel"', danger: true });
      if (bookingCanBeCompleted(booking)) {
        buttons = '<button class="admin-button admin-button-primary" type="button" data-complete-booking="' + escapeHtml(booking.id) + '">Mark completed</button>';
      }
    } else if (booking.status === 'completed' && permissions.bill) {
      var invoice = activeInvoiceForBooking(booking.id);
      buttons = invoice
        ? '<button class="admin-button admin-button-primary" type="button" data-open-invoice="' + escapeHtml(invoice.id) + '">Open ' + (invoice.invoice_status === 'payment' ? 'payment' : 'invoice') + '</button>'
        : '<button class="admin-button admin-button-primary" type="button" data-admin-step="invoice">Create invoice…</button>';
    }
    if (!buttons && !more.length) return '';
    // With nothing else in the footer a single risky action shows as quiet
    // red text; next to a primary it stays behind "More".
    var moreHtml = !buttons && more.length === 1
      ? '<button class="admin-button admin-button-ghost admin-button-quiet-danger" type="button" ' + more[0].attrs + '>' + escapeHtml(more[0].label) + '</button>'
      : moreMenuHtml(more);
    return '<div class="admin-modal-footer admin-panel-footer">' + moreHtml + buttons + '</div>';
  }

  function bookingOverviewHtml(booking) {
    var operations = bookingOperations(booking.id);
    var permissions = bookingPermissions();
    var assigned = staffById(booking.assigned_to_staff_id);
    var customer = customerForBooking(booking);
    var serviceName = serviceNameForBooking(booking);
    var scheduled = Boolean(booking.final_start_at && booking.final_end_at);
    var when = scheduled
      ? formatReviewRange(booking.final_start_at, booking.final_end_at)
      : formatReviewRange(booking.requested_start_at, booking.requested_end_at);
    var timeChanged = scheduled && booking.requested_start_at && booking.requested_end_at &&
      (new Date(booking.final_start_at).getTime() !== new Date(booking.requested_start_at).getTime() ||
        new Date(booking.final_end_at).getTime() !== new Date(booking.requested_end_at).getTime());
    var whenHtml = '<strong>' + escapeHtml(when) + '</strong>' +
      (!scheduled && booking.status === 'pending' ? '<span class="admin-fact-sub">Requested by the customer</span>' : '') +
      (timeChanged ? '<span class="admin-fact-sub">Originally requested ' + escapeHtml(formatReviewRange(booking.requested_start_at, booking.requested_end_at)) + '</span>' : '');

    var contactLinks =
      (booking.customer_phone ? '<a class="admin-context-action" href="tel:' + escapeHtml(booking.customer_phone) + '">' + ICON_PHONE + '<span>' + escapeHtml(booking.customer_phone) + '</span></a>' : '') +
      (booking.customer_email ? '<a class="admin-context-action" href="mailto:' + escapeHtml(booking.customer_email) + '">' + ICON_EMAIL + '<span>' + escapeHtml(booking.customer_email) + '</span></a>' : '');
    var customerHtml = '<strong>' + escapeHtml(booking.customer_name || 'Name not given') + '</strong>' +
      (contactLinks ? '<span class="admin-fact-links admin-fact-links-stacked">' + contactLinks + '</span>' : '') +
      (customer ? '<span class="admin-fact-links"><button class="admin-context-action" type="button" data-open-customer="' + escapeHtml(customer.id) + '">' + ICON_USER + '<span>Open customer</span></button></span>' : '');

    var mapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(booking.vehicle_location || '');
    var vehicleLinks =
      (booking.vehicle_location ? '<a class="admin-context-action" href="' + escapeHtml(mapsUrl) + '" target="_blank" rel="noopener noreferrer">' + ICON_MAP + '<span>Open map</span></a>' : '') +
      (booking.listing_url ? '<a class="admin-context-action" href="' + escapeHtml(booking.listing_url) + '" target="_blank" rel="noopener noreferrer">' + ICON_EXTERNAL + '<span>Open listing</span></a>' : '');
    var vehicleHtml = '<strong>' + escapeHtml(booking.vehicle || 'Not given') + '</strong>' +
      (booking.vehicle_location ? '<span class="admin-fact-sub">' + escapeHtml(booking.vehicle_location) + '</span>' : '') +
      (vehicleLinks ? '<span class="admin-fact-links">' + vehicleLinks + '</span>' : '');

    var emails = (operations?.notifications || []).filter(function (notification) { return notification.booking_id === booking.id; });
    var emailsHtml = operations?.detail_pending
      ? '<span class="admin-fact-sub">Loading…</span>'
      : (emails.length ? emailLinesHtml(emails) : '');

    return panelHeaderHtml({
        title: booking.customer_name || booking.public_reference,
        chips: '<span class="admin-status-pill" data-status="' + escapeHtml(statusTone(booking.status)) + '">' + escapeHtml(statusLabel(booking.status)) + '</span>' + expiryCountdownHtml(booking, 'compact'),
        meta: escapeHtml(booking.public_reference + ' · ' + serviceName),
        closeLabel: 'Close booking'
      }) +
      panelNoticeHtml('booking', booking.id) +
      '<dl class="admin-facts">' +
        factHtml('When', whenHtml) +
        (booking.status === 'pending' && !assigned ? '' : factHtml('Inspector', escapeHtml(assigned ? assigned.display_name : 'Not assigned'))) +
        factHtml('Customer', customerHtml) +
        factHtml('Vehicle', vehicleHtml) +
        (booking.customer_message ? factHtml('Customer note', '<span class="admin-fact-text">' + escapeHtml(booking.customer_message) + '</span>') : '') +
        bookingPriceFact(booking, operations, permissions.manage) +
        (permissions.bill && booking.status === 'completed' ? bookingInvoiceFact(booking) : '') +
        (emailsHtml ? factHtml('Emails', emailsHtml) : '') +
      '</dl>' +
      bookingFooterHtml(booking, permissions);
  }

  function stepFooterHtml(backLabel, submitLabel, submitClass) {
    return '<div class="admin-modal-footer admin-panel-footer">' +
      '<div class="admin-form-error" data-action-error role="status" aria-live="polite"></div>' +
      '<button class="admin-button admin-button-secondary" type="button" data-admin-step-back>' + escapeHtml(backLabel) + '</button>' +
      '<button class="admin-button ' + (submitClass || 'admin-button-primary') + '" type="submit" data-step-submit>' + escapeHtml(submitLabel) + '</button>' +
    '</div>';
  }

  function requiredLabel(text) {
    return '<span class="admin-field-label">' + escapeHtml(text) + ' <span class="admin-required-marker" aria-hidden="true">*</span></span>';
  }

  function optionalLabel(text) {
    return '<span class="admin-field-label">' + escapeHtml(text) + ' <span class="admin-optional">(optional)</span></span>';
  }

  // Price fields share the hooks bindPriceTotals updates (total, free reason).
  function priceStepFieldsHtml(agreement, revision) {
    var service = agreement ? (Number(agreement.service_amount_cents) / 100).toFixed(2) : '';
    var travel = agreement ? (Number(agreement.travel_amount_cents) / 100).toFixed(2) : '';
    return '<div class="admin-form-row">' +
        '<label>' + requiredLabel('Service (€)') + '<input name="serviceAmount" type="text" inputmode="decimal" required value="' + escapeHtml(service) + '" placeholder="0.00"></label>' +
        '<label>' + optionalLabel('Travel (€)') + '<input name="travelAmount" type="text" inputmode="decimal" value="' + escapeHtml(travel) + '" placeholder="0.00"></label>' +
      '</div>' +
      '<p class="admin-price-total" data-price-total data-compact="true" role="status"></p>' +
      '<label class="admin-checkbox"><input name="customerAgreed" type="checkbox" required><span>Customer agreed to this price</span></label>' +
      '<label data-price-note data-revision="' + (revision ? 'true' : 'false') + '"' + (revision ? '' : ' hidden') + '>' +
        requiredLabel(revision ? 'Reason for the change' : 'Why is it free?') +
        '<textarea name="priceReason" maxlength="1000"' + (revision ? ' required' : '') + '></textarea>' +
      '</label>';
  }

  function bookingConfirmStepHtml(booking) {
    var operations = bookingOperations(booking.id);
    var agreement = bookingQuotes(booking, operations)[0];
    var requested = formatReviewRange(booking.requested_start_at, booking.requested_end_at);
    return panelStepHeaderHtml('Confirm booking', { meta: escapeHtml((booking.customer_name || booking.public_reference) + ' · ' + booking.public_reference) }) +
      '<form class="admin-action-form admin-form-plain admin-step-form" data-admin-action-form data-action="confirmBooking" data-no-confirm data-requested-date="' + escapeHtml(dateInputValue(booking.requested_start_at)) + '" data-requested-start="' + escapeHtml(timeInputValue(booking.requested_start_at)) + '" data-requested-end="' + escapeHtml(timeInputValue(booking.requested_end_at)) + '">' +
        hiddenInput('bookingId', booking.id) +
        '<section class="admin-step-section">' +
          '<h3>Time</h3>' +
          '<div class="admin-form-row admin-form-row-time">' +
            '<label>' + requiredLabel('Date') + '<input name="date" type="date" required value="' + escapeHtml(dateInputValue(booking.requested_start_at)) + '"></label>' +
            '<label>' + requiredLabel('From') + '<input name="startTime" type="time" step="900" required value="' + escapeHtml(timeInputValue(booking.requested_start_at)) + '"></label>' +
            '<label>' + requiredLabel('Until') + '<input name="endTime" type="time" step="900" required value="' + escapeHtml(timeInputValue(booking.requested_end_at)) + '"></label>' +
          '</div>' +
          '<p class="admin-field-hint" data-time-changed-hint hidden>The customer asked for ' + escapeHtml(requested) + '.</p>' +
          '<div data-dst-slot hidden></div>' +
          '<label>' + requiredLabel('Inspector') + '<span class="admin-select-wrap"><select name="assignedStaffId" required>' + assignableStaffOptions(booking.assigned_to_staff_id || (state.staff && state.staff.id)) + '</select></span></label>' +
        '</section>' +
        '<section class="admin-step-section">' +
          '<h3>Price</h3>' +
          priceStepFieldsHtml(agreement, false) +
        '</section>' +
        '<section class="admin-step-section">' +
          '<label>' + optionalLabel('Internal note') + '<textarea name="internalNote" maxlength="1000"></textarea></label>' +
        '</section>' +
        stepFooterHtml('Back', 'Confirm and email customer') +
      '</form>';
  }

  function bookingReasonStepHtml(booking, kind) {
    var cancel = kind === 'cancel';
    return panelStepHeaderHtml(cancel ? 'Cancel booking' : 'Reject request', {
        meta: escapeHtml((booking.customer_name || booking.public_reference) + ' · ' + booking.public_reference),
        backLabel: cancel ? 'Keep booking' : 'Back'
      }) +
      '<form class="admin-action-form admin-form-plain admin-step-form" data-admin-action-form data-action="' + (cancel ? 'cancelBooking' : 'rejectBooking') + '" data-no-confirm>' +
        hiddenInput('bookingId', booking.id) +
        '<label>' + optionalLabel('Message to the customer') + '<textarea name="customerReason" maxlength="700" rows="4"></textarea></label>' +
        '<label>' + optionalLabel('Internal note') + '<textarea name="internalNote" maxlength="1000"></textarea></label>' +
        stepFooterHtml(cancel ? 'Keep booking' : 'Back', cancel ? 'Cancel booking and email customer' : 'Reject and email customer', 'admin-button-danger') +
      '</form>';
  }

  function bookingPriceStepHtml(booking) {
    var operations = bookingOperations(booking.id);
    var quotes = bookingQuotes(booking, operations);
    var agreement = quotes[0];
    var history = quotes.length > 1
      ? '<section class="admin-step-section admin-price-history"><h3>Earlier prices</h3><dl class="admin-facts">' +
          quotes.slice(1).map(function (quote) {
            return factHtml(formatDateTime(quote.agreed_at), '<strong>' + escapeHtml(formatMoney(quote.total_amount_cents, 'EUR')) + '</strong>' +
              (quote.revision_reason ? '<span class="admin-fact-sub">' + escapeHtml(quote.revision_reason) + '</span>' : ''));
          }).join('') +
        '</dl></section>'
      : '';
    return panelStepHeaderHtml(agreement ? 'Change price' : 'Set price', { meta: escapeHtml((booking.customer_name || booking.public_reference) + ' · ' + booking.public_reference) }) +
      '<form class="admin-action-form admin-form-plain admin-step-form" data-admin-action-form data-action="recordAgreedPrice" data-no-confirm>' +
        hiddenInput('bookingId', booking.id) +
        priceStepFieldsHtml(agreement, Boolean(agreement)) +
        stepFooterHtml('Back', 'Save price') +
      '</form>' +
      history;
  }

  function organizationFieldList(fields) {
    return (fields || []).map(function (field) {
      return ORGANIZATION_FIELD_LABELS[field] || String(field).replaceAll('_', ' ');
    }).join(', ');
  }

  function bookingInvoiceStepHtml(booking) {
    var operations = bookingOperations(booking.id);
    var agreement = bookingQuotes(booking, operations)[0];
    var readiness = state.invoiceSettingsReadiness;
    var header = panelStepHeaderHtml('Create invoice', { meta: escapeHtml((booking.customer_name || booking.public_reference) + ' · ' + booking.public_reference) });
    if (operations?.detail_pending) {
      return header + '<p class="admin-step-blocked" role="status">Loading the agreed price…</p>';
    }
    if (!agreement) {
      return header +
        '<div class="admin-step-blocked" role="alert"><p>Set the agreed price before creating the invoice.</p>' +
          (bookingPriceEditable(booking, operations, bookingPermissions().manage) ? '<button class="admin-button admin-button-primary" type="button" data-admin-step="price">Set price</button>' : '') +
        '</div>';
    }
    if (readiness && readiness.ready === false) {
      var missing = organizationFieldList(readiness.missing_fields);
      return header +
        '<div class="admin-step-blocked" role="alert"><p>Finish the invoice details in Organization first' + (missing ? ': ' + escapeHtml(missing) : '') + '.</p>' +
          (staffCanAccessPage(state.staff, 'organization')
            ? '<a class="admin-button admin-button-primary" href="' + escapeHtml(PATHS.organization) + '">Open Organization</a>'
            : '<p class="admin-field-hint">Ask an owner to finish them.</p>') +
        '</div>';
    }
    var amount = (Number(agreement.total_amount_cents) / 100).toFixed(2);
    return header +
      '<form class="admin-action-form admin-form-plain admin-step-form" data-admin-action-form data-action="createAndSendInvoice" data-no-confirm>' +
        hiddenInput('bookingId', booking.id) +
        hiddenInput('amount', amount) +
        '<dl class="admin-facts admin-step-facts">' +
          factHtml('Amount', '<strong>' + escapeHtml(formatMoney(agreement.total_amount_cents, 'EUR')) + '</strong>' +
            (bookingPriceEditable(booking, operations, bookingPermissions().manage) ? '<span class="admin-fact-links"><button class="admin-context-action" type="button" data-admin-step="price">Change price</button></span>' : '')) +
          factHtml('To', escapeHtml(booking.customer_name || 'Customer') + (booking.customer_email ? '<span class="admin-fact-sub">' + escapeHtml(booking.customer_email) + '</span>' : '')) +
        '</dl>' +
        '<section class="admin-step-section">' +
          '<h3>Bill to</h3>' +
          '<div class="admin-choice-group" role="radiogroup" aria-label="Bill to">' +
            '<label><input type="radio" name="billTo" value="private" checked><span>Private person</span></label>' +
            '<label><input type="radio" name="billTo" value="company"><span>Company</span></label>' +
          '</div>' +
          '<div data-bill-to="private">' +
            '<label>' + optionalLabel('Address') + '<textarea name="privateAddress" rows="2" maxlength="400"></textarea></label>' +
          '</div>' +
          '<div data-bill-to="company" hidden>' +
            '<label>' + requiredLabel('Company name') + '<input name="companyName" type="text" maxlength="200" autocomplete="organization"></label>' +
            '<div class="admin-form-row">' +
              '<label>' + requiredLabel('Company code') + '<input name="companyCode" type="text" maxlength="40"></label>' +
              '<label>' + optionalLabel('VAT code') + '<input name="companyVatCode" type="text" maxlength="40"></label>' +
            '</div>' +
            '<label>' + requiredLabel('Address') + '<textarea name="companyAddress" rows="2" maxlength="400"></textarea></label>' +
          '</div>' +
        '</section>' +
        '<section class="admin-step-section">' +
          '<h3>Invoice</h3>' +
          '<label>' + requiredLabel('Description') + '<input name="serviceDescription" type="text" maxlength="300" required value="' + escapeHtml(serviceNameForBooking(booking)) + '"></label>' +
          '<div class="admin-form-row">' +
            '<label>VAT<span class="admin-select-wrap"><select name="vatMode"><option value="none">No VAT</option><option value="included">VAT included</option></select></span></label>' +
            '<label data-vat-rate-field hidden>' + requiredLabel('VAT rate (%)') + '<input name="vatRate" type="text" inputmode="decimal" value="21"></label>' +
          '</div>' +
          '<label>' + requiredLabel('Due date') + '<input name="dueDate" type="date" required value="' + escapeHtml(defaultInvoiceDueDate()) + '" min="' + escapeHtml(todayYmd()) + '"></label>' +
        '</section>' +
        stepFooterHtml('Back', 'Create and email invoice') +
      '</form>';
  }

  function renderBookingModal(booking) {
    var step = currentModalStep('booking', booking.id);
    var html;
    if (step === 'confirm' && booking.status === 'pending') html = bookingConfirmStepHtml(booking);
    else if (step === 'reject' && booking.status === 'pending') html = bookingReasonStepHtml(booking, 'reject');
    else if (step === 'cancel' && booking.status === 'confirmed') html = bookingReasonStepHtml(booking, 'cancel');
    else if (step === 'price') html = bookingPriceStepHtml(booking);
    else if (step === 'invoice' && booking.status === 'completed') html = bookingInvoiceStepHtml(booking);
    else {
      if (step) state.modalStep = null;
      html = bookingOverviewHtml(booking);
    }

    var modal = openModal(html, 'panel');
    bindPriceTotals(modal);
    installTimeChoices(modal);
    updateExpiryCountdowns();

    $all('[data-admin-action-form]', modal).forEach(function (form) {
      form.addEventListener('submit', handleActionSubmit);
    });

    // Confirm step: say when the time differs from the request and name it
    // on the button.
    var confirmForm = $('form[data-action="confirmBooking"]', modal);
    if (confirmForm) {
      var hint = $('[data-time-changed-hint]', confirmForm);
      var submit = $('[data-step-submit]', confirmForm);
      var syncTime = function () {
        var changed = confirmForm.elements.date.value !== confirmForm.dataset.requestedDate ||
          confirmForm.elements.startTime.value !== confirmForm.dataset.requestedStart ||
          confirmForm.elements.endTime.value !== confirmForm.dataset.requestedEnd;
        if (hint) hint.hidden = !changed;
        if (submit) submit.textContent = changed ? 'Confirm new time and email customer' : 'Confirm and email customer';
      };
      confirmForm.addEventListener('input', syncTime);
      syncTime();
    }

    var invoiceForm = $('form[data-action="createAndSendInvoice"]', modal);
    if (invoiceForm) {
      var syncBillTo = function () {
        var kind = invoiceForm.elements.billTo.value;
        $all('[data-bill-to]', invoiceForm).forEach(function (group) {
          var active = group.dataset.billTo === kind;
          group.hidden = !active;
          $all('input, textarea', group).forEach(function (field) { field.disabled = !active; });
        });
        ['companyName', 'companyCode', 'companyAddress'].forEach(function (name) {
          if (invoiceForm.elements[name]) invoiceForm.elements[name].required = kind === 'company';
        });
      };
      $all('input[name="billTo"]', invoiceForm).forEach(function (input) { input.addEventListener('change', syncBillTo); });
      syncBillTo();
      var vatMode = invoiceForm.elements.vatMode;
      var vatRateField = $('[data-vat-rate-field]', invoiceForm);
      var syncVat = function () {
        var included = vatMode.value === 'included';
        vatRateField.hidden = !included;
        invoiceForm.elements.vatRate.disabled = !included;
        invoiceForm.elements.vatRate.required = included;
      };
      vatMode.addEventListener('change', syncVat);
      syncVat();
    }

    var completeButton = $('[data-complete-booking]', modal);
    if (completeButton) {
      completeButton.addEventListener('click', function () {
        runAction({ action: 'completeBooking', bookingId: booking.id }, 'completeBooking', completeButton, {
          confirm: {
            title: 'Mark ' + booking.public_reference + ' completed?',
            message: 'The inspection for ' + (booking.customer_name || 'this customer') + ' is done and ready to invoice.',
            cancelLabel: 'Not yet',
            confirmLabel: 'Mark completed'
          }
        });
      });
    }

    $all('[data-open-customer]', modal).forEach(function (button) {
      button.addEventListener('click', function () { navigateToModal('customer', button.dataset.openCustomer); });
    });
    $all('[data-open-invoice]', modal).forEach(function (button) {
      button.addEventListener('click', function () { navigateToModal('invoice', button.dataset.openInvoice); });
    });
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
        '<label><span class="admin-field-label">Hold until date <span class="admin-required-marker" aria-hidden="true">*</span></span><input name="holdUntilDate" type="text" inputmode="numeric" required value="' + escapeHtml(holdDefaultDate) + '" placeholder="2026-12-31"></label>' +
        '<label><span class="admin-field-label">Hold until time <span class="admin-required-marker" aria-hidden="true">*</span></span><input name="holdUntilTime" type="time" step="60" required value="23:59"></label>' +
      '</div>' +
      '<label><span class="admin-field-label">Reason <span class="admin-required-marker" aria-hidden="true">*</span></span><textarea name="legalHoldReason" maxlength="500" required placeholder="Legal or dispute reason"></textarea></label>' +
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
    if (search) search.disabled = false;
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
      var customerContact = [customer.email, customer.phone].filter(Boolean).join(' · ') || 'No contact details';
      var customerMeta = [customerBookingMoment(bookings), bookings.length + ' booking' + (bookings.length === 1 ? '' : 's'), invoices.length + ' invoice' + (invoices.length === 1 ? '' : 's')].filter(Boolean).join(' · ');
      var customerLabel = [customerName, customerEmail, customer.phone || 'No phone', customerMeta].join(', ');
      return '<button class="admin-customer-item admin-data-row' + (customer.id === state.selectedCustomerId ? ' is-selected' : '') + '" type="button" aria-label="' + escapeHtml(customerLabel) + '" data-customer-id="' + escapeHtml(customer.id) + '">' +
        '<span class="admin-row-primary admin-booking-item-header"><span class="admin-booking-title">' + escapeHtml(customerName) + '</span></span>' +
        '<span class="admin-row-service admin-booking-meta">' + escapeHtml(customerContact) + '</span>' +
        '<span class="admin-row-meta admin-booking-meta">' + escapeHtml(customerMeta) + '</span>' +
      '</button>';
    }).join('');

    $all('[data-customer-id]', list).forEach(function (button) {
      button.addEventListener('click', function () {
        navigateToModal('customer', button.dataset.customerId);
      });
    });
  }

  // "Next Sat 7 Nov" for an upcoming booking, otherwise "Last 4 Nov".
  function customerBookingMoment(bookings) {
    var now = Date.now();
    var timed = bookings.map(function (booking) {
      var start = booking.final_start_at || booking.requested_start_at;
      return { booking: booking, time: start ? new Date(start).getTime() : NaN, start: start };
    }).filter(function (item) { return Number.isFinite(item.time); });
    var next = timed.filter(function (item) { return item.time >= now && isActiveBookingStatus(item.booking.status); })
      .sort(function (a, b) { return a.time - b.time; })[0];
    if (next) return 'Next ' + displayDay(next.start, { weekday: true });
    var last = timed.filter(function (item) { return item.time < now; })
      .sort(function (a, b) { return b.time - a.time; })[0];
    return last ? 'Last ' + displayDay(last.start) : '';
  }

  function marketingLabel(status) {
    return {
      opted_in: 'Opted in',
      withdrawn: 'Consent withdrawn',
      suppressed: 'Marketing blocked',
      not_asked: 'No marketing consent'
    }[status] || 'No marketing consent';
  }

  function customerActivityCacheEntry(customerId) {
    if (!state.customerActivityCache || typeof state.customerActivityCache !== 'object') {
      state.customerActivityCache = Object.create(null);
    }
    return state.customerActivityCache[customerId] || {
      status: 'idle',
      events: [],
      has_more: false,
      next_cursor: null,
      error: ''
    };
  }

  function normalizeCustomerActivityApiEvent(event, customerId, index) {
    if (!event || typeof event !== 'object') return null;
    var occurredAt = String(event.occurred_at || '');
    if (!occurredAt || !Number.isFinite(new Date(occurredAt).getTime())) return null;
    var entityType = String(event.entity_type || '').trim().toLowerCase();
    var entityId = String(event.entity_id || '').trim();
    var eventType = String(event.event_type || 'customer_record_updated').trim().toLowerCase();
    var actor = event.actor_staff_id ? staffById(event.actor_staff_id) : null;
    if (!eventType) eventType = 'customer_record_updated';
    return {
      id: 'activity-api:' + String(event.id || customerId + ':' + occurredAt + ':' + eventType + ':' + index),
      event_type: eventType,
      title: String(event.title || recordedCustomerEventTitle(eventType)),
      message: String(event.message || ''),
      created_at: occurredAt,
      entity_type: entityType,
      entity_id: entityId,
      booking_id: entityType === 'booking' ? entityId : '',
      invoice_id: entityType === 'invoice' ? entityId : '',
      actor_staff_id: String(event.actor_staff_id || ''),
      actor_name: String(event.actor_name || (actor && actor.display_name) || '')
    };
  }

  function canonicalCustomerActivityType(eventType) {
    var type = String(eventType || '').trim().toLowerCase();
    return {
      booking_requested: 'booking_created',
      booking_approved: 'booking_confirmed',
      booking_cancelled_by_admin: 'booking_cancelled',
      booking_cancelled_by_customer: 'booking_cancelled',
      invoice_draft_created: 'invoice_created',
      marketing_consent_granted: 'marketing_consent_recorded',
      marketing_consent_opted_in: 'marketing_consent_recorded',
      marketing_consent_withdrawn_admin: 'marketing_consent_withdrawn',
      marketing_consent_withdrawn_public: 'marketing_consent_withdrawn'
    }[type] || type;
  }

  function customerActivityDedupeKey(event) {
    var type = canonicalCustomerActivityType(event.event_type);
    var entityType = String(event.entity_type || (event.booking_id ? 'booking' : (event.invoice_id ? 'invoice' : 'customer')));
    var entityId = String(event.entity_id || event.booking_id || event.invoice_id || '');
    var singularTypes = {
      customer_created: true,
      privacy_erasure_requested: true,
      privacy_customer_redacted: true,
      booking_created: true,
      booking_confirmed: true,
      booking_rejected: true,
      booking_cancelled: true,
      booking_completed: true,
      booking_expired: true,
      invoice_created: true,
      invoice_issued: true,
      invoice_paid: true,
      invoice_voided: true
    };
    var key = entityType + ':' + entityId + ':' + type;
    if (singularTypes[type]) return key;
    return key + ':' + new Date(event.created_at).getTime();
  }

  function mergeCustomerActivityEvents(apiEvents, fallbackEvents) {
    var merged = [];
    var seenIds = Object.create(null);
    var seenKeys = Object.create(null);
    (apiEvents || []).concat(fallbackEvents || []).forEach(function (event) {
      if (!event || !event.created_at || !Number.isFinite(new Date(event.created_at).getTime())) return;
      var id = String(event.id || '');
      var key = customerActivityDedupeKey(event);
      var existingIndex = id && Object.prototype.hasOwnProperty.call(seenIds, id)
        ? seenIds[id]
        : (Object.prototype.hasOwnProperty.call(seenKeys, key) ? seenKeys[key] : -1);
      if (existingIndex >= 0) {
        var existing = merged[existingIndex];
        if (!existing.message && event.message) existing.message = event.message;
        if (!existing.actor_name && event.actor_name) existing.actor_name = event.actor_name;
        if (!existing.booking_id && event.booking_id) existing.booking_id = event.booking_id;
        if (!existing.invoice_id && event.invoice_id) existing.invoice_id = event.invoice_id;
        return;
      }
      var nextIndex = merged.length;
      if (id) seenIds[id] = nextIndex;
      seenKeys[key] = nextIndex;
      merged.push(Object.assign({}, event));
    });
    return merged.sort(function (a, b) {
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }

  function renderCustomerActivityPanelContent(customer, bookings, invoices, recordedEvents) {
    var cache = customerActivityCacheEntry(customer.id);
    var fallbackEvents = buildCustomerActivity(customer, bookings, invoices, recordedEvents);
    var events = Array.isArray(cache.events) ? cache.events : [];
    if (cache.status === 'error' && !events.length) {
      events = fallbackEvents;
    }
    var status = '';

    if (cache.status === 'loading' && !events.length) {
      return renderCustomerActivitySkeleton(7, 'Loading customer activity');
    } else if (cache.status === 'error') {
      status = '<div class="admin-customer-activity-state" data-state="error" role="status" aria-live="polite">' +
        '<span><strong>Activity could not be loaded.</strong><span>' +
          escapeHtml(cache.error || 'Try loading this part of the timeline again.') +
        '</span></span>' +
        '<button class="admin-button admin-button-secondary" type="button" data-customer-activity-retry>Retry</button>' +
      '</div>';
    }

    return status +
      renderCustomerEvents(events) +
      (cache.status === 'loading_more'
        ? renderCustomerActivitySkeleton(3, 'Loading older customer activity')
        : '') +
      (cache.status === 'loaded' && cache.has_more
        ? '<div class="admin-customer-activity-more" data-customer-activity-more role="status">Scroll for older activity</div>'
        : '');
  }

  function renderCustomerActivitySkeleton(count, label) {
    var rows = [];
    for (var index = 0; index < count; index += 1) {
      rows.push('<li style="--admin-skeleton-delay:' + (index * 65) + 'ms"><span></span><div><i></i><i></i></div></li>');
    }
    return '<div class="admin-customer-activity-skeleton" role="status" aria-label="' + escapeHtml(label || 'Loading activity') + '"><ol aria-hidden="true">' + rows.join('') + '</ol></div>';
  }

  function customerActivitySummaryMeta(cache, eventCount) {
    if (cache.status === 'loading') return '';
    if (cache.status === 'loading_more') return eventCount + ' loaded';
    if (cache.status === 'error') return 'Unavailable';
    if (cache.status === 'loaded') {
      return eventCount + ' event' + (eventCount === 1 ? '' : 's');
    }
    return '';
  }

  function rerenderCustomerActivityPanel(customerId) {
    var route = modalRouteFromUrl();
    if (!route || route.type !== 'customer' || route.id !== customerId) return;
    var panel = $('[data-customer-activity-panel]');
    if (!panel || panel.dataset.customerId !== customerId) return;
    var customer = customerById(customerId);
    if (!customer) return;
    var cache = customerActivityCacheEntry(customerId);
    var bookings = allBookingsForCustomer(customerId);
    var invoices = invoicesForCustomer(customerId);
    var recordedEvents = eventsForCustomer(customerId);
    var events = Array.isArray(cache.events) ? cache.events : [];
    var previousScrollTop = panel.scrollTop;
    panel.setAttribute('aria-busy', ['loading', 'loading_more'].includes(cache.status) ? 'true' : 'false');
    panel.innerHTML = renderCustomerActivityPanelContent(
      customer,
      bookings,
      invoices,
      recordedEvents
    );
    panel.scrollTop = previousScrollTop;
    var summaryMeta = $('[data-customer-activity-summary]', panel.closest('[data-customer-activity-disclosure]'));
    if (summaryMeta) {
      summaryMeta.innerHTML = cache.status === 'loading'
        ? skeletons.block('admin-skeleton-line admin-skeleton-count')
        : escapeHtml(customerActivitySummaryMeta(cache, events.length));
    }
  }

  async function loadCustomerActivity(customerId, options) {
    var opts = options || {};
    if (!customerById(customerId)) return false;
    var cached = customerActivityCacheEntry(customerId);
    var append = opts.append === true;
    if (append && (!cached.has_more || ['loading', 'loading_more'].includes(cached.status))) return true;
    if (cached.status === 'loaded' && !opts.force && !append) return true;
    if (customerActivityLoads[customerId] && !opts.force) {
      return customerActivityLoads[customerId].promise;
    }
    if (customerActivityLoads[customerId]) {
      customerActivityLoads[customerId].controller.abort();
      delete customerActivityLoads[customerId];
    }

    var controller = new AbortController();
    var requestId = customerActivityLoadSequence + 1;
    customerActivityLoadSequence = requestId;
    var previousEvents = append && Array.isArray(cached.events) ? cached.events : [];
    var cursor = append && cached.next_cursor && typeof cached.next_cursor === 'object'
      ? cached.next_cursor
      : null;
    state.customerActivityCache[customerId] = {
      status: append ? 'loading_more' : 'loading',
      events: previousEvents,
      has_more: Boolean(cached.has_more),
      next_cursor: cursor,
      error: ''
    };
    rerenderCustomerActivityPanel(customerId);

    var load = {
      controller: controller,
      requestId: requestId,
      promise: null
    };
    customerActivityLoads[customerId] = load;

    load.promise = (async function () {
      try {
        if (!(await ensureActiveSession())) {
          throw new Error('This account is not approved for admin access or the session has expired.');
        }
        if (controller.signal.aborted || customerActivityLoads[customerId] !== load) return false;
        var activityUrl = ADMIN_ENDPOINT + '?view=customer_activity&customerId=' + encodeURIComponent(customerId) + '&limit=30';
        if (cursor && cursor.occurred_at && cursor.id) {
          activityUrl += '&beforeAt=' + encodeURIComponent(cursor.occurred_at) + '&beforeId=' + encodeURIComponent(cursor.id);
        }
        var response = await fetch(
          activityUrl,
          {
            method: 'GET',
            headers: authHeaders(),
            cache: 'no-store',
            signal: controller.signal
          }
        );
        var data = await response.json().catch(function () { return {}; });
        if (!response.ok) {
          if (isTemporaryPasswordCode(data.code)) {
            redirectTo(PATHS.login);
            throw new Error(data.error || 'Change your temporary password before opening customer activity.');
          }
          if (response.status === 401 || isSecuritySessionCode(data.code)) {
            await revokeAndClearSession();
            redirectTo(PATHS.login);
            throw new Error('Sign in again to verify your account.');
          }
          if (data.code === 'insufficient_role') {
            redirectTo(PATHS.dashboard);
            throw new Error(data.error || 'Your admin role cannot access customer activity.');
          }
          throw new Error(data.error || 'The complete customer activity timeline could not be loaded.');
        }

        var activity = data.customerActivity;
        if (!activity || typeof activity !== 'object' || String(activity.customer_id || '') !== customerId || !Array.isArray(activity.events)) {
          throw new Error('The customer activity response was incomplete.');
        }
        if (controller.signal.aborted || customerActivityLoads[customerId] !== load) return false;
        var normalizedEvents = activity.events.map(function (event, index) {
          return normalizeCustomerActivityApiEvent(event, customerId, index);
        }).filter(Boolean);
        var combinedEvents = append
          ? mergeCustomerActivityEvents(previousEvents, normalizedEvents)
          : normalizedEvents;
        state.customerActivityCache[customerId] = {
          status: 'loaded',
          events: combinedEvents,
          has_more: Boolean(activity.has_more),
          next_cursor: activity.next_cursor && typeof activity.next_cursor === 'object'
            ? activity.next_cursor
            : null,
          error: ''
        };
        rerenderCustomerActivityPanel(customerId);
        return true;
      } catch (error) {
        if (isAbortError(error) || controller.signal.aborted) return false;
        if (customerActivityLoads[customerId] === load) {
          state.customerActivityCache[customerId] = {
            status: 'error',
            events: previousEvents,
            has_more: append ? Boolean(cached.has_more) : false,
            next_cursor: cursor,
            error: error instanceof Error ? error.message : 'The complete customer activity timeline could not be loaded.'
          };
          rerenderCustomerActivityPanel(customerId);
        }
        return false;
      } finally {
        if (customerActivityLoads[customerId] === load) delete customerActivityLoads[customerId];
      }
    })();

    return load.promise;
  }

  function invalidateCustomerActivity(customerId) {
    if (!customerId) return;
    if (customerActivityLoads[customerId]) {
      customerActivityLoads[customerId].controller.abort();
      delete customerActivityLoads[customerId];
    }
    if (state.customerActivityCache) delete state.customerActivityCache[customerId];
  }

  function invalidateCustomerActivityForPayload(payload) {
    var customerIds = [];
    function add(customerId) {
      if (customerId && !customerIds.includes(customerId)) customerIds.push(customerId);
    }
    add(payload && payload.customerId);
    var booking = payload && payload.bookingId ? bookingById(payload.bookingId) : null;
    if (booking) add(booking.customer_id);
    var invoice = payload && payload.invoiceId ? invoiceById(payload.invoiceId) : null;
    if (invoice) {
      add(invoice.customer_id);
      var invoiceBooking = invoice.booking_id ? bookingById(invoice.booking_id) : null;
      if (invoiceBooking) add(invoiceBooking.customer_id);
    }
    customerIds.forEach(invalidateCustomerActivity);
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
    var activityCache = customerActivityCacheEntry(customer.id);
    var initialActivityEvents = Array.isArray(activityCache.events) ? activityCache.events : [];
    var holdActive = hasActiveLegalHold(customer);
    var redactionBlockReasons = customerRedactionBlockReasons(customer, bookings);
    var redactionDisabled = redactionBlockReasons.length > 0;
    var redactionBlockText = redactionDisabled ? 'Unavailable: ' + redactionBlockReasons.join('; ') + '.' : '';
    var deleteBlockReasons = customerDeleteBlockReasons(customer, linkedBookings);
    var deleteDisabled = deleteBlockReasons.length > 0;
    var deleteBlockText = deleteDisabled ? 'Unavailable: ' + deleteBlockReasons.join('; ') + '.' : '';
    var holdStatus = holdActive
      ? 'Active until ' + formatDateTime(customer.legal_hold_until)
      : 'No active legal hold';
    var profileStatus = customer.pii_redacted_at
      ? 'Redacted ' + formatDateTime(customer.pii_redacted_at)
      : 'Personal data present';

    var html =
      '<div class="admin-modal-header admin-customer-modal-header" data-customer-modal="' + escapeHtml(customer.id) + '">' +
        '<div class="admin-customer-header-primary">' +
          '<h2>' + escapeHtml(customer.display_name || 'Unnamed customer') + '</h2>' +
          '<div class="admin-customer-header-contact" aria-label="Contact customer">' +
            (customer.phone ? '<a class="admin-customer-contact-link" href="tel:' + escapeHtml(customer.phone) + '" aria-label="Call ' + escapeHtml(customer.phone) + '">' + ICON_PHONE + '<span>' + escapeHtml(customer.phone) + '</span></a>' : '') +
            (customer.email ? '<a class="admin-customer-contact-link" href="mailto:' + escapeHtml(customer.email) + '" aria-label="Email ' + escapeHtml(customer.email) + '">' + ICON_EMAIL + '<span>' + escapeHtml(customer.email) + '</span></a>' : '') +
          '</div>' +
        '</div>' +
        '<div class="admin-customer-header-utility">' +
          '<div class="admin-customer-profile-menu">' +
            '<button class="admin-icon-button admin-customer-header-icon admin-customer-profile-toggle" type="button" aria-label="Profile details" aria-describedby="admin-customer-profile-tooltip">' + ICON_INFO + '</button>' +
            '<div class="admin-customer-profile-popover" id="admin-customer-profile-tooltip" role="tooltip">' +
              '<strong>Profile details</strong>' +
              '<div class="admin-detail-list">' +
                detailRow('Language', customer.preferred_language) +
                detailRow('Customer since', customer.created_at ? formatDateTime(customer.created_at) : '') +
                detailRow('Last booking', customer.last_booking_at ? formatDateTime(customer.last_booking_at) : '') +
                detailRow('Last invoice', customer.last_invoice_at ? formatDateTime(customer.last_invoice_at) : '') +
              '</div>' +
            '</div>' +
          '</div>' +
          '<button class="admin-preview-close admin-icon-button" type="button" data-admin-modal-close aria-label="Close customer" title="Close">' + ICON_CLOSE + '</button>' +
        '</div>' +
      '</div>' +
      '<section class="admin-detail-section admin-customer-bookings-section" aria-labelledby="admin-customer-bookings-title">' +
        '<h3 id="admin-customer-bookings-title">Bookings (' + escapeHtml(String(bookings.length)) + ')</h3>' +
        renderCustomerBookings(bookings) +
      '</section>' +
      '<details class="admin-detail-section admin-disclosure admin-customer-invoices-section" data-disclosure-key="customer-invoices">' +
        '<summary>Invoices <span>' + escapeHtml(String(invoices.length)) + '</span></summary>' +
        renderCustomerInvoices(invoices) +
      '</details>' +
      '<details class="admin-detail-section admin-disclosure admin-customer-activity-section" data-customer-activity-disclosure data-disclosure-key="customer-activity">' +
        '<summary id="admin-customer-activity-title"><span>Customer activity</span><span class="admin-customer-disclosure-meta" data-customer-activity-summary>' +
          (activityCache.status === 'loading'
            ? skeletons.block('admin-skeleton-line admin-skeleton-count')
            : escapeHtml(customerActivitySummaryMeta(activityCache, initialActivityEvents.length))) +
        '</span></summary>' +
        '<div role="region" aria-labelledby="admin-customer-activity-title" tabindex="0" data-customer-activity-panel data-customer-id="' + escapeHtml(customer.id) + '" aria-busy="' + (['loading', 'loading_more'].includes(activityCache.status) ? 'true' : 'false') + '">' +
          (activityCache.status === 'idle' ? '' : renderCustomerActivityPanelContent(customer, linkedBookings, invoices, eventsForCustomer(customer.id))) +
        '</div>' +
      '</details>' +
      '<details class="admin-detail-section admin-disclosure admin-privacy-controls" data-disclosure-key="privacy-controls">' +
        '<summary>Privacy and records</summary>' +
        '<div class="admin-privacy-overview">' +
          '<div class="admin-privacy-status-grid">' +
              '<div class="admin-privacy-status-card"><span>Legal hold</span><strong>' + escapeHtml(holdStatus) + '</strong></div>' +
              '<div class="admin-privacy-status-card"><span>Profile data</span><strong>' + escapeHtml(profileStatus) + '</strong></div>' +
              '<div class="admin-privacy-status-card admin-privacy-marketing-card"><span>Marketing permission</span><strong>' + escapeHtml(marketingLabel(customer.marketing_consent_status)) + '</strong>' +
                (customer.marketing_consent_status === 'opted_in'
                  ? renderInlineActionForm('withdrawCustomerMarketingConsent', 'Withdraw permission', 'admin-button-secondary', { customerId: customer.id })
                  : '') +
              '</div>' +
          '</div>' +
          '<details class="admin-privacy-record-details admin-disclosure" data-disclosure-key="consent-dates">' +
            '<summary>View consent and retention dates</summary>' +
            '<div class="admin-detail-list">' +
              detailRow('Terms accepted', customer.terms_accepted_at ? formatDateTime(customer.terms_accepted_at) : 'Not recorded') +
              detailRow('Terms version', customer.terms_text_version) +
              detailRow('Privacy accepted', customer.privacy_accepted_at ? formatDateTime(customer.privacy_accepted_at) : 'Not recorded') +
              detailRow('Privacy version', customer.privacy_text_version) +
              detailRow('Marketing consent recorded', customer.marketing_consent_at ? formatDateTime(customer.marketing_consent_at) : 'Not recorded') +
              detailRow('Marketing consent source', customer.marketing_consent_source) +
              detailRow('Marketing consent version', customer.marketing_consent_text_version) +
              detailRow('Re-permission due', customer.marketing_repermission_due_at ? formatDateTime(customer.marketing_repermission_due_at) : '') +
              detailRow('Legal hold review', customer.legal_hold_review_at ? formatDateTime(customer.legal_hold_review_at) : 'Not scheduled') +
            '</div>' +
          '</details>' +
          '<details class="admin-disclosure admin-privacy-actions-disclosure">' +
            '<summary>Data controls</summary>' +
            '<div class="admin-privacy-action-list">' +
              '<div class="admin-privacy-action-card">' +
                '<div class="admin-privacy-action-heading"><h4>' + (holdActive ? 'Release legal hold' : 'Start a legal hold') + '</h4><p>' +
                  (holdActive
                    ? 'Allows eligible redaction and deletion checks to proceed again. Releasing the hold does not delete data.'
                    : 'Temporarily blocks redaction and deletion for a legal, dispute, or retention reason.') +
                '</p></div>' +
                (holdActive ? renderReleaseHoldForm(customer) : renderSetHoldForm(customer, addDaysYmd(todayYmd(), 180))) +
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
          '</details>' +
        '</div>' +
      '</details>';

    var modal = openModal(html, 'panel');
    $('.admin-modal-panel', modal).classList.add('admin-customer-modal');
    renderCustomerList();

    $all('[data-admin-action-form]', modal).forEach(function (form) {
      form.addEventListener('submit', handleActionSubmit);
    });
    $all('[data-open-booking]', modal).forEach(function (button) {
      if (button.closest('[data-customer-activity-panel]')) return;
      button.addEventListener('click', function () {
        navigateToModal('booking', button.dataset.openBooking);
      });
    });
    $all('[data-open-invoice]', modal).forEach(function (button) {
      if (button.closest('[data-customer-activity-panel]')) return;
      button.addEventListener('click', function () {
        navigateToModal('invoice', button.dataset.openInvoice);
      });
    });
    var activityDisclosure = $('[data-customer-activity-disclosure]', modal);
    if (activityDisclosure) {
      activityDisclosure.addEventListener('toggle', function () {
        if (!activityDisclosure.open) return;
        var cache = customerActivityCacheEntry(customer.id);
        if (cache.status === 'idle') {
          loadCustomerActivity(customer.id).catch(function () {});
        }
      });
    }
    if (activityDisclosure) activityDisclosure.addEventListener('click', function (event) {
      if (!event.target || typeof event.target.closest !== 'function') return;
      var retry = event.target.closest('[data-customer-activity-retry]');
      var activityPanel = event.target.closest('[data-customer-activity-panel]');
      if (retry && activityDisclosure.open && activityPanel && activityPanel.dataset.customerId === customer.id) {
        var retryCache = customerActivityCacheEntry(customer.id);
        loadCustomerActivity(customer.id, retryCache.events.length ? { append: true } : { force: true }).catch(function () {});
        return;
      }
      if (!activityPanel || activityPanel.dataset.customerId !== customer.id) return;
      var bookingButton = event.target.closest('[data-open-booking]');
      if (bookingButton && bookingById(bookingButton.dataset.openBooking)) {
        navigateToModal('booking', bookingButton.dataset.openBooking);
        return;
      }
      var invoiceButton = event.target.closest('[data-open-invoice]');
      if (invoiceButton && invoiceById(invoiceButton.dataset.openInvoice)) {
        navigateToModal('invoice', invoiceButton.dataset.openInvoice);
      }
    });
    var activityPanel = $('[data-customer-activity-panel]', modal);
    if (activityPanel) {
      activityPanel.addEventListener('scroll', function () {
        if (!activityDisclosure || !activityDisclosure.open) return;
        if (activityPanel.scrollHeight - activityPanel.scrollTop - activityPanel.clientHeight > 160) return;
        var cache = customerActivityCacheEntry(customer.id);
        if (cache.status === 'loaded' && cache.has_more) {
          loadCustomerActivity(customer.id, { append: true }).catch(function () {});
        }
      }, { passive: true });
    }
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
      var payment = paymentLabel(booking.payment_balance?.state || booking.payment_status);
      var invoiceStatus = invoiceStatusLabel(invoice);
      var bookingLabel = [service, time, status, vehicle, booking.public_reference, payment, invoiceStatus].join(', ');
      return '<button class="admin-mini-item admin-customer-booking" type="button" aria-label="' + escapeHtml('Open booking: ' + bookingLabel) + '" data-open-booking="' + escapeHtml(booking.id) + '">' +
        '<span class="admin-customer-booking-main">' +
          '<strong>' + escapeHtml(service) + '</strong>' +
          '<span class="admin-customer-booking-time">' + escapeHtml(time) + '</span>' +
        '</span>' +
        '<span class="admin-status-pill" data-status="' + escapeHtml(statusTone(booking.status)) + '">' + escapeHtml(status) + '</span>' +
        '<span class="admin-customer-booking-meta">' + escapeHtml(vehicle) + ' · ' + escapeHtml(booking.public_reference) + '</span>' +
      '</button>';
    }).join('') + '</div>';
  }

  function renderCustomerInvoices(invoices) {
    if (!invoices.length) return '<p>No invoices linked to this customer.</p>';
    return '<div class="admin-mini-list">' + invoices.map(function (invoice) {
      var invoiceLabel = invoiceStatusLabel(invoice);
      var amount = formatMoney(invoice.amount_cents, invoice.currency);
      var issued = invoice.issued_at ? 'Issued ' + formatDateTime(invoice.issued_at) : 'Not issued';
      var emailState = emailStatusLabel(invoice.email_status);
      var openInvoiceLabel = [invoice.invoice_number, amount, invoiceLabel, issued, emailState].join(', ');
      return '<button class="admin-mini-item admin-customer-invoice" type="button" aria-label="' + escapeHtml('Open invoice: ' + openInvoiceLabel) + '" data-open-invoice="' + escapeHtml(invoice.id) + '">' +
        '<span class="admin-customer-invoice-main"><strong>' + escapeHtml(invoice.invoice_number) + '</strong><span>' + escapeHtml(amount) + '</span></span>' +
        '<span class="admin-status-pill" data-status="' + escapeHtml(invoiceTone(invoice)) + '">' + escapeHtml(invoiceLabel) + '</span>' +
        '<span class="admin-customer-invoice-meta">' + escapeHtml(issued) + '</span>' +
      '</button>';
    }).join('') + '</div>';
  }

  function addCustomerActivityEvent(events, event) {
    if (!event || !event.created_at) return;
    var timestamp = new Date(event.created_at).getTime();
    if (!Number.isFinite(timestamp)) return;
    if (!event.entity_type && event.booking_id) event.entity_type = 'booking';
    if (!event.entity_type && event.invoice_id) event.entity_type = 'invoice';
    if (!event.entity_id) event.entity_id = event.booking_id || event.invoice_id || '';
    events.push(event);
  }

  function customerActivityReference(booking) {
    return booking.public_reference || 'Booking';
  }

  function customerActivityBookingMessage(booking, timeLabel, start, end) {
    var parts = [customerActivityReference(booking), serviceNameForBooking(booking)];
    if (start) parts.push(timeLabel + ' ' + formatRange(start, end));
    return parts.filter(Boolean).join(' · ');
  }

  function recordedCustomerEventTitle(eventType) {
    return {
      privacy_legal_hold_set: 'Legal hold started',
      privacy_legal_hold_released: 'Legal hold released',
      privacy_erasure_requested: 'Erasure request recorded',
      privacy_customer_redacted: 'Customer data redacted',
      marketing_consent_withdrawn_public: 'Marketing consent withdrawn'
    }[eventType] || String(eventType || 'Customer record updated')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, function (letter) { return letter.toUpperCase(); });
  }

  function customerActivityTone(eventType) {
    if (String(eventType || '').indexOf('invoice_') === 0) return 'invoice';
    if (String(eventType || '').indexOf('booking_') === 0) return 'booking';
    if (String(eventType || '').indexOf('privacy_') === 0 || String(eventType || '').indexOf('marketing_') === 0) return 'privacy';
    return 'customer';
  }

  function buildCustomerActivity(customer, bookings, invoices, recordedEvents) {
    var events = [];
    var recordedTypes = (recordedEvents || []).reduce(function (types, event) {
      types[event.event_type] = true;
      return types;
    }, {});

    addCustomerActivityEvent(events, {
      id: 'customer:' + customer.id + ':created',
      event_type: 'customer_created',
      title: 'Customer created',
      message: 'Customer profile created.',
      created_at: customer.created_at,
      entity_type: 'customer',
      entity_id: customer.id
    });

    (bookings || []).forEach(function (booking) {
      addCustomerActivityEvent(events, {
        id: 'booking:' + booking.id + ':created',
        event_type: 'booking_created',
        title: 'Booking created',
        message: customerActivityBookingMessage(booking, 'Requested', booking.requested_start_at, booking.requested_end_at),
        created_at: booking.created_at,
        booking_id: booking.id
      });

      if (booking.confirmed_at) {
        var approvedMessage = customerActivityBookingMessage(
          booking,
          'Scheduled',
          booking.final_start_at || booking.requested_start_at,
          booking.final_end_at || booking.requested_end_at
        );
        var assigned = staffById(booking.assigned_to_staff_id);
        if (assigned) approvedMessage += ' · Assigned to ' + assigned.display_name;
        if (
          booking.final_start_at &&
          booking.requested_start_at &&
          new Date(booking.final_start_at).getTime() !== new Date(booking.requested_start_at).getTime()
        ) {
          approvedMessage += ' · Requested time was ' + formatRange(booking.requested_start_at, booking.requested_end_at);
        }
        addCustomerActivityEvent(events, {
          id: 'booking:' + booking.id + ':confirmed',
          event_type: 'booking_confirmed',
          title: 'Booking approved',
          message: approvedMessage,
          created_at: booking.confirmed_at,
          booking_id: booking.id
        });
      }

      [
        ['rejected_at', 'booking_rejected', 'Booking rejected'],
        ['cancelled_at', 'booking_cancelled', 'Booking cancelled'],
        ['completed_at', 'booking_completed', 'Inspection completed'],
        ['expired_at', 'booking_expired', 'Booking request expired']
      ].forEach(function (definition) {
        if (!booking[definition[0]]) return;
        addCustomerActivityEvent(events, {
          id: 'booking:' + booking.id + ':' + definition[1],
          event_type: definition[1],
          title: definition[2],
          message: customerActivityBookingMessage(
            booking,
            'Scheduled',
            booking.final_start_at || booking.requested_start_at,
            booking.final_end_at || booking.requested_end_at
          ),
          created_at: booking[definition[0]],
          booking_id: booking.id
        });
      });
    });

    (invoices || []).forEach(function (invoice) {
      var invoiceMessage = [
        invoice.invoice_number || 'Invoice',
        formatMoney(invoice.amount_cents, invoice.currency)
      ].filter(Boolean).join(' · ');
      addCustomerActivityEvent(events, {
        id: 'invoice:' + invoice.id + ':created',
        event_type: 'invoice_created',
        title: 'Invoice created',
        message: invoiceMessage,
        created_at: invoice.created_at,
        invoice_id: invoice.id
      });
      addCustomerActivityEvent(events, {
        id: 'invoice:' + invoice.id + ':issued',
        event_type: 'invoice_issued',
        title: 'Invoice issued',
        message: invoiceMessage,
        created_at: invoice.issued_at,
        invoice_id: invoice.id
      });
      addCustomerActivityEvent(events, {
        id: 'invoice:' + invoice.id + ':paid',
        event_type: 'invoice_paid',
        title: 'Invoice payment recorded',
        message: invoiceMessage,
        created_at: invoice.paid_at,
        invoice_id: invoice.id
      });
      addCustomerActivityEvent(events, {
        id: 'invoice:' + invoice.id + ':voided',
        event_type: 'invoice_voided',
        title: 'Invoice voided',
        message: invoiceMessage,
        created_at: invoice.voided_at,
        invoice_id: invoice.id
      });
    });

    (recordedEvents || []).forEach(function (event) {
      var actor = staffById(event.actor_staff_id);
      addCustomerActivityEvent(events, {
        id: 'customer-event:' + event.id,
        event_type: event.event_type,
        title: recordedCustomerEventTitle(event.event_type),
        message: event.message || '',
        created_at: event.created_at,
        entity_type: 'customer',
        entity_id: customer.id,
        actor_staff_id: event.actor_staff_id || '',
        actor_name: actor ? actor.display_name : ''
      });
    });

    if (customer.marketing_consent_at) {
      addCustomerActivityEvent(events, {
        id: 'customer:' + customer.id + ':marketing-consent-recorded',
        event_type: 'marketing_consent_recorded',
        title: 'Marketing consent recorded',
        message: customer.marketing_consent_source
          ? 'Source: ' + customer.marketing_consent_source.replace(/_/g, ' ') + '.'
          : 'Marketing consent recorded.',
        created_at: customer.marketing_consent_at,
        entity_type: 'customer',
        entity_id: customer.id
      });
    }
    var hasRecordedConsentWithdrawal = Boolean(
      recordedTypes.marketing_consent_withdrawn ||
      recordedTypes.marketing_consent_withdrawn_public ||
      recordedTypes.marketing_consent_withdrawn_admin
    );
    if (customer.marketing_consent_withdrawn_at && !hasRecordedConsentWithdrawal) {
      addCustomerActivityEvent(events, {
        id: 'customer:' + customer.id + ':marketing-consent-withdrawn',
        event_type: 'marketing_consent_withdrawn',
        title: 'Marketing consent withdrawn',
        message: 'Marketing consent is no longer active.',
        created_at: customer.marketing_consent_withdrawn_at,
        entity_type: 'customer',
        entity_id: customer.id
      });
    }
    if (customer.erasure_requested_at && !recordedTypes.privacy_erasure_requested) {
      addCustomerActivityEvent(events, {
        id: 'customer:' + customer.id + ':erasure-requested',
        event_type: 'privacy_erasure_requested',
        title: 'Erasure request recorded',
        message: 'Customer erasure request recorded.',
        created_at: customer.erasure_requested_at,
        entity_type: 'customer',
        entity_id: customer.id
      });
    }
    if (customer.pii_redacted_at && !recordedTypes.privacy_customer_redacted) {
      addCustomerActivityEvent(events, {
        id: 'customer:' + customer.id + ':redacted',
        event_type: 'privacy_customer_redacted',
        title: 'Customer data redacted',
        message: 'Direct identifiers were removed from the customer profile.',
        created_at: customer.pii_redacted_at,
        entity_type: 'customer',
        entity_id: customer.id
      });
    }

    return events.sort(function (a, b) {
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }

  function renderCustomerEvents(events) {
    if (!events.length) return '<p class="admin-customer-empty-copy">No activity yet.</p>';
    return '<ol class="admin-customer-activity-list">' + events.map(function (event) {
      var title = event.title || recordedCustomerEventTitle(event.event_type);
      var actor = event.actor_name ? 'By ' + event.actor_name : '';
      var content =
        '<span class="admin-customer-activity-marker" aria-hidden="true"></span>' +
        '<span class="admin-customer-activity-content">' +
          '<span class="admin-customer-activity-heading">' +
            '<strong>' + escapeHtml(title) + '</strong>' +
            '<time datetime="' + escapeHtml(event.created_at) + '">' + escapeHtml(formatDateTime(event.created_at)) + '</time>' +
          '</span>' +
          (event.message ? '<span class="admin-customer-activity-message">' + escapeHtml(event.message) + '</span>' : '') +
          (actor ? '<span class="admin-customer-activity-actor">' + escapeHtml(actor) + '</span>' : '') +
        '</span>';
      if (event.booking_id && bookingById(event.booking_id)) {
        return '<li data-activity-tone="' + escapeHtml(customerActivityTone(event.event_type)) + '"><button type="button" data-open-booking="' + escapeHtml(event.booking_id) + '" aria-label="' + escapeHtml('Open booking: ' + title + (event.message ? '. ' + event.message : '') + (actor ? '. ' + actor : '')) + '">' + content + '</button></li>';
      }
      if (event.invoice_id && invoiceById(event.invoice_id)) {
        return '<li data-activity-tone="' + escapeHtml(customerActivityTone(event.event_type)) + '"><button type="button" data-open-invoice="' + escapeHtml(event.invoice_id) + '" aria-label="' + escapeHtml('Open invoice: ' + title + (event.message ? '. ' + event.message : '') + (actor ? '. ' + actor : '')) + '">' + content + '</button></li>';
      }
      return '<li data-activity-tone="' + escapeHtml(customerActivityTone(event.event_type)) + '"><div>' + content + '</div></li>';
    }).join('') + '</ol>';
  }

  function invoiceFilterSignature() {
    return JSON.stringify({
      search: state.invoiceSearch,
      invoiceStatuses: state.invoiceStatuses.slice().sort(),
      paymentStatuses: state.invoicePaymentStatuses.slice().sort(),
      emailStatuses: state.invoiceEmailStatuses.slice().sort(),
      dateField: state.invoiceDateField,
      dateFrom: state.invoiceDateFrom,
      dateTo: state.invoiceDateTo,
      amountMin: state.invoiceAmountMin,
      amountMax: state.invoiceAmountMax,
      sort: state.invoiceSort
    });
  }

  function invoiceFilterCount() {
    var count = state.invoiceStatuses.length + state.invoicePaymentStatuses.length + state.invoiceEmailStatuses.length;
    if (state.invoiceDateFrom) count += 1;
    if (state.invoiceDateTo) count += 1;
    if (state.invoiceDateField !== 'created' && (state.invoiceDateFrom || state.invoiceDateTo)) count += 1;
    if (state.invoiceAmountMin) count += 1;
    if (state.invoiceAmountMax) count += 1;
    return count;
  }

  function syncInvoiceFilterControls() {
    var search = $('[data-invoice-search]');
    if (search && search.value !== state.invoiceSearch) search.value = state.invoiceSearch;
    [
      ['[data-invoice-status]', state.invoiceStatuses],
      ['[data-invoice-payment-status]', state.invoicePaymentStatuses],
      ['[data-invoice-email-status]', state.invoiceEmailStatuses]
    ].forEach(function (entry) {
      $all(entry[0]).forEach(function (checkbox) { checkbox.checked = entry[1].includes(checkbox.value); });
    });
    var values = [
      ['[data-invoice-date-field]', state.invoiceDateField],
      ['[data-invoice-date-from]', state.invoiceDateFrom],
      ['[data-invoice-date-to]', state.invoiceDateTo],
      ['[data-invoice-amount-min]', state.invoiceAmountMin],
      ['[data-invoice-amount-max]', state.invoiceAmountMax]
    ];
    values.forEach(function (entry) {
      var control = $(entry[0]);
      if (control && control.value !== entry[1]) control.value = entry[1];
    });
    var count = $('[data-invoice-filter-count]');
    var activeCount = invoiceFilterCount();
    if (count) {
      count.textContent = String(activeCount);
      count.hidden = activeCount === 0;
    }
    var more = $('[data-invoice-filter-more]');
    var moreCount = $('[data-invoice-filter-more-count]');
    var extraCount = state.invoiceEmailStatuses.length + Number(Boolean(state.invoiceAmountMin)) + Number(Boolean(state.invoiceAmountMax));
    if (more && !more.dataset.initialized) {
      more.open = extraCount > 0;
      more.dataset.initialized = 'true';
    }
    if (moreCount) {
      moreCount.textContent = String(extraCount);
      moreCount.hidden = extraCount === 0;
    }
    $all('[data-invoice-sort]').forEach(function (button) {
      setPressed(button, button.dataset.invoiceSort === state.invoiceSort);
    });
    refreshCustomControls($('[data-page-root]'));
  }

  function replaceInvoiceFilterUrl() {
    var url = new URL(PATHS.invoices, window.location.href);
    if (state.invoiceSearch) url.searchParams.set('search', state.invoiceSearch);
    if (state.invoiceStatuses.length) url.searchParams.set('invoiceStatuses', state.invoiceStatuses.join(','));
    if (state.invoicePaymentStatuses.length) url.searchParams.set('paymentStatuses', state.invoicePaymentStatuses.join(','));
    if (state.invoiceEmailStatuses.length) url.searchParams.set('emailStatuses', state.invoiceEmailStatuses.join(','));
    if (state.invoiceDateField !== 'created') url.searchParams.set('dateField', state.invoiceDateField);
    if (state.invoiceDateFrom) url.searchParams.set('from', state.invoiceDateFrom);
    if (state.invoiceDateTo) url.searchParams.set('to', state.invoiceDateTo);
    if (state.invoiceAmountMin) url.searchParams.set('amountMin', state.invoiceAmountMin);
    if (state.invoiceAmountMax) url.searchParams.set('amountMax', state.invoiceAmountMax);
    if (state.invoiceSort !== 'desc') url.searchParams.set('sort', state.invoiceSort);
    var route = modalRouteFromUrl();
    if (route && route.type === 'invoice' && route.id) url.searchParams.set('invoice', route.id);
    history.replaceState(modalHistoryState(route, route ? 1 : 0), '', url.pathname + url.search);
  }

  function validMoneyFilter(value) {
    var normalized = String(value || '').replace(',', '.').trim();
    return /^\d+(\.\d{1,2})?$/.test(normalized) ? normalized : '';
  }

  function renderInvoiceQuerySkeleton(list) {
    renderListSkeleton(list || $('[data-invoice-list]'), $('[data-invoice-count]'), 'invoices');
  }

  async function loadInvoiceQuery(options) {
    var opts = options || {};
    var append = opts.append === true;
    var signature = invoiceFilterSignature();
    if (!append && !opts.force && state.invoiceQuerySignature === signature) return true;
    if (activeInvoiceQuery) activeInvoiceQuery.abort();
    var controller = new AbortController();
    activeInvoiceQuery = controller;
    state.invoiceQueryLoading = true;
    var list = $('[data-invoice-list]');
    var count = $('[data-invoice-count]');
    if (list) {
      list.setAttribute('aria-busy', 'true');
      list.classList.add('is-querying');
    }
    if (count) count.setAttribute('aria-busy', 'true');
    if (!append && list && !opts.silent) {
      renderInvoiceQuerySkeleton(list);
    }
    try {
      if (!(await ensureActiveSession())) throw new Error('Sign in again before loading invoices.');
      var query = new URLSearchParams({
        view: 'invoices_query',
        sort: state.invoiceSort,
        offset: String(append ? state.invoices.length : 0),
        limit: '100'
      });
      if (state.invoiceSearch) query.set('search', state.invoiceSearch);
      if (state.invoiceStatuses.length) query.set('invoiceStatuses', state.invoiceStatuses.join(','));
      if (state.invoicePaymentStatuses.length) query.set('paymentStatuses', state.invoicePaymentStatuses.join(','));
      if (state.invoiceEmailStatuses.length) query.set('emailStatuses', state.invoiceEmailStatuses.join(','));
      if (state.invoiceDateField) query.set('dateField', state.invoiceDateField);
      if (state.invoiceDateFrom) query.set('dateFrom', state.invoiceDateFrom);
      if (state.invoiceDateTo) query.set('dateTo', state.invoiceDateTo);
      if (state.invoiceAmountMin) query.set('amountMinCents', String(Math.round(Number(state.invoiceAmountMin) * 100)));
      if (state.invoiceAmountMax) query.set('amountMaxCents', String(Math.round(Number(state.invoiceAmountMax) * 100)));
      var targetCount = !append && opts.preservePages && state.invoiceQuerySignature === signature ? Math.max(100,state.invoices.length) : 100;
      var result = await fetchOperationalPages(query,controller,targetCount,'invoiceQuery');
      if (controller.signal.aborted || activeInvoiceQuery !== controller || state.page !== 'invoices' || invoiceFilterSignature() !== signature) return false;
      var rows = Array.isArray(result.rows) ? result.rows : [];
      var commit = function () {
        if (state.page !== 'invoices' || invoiceFilterSignature() !== signature) return false;
        state.invoices = append ? state.invoices.concat(rows) : rows;
        state.invoiceQueryTotal = Number(result.total_count) || 0;
        state.invoiceQueryHasMore = Boolean(result.has_more);
        state.invoiceQueryOffset = state.invoices.length;
        state.invoiceQuerySignature = signature;
        state.invoiceQueryLoading = false;
        return true;
      };
      if (opts.defer) return commit;
      commit();
      renderInvoicesPage();
      return true;
    } catch (error) {
      if (isAbortError(error) || controller.signal.aborted) return false;
      state.invoiceQueryLoading = false;
      if ((!opts.silent || !state.invoices.length) && (!append || !state.invoices.length)) {
        if (list) list.innerHTML = '<div class="admin-empty-state" role="alert"><div><h2>Billing records could not be loaded</h2><p>' + escapeHtml(error instanceof Error ? error.message : 'Try again.') + '</p></div><button class="admin-button admin-button-secondary" type="button" data-invoice-query-retry>Try again</button></div>';
        if (count) count.textContent = 'Unavailable';
      } else {
        showToast(error instanceof Error ? error.message : (append ? 'Older billing records could not be loaded.' : 'Billing records could not be refreshed.'), 'error');
      }
      return false;
    } finally {
      if (activeInvoiceQuery === controller) {
        activeInvoiceQuery = null;
        if (list) {
          list.removeAttribute('aria-busy');
          list.classList.remove('is-querying');
        }
        if (count) count.removeAttribute('aria-busy');
      }
    }
  }

  function renderInvoicesPage() {
    var search = $('[data-invoice-search]');
    if (search) search.disabled = false;
    $all('[data-invoice-status], [data-invoice-payment-status], [data-invoice-email-status], [data-invoice-date-field], [data-invoice-date-from], [data-invoice-date-to], [data-invoice-amount-min], [data-invoice-amount-max], [data-invoice-sort]').forEach(function (control) { control.disabled = false; });
    syncInvoiceFilterControls();
    renderInvoiceList();
  }

  function sumByCurrency(rows, amount) {
    var totals = {};
    rows.forEach(function (row) {
      var currency = String(row.currency || 'EUR').toUpperCase();
      totals[currency] = (totals[currency] || 0) + amount(row);
    });
    var currencies = Object.keys(totals).sort();
    return currencies.length
      ? currencies.map(function (currency) { return formatMoney(totals[currency], currency); }).join(' · ')
      : formatMoney(0, 'EUR');
  }

  function invoiceQuickFilter() {
    var plain = !state.invoiceSearch && !state.invoiceEmailStatuses.length && !state.invoiceAmountMin && !state.invoiceAmountMax && !state.invoiceDateFrom &&
      state.invoiceStatuses.join() === 'issued' && state.invoicePaymentStatuses.join() === 'unpaid';
    if (!plain) return '';
    if (state.invoiceDateField === 'due' && state.invoiceDateTo === addDaysYmd(todayYmd(), -1)) return 'overdue';
    return state.invoiceDateTo ? '' : 'unpaid';
  }

  function applyInvoiceQuickFilter(kind) {
    var turnOff = invoiceQuickFilter() === kind;
    state.invoiceSearch = '';
    state.invoiceStatuses = turnOff ? [] : ['issued'];
    state.invoicePaymentStatuses = turnOff ? [] : ['unpaid'];
    state.invoiceEmailStatuses = [];
    state.invoiceDateField = !turnOff && kind === 'overdue' ? 'due' : 'created';
    state.invoiceDateFrom = '';
    state.invoiceDateTo = !turnOff && kind === 'overdue' ? addDaysYmd(todayYmd(), -1) : '';
    state.invoiceAmountMin = '';
    state.invoiceAmountMax = '';
    commitInvoiceFilters();
  }

  // Totals describe the records on screen: the API pages and filters billing
  // records and has no overall total, so the note says what is covered.
  function renderInvoiceSummary(invoices) {
    var root = $('[data-invoice-summary]');
    if (!root) return;
    if (!invoices.length && !invoiceQuickFilter()) {
      root.hidden = true;
      root.innerHTML = '';
      return;
    }
    var open = invoices.filter(invoiceIsOpen);
    var overdue = open.filter(invoiceIsOverdue);
    var active = invoiceQuickFilter();
    var tile = function (kind, label, rows) {
      var countText = rows.length + (rows.length === 1 ? ' invoice' : ' invoices');
      return '<button class="admin-billing-tile" type="button" data-invoice-quick="' + kind + '" data-tone="' + (kind === 'overdue' && rows.length ? 'danger' : 'neutral') + '" aria-pressed="' + (active === kind ? 'true' : 'false') + '">' +
        '<strong>' + escapeHtml(sumByCurrency(rows, invoiceOutstandingCents)) + '</strong>' +
        '<span>' + escapeHtml(label + ' · ' + countText) + '</span>' +
        '<small>' + (active === kind ? 'Showing only these · show all' : 'Show only these') + '</small>' +
      '</button>';
    };
    var scope = state.invoiceQueryHasMore
      ? 'Totals cover the ' + invoices.length + ' records loaded so far.'
      : (invoiceFilterCount() > 0 || state.invoiceSearch ? 'Totals cover the records shown.' : 'Totals cover all billing records.');
    root.hidden = false;
    root.innerHTML = tile('unpaid', 'Unpaid', open) + tile('overdue', 'Overdue', overdue) + '<p>' + escapeHtml(scope) + '</p>';
    $all('[data-invoice-quick]', root).forEach(function (button) {
      button.addEventListener('click', function () {
        applyInvoiceQuickFilter(button.dataset.invoiceQuick);
      });
    });
  }

  function renderInvoiceList() {
    var list = $('[data-invoice-list]');
    if (!list) return;
    var invoices = state.invoices.slice().sort(function (a, b) {
      var direction = state.invoiceSort === 'desc' ? -1 : 1;
      return ((new Date(a.created_at).getTime() || 0) - (new Date(b.created_at).getTime() || 0)) * direction || String(a.id).localeCompare(String(b.id)) * direction;
    });
    var count = $('[data-invoice-count]');
    if (count) {
      var total = state.invoiceQuerySignature ? state.invoiceQueryTotal : invoices.length;
      count.textContent = total + ' record' + (total === 1 ? '' : 's');
      count.setAttribute('role', 'status');
      count.setAttribute('aria-live', 'polite');
      count.setAttribute('aria-atomic', 'true');
    }
    renderInvoiceSummary(invoices);
    if (!invoices.length) {
      var hasRefinement = invoiceFilterCount() > 0 || Boolean(state.invoiceSearch);
      list.innerHTML = emptyState(
        hasRefinement ? 'No billing records match the current search and filters.' : 'No billing records yet.',
        hasRefinement ? 'Clear filters' : '',
        hasRefinement ? 'data-empty-invoices-clear' : ''
      );
      var emptyClear = $('[data-empty-invoices-clear]', list);
      if (emptyClear) {
        emptyClear.addEventListener('click', function () {
          resetInvoiceFilters();
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
      var invoiceDate = invoice.invoice_status === 'payment'
        ? (invoice.paid_at ? formatDateTime(invoice.paid_at) : formatDateTime(invoice.created_at))
        : (invoice.issued_at ? formatDateTime(invoice.issued_at) : 'Not issued');
      var invoiceAmount = formatMoney(invoice.payment_status === 'paid' ? (invoice.paid_amount_cents || invoice.amount_cents) : invoice.amount_cents, invoice.currency);
      var isPaymentRecord = invoice.invoice_status === 'payment';
      var dueText = isPaymentRecord || invoice.invoice_status === 'void'
        ? '–'
        : (formatDueDate(invoice.due_date) || 'Not set');
      var email = isPaymentRecord ? ['–', 'none'] : emailStatusShort(invoice.email_status);
      var invoiceMeta = isPaymentRecord
        ? [paymentLabel(invoice.payment_status), invoice.payment_method || 'Method not recorded'].join(' · ')
        : 'Due ' + (formatDueDate(invoice.due_date) || 'not set') + ' · Email ' + emailStatusLabel(invoice.email_status);
      var invoiceLabel = [invoice.invoice_number, invoiceCustomer, invoiceStatusLabel(invoice), invoiceBooking, invoiceDate, invoiceAmount, invoiceMeta].join(', ');
      return '<button class="admin-booking-item admin-data-row' + (invoice.id === state.selectedInvoiceId ? ' is-selected' : '') + (invoiceIsOverdue(invoice) ? ' is-overdue' : '') + '" type="button" aria-label="' + escapeHtml(invoiceLabel) + '" data-invoice-id="' + escapeHtml(invoice.id) + '">' +
        '<span class="admin-row-primary admin-booking-item-header"><span class="admin-booking-title"><strong>' + escapeHtml(invoice.invoice_number) + '</strong><span>' + escapeHtml(invoiceCustomer) + '</span></span></span>' +
        '<span class="admin-row-status"><span class="admin-status-pill" data-status="' + escapeHtml(invoiceTone(invoice)) + '">' + escapeHtml(invoiceStatusLabel(invoice)) + '</span></span>' +
        '<span class="admin-row-service admin-booking-meta">' + escapeHtml(invoiceBooking) + '</span>' +
        '<span class="admin-row-date admin-booking-meta">' + escapeHtml(invoiceDate) + '</span>' +
        '<span class="admin-row-amount">' + escapeHtml(invoiceAmount) + '</span>' +
        '<span class="admin-row-due admin-booking-meta"><span class="admin-row-mobile-label">Due </span>' + escapeHtml(dueText) + '</span>' +
        '<span class="admin-row-email admin-booking-meta" data-tone="' + email[1] + '"><span class="admin-row-mobile-label">Email </span>' + escapeHtml(email[0]) + '</span>' +
      '</button>';
    }).join('');

    $all('[data-invoice-id]', list).forEach(function (button) {
      button.addEventListener('click', function () {
        navigateToModal('invoice', button.dataset.invoiceId);
      });
    });
    var pagination = $('[data-invoice-pagination]');
    var loadMore = $('[data-invoice-load-more]');
    if (pagination) pagination.hidden = !state.invoiceQueryHasMore;
    if (loadMore) loadMore.disabled = state.invoiceQueryLoading;
  }

  // Invoice panel ------------------------------------------------------------
  // What is owed, what came in, and the next step. Payments are recorded
  // only once the invoice email is confirmed delivered; the panel says so.

  var PAYMENT_METHOD_LABELS = { cash: 'Cash', bank_transfer: 'Bank transfer', card: 'Card', other: 'Other' };
  var PAYMENT_ENTRY_LABELS = { receipt: 'Payment', refund: 'Refund', opening_receipt: 'Earlier payment', reversal: 'Reversal', correction: 'Correction' };

  function vilniusNowLocalValue() {
    var nowIso = new Date().toISOString();
    return dateInputValue(nowIso) + 'T' + timeInputValue(nowIso);
  }

  function invoicePanelContext(invoice) {
    var operations = invoice.booking_id ? bookingOperations(invoice.booking_id) : null;
    var booking = invoice.booking_id ? bookingById(invoice.booking_id) : null;
    var summary = operations?.payment_summaries?.[invoice.booking_id] || null;
    var entries = (operations?.payment_entries || []).filter(function (entry) { return entry.booking_id === invoice.booking_id; });
    var editable = entries.filter(function (entry) {
      return ['receipt', 'refund', 'opening_receipt'].includes(entry.entry_kind) &&
        !entries.some(function (other) { return other.reverses_entry_id === entry.id; });
    });
    var canBill = staffHasAccess(state.staff, 'billing_email.manage', ['owner', 'admin']);
    var delivered = invoiceDeliveredToClient(invoice, operations);
    var canRecord = Boolean(canBill && booking && booking.status === 'completed' && summary && delivered && invoice.invoice_status === 'issued');
    return {
      operations: operations,
      booking: booking,
      summary: summary,
      entries: entries,
      editable: editable,
      canBill: canBill,
      delivered: delivered,
      canRecord: canRecord,
      canRefund: canRecord && Number(summary && summary.net_paid_cents) > 0
    };
  }

  function invoiceTitle(invoice) {
    return (invoice.invoice_status === 'payment' ? 'Payment ' : 'Invoice ') + (invoice.invoice_number || '');
  }

  function invoiceChipLabel(invoice) {
    return invoice.invoice_status === 'draft' ? 'Draft' : invoiceStatusLabel(invoice);
  }

  function invoiceAmountHtml(invoice, context) {
    var currency = invoice.currency;
    var total = Number(invoice.amount_cents) || 0;
    var paid = Number(invoice.paid_amount_cents) || 0;
    if (invoice.invoice_status === 'void') {
      return '<p class="admin-panel-amount"><strong>' + escapeHtml(formatMoney(total, currency)) + '</strong>' +
        '<span>' + escapeHtml(invoice.voided_at ? 'Voided ' + formatDateTime(invoice.voided_at) : 'Voided') + '</span></p>';
    }
    if (invoice.invoice_status === 'payment') {
      return '<p class="admin-panel-amount"><strong>' + escapeHtml(formatMoney(paid || total, currency)) + ' received</strong>' +
        (invoice.paid_at ? '<span>' + escapeHtml(formatDateTime(invoice.paid_at)) + '</span>' : '') + '</p>';
    }
    if (invoice.payment_status === 'paid') {
      return '<p class="admin-panel-amount"><strong>Paid ' + escapeHtml(formatMoney(paid || total, currency)) + '</strong>' +
        (invoice.paid_at ? '<span>on ' + escapeHtml(formatDateTime(invoice.paid_at)) + '</span>' : '') + '</p>';
    }
    var remaining = context.summary && context.summary.agreed_or_invoiced_cents !== null && context.summary.remaining_cents != null
      ? Number(context.summary.remaining_cents)
      : Math.max(0, total - paid);
    var dueText = invoice.due_date ? formatDueDate(invoice.due_date) : '';
    var overdue = invoiceIsOverdue(invoice);
    var sub = [];
    if (paid > 0) sub.push(formatMoney(paid, currency) + ' of ' + formatMoney(total, currency) + ' paid');
    if (dueText) sub.push((overdue ? 'Was due ' : 'Due ') + dueText);
    return '<p class="admin-panel-amount' + (overdue ? ' is-overdue' : '') + '"><strong>' + escapeHtml(formatMoney(remaining, currency)) + ' due</strong>' +
      (sub.length ? '<span>' + escapeHtml(sub.join(' · ')) + '</span>' : '') + '</p>';
  }

  function invoiceEmailFact(invoice, context) {
    if (invoice.invoice_status === 'payment') return '';
    var notification = (context.operations?.notifications || []).filter(function (item) {
      return item.invoice_id === invoice.id && item.kind === 'invoice_customer';
    }).slice(-1)[0];
    var recipient = notification?.recipient_email || invoice.customer_email;
    var status = notification ? notification.status : invoice.email_status;
    if (!status || status === 'not_sent' || status === 'skipped') {
      return factHtml('Email', '<span>' + (recipient ? 'Not emailed' : 'Not emailed · the customer has no email address') + '</span>');
    }
    var label = EMAIL_STATUS_LABELS[status] || emailStatusLabel(status);
    var line = '<span class="admin-email-line' + (emailIsProblem(status) ? ' is-problem' : '') + '">' +
      escapeHtml('Emailed to ' + (recipient || 'customer') + (invoice.last_sent_at ? ' on ' + formatDateTime(invoice.last_sent_at) : '')) + ' · <strong>' + escapeHtml(label) + '</strong></span>';
    var error = invoice.last_email_error && status !== 'delivered'
      ? '<span class="admin-fact-sub admin-fact-problem">' + escapeHtml(invoice.last_email_error) + '</span>'
      : '';
    return factHtml('Email', line + error);
  }

  function paymentEntryLine(entry, entries, options) {
    var reversed = entries.some(function (other) { return other.reverses_entry_id === entry.id; });
    var staff = entry.actor_staff_id ? staffById(entry.actor_staff_id) : null;
    var when = entry.occurred_at_is_estimate ? 'Date unknown' : formatDateTime(entry.occurred_at);
    var detail = [when, PAYMENT_METHOD_LABELS[entry.method] || '', staff ? staff.display_name : (entry.actor_staff_id ? '' : 'Imported')].filter(Boolean).join(' · ');
    var canCorrect = !(options && options.noAction) && ['receipt', 'refund', 'opening_receipt'].includes(entry.entry_kind) && !reversed;
    return '<li class="admin-payment-entry' + (reversed ? ' is-reversed' : '') + '">' +
      '<div><strong>' + escapeHtml(PAYMENT_ENTRY_LABELS[entry.entry_kind] || 'Entry') + (reversed ? ' · corrected' : '') + '</strong>' +
        '<span>' + escapeHtml(detail) + '</span>' +
        (entry.reason ? '<span>' + escapeHtml(entry.reason) + '</span>' : '') +
      '</div>' +
      '<div class="admin-payment-entry-side"><strong>' + escapeHtml(formatMoney(entry.signed_amount_cents, 'EUR')) + '</strong>' +
        (canCorrect ? '<button class="admin-context-action" type="button" data-admin-step="correct" data-admin-step-data="' + escapeHtml(entry.id) + '">Correct…</button>' : '') +
      '</div>' +
    '</li>';
  }

  function invoicePaymentsHtml(invoice, context) {
    if (!context.canBill || !context.booking || invoice.invoice_status === 'draft') return '';
    var summary = context.summary;
    var parts = [];
    if (invoice.invoice_status === 'issued' && !context.delivered) {
      var status = invoice.email_status;
      var reason = !invoice.customer_email
        ? 'The customer has no email address, so the invoice wasn’t emailed.'
        : (emailIsProblem(status) || status === 'failed' || status === 'bounced')
          ? 'The invoice email didn’t arrive. Email it again or contact the customer.'
          : 'Delivery of the invoice email isn’t confirmed yet.';
      parts.push('<p class="admin-step-note">Payments can be recorded once the invoice email is delivered. ' + escapeHtml(reason) + '</p>');
    }
    if (context.entries.length) {
      parts.push('<ul class="admin-payment-entries">' + context.entries.map(function (entry) { return paymentEntryLine(entry, context.entries); }).join('') + '</ul>');
    }
    // Totals only add something once money has moved; the amount line above
    // already says what is due.
    if (summary && (context.entries.length || Number(summary.received_cents) > 0 || Number(summary.credit_cents) > 0)) {
      var totals = ['Received ' + formatMoney(summary.received_cents, 'EUR')];
      if (Number(summary.refunded_cents) > 0) totals.push('refunded ' + formatMoney(summary.refunded_cents, 'EUR'));
      if (summary.agreed_or_invoiced_cents !== null && Number(summary.remaining_cents) > 0) totals.push(formatMoney(summary.remaining_cents, 'EUR') + ' still due');
      if (Number(summary.credit_cents) > 0) totals.push(formatMoney(summary.credit_cents, 'EUR') + ' credit');
      parts.push('<p class="admin-payment-totals">' + escapeHtml(totals.join(' · ')) + '</p>');
      if (summary.unallocated_cents) parts.push('<p class="admin-step-note is-warning" role="alert">' + escapeHtml(formatMoney(summary.unallocated_cents, 'EUR')) + ' isn’t tied to an invoice yet.</p>');
    } else if (!summary && !context.operations?.detail_pending && invoice.invoice_status === 'issued') {
      parts.push('<p class="admin-step-note">The payment balance isn’t available right now.</p>');
    }
    if (!parts.length) return '';
    return '<section class="admin-panel-section admin-invoice-payments"><h3>Payments</h3>' + parts.join('') + '</section>';
  }

  function invoiceFooterHtml(invoice, context) {
    if (!context.canBill) {
      return invoice.pdf_path ? '<div class="admin-modal-footer admin-panel-footer"><button class="admin-button admin-button-secondary" type="button" data-view-invoice-pdf="' + escapeHtml(invoice.id) + '">View PDF</button></div>' : '';
    }
    var issued = invoice.invoice_status === 'issued';
    var unpaid = issued && invoice.payment_status !== 'paid';
    var deliveryFailed = issued && invoice.customer_email && !context.delivered && ['failed', 'bounced', 'needs_review', 'suppressed'].includes(invoice.email_status);
    var primary = '';
    if (unpaid && context.canRecord) primary = '<button class="admin-button admin-button-primary" type="button" data-admin-step="payment">Record payment…</button>';
    else if (deliveryFailed) primary = '<button class="admin-button admin-button-primary" type="button" data-resend-invoice="' + escapeHtml(invoice.id) + '">Email invoice again</button>';
    var secondary = invoice.pdf_path ? '<button class="admin-button admin-button-secondary" type="button" data-view-invoice-pdf="' + escapeHtml(invoice.id) + '">View PDF</button>' : '';
    var more = [];
    if (unpaid && !deliveryFailed && invoice.customer_email) more.push({ label: 'Email invoice again', attrs: 'data-resend-invoice="' + escapeHtml(invoice.id) + '"' });
    if (context.canRefund) more.push({ label: 'Record refund…', attrs: 'data-admin-step="refund"' });
    if (invoice.invoice_status !== 'void') more.push({ label: invoice.invoice_status === 'payment' ? 'Void payment record…' : 'Void invoice…', attrs: 'data-admin-step="void"', danger: true });
    if (!primary && !secondary && !more.length) return '';
    return '<div class="admin-modal-footer admin-panel-footer">' + moreMenuHtml(more) + secondary + primary + '</div>';
  }

  function invoiceOverviewHtml(invoice, context) {
    var customer = customerById(invoice.customer_id);
    var customerName = customer ? customer.display_name : invoice.customer_name;
    var booking = context.booking;
    var customerHtml = '<strong>' + escapeHtml(customerName || 'Name not given') + '</strong>' +
      (invoice.customer_email ? '<span class="admin-fact-sub">' + escapeHtml(invoice.customer_email) + '</span>' : (invoice.customer_phone ? '<span class="admin-fact-sub">' + escapeHtml(invoice.customer_phone) + '</span>' : '')) +
      (customer ? '<span class="admin-fact-links"><button class="admin-context-action" type="button" data-open-customer="' + escapeHtml(customer.id) + '">' + ICON_USER + '<span>Open customer</span></button></span>' : '');
    var bookingHtml = booking
      ? '<strong>' + escapeHtml(booking.public_reference) + '</strong><span class="admin-fact-links"><button class="admin-context-action" type="button" data-open-booking="' + escapeHtml(booking.id) + '">' + ICON_BOOKING + '<span>Open booking</span></button></span>'
      : '<span>No booking</span>';
    var vat = Number(invoice.tax_cents) > 0 ? 'Included · ' + formatMoney(invoice.tax_cents, invoice.currency) : 'No VAT';
    return panelHeaderHtml({
        title: invoiceTitle(invoice),
        chips: '<span class="admin-status-pill" data-status="' + escapeHtml(invoice.invoice_status === 'draft' ? 'pending' : invoiceTone(invoice)) + '">' + escapeHtml(invoiceChipLabel(invoice)) + '</span>',
        meta: escapeHtml([customerName, booking ? booking.public_reference : ''].filter(Boolean).join(' · ')),
        closeLabel: 'Close invoice'
      }) +
      panelNoticeHtml('invoice', invoice.id) +
      invoiceAmountHtml(invoice, context) +
      '<dl class="admin-facts">' +
        factHtml('Customer', customerHtml) +
        factHtml('Booking', bookingHtml) +
        (invoice.service_description ? factHtml('Description', escapeHtml(invoice.service_description)) : '') +
        (invoice.invoice_status !== 'payment' ? factHtml('VAT', escapeHtml(vat)) : '') +
        (invoice.issued_at ? factHtml('Issued', escapeHtml(formatDateTime(invoice.issued_at))) : '') +
        invoiceEmailFact(invoice, context) +
      '</dl>' +
      invoicePaymentsHtml(invoice, context) +
      invoiceFooterHtml(invoice, context);
  }

  function methodChoiceHtml(selected) {
    return '<div class="admin-choice-group" role="radiogroup" aria-label="Method">' +
      Object.keys(PAYMENT_METHOD_LABELS).map(function (key) {
        return '<label><input type="radio" name="paymentMethod" value="' + key + '"' + (key === selected ? ' checked' : '') + '><span>' + escapeHtml(PAYMENT_METHOD_LABELS[key]) + '</span></label>';
      }).join('') +
    '</div>';
  }

  function movementFieldsHtml(dateLabel, value) {
    return '<label>' + requiredLabel(dateLabel) + '<input name="occurredLocal" type="datetime-local" required value="' + escapeHtml(value || vilniusNowLocalValue()) + '"></label>' +
      '<label hidden>When clocks go back<span class="admin-select-wrap"><select name="paymentFold"><option value="">Choose if a time repeats</option><option value="first">First occurrence (summer time)</option><option value="second">Second occurrence (winter time)</option></select></span></label>';
  }

  function invoiceMoneyStepHtml(invoice, context, kind) {
    var refund = kind === 'refund';
    var summary = context.summary || {};
    var amountCents = refund ? Number(summary.net_paid_cents) || 0 : (summary.agreed_or_invoiced_cents !== null && Number(summary.remaining_cents) > 0 ? Number(summary.remaining_cents) : Math.max(0, invoice.amount_cents - (invoice.paid_amount_cents || 0)));
    return panelStepHeaderHtml(refund ? 'Record refund' : 'Record payment', { meta: escapeHtml(invoiceTitle(invoice)) }) +
      '<form class="admin-action-form admin-form-plain admin-step-form" data-admin-action-form data-action="' + (refund ? 'recordRefund' : 'recordPayment') + '" data-no-confirm data-money-label="' + (refund ? 'refund' : 'payment') + '">' +
        hiddenInput('bookingId', invoice.booking_id) +
        '<label>' + requiredLabel('Amount (€)') + '<input name="paidAmount" type="text" inputmode="decimal" required value="' + escapeHtml(amountCents ? (amountCents / 100).toFixed(2) : '') + '" placeholder="0.00"></label>' +
        '<div class="admin-step-section"><span class="admin-field-label">Method</span>' + methodChoiceHtml('bank_transfer') + '</div>' +
        movementFieldsHtml(refund ? 'Refunded on' : 'Received on') +
        '<label>' + (refund ? requiredLabel('Reason') : optionalLabel('Note')) + '<textarea name="paymentNote" maxlength="1000"' + (refund ? ' required' : '') + '></textarea></label>' +
        stepFooterHtml('Back', refund ? 'Record refund' : 'Record payment') +
      '</form>';
  }

  function invoiceCorrectStepHtml(invoice, context, entryId) {
    var entry = context.editable.find(function (item) { return item.id === entryId; });
    var header = panelStepHeaderHtml('Correct entry', { meta: escapeHtml(invoiceTitle(invoice)) });
    if (!entry) return header + '<p class="admin-step-blocked">This entry was already corrected.</p>';
    var amount = (Math.abs(Number(entry.signed_amount_cents) || 0) / 100).toFixed(2);
    return header +
      '<form class="admin-action-form admin-form-plain admin-step-form" data-admin-action-form data-action="correctPayment" data-no-confirm data-entry-method="' + escapeHtml(entry.method || 'unknown') + '" data-entry-occurred-at="' + escapeHtml(entry.occurred_at || '') + '">' +
        hiddenInput('bookingId', invoice.booking_id) +
        hiddenInput('paymentEntryId', entry.id) +
        '<ul class="admin-payment-entries">' + paymentEntryLine(entry, [], { noAction: true }) + '</ul>' +
        '<div class="admin-choice-group" role="radiogroup" aria-label="Correction">' +
          '<label><input type="radio" name="correctionMode" value="change" checked><span>Change the amount</span></label>' +
          '<label><input type="radio" name="correctionMode" value="remove"><span>Remove this entry</span></label>' +
        '</div>' +
        '<div class="admin-step-section" data-correction-fields>' +
          '<label>' + requiredLabel('Correct amount (€)') + '<input name="paidAmount" type="text" inputmode="decimal" required value="' + escapeHtml(amount) + '"></label>' +
          '<div class="admin-step-section"><span class="admin-field-label">Method</span>' + methodChoiceHtml(PAYMENT_METHOD_LABELS[entry.method] ? entry.method : 'bank_transfer') + '</div>' +
          movementFieldsHtml('Date', entry.occurred_at ? dateInputValue(entry.occurred_at) + 'T' + timeInputValue(entry.occurred_at) : '') +
        '</div>' +
        '<label>' + requiredLabel('Reason') + '<textarea name="paymentNote" maxlength="1000" required></textarea></label>' +
        stepFooterHtml('Back', 'Save correction') +
      '</form>';
  }

  function invoiceVoidStepHtml(invoice) {
    var paymentOnly = invoice.invoice_status === 'payment';
    return panelStepHeaderHtml(paymentOnly ? 'Void payment record' : 'Void invoice', { meta: escapeHtml(invoiceTitle(invoice)) }) +
      '<form class="admin-action-form admin-form-plain admin-step-form" data-admin-action-form data-action="voidInvoice" data-no-confirm' + (invoice.payment_status === 'paid' && !paymentOnly ? ' data-paid-warning' : '') + '>' +
        hiddenInput('invoiceId', invoice.id) +
        '<p class="admin-step-note">' + escapeHtml(paymentOnly
          ? 'The recorded money stays in the payment history.'
          : 'The number and PDF are kept for accounting. A voided invoice can’t be reopened.') + '</p>' +
        '<label>' + requiredLabel('Reason') + '<textarea name="voidReason" maxlength="700" required></textarea></label>' +
        stepFooterHtml('Back', paymentOnly ? 'Void payment record' : 'Void invoice', 'admin-button-danger') +
      '</form>';
  }

  function renderInvoiceModal(invoiceId) {
    var invoice = invoiceById(invoiceId);
    if (!invoice) return;
    state.selectedInvoiceId = invoice.id;
    var context = invoicePanelContext(invoice);
    var step = currentModalStep('invoice', invoice.id);
    var html;
    if (step === 'payment' && context.canRecord) html = invoiceMoneyStepHtml(invoice, context, 'payment');
    else if (step === 'refund' && context.canRefund) html = invoiceMoneyStepHtml(invoice, context, 'refund');
    else if (step === 'correct' && context.canBill) html = invoiceCorrectStepHtml(invoice, context, currentModalStepData('invoice', invoice.id));
    else if (step === 'void' && context.canBill && invoice.invoice_status !== 'void') html = invoiceVoidStepHtml(invoice);
    else {
      if (step) state.modalStep = null;
      html = invoiceOverviewHtml(invoice, context);
    }

    var modal = openModal(html, 'panel');
    renderInvoiceList();
    bindPriceTotals(modal);

    $all('[data-admin-action-form]', modal).forEach(function (form) {
      form.addEventListener('submit', handleActionSubmit);
    });

    // Money steps name the amount on the button.
    var moneyForm = $('form[data-money-label]', modal);
    if (moneyForm) {
      var moneySubmit = $('[data-step-submit]', moneyForm);
      var syncMoney = function () {
        var cents = moneyCents(moneyForm.elements.paidAmount.value, false);
        var noun = moneyForm.dataset.moneyLabel;
        moneySubmit.textContent = 'Record ' + (cents ? formatMoney(cents, 'EUR') + ' ' : '') + noun;
      };
      moneyForm.elements.paidAmount.addEventListener('input', syncMoney);
      syncMoney();
    }

    var correctForm = $('form[data-action="correctPayment"]', modal);
    if (correctForm) {
      var fields = $('[data-correction-fields]', correctForm);
      var syncCorrection = function () {
        var remove = correctForm.elements.correctionMode.value === 'remove';
        fields.hidden = remove;
        $all('input, select', fields).forEach(function (field) { field.disabled = remove; });
        $('[data-step-submit]', correctForm).textContent = remove ? 'Remove entry' : 'Save correction';
      };
      $all('input[name="correctionMode"]', correctForm).forEach(function (input) { input.addEventListener('change', syncCorrection); });
      syncCorrection();
    }

    $all('[data-open-customer]', modal).forEach(function (button) {
      button.addEventListener('click', function () { navigateToModal('customer', button.dataset.openCustomer); });
    });
    $all('[data-open-booking]', modal).forEach(function (button) {
      button.addEventListener('click', function () { navigateToModal('booking', button.dataset.openBooking); });
    });
    $all('[data-resend-invoice]', modal).forEach(function (button) {
      button.addEventListener('click', function () {
        runAction({ action: 'resendInvoice', invoiceId: button.dataset.resendInvoice }, 'resendInvoice', button, {
          confirm: {
            title: 'Email ' + invoiceTitle(invoice) + ' again?',
            message: 'The PDF goes to ' + (invoice.customer_email || 'the customer') + ' again.',
            cancelLabel: 'Don’t send',
            confirmLabel: 'Email again'
          }
        });
      });
    });
    var pdfButton = $('[data-view-invoice-pdf]', modal);
    if (pdfButton) {
      pdfButton.addEventListener('click', async function () {
        var pdfWindow = window.open('about:blank', '_blank');
        if (pdfWindow) {
          pdfWindow.opener = null;
          renderInvoicePdfWindowSkeleton(pdfWindow);
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
          '<h2>' + escapeHtml(campaign.subject) + '</h2>' +
          '<span class="admin-status-pill" data-status="' + escapeHtml(statusTone(campaign.status)) + '">' + escapeHtml(statusLabel(campaign.status || 'sent')) + '</span>' +
        '</div>' +
        '<button class="admin-preview-close admin-icon-button" type="button" data-admin-modal-close aria-label="Close campaign" title="Close">' + ICON_CLOSE + '</button>' +
      '</div>' +
      '<div class="admin-campaign-layout">' +
        '<section class="admin-detail-section admin-campaign-summary" aria-label="Campaign summary">' +
          '<div class="admin-detail-list">' +
            detailRow('Created', formatDateTime(campaign.created_at)) +
            detailRow('Sent', campaign.sent_at ? formatDateTime(campaign.sent_at) : '') +
            detailRow('Recipients', Number(campaign.audience_count || 0) + ' total') +
            detailRow('Delivery', Number(campaign.sent_count || 0) + ' sent / ' + Number(campaign.failed_count || 0) + ' failed') +
          '</div>' +
        '</section>' +
        '<section class="admin-detail-section admin-campaign-preview">' +
          '<h3>Email preview</h3>' +
          emailPreviewFrame('Campaign email preview', 'data-campaign-preview') +
        '</section>' +
        '<details class="admin-detail-section admin-disclosure admin-campaign-recipients">' +
          '<summary>Recipients (' + recipients.length + ')</summary>' +
          '<div class="admin-mini-list admin-recipient-list">' +
            (recipients.length ? recipients.map(function (recipient) {
              return '<div class="admin-mini-item">' +
                '<span><strong>' + escapeHtml(recipient.recipient_email) + '</strong></span>' +
                '<span>' + escapeHtml(recipientStatusText(recipient)) + '</span>' +
              '</div>';
            }).join('') : '<div class="admin-empty-state admin-empty-state-compact"><p>No recipients recorded.</p></div>') +
          '</div>' +
        '</details>' +
      '</div>',
      'lg'
    );

    var frame = $('[data-campaign-preview]', modal);
    if (frame) {
      adminAction({
        action: 'previewMarketingEmail',
        marketingSubject: campaign.subject,
        marketingBody: campaign.body_text || ''
      }).then(function (response) {
        setEmailPreviewDocument(frame, response.result && response.result.html ? response.result.html : '');
      }).catch(function (error) {
        setEmailPreviewDocument(frame, '<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;color:#b42318;padding:24px;">' + escapeHtml(error instanceof Error ? error.message : 'Preview unavailable.') + '</body>');
      });
    }
  }

  function renderMarketingPage() {
    var count = $('[data-marketing-audience-count]');
    var customers = consentedCustomers();
    if (count) count.textContent = customers.length + ' eligible recipient' + (customers.length === 1 ? '' : 's');

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
        : emptyState('No campaigns yet.');

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
    syncMarketingFormState(form);
  }

  function syncMarketingFormState(form) {
    if (!form) return;
    var submit = $('[type="submit"]', form);
    var unavailable = $('[data-marketing-unavailable]', form);
    var loaded = viewIsLoaded('marketing');
    var audienceCount = loaded ? consentedCustomers().length : 0;
    var subject = String(form.elements.marketingSubject && form.elements.marketingSubject.value || '').trim();
    var body = String(form.elements.marketingBody && form.elements.marketingBody.value || '').trim();
    var ready = loaded && audienceCount > 0 && subject && body && form.checkValidity() && form.getAttribute('aria-busy') !== 'true';
    if (submit) submit.disabled = !ready;
    if (!unavailable) return;
    if (!loaded) {
      unavailable.hidden = false;
      unavailable.textContent = 'Recipients are unavailable. Refresh the page before sending.';
    } else if (audienceCount < 1) {
      unavailable.hidden = false;
      unavailable.textContent = 'No customers currently have active marketing consent. Sending is unavailable.';
    } else {
      unavailable.hidden = true;
      unavailable.textContent = '';
    }
  }

  function staffOptions(selectedId) {
    return state.staffList.filter(function (staff) { return staff.is_active; }).map(function (staff) {
      return '<option value="' + escapeHtml(staff.id) + '"' + (staff.id === selectedId ? ' selected' : '') + '>' + escapeHtml(staff.display_name) + '</option>';
    }).join('');
  }

  function validateDateTimePair(dateValue, startTime, endTime, fold) {
    if (!isValidYmd(dateValue)) {
      return { error: 'Use the date format YYYY-MM-DD.' };
    }

    var startAt = isoFromVilniusInput(dateValue, startTime, fold);
    var endAt = isoFromVilniusInput(dateValue, endTime, fold);
    if (!startAt || !endAt) {
      return { error: 'Choose valid Vilnius times. A skipped spring time is unavailable; a repeated autumn time requires choosing its occurrence.' };
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
      confirmBooking: 'Confirming…',
      rejectBooking: 'Rejecting…',
      cancelBooking: 'Cancelling…',
      completeBooking: 'Marking…',
      createAndSendInvoice: 'Creating…',
      markBookingPaid: 'Saving…',
      markInvoicePaid: 'Saving…',
      updateInvoicePaidAmount: 'Updating…',
      resendInvoice: 'Sending…',
      voidInvoice: 'Voiding…',
      deleteSlot: 'Cancelling…',
      deleteSlotSeries: 'Cancelling…',
      updateSlot: 'Saving…',
      createSlot: 'Creating…',
      setCustomerLegalHold: 'Saving…',
      releaseCustomerLegalHold: 'Saving…',
      markCustomerErasureRequest: 'Saving…',
      withdrawCustomerMarketingConsent: 'Saving…',
      redactBookingPii: 'Redacting…',
      redactCustomerPii: 'Redacting…',
      deleteCustomerProfile: 'Deleting…',
      sendMarketingCampaign: 'Sending…',
      getInvoicePdfUrl: 'Opening…'
    }[action] || 'Working…';
  }

  function successMessageForAction(action) {
    return {
      confirmBooking: 'Booking confirmed and the customer emailed.',
      rejectBooking: 'Request rejected and the customer emailed.',
      cancelBooking: 'Booking cancelled and the customer emailed.',
      completeBooking: 'Marked completed.',
      recordAgreedPrice: 'Price saved.',
      createAndSendInvoice: 'Invoice created and emailed.',
      recordPayment: 'Payment recorded.',
      recordRefund: 'Refund recorded.',
      correctPayment: 'Correction saved.',
      resendInvoice: 'Invoice emailed again.',
      voidInvoice: 'Invoice voided.',
      deleteSlot: 'Slot deleted.',
      deleteSlotSeries: 'Series deleted.',
      updateSlot: 'Slot saved.',
      createSlot: 'Slot added.',
      setCustomerLegalHold: 'Legal hold started.',
      releaseCustomerLegalHold: 'Legal hold released.',
      withdrawCustomerMarketingConsent: 'Unsubscribed from marketing emails.',
      redactCustomerPii: 'Personal data erased.',
      deleteCustomerProfile: 'Profile deleted.',
      sendMarketingCampaign: 'Marketing campaign sent.'
    }[action] || 'Saved.';
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
      button.setAttribute('aria-label', label || 'Working…');
      button.textContent = button.classList.contains('admin-icon-button') ? '' : (label || 'Working…');
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

  function setSyncState(label, tone, detail) {
    var target = $('[data-admin-sync-state]');
    if (!target) return;
    var status = tone === 'loading' || tone === 'error' ? tone : 'synced';
    var description = label + (detail ? ': ' + detail : '') + (state.lastSuccessfulRefresh ? '. Last successful refresh ' + formatDateTime(new Date(state.lastSuccessfulRefresh).toISOString()) : '. No successful refresh yet');
    var hint = status === 'loading'
      ? description
      : description + (/[.!?…]$/.test(description) ? ' ' : '. ') + 'Refresh admin data';
    target.dataset.state = status;
    target.setAttribute('aria-label', hint);
    target.setAttribute('title', hint);
    // Stay focusable while busy so keyboard users can still leave the menu.
    target.setAttribute('aria-disabled', status === 'loading' ? 'true' : 'false');
    target.setAttribute('aria-busy', status === 'loading' ? 'true' : 'false');
    var announcement = $('[data-admin-sync-announcement]');
    if (announcement && announcement.textContent !== description) announcement.textContent = description;
  }

  function bookingActionProgressLabel(action) {
    return {
      confirmBooking: 'Confirming booking…',
      rejectBooking: 'Rejecting booking…',
      cancelBooking: 'Cancelling booking…',
      completeBooking: 'Marking booking completed…'
    }[action] || 'Updating booking…';
  }

  function showBookingActionProgress(target, action) {
    if (!target || !['confirmBooking','rejectBooking','cancelBooking','completeBooking'].includes(action)) return false;
    var section=target.closest('.admin-booking-decision');
    if(section) section.setAttribute('aria-busy','true');
    return Boolean(section);
  }

  function applyBookingActionResult(payload, result) {
    if (!payload || !payload.bookingId) return null;
    var index = state.bookings.findIndex(function (booking) { return booking.id === payload.bookingId; });
    if (index < 0) return null;
    var current = state.bookings[index];
    var now = new Date().toISOString();
    var patch = { updated_at: now };

    if (payload.action === 'confirmBooking') {
      patch.status = 'confirmed';
      patch.final_start_at = payload.startAt || current.requested_start_at;
      patch.final_end_at = payload.endAt || current.requested_end_at;
      patch.assigned_to_staff_id = payload.assignedStaffId || current.assigned_to_staff_id;
      patch.confirmed_at = now;
      patch.pending_expires_at = null;
    } else if (payload.action === 'rejectBooking') {
      patch.status = 'rejected';
      patch.rejected_at = now;
    } else if (payload.action === 'cancelBooking') {
      patch.status = 'cancelled';
      patch.cancelled_at = now;
    } else if (payload.action === 'completeBooking') {
      patch.status = 'completed';
      patch.completed_at = now;
    } else {
      return null;
    }

    if (result && typeof result.status === 'string') patch.status = result.status;
    state.bookings[index] = Object.assign({}, current, patch);
    return state.bookings[index];
  }

  function renderPatchedBookingModal(payload, result) {
    var booking = applyBookingActionResult(payload, result);
    var route = modalRouteFromUrl();
    if (booking && route && route.type === 'booking' && route.id === booking.id) {
      renderBookingModal(booking);
    }
    return booking;
  }

  function restoreBookingModalAfterActionError(payload) {
    var route = modalRouteFromUrl();
    if (payload && payload.bookingId && route && route.type === 'booking' && route.id === payload.bookingId) {
      var booking = bookingById(payload.bookingId);
      if (booking) renderBookingModal(booking);
    }
  }

  function actionSuccessMessage(action, result) {
    var message = successMessageForAction(action);
    if (!(result && result.notificationStatus === 'queued')) return message;
    return message.replace(/ and (the customer )?emailed/, '') + ' The email is queued; its delivery shows on the record.';
  }

  // Which record to show after an action: the invoice it touched, the
  // invoice already open for that booking, the booking, or the customer.
  function actionResultRoute(payload, result) {
    var activeRoute = modalRouteFromUrl();
    if (payload.action === 'createAndSendInvoice' && result && result.id) return { type: 'invoice', id: result.id };
    if (payload.invoiceId && invoiceById(payload.invoiceId)) return { type: 'invoice', id: payload.invoiceId };
    if (payload.bookingId && activeRoute && activeRoute.type === 'invoice' && invoiceById(activeRoute.id)?.booking_id === payload.bookingId) return { type: 'invoice', id: activeRoute.id };
    if (payload.bookingId && bookingById(payload.bookingId)) return { type: 'booking', id: payload.bookingId };
    if (payload.customerId && customerById(payload.customerId)) return { type: 'customer', id: payload.customerId };
    return null;
  }

  async function runAction(payload, confirmAction, trigger, options) {
    var opts = options || {};
    try {
      var confirmOptions = opts.confirm || confirmOptionsForAction(confirmAction || payload.action);
      if (confirmOptions && !opts.skipConfirm) {
        var confirmed = await openConfirmDialog(confirmOptions);
        if (!confirmed) return false;
      }
      var fromPanel = Boolean(trigger && ensureModalRoot().contains(trigger));
      setButtonBusy(trigger, true, busyLabelForAction(confirmAction || payload.action));
      showBookingActionProgress(trigger, payload.action);
      setSyncState('Saving', 'loading');
      var response = await adminAction(payload);
      if(state.page==='notifications') state.notificationActionSaved=true;
      if(payload.bookingId && state.bookingOperations) delete state.bookingOperations[payload.bookingId];
      markModalClean();
      invalidateCustomerActivityForPayload(payload);
      renderPatchedBookingModal(payload, response.result);
      if (typeof opts.beforeRefresh === 'function') opts.beforeRefresh();
      await refresh({ preserveScroll: true, force: true }).catch(function () { showToast('Saved. The view is stale; refresh to see the latest records.', 'info'); });
      if(state.page==='notifications') { showToast('Action saved.','success');return true; }
      var message = actionSuccessMessage(confirmAction || payload.action, response.result);
      // Actions started from a list row stay on the list; actions in a panel
      // re-render that record and say so inside it.
      var target = fromPanel ? actionResultRoute(payload, null) : null;
      if (target) {
        state.modalStep = null;
        state.modalNotice = { type: target.type, id: target.id, text: message };
        navigateToModal(target.type, target.id, { force: true });
      } else {
        showToast(message, 'success');
      }
      return true;
    } catch (error) {
      setSyncState('Action failed', 'error', error instanceof Error ? error.message : '');
      if (!modalIsDirty() && !state.modalStep) restoreBookingModalAfterActionError(payload);
      showToast(error instanceof Error ? error.message : 'The action could not be completed.', 'error');
      return false;
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
    await runAction({ action: action, slotId: slotId }, action, trigger, {
      skipConfirm: true,
      beforeRefresh: function () {
        state.selectedSlotId = null;
        slotEditorBaseline = '';
        history.replaceState(modalHistoryState(null, 0), '', PATHS.availability);
        setSlotEditorOpen(false, { restoreFocus: true });
      }
    });
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
      paidAmount: data.get('paidAmount') || null,
      voidReason: data.get('voidReason') || null
    };

    if (action === 'confirmBooking') {
      var validation = validateDateTimePair(String(data.get('date') || ''), String(data.get('startTime') || ''), String(data.get('endTime') || ''), data.get('dstFold'));
      if (validation.error) {
        showFieldError(errorEl, validation.error, form.elements.date);
        return;
      }
      payload.startAt = validation.startAt;
      payload.endAt = validation.endAt;
    }

    if (['confirmBooking','recordAgreedPrice'].includes(action)) {
      payload.serviceAmountCents = moneyCents(data.get('serviceAmount'));
      payload.travelAmountCents = moneyCents(String(data.get('travelAmount') || '').trim() || '0');
      payload.customerAgreed = data.get('customerAgreed') === 'on';
      payload.priceReason = data.get('priceReason') || null;
      if (payload.serviceAmountCents === null || payload.travelAmountCents === null || !payload.customerAgreed) {
        showFieldError(errorEl,'Enter a valid service amount and optional travel fee, then confirm customer agreement.'); return;
      }
    }
    if (['recordPayment','recordRefund','correctPayment'].includes(action)) {
      payload.paymentEntryId = data.get('paymentEntryId') || null;
      // Removing an entry is a correction to zero at the original time.
      var removingEntry = action === 'correctPayment' && (data.get('correctionMode') === 'remove' || moneyCents(payload.paidAmount, true) === 0);
      if (removingEntry) {
        payload.paidAmount = '0';
        payload.occurredAt = form.dataset.entryOccurredAt || null;
        payload.paymentMethod = form.dataset.entryMethod || 'unknown';
      } else {
        var local = String(data.get('occurredLocal') || '').split('T');
        payload.occurredAt = vilniusInstant(local[0] || '',local[1] || '',data.get('paymentFold'));
      }
      if (!payload.occurredAt || moneyCents(payload.paidAmount,action==='correctPayment') === null) {
        showFieldError(errorEl,'Enter the amount and when the money moved. If the time repeats when clocks go back, choose which one.');return;
      }
    }
    if (action==='resolvePaymentReconciliation' && data.get('disposition')==='already_refunded') {
      var refundLocal=String(data.get('refundOccurredLocal') || '').split('T');
      payload.refundedAt=vilniusInstant(refundLocal[0] || '',refundLocal[1] || '',data.get('refundFold'));
      payload.refundMethod=data.get('refundMethod');
      if(!payload.refundedAt || !payload.refundMethod){showFieldError(errorEl,'Enter the actual refund date and method.');return;}
    }
    ['notificationId','inquiryId','note','disposition'].forEach(function(key) { if(data.has(key)) payload[key]=data.get(key); });

    if (action === 'setCustomerLegalHold') {
      var holdDate = String(data.get('holdUntilDate') || '');
      var holdTime = String(data.get('holdUntilTime') || '');
      var holdUntil = isoFromVilniusInput(holdDate, holdTime, data.get('dstFold'));
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
      if (!viewIsLoaded('marketing')) {
        showFieldError(errorEl, 'Recipients are unavailable. Refresh the page before sending.');
        return;
      }
      if (consentedCustomers().length < 1) {
        showFieldError(errorEl, 'No customers currently have active marketing consent.');
        syncMarketingFormState(form);
        return;
      }
    }

    if (action === 'createAndSendInvoice') {
      var amount = String(data.get('amount') || '').replace(',', '.').trim();
      var dueDate = String(data.get('dueDate') || '').trim();
      if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) {
        showFieldError(errorEl, 'An invoice needs a positive agreed total.');
        return;
      }
      if (dueDate && (!isValidYmd(dueDate) || compareYmd(dueDate, todayYmd()) < 0)) {
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
      var billTo = data.get('billTo');
      if (billTo === 'company') {
        var company = {
          name: String(data.get('companyName') || '').trim(),
          code: String(data.get('companyCode') || '').trim(),
          vat: String(data.get('companyVatCode') || '').trim(),
          address: String(data.get('companyAddress') || '').trim()
        };
        var missingCompany = !company.name ? 'companyName' : !company.code ? 'companyCode' : !company.address ? 'companyAddress' : '';
        if (missingCompany) {
          showFieldError(errorEl, 'Enter the company name, company code and address.', form.elements[missingCompany]);
          return;
        }
        // Sent as the buyer block the server prints on the invoice.
        payload.billingDetails = [
          company.name,
          'Company code: ' + company.code,
          company.vat ? 'VAT code: ' + company.vat : '',
          company.address
        ].filter(Boolean).join('\n');
      } else if (billTo === 'private') {
        payload.billingDetails = String(data.get('privateAddress') || '').trim() || null;
      } else {
        payload.billingDetails = data.get('billingDetails') || null;
      }
    }

    if (['markBookingPaid', 'markInvoicePaid', 'updateInvoicePaidAmount'].includes(action)) {
      var paidAmount = String(data.get('paidAmount') || '').replace(',', '.').trim();
      if (!/^\d+(\.\d{1,2})?$/.test(paidAmount) || Number(paidAmount) <= 0) {
        showFieldError(errorEl, 'Use a valid paid amount, for example 100.00.', form.elements.paidAmount);
        return;
      }
      payload.paidAmount = paidAmount;
    }

    if (action === 'voidInvoice' && !String(data.get('voidReason') || '').trim()) {
      showFieldError(errorEl, 'Enter why it is being voided.', form.elements.voidReason);
      return;
    }
    if (action === 'voidInvoice' && form.hasAttribute('data-paid-warning')) {
      var voidPaid = await openConfirmDialog({
        title: 'This invoice is paid. Void it anyway?',
        message: 'The money stays recorded. If you return it, record a refund separately.',
        cancelLabel: 'Keep invoice',
        confirmLabel: 'Void invoice',
        danger: true
      });
      if (!voidPaid) return;
    }

    if (action === 'sendMarketingCampaign') {
      var marketingConfirmed = await openMarketingSendConfirm(String(payload.marketingSubject || ''), String(payload.marketingBody || ''));
      if (!marketingConfirmed) return;
      if (consentedCustomers().length < 1) {
        showFieldError(errorEl, 'The eligible audience is now empty. Nothing was sent.');
        syncMarketingFormState(form);
        return;
      }
    } else if (!form.hasAttribute('data-no-confirm')) {
      var confirmOptions = confirmOptionsForAction(action);
      if (confirmOptions) {
        var confirmed = await openConfirmDialog(confirmOptions);
        if (!confirmed) return;
      }
    }

    var fromPanel = ensureModalRoot().contains(form) && ensureModalRoot().dataset.mode === 'panel';
    try {
      setFormBusy(form, true, busyLabelForAction(action));
      showBookingActionProgress(form, action);
      setSyncState('Saving', 'loading');
      var response = await adminAction(payload);
      if(state.page==='notifications') state.notificationActionSaved=true;
      if(payload.bookingId && state.bookingOperations) delete state.bookingOperations[payload.bookingId];
      if(!ensureModalRoot().contains(form)) form.reset();
      markModalClean();
      if (fromPanel) state.modalStep = null;
      invalidateCustomerActivityForPayload(payload);
      renderPatchedBookingModal(payload, response.result);
      if (action === 'deleteCustomerProfile') {
        state.selectedCustomerId = null;
        history.replaceState(modalHistoryState(null, 0), '', modalUrl(null));
      }
      await refresh({ preserveScroll: true, force: true }).catch(function () { showToast('Saved. The view is stale; refresh to see the latest records.', 'info'); });
      if(state.page==='notifications') { showToast('Action saved.','success');return; }
      var message = actionSuccessMessage(action, response.result);
      if (action === 'deleteCustomerProfile') {
        closeModal({ restoreFocus: true });
        showToast(message, 'success');
        return;
      }
      var target = actionResultRoute(payload, response.result);
      if (target && fromPanel) {
        state.modalStep = null;
        state.modalNotice = { type: target.type, id: target.id, text: message };
        navigateToModal(target.type, target.id, { force: true });
      } else {
        if (target) navigateToModal(target.type, target.id, { force: true });
        showToast(message, 'success');
      }
    } catch (error) {
      setSyncState('Action failed', 'error', error instanceof Error ? error.message : '');
      if (!modalIsDirty() && !state.modalStep) restoreBookingModalAfterActionError(payload);
      if (errorEl && document.body.contains(errorEl)) {
        errorEl.textContent = error instanceof Error ? error.message : 'The action could not be completed.';
      } else {
        showToast(error instanceof Error ? error.message : 'The action could not be completed.', 'error');
      }
    } finally {
      if (document.body.contains(form)) {
        setFormBusy(form, false);
        var section=form.closest('.admin-booking-decision');if(section)section.removeAttribute('aria-busy');
        if (action === 'sendMarketingCampaign') syncMarketingFormState(form);
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
    syncSlotSubmitState();
  }

  function syncSlotSubmitState() {
    var form = $('[data-admin-slot-form]');
    var submit = form && $('[data-admin-slot-submit]', form);
    if (!form || !submit || form.getAttribute('aria-busy') === 'true') return;
    var slotId = String(($('[data-admin-slot-id]', form) || {}).value || '').trim();
    submit.disabled = Boolean(slotId) && Boolean(slotEditorBaseline) && slotEditorFormState(form) === slotEditorBaseline;
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
    syncSlotSubmitState();
    setSlotEditorOpen(true, { focus: false });
    var panel = $('.admin-slot-editor-panel', editor);
    if (panel) panel.scrollTop = draft.scrollTop;
    if (draft.activeName) focusElement($('[name="' + escapeSelectorValue(draft.activeName) + '"]', form));
  }

  function organizationSettingsFormState(form) {
    if (!form) return '';
    return JSON.stringify($all('input, textarea, select', form).map(function (control) {
      return {
        name: control.name || '',
        value: String(control.value || '').trim(),
        checked: Boolean(control.checked)
      };
    }));
  }

  function syncOrganizationSettingsSubmit() {
    var form = $('[data-organization-settings-form]');
    var submit = form && $('[data-organization-settings-submit]', form);
    if (!form || !submit || form.getAttribute('aria-busy') === 'true') return;
    var dirty = Boolean(organizationSettingsBaseline) && organizationSettingsFormState(form) !== organizationSettingsBaseline;
    submit.disabled = !dirty;
    var status = $('[data-organization-settings-status]', form);
    if (dirty && status && status.classList.contains('is-success')) {
      status.textContent = '';
      status.classList.remove('is-success');
    }
  }

  var ORGANIZATION_FIELD_LABELS = {
    seller_name: 'company name',
    seller_address: 'address',
    seller_company_code: 'company code',
    seller_vat_code: 'VAT code',
    seller_email: 'email',
    seller_phone: 'phone',
    bank_name: 'bank',
    bank_recipient_name: 'account holder',
    bank_account_iban: 'IBAN',
    bank_swift_bic: 'SWIFT / BIC',
    payment_instructions: 'payment note'
  };

  // Invoices can't be issued until the required details exist; say which.
  function renderOrganizationReadiness() {
    var chip = $('[data-organization-readiness]');
    if (!chip) return;
    var readiness = state.invoiceSettingsReadiness;
    var blocked = Boolean(readiness && readiness.ready === false);
    chip.hidden = !blocked;
    if (!blocked) {
      chip.textContent = '';
      return;
    }
    var missing = (Array.isArray(readiness.missing_fields) ? readiness.missing_fields : []).map(function (name) {
      var key = String(name || '').replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
      return ORGANIZATION_FIELD_LABELS[key] || key.replace(/_/g, ' ');
    }).filter(Boolean);
    chip.textContent = missing.length
      ? 'Missing before invoicing: ' + missing.join(', ')
      : 'Incomplete: invoices can’t be issued yet';
  }

  function setOrganizationField(form, name, value) {
    var field = form && form.elements && form.elements[name];
    if (field) field.value = value == null ? '' : String(value);
  }

  function renderOrganizationSettings(force) {
    var form = $('[data-organization-settings-form]');
    if (!form) return;
    if (!force && organizationSettingsBaseline && organizationSettingsFormState(form) !== organizationSettingsBaseline) return;
    var settings = state.organizationSettings || {};
    setOrganizationField(form, 'sellerName', settings.seller_name);
    setOrganizationField(form, 'sellerAddress', settings.seller_address);
    setOrganizationField(form, 'sellerCompanyCode', settings.seller_company_code);
    setOrganizationField(form, 'sellerVatCode', settings.seller_vat_code);
    setOrganizationField(form, 'sellerEmail', settings.seller_email);
    setOrganizationField(form, 'sellerPhone', settings.seller_phone);
    setOrganizationField(form, 'bankName', settings.bank_name);
    setOrganizationField(form, 'bankAccountIban', settings.bank_account_iban);
    setOrganizationField(form, 'bankSwiftBic', settings.bank_swift_bic);
    setOrganizationField(form, 'bankRecipientName', settings.bank_recipient_name);
    setOrganizationField(form, 'paymentInstructions', settings.payment_instructions);
    var status = $('[data-organization-settings-status]', form);
    if (status) {
      status.textContent = '';
      status.classList.remove('is-success');
    }
    organizationSettingsBaseline = organizationSettingsFormState(form);
    syncOrganizationSettingsSubmit();
    renderOrganizationReadiness();
  }

  function setOrganizationLoading(loading) {
    var invoiceLoading = $('[data-organization-invoice-loading]');
    var invoiceContent = $('[data-organization-invoice-content]');
    var scheduleLoading = $('[data-organization-schedule-loading]');
    var scheduleContent = $('[data-organization-schedule-content]');
    if (invoiceLoading) invoiceLoading.hidden = !loading;
    if (invoiceContent) invoiceContent.hidden = loading;
    if (scheduleLoading) scheduleLoading.hidden = !loading;
    if (scheduleContent) scheduleContent.hidden = loading;
  }

  function renderOrganizationPage() {
    var loaded = viewIsLoaded('organization');
    setOrganizationLoading(!loaded);
    if (!loaded) return;
    renderOrganizationSettings();
    renderConfirmationSchedule();
  }

  async function handleOrganizationSettingsSubmit(event) {
    event.preventDefault();
    var form = event.currentTarget;
    var status = $('[data-organization-settings-status]', form);
    clearFormValidation(form, status);
    if (!form.reportValidity()) return;
    if (!staffHasRole(state.staff, 'owner') || !staffHasAccess(state.staff, 'staff_users.manage', ['owner'])) {
      showFieldError(status, 'Only the organization owner can change these settings.');
      return;
    }

    var data = new FormData(form);
    var iban = String(data.get('bankAccountIban') || '').replace(/\s+/g, '').toUpperCase();
    var swiftBic = String(data.get('bankSwiftBic') || '').replace(/\s+/g, '').toUpperCase();
    if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) {
      showFieldError(status, 'Enter a valid IBAN.', form.elements.bankAccountIban);
      return;
    }
    if (swiftBic && !/^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(swiftBic)) {
      showFieldError(status, 'Enter a valid 8 or 11 character SWIFT or BIC.', form.elements.bankSwiftBic);
      return;
    }

    try {
      setFormBusy(form, true, 'Saving…');
      setSyncState('Saving', 'loading');
      var response = await adminAction({
        action: 'updateOrganizationSettings',
        sellerName: data.get('sellerName'),
        sellerAddress: data.get('sellerAddress'),
        sellerCompanyCode: data.get('sellerCompanyCode'),
        sellerVatCode: data.get('sellerVatCode') || null,
        sellerEmail: data.get('sellerEmail'),
        sellerPhone: data.get('sellerPhone') || null,
        bankName: data.get('bankName'),
        bankAccountIban: iban,
        bankSwiftBic: swiftBic || null,
        bankRecipientName: data.get('bankRecipientName'),
        paymentInstructions: data.get('paymentInstructions') || null
      });
      if (response.result && typeof response.result === 'object') {
        state.organizationSettings = response.result;
      }
      renderOrganizationSettings(true);
      var savedSettingsStatus = $('[data-organization-settings-status]', form);
      if (savedSettingsStatus) {
        savedSettingsStatus.textContent = 'Saved.';
        savedSettingsStatus.classList.add('is-success');
      }
      state.lastSuccessfulRefresh = Date.now();
      setSyncState('Synced', 'synced');
      renderOperationalStatus();
    } catch (error) {
      setSyncState('Action failed', 'error', error instanceof Error ? error.message : '');
      if (status) status.textContent = error instanceof Error ? error.message : 'Invoice details could not be saved. Try again.';
    } finally {
      if (document.body.contains(form)) {
        setFormBusy(form, false);
        syncOrganizationSettingsSubmit();
      }
    }
  }

  function setupOrganizationEvents() {
    var settingsForm = $('[data-organization-settings-form]');
    var scheduleForm = $('[data-confirmation-schedule-form]');
    if (settingsForm) {
      settingsForm.addEventListener('submit', handleOrganizationSettingsSubmit);
      settingsForm.addEventListener('input', syncOrganizationSettingsSubmit);
      settingsForm.addEventListener('change', syncOrganizationSettingsSubmit);
    }
    if (scheduleForm) {
      $all('[data-confirmation-day]', scheduleForm).forEach(function (row) {
        var toggle = $('[data-confirmation-day-enabled]', row);
        if (toggle) toggle.addEventListener('change', function () { updateConfirmationDayState(row); });
      });
      bindConfirmationScheduleChanges(scheduleForm);
      scheduleForm.addEventListener('submit', handleConfirmationScheduleSubmit);
    }
    initCustomControls($('[data-page-root]'));
    renderOrganizationPage();
  }

  function confirmationScheduleHours() {
    var settings = state.confirmationSettings || {};
    return Array.isArray(settings.hours) ? settings.hours : [];
  }

  function confirmationScheduleFormHtml() {
    return '<div class="admin-modal-header">' +
        '<div>' +
          '<h2>Booking requests</h2>' +
          '<p>How long you have to accept a new request, and when that time counts.</p>' +
        '</div>' +
        '<button class="admin-preview-close admin-icon-button" type="button" data-admin-modal-close aria-label="Close booking request settings" title="Close">' + ICON_CLOSE + '</button>' +
      '</div>' +
      '<form class="admin-booking-request-form admin-form-plain" data-confirmation-schedule-form novalidate>' +
        bookingRequestFieldsHtml() +
        '<div class="admin-modal-footer">' +
          '<p class="admin-form-error" data-confirmation-schedule-status role="status" aria-live="polite"></p>' +
          '<button class="admin-button admin-button-primary" type="submit" data-confirmation-schedule-submit disabled>Save</button>' +
        '</div>' +
      '</form>';
  }

  function renderConfirmationScheduleModal() {
    if (!staffHasAccess(state.staff, 'confirmation_schedule.manage', ['owner'])) return;
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
    bindConfirmationScheduleChanges(form);
    form.addEventListener('submit', handleConfirmationScheduleSubmit);
  }

  // Reads every named control, disabled ones included: the form is fully
  // disabled while saving, which FormData would silently skip.
  function confirmationScheduleSnapshot(form) {
    return JSON.stringify($all('input[name], select[name], textarea[name]', form).map(function (control) {
      return [control.name, control.type === 'checkbox' ? control.checked : String(control.value || '')];
    }));
  }

  // Save only reacts once something changed; a new edit clears "Saved".
  function syncConfirmationScheduleSubmit(form) {
    var target = form || $('[data-confirmation-schedule-form]');
    var submit = target && $('[data-confirmation-schedule-submit]', target);
    if (!target || !submit || target.getAttribute('aria-busy') === 'true') return;
    var dirty = Boolean(target.dataset.scheduleBaseline) && confirmationScheduleSnapshot(target) !== target.dataset.scheduleBaseline;
    submit.disabled = !dirty;
    var status = $('[data-confirmation-schedule-status]', target);
    if (dirty && status && status.classList.contains('is-success')) {
      status.textContent = '';
      status.classList.remove('is-success');
    }
  }

  function bindConfirmationScheduleChanges(form) {
    if (!form || form.dataset.scheduleChangesBound) return;
    form.dataset.scheduleChangesBound = 'true';
    form.addEventListener('input', function () { syncConfirmationScheduleSubmit(form); });
    form.addEventListener('change', function () { syncConfirmationScheduleSubmit(form); });
  }

  // Keeps a stored time that is off the 15-minute grid instead of dropping it.
  function setTimeSelectValue(select, value) {
    if (!select) return;
    if (select.tagName === 'SELECT' && value && !Array.from(select.options).some(function (option) { return option.value === value; })) {
      var extra = document.createElement('option');
      extra.value = value;
      extra.textContent = value;
      var before = Array.from(select.options).find(function (option) { return option.value > value; });
      select.insertBefore(extra, before || null);
    }
    select.value = value;
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
    var requiredMarkers = $all('[data-confirmation-time-required]', row);
    var enabled = Boolean(toggle && toggle.checked);
    var editable = row.dataset.confirmationEditable === 'true';
    var required = editable && enabled;
    row.classList.toggle('is-disabled', !enabled);
    if (start) {
      start.disabled = !required;
      start.required = required;
    }
    if (end) {
      end.disabled = !required;
      end.required = required;
    }
    requiredMarkers.forEach(function (marker) {
      marker.hidden = !required;
    });
  }

  function renderConfirmationSchedule(force) {
    var form = $('[data-confirmation-schedule-form]');
    if (!form) return;
    var snapshot=function(){return confirmationScheduleSnapshot(form);};
    if (!force && form.dataset.scheduleBaseline && snapshot()!==form.dataset.scheduleBaseline) return;

    var settings = state.confirmationSettings;
    var canEdit = staffHasAccess(
      state.staff,
      'confirmation_schedule.manage',
      ['owner']
    );
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
      setTimeSelectValue(start, confirmationTimeValue(entry && entry.opens_at, '09:00'));
      setTimeSelectValue(end, confirmationTimeValue(entry && entry.closes_at, '16:00'));
      updateConfirmationDayState(row);
    });

    refreshCustomControls(form);
    form.dataset.scheduleBaseline=snapshot();
    syncConfirmationScheduleSubmit(form);
  }

  async function handleConfirmationScheduleSubmit(event) {
    event.preventDefault();
    var form = event.currentTarget;
    var status = $('[data-confirmation-schedule-status]', form);
    var duration = Number(($('[data-confirmation-duration]', form) || {}).value || 0);

    if (!staffHasAccess(state.staff, 'confirmation_schedule.manage', ['owner'])) {
      if (status) status.textContent = 'Only the organization owner can change these settings.';
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
      showFieldError(status, 'Choose how long you have to respond.', $('[data-confirmation-duration]', form));
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
      setFormBusy(form, true, 'Saving…');
      setSyncState('Saving', 'loading');
      var response = await adminAction({
        action: 'updateConfirmationSchedule',
        confirmationDurationMinutes: duration,
        confirmationSchedule: schedule
      });
      cancelDashboardLoad('organization');
      if (response.result && typeof response.result === 'object') {
        state.confirmationSettings = response.result;
      }
      state.loadedViews.organization = { loadedAt: Date.now() };
      markModalClean();
      renderConfirmationSchedule(true);
      var savedStatus = $('[data-confirmation-schedule-status]');
      if (savedStatus) {
        savedStatus.textContent = 'Saved. New requests use these settings.';
        savedStatus.classList.add('is-success');
      }
      state.lastSuccessfulRefresh = Date.now();
      setSyncState('Synced', 'synced');
      renderOperationalStatus();
    } catch (error) {
      setSyncState('Action failed', 'error', error instanceof Error ? error.message : '');
      if (status) status.textContent = error instanceof Error ? error.message : 'Booking request settings could not be saved. Try again.';
    } finally {
      if (document.body.contains(form)) {
        setFormBusy(form, false);
        syncConfirmationScheduleSubmit(form);
      }
    }
  }

  function canManageOtherStaffAvailability() {
    return staffHasRole(state.staff, 'owner') || staffHasRole(state.staff, 'admin');
  }

  function dayScheduleStaffOptions(selectedId) {
    var canManageOthers = canManageOtherStaffAvailability();
    var candidates = state.staffList.filter(function (staff) {
      return staff.is_active && rolesForStaff(staff).some(function (role) {
        return ['owner', 'admin', 'inspector'].includes(role);
      });
    });
    if (!canManageOthers) {
      candidates = candidates.filter(function (staff) { return staff.id === state.staff.id; });
    }
    return candidates.map(function (staff) {
      var selected = staff.id === selectedId ? ' selected' : '';
      return '<option value="' + escapeHtml(staff.id) + '"' + selected + '>' +
        escapeHtml(staff.display_name) +
      '</option>';
    }).join('');
  }

  function dayScheduleRanges(startTime, endTime, inspectionMinutes, bufferMinutes) {
    if (!isValidHm(startTime) || !isValidHm(endTime)) return [];
    var start = timeToMinutes(startTime);
    var end = timeToMinutes(endTime);
    var duration = Number(inspectionMinutes);
    var buffer = Number(bufferMinutes);
    if (
      end <= start ||
      !Number.isInteger(duration) ||
      !Number.isInteger(buffer) ||
      duration <= 0 ||
      buffer < 0
    ) return [];

    var ranges = [];
    var cursor = start;
    while (cursor + duration <= end && ranges.length < 96) {
      ranges.push({
        start: minutesToTime(cursor),
        end: minutesToTime(cursor + duration)
      });
      cursor += duration + buffer;
    }
    return ranges;
  }

  function dayScheduleResultHtml(result) {
    if (!result || typeof result !== 'object') return '';
    var created = Number(result.created_count) || 0;
    var skipped = Number(result.skipped_count) || 0;
    var conflicts = Array.isArray(result.conflicts) ? result.conflicts : [];
    var reasonLabels = {
      existing_availability: 'overlaps existing availability',
      existing_booking: 'overlaps an active booking',
      blocked_time: 'overlaps blocked time'
    };
    var conflictHtml = conflicts.map(function (conflict) {
      var label = reasonLabels[conflict.reason_code] || 'could not be created';
      return '<li><time>' + escapeHtml(formatTime(conflict.start_at)) + '-' + escapeHtml(formatTime(conflict.end_at)) + '</time><span>' + escapeHtml(label) + '</span></li>';
    }).join('');
    var summary = created === 1 ? '1 availability slot created.' : created + ' availability slots created.';
    if (skipped) summary += ' ' + skipped + (skipped === 1 ? ' slot was skipped.' : ' slots were skipped.');

    return '<section class="admin-day-schedule-result" data-tone="' + (created ? 'success' : 'warning') + '" aria-labelledby="admin-day-schedule-result-title">' +
      '<strong id="admin-day-schedule-result-title">' + escapeHtml(summary) + '</strong>' +
      (conflictHtml
        ? '<details class="admin-disclosure" open><summary>Review conflicts</summary><ul>' + conflictHtml + '</ul></details>'
        : '') +
    '</section>';
  }

  function dayScheduleFormHtml() {
    var defaultDate = addDaysYmd(todayYmd(), 1);
    var selectedStaffId = dayScheduleLastResult && dayScheduleLastResult.assigned_staff_id
      ? String(dayScheduleLastResult.assigned_staff_id)
      : String(state.staff && state.staff.id || '');
    var canManageOthers = canManageOtherStaffAvailability();
    var staffOptionsHtml = dayScheduleStaffOptions(selectedStaffId);

    return '<div class="admin-modal-header">' +
        '<div>' +
          '<h2>Create day schedule</h2>' +
        '</div>' +
        '<button class="admin-preview-close admin-icon-button" type="button" data-admin-modal-close aria-label="Close day schedule" title="Close">' + ICON_CLOSE + '</button>' +
      '</div>' +
      dayScheduleResultHtml(dayScheduleLastResult) +
      '<form class="admin-day-schedule-form" data-admin-day-schedule-form novalidate>' +
        '<div class="admin-day-schedule-core-fields">' +
          '<label><span class="admin-field-label">Date <span class="admin-required-marker" aria-hidden="true">*</span></span><input name="date" type="date" value="' + escapeHtml(defaultDate) + '" required data-admin-day-schedule-date></label>' +
          '<label><span class="admin-field-label">Start time <span class="admin-required-marker" aria-hidden="true">*</span></span><input name="startTime" type="time" value="09:00" min="00:00" max="23:45" step="900" required data-admin-day-schedule-start></label>' +
          '<label><span class="admin-field-label">End time <span class="admin-required-marker" aria-hidden="true">*</span></span><input name="endTime" type="time" value="18:00" min="00:00" max="23:45" step="900" required data-admin-day-schedule-end></label>' +
          '<label class="admin-day-schedule-inspector"><span class="admin-field-label">Inspector <span class="admin-required-marker" aria-hidden="true">*</span></span><span class="admin-select-wrap"><select name="assignedStaffId" required data-admin-day-schedule-staff' + (canManageOthers ? '' : ' disabled') + '>' + staffOptionsHtml + '</select></span></label>' +
          (!canManageOthers ? '<input type="hidden" name="assignedStaffId" value="' + escapeHtml(selectedStaffId) + '">' : '') +
        '</div>' +
        '<details class="admin-disclosure admin-day-schedule-advanced">' +
          '<summary>Duration settings</summary>' +
          '<div>' +
            '<label>Inspection duration<span class="admin-select-wrap"><select name="inspectionDurationMinutes" data-admin-day-schedule-duration>' +
              '<option value="30">30 minutes</option>' +
              '<option value="45">45 minutes</option>' +
              '<option value="60" selected>1 hour</option>' +
              '<option value="90">1 hour 30 minutes</option>' +
              '<option value="120">2 hours</option>' +
            '</select></span></label>' +
            '<label>Travel buffer<span class="admin-select-wrap"><select name="bufferDurationMinutes" data-admin-day-schedule-buffer>' +
              '<option value="0">No buffer</option>' +
              '<option value="30">30 minutes</option>' +
              '<option value="45">45 minutes</option>' +
              '<option value="60" selected>1 hour</option>' +
              '<option value="90">1 hour 30 minutes</option>' +
              '<option value="120">2 hours</option>' +
            '</select></span></label>' +
          '</div>' +
        '</details>' +
        '<div class="admin-day-schedule-preview" data-admin-day-schedule-preview role="status" aria-live="polite"></div>' +
        '<div class="admin-form-error" data-admin-day-schedule-status role="status" aria-live="polite"></div>' +
        '<div class="admin-action-buttons admin-modal-actions">' +
          '<button class="admin-button admin-button-primary" type="submit">Create availability</button>' +
          '<button class="admin-button admin-button-secondary" type="button" data-admin-modal-close>Cancel</button>' +
        '</div>' +
      '</form>';
  }

  function updateDaySchedulePreview(form) {
    if (!form) return;
    var start = String(($('[data-admin-day-schedule-start]', form) || {}).value || '');
    var end = String(($('[data-admin-day-schedule-end]', form) || {}).value || '');
    var duration = Number(($('[data-admin-day-schedule-duration]', form) || {}).value || 0);
    var buffer = Number(($('[data-admin-day-schedule-buffer]', form) || {}).value || 0);
    var ranges = dayScheduleRanges(start, end, duration, buffer);
    var preview = $('[data-admin-day-schedule-preview]', form);
    if (!preview) return;
    if (!ranges.length) {
      preview.innerHTML = '<strong>No slots fit this workday.</strong><span>Extend the workday or shorten the inspection duration.</span>';
      preview.dataset.tone = 'warning';
      return;
    }

    var visibleRanges = ranges.slice(0, 8).map(function (range) {
      return '<li><time>' + escapeHtml(range.start) + '</time><span aria-hidden="true">→</span><time>' + escapeHtml(range.end) + '</time></li>';
    }).join('');
    preview.dataset.tone = 'neutral';
    preview.innerHTML = '<details class="admin-disclosure"><summary><strong>' + ranges.length + (ranges.length === 1 ? ' bookable slot' : ' bookable slots') + '</strong>' +
      '<span>' + escapeHtml(ranges[0].start + '–' + ranges[ranges.length - 1].end) + '</span></summary>' +
      '<ol>' + visibleRanges + '</ol>' +
      (ranges.length > 8 ? '<span>+' + (ranges.length - 8) + ' more</span>' : '') + '</details>';
  }

  function renderDayScheduleModal() {
    if (!staffHasAccess(state.staff, 'operations.manage', ['owner', 'admin', 'inspector'])) return;
    var modal = openModal(dayScheduleFormHtml(), 'md');
    var form = $('[data-admin-day-schedule-form]', modal);
    if (!form) return;
    updateDaySchedulePreview(form);
    $all('input, select', form).forEach(function (control) {
      control.addEventListener('change', function () {
        if (control.matches('[data-admin-day-schedule-start], [data-admin-day-schedule-end]')) {
          normalizeTimeControl(control);
        }
        updateDaySchedulePreview(form);
      });
    });
    form.addEventListener('submit', handleDayScheduleSubmit);
    refreshCustomControls(form);
  }

  async function handleDayScheduleSubmit(event) {
    event.preventDefault();
    var form = event.currentTarget;
    var status = $('[data-admin-day-schedule-status]', form);
    clearFormValidation(form, status);

    if (!viewIsLoaded('schedule')) {
      showFieldError(status, 'Availability is still loading. Try again in a moment.', $('[data-admin-day-schedule-date]', form));
      return;
    }
    if (!staffHasAccess(state.staff, 'operations.manage', ['owner', 'admin', 'inspector'])) {
      showFieldError(status, 'Your admin role cannot create availability.', $('[data-admin-day-schedule-date]', form));
      return;
    }

    normalizeTimeControl($('[data-admin-day-schedule-start]', form));
    normalizeTimeControl($('[data-admin-day-schedule-end]', form));
    var data = new FormData(form);
    var dateValue = String(data.get('date') || '');
    var startTime = String(data.get('startTime') || '');
    var endTime = String(data.get('endTime') || '');
    var assignedStaffId = canManageOtherStaffAvailability()
      ? String(data.get('assignedStaffId') || '')
      : String(state.staff && state.staff.id || '');
    var inspectionDuration = Number(data.get('inspectionDurationMinutes'));
    var bufferDuration = Number(data.get('bufferDurationMinutes'));
    var validation = validateDateTimePair(dateValue, startTime, endTime, data.get('dstFold'));
    var ranges = dayScheduleRanges(startTime, endTime, inspectionDuration, bufferDuration);

    if (validation.error) {
      showFieldError(status, validation.error, $('[data-admin-day-schedule-date]', form));
      return;
    }
    if (!assignedStaffId) {
      showFieldError(status, 'Choose an inspector.', $('[data-admin-day-schedule-staff]', form));
      return;
    }
    if (
      !Number.isInteger(inspectionDuration) ||
      inspectionDuration < 15 ||
      inspectionDuration > 480 ||
      inspectionDuration % SLOT_STEP_MINUTES !== 0
    ) {
      showFieldError(status, 'Choose a valid inspection duration.', $('[data-admin-day-schedule-duration]', form));
      return;
    }
    if (
      !Number.isInteger(bufferDuration) ||
      bufferDuration < 0 ||
      bufferDuration > 240 ||
      bufferDuration % SLOT_STEP_MINUTES !== 0
    ) {
      showFieldError(status, 'Choose a valid travel buffer.', $('[data-admin-day-schedule-buffer]', form));
      return;
    }
    if (!ranges.length) {
      showFieldError(status, 'The selected workday is shorter than one inspection.', $('[data-admin-day-schedule-end]', form));
      return;
    }

    setFormBusy(form, true, 'Creating…');
    setSyncState('Saving', 'loading');
    var response;
    try {
      var occurrences=ranges.map(function(range){
        var start=range.start,end=range.end;
        var pair=validateDateTimePair(dateValue,start,end,data.get('dstFold'));
        if(pair.error) throw new Error(pair.error);
        return {date:dateValue,startTime:start,endTime:end,startAt:pair.startAt,endAt:pair.endAt,fold:data.get('dstFold') || null};
      });
      response=await adminAction({action:'createSlotSeries',serviceCode:'all',assignedStaffId:assignedStaffId,occurrences:occurrences});
      dayScheduleLastResult={created_count:response.result?.created || 0,skipped_count:0};
      state.calendarAnchor = dateValue;
      markModalClean();
      var created = Number(dayScheduleLastResult && dayScheduleLastResult.created_count) || 0;
      var skipped = Number(dayScheduleLastResult && dayScheduleLastResult.skipped_count) || 0;
      var message = created + (created === 1 ? ' availability slot created.' : ' availability slots created.');
      if (skipped) message += ' ' + skipped + (skipped === 1 ? ' conflict skipped.' : ' conflicts skipped.');
      setSyncState('Saved', 'success');
      showToast(message, created ? 'success' : 'info');
      if (created > 0) {
        await closeModalRoute({ force: true });
      } else {
        var existingResult = $('[data-tone][aria-labelledby="admin-day-schedule-result-title"]', form.parentElement);
        if (existingResult) existingResult.remove();
        form.insertAdjacentHTML('beforebegin', dayScheduleResultHtml(dayScheduleLastResult));
      }
    } catch (error) {
      setSyncState('Action failed', 'error', error instanceof Error ? error.message : '');
      if (status) status.textContent = error instanceof Error ? error.message : 'Could not create the day schedule.';
      setFormBusy(form, false);
      return;
    }

    try {
      await refresh({ preserveScroll: true, force: true });
    } catch (error) {
      setSyncState('Refresh failed', 'error', error instanceof Error ? error.message : '');
      if (document.body.contains(form) && status) {
        status.textContent = 'The day schedule was created, but the calendar could not be refreshed. Reload Availability to see the saved slots.';
      }
      showToast('Availability was saved, but the calendar could not be refreshed.', 'error');
    } finally {
      if (document.body.contains(form)) setFormBusy(form, false);
    }
  }

  function renderAvailabilityPage() {
    var openButton = $('[data-admin-slot-open]');
    var dayScheduleButton = $('[data-admin-day-schedule-open]');
    var canManageAvailability = staffHasAccess(
      state.staff,
      'operations.manage',
      ['owner', 'admin', 'inspector']
    );
    if (openButton) openButton.disabled = !canManageAvailability;
    if (dayScheduleButton) dayScheduleButton.disabled = !canManageAvailability;
    renderAvailabilityOptions();
    syncSlotFormFromSelection();
    renderCalendar();
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
    if (repeatWrap) repeatWrap.hidden = !enabled || !(repeatToggle && repeatToggle.checked);
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
    var slotId = $('[data-admin-slot-id]', form);
    var serviceSelect = $('[data-admin-slot-service]', form);
    var staffSelect = $('[data-admin-slot-staff]', form);
    var dateInput = $('[data-admin-slot-date]', form);
    var startSelect = $('[data-admin-slot-start]', form);
    var endSelect = $('[data-admin-slot-end]', form);
    var submit = $('[data-admin-slot-submit]', form);
    var del = $('[data-admin-slot-delete]', form);
    var repeatToggle = $('[data-admin-repeat-toggle]', form);

    if (slot) {
      var service = serviceById(slot.service_id);
      if (!state.hasRendered) state.calendarAnchor = formatDate(slot.start_at);
      if (title) title.textContent = 'Edit slot';
      if (slotId) slotId.value = slot.id;
      if (serviceSelect) serviceSelect.value = serviceSelect.tagName === 'SELECT' && service ? service.code : 'all';
      if (staffSelect) staffSelect.value = slot.assigned_staff_id || '';
      if (dateInput) dateInput.value = formatDate(slot.start_at);
      if (startSelect) startSelect.dataset.pendingDefault = formatTime(slot.start_at);
      rebuildSlotTimeOptions(true);
      if (startSelect) startSelect.value = formatTime(slot.start_at);
      if (endSelect) endSelect.value = formatTime(slot.end_at);
      if (submit) submit.textContent = 'Update slot';
      if (del) del.hidden = false;
      if (repeatToggle) repeatToggle.checked = false;
      setRepeatControlsEnabled(false);
      refreshCustomControls(form);
      captureSlotEditorBaseline();
      setSlotEditorOpen(true, { focus: false });
      return;
    }

    if (title) title.textContent = 'New slot';
    if (slotId) slotId.value = '';
    if (submit) submit.textContent = 'Create slot';
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
      return '<option value="' + escapeHtml(staff.id) + '"' + (staff.id === selectedStaff ? ' selected' : '') + '>' + escapeHtml(staff.display_name) + '</option>';
    }).join('');

    if (!dateInput.value) {
      var defaults = defaultSlotDateTime();
      dateInput.value = defaults.date;
      startSelect.dataset.pendingDefault = defaults.time;
    }

    rebuildSlotTimeOptions(true);
    refreshCustomControls(document);
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
      endInput.value = minutesToTime(timeToMinutes(startInput.value) + DEFAULT_SLOT_DURATION_MINUTES);
    }
    refreshCustomControls(document);
  }

  async function handleSlotSubmit(event) {
    event.preventDefault();
    var form = event.currentTarget;
    var errorEl = $('[data-admin-slot-error]', form);
    if (!viewIsLoaded('schedule')) {
      showFieldError(errorEl, 'Availability is still loading. Try again in a moment.', $('[data-admin-slot-date]', form));
      return;
    }
    normalizeTimeControl($('[data-admin-slot-start]', form));
    normalizeTimeControl($('[data-admin-slot-end]', form));
    var data = new FormData(form);
    var dateValue = String(data.get('date') || '');
    var startTime = String(data.get('startTime') || '');
    var endTime = String(data.get('endTime') || '');
    var validation = validateDateTimePair(dateValue, startTime, endTime, data.get('dstFold'));
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
          endAt: validation.endAt
        });
        await refresh({ preserveScroll: true, force: true });
        if (errorEl) {
          errorEl.textContent = 'Slot updated.';
          errorEl.classList.add('is-success');
        }
        captureSlotEditorBaseline();
        showToast('Availability slot updated.', 'success');
      } catch (error) {
        setSyncState('Action failed', 'error', error instanceof Error ? error.message : '');
        if (errorEl) errorEl.textContent = error instanceof Error ? error.message : 'Could not update slot.';
      } finally {
        if (document.body.contains(form)) setFormBusy(form, false);
      }
      return;
    }

    var weeks = data.get('repeatWeekly') === 'on' ? Number(data.get('repeatWeeks')) || 1 : 1;
    var occurrences = [];
    for (var i=0;i<weeks;i++) {
      var occurrenceDate = addDaysYmd(dateValue,i*7);
      var occurrence = validateDateTimePair(occurrenceDate,startTime,endTime,data.get('dstFold'));
      if (occurrence.error) { showFieldError(errorEl,occurrenceDate+': '+occurrence.error); return; }
      occurrences.push({date:occurrenceDate,startTime:startTime,endTime:endTime,startAt:occurrence.startAt,endAt:occurrence.endAt,fold:data.get('dstFold') || null});
    }
    setFormBusy(form,true,'Publishing availability'); setSyncState('Saving','loading');
    try {
      var response = await adminAction({action:'createSlotSeries',serviceCode:data.get('serviceCode') || 'all',assignedStaffId:data.get('assignedStaffId') || null,occurrences:occurrences});
      state.selectedSlotId=null; slotEditorBaseline='';
      history.replaceState(modalHistoryState(null,0),'',PATHS.availability);
      setSlotEditorOpen(false,{restoreFocus:true});
      await refresh({preserveScroll:true,force:true}).catch(function(){showToast('Availability saved. Refresh to load the updated schedule.','info');});
      showToast((response.result && response.result.created || weeks)+' availability slots published.','success');
    } catch(error) {
      setSyncState('Action failed','error');
      showFieldError(errorEl,error instanceof Error ? error.message : 'No slots were created.');
    } finally { if(document.body.contains(form)) setFormBusy(form,false); }
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
      if (!slotIsBookable(slot)) return false;
      if (completedSlotIds[slot.id]) return false;
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
          '<div class="admin-slot-meta">' + escapeHtml(service)  + ' · ' + escapeHtml(assignee ? assignee.display_name : 'Unassigned')  + ' · ' + escapeHtml(statusLabel(status) + seriesMeta) + '</div>' +
          (booking ? '<a class="admin-inline-link" href="' + PATHS.bookings + '?booking=' + encodeURIComponent(booking.id) + '">' + escapeHtml(booking.public_reference + ' · ' + booking.customer_name) + '</a>' : '') +
        '</div>' +
        '<div class="admin-slot-actions">' +
          (!hasActiveBooking ? '<button class="admin-button admin-button-danger" type="button" data-delete-slot="' + escapeHtml(slot.id) + '">Cancel</button>' : '') +
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

  function applyBookingFilterParameters(params) {
    var previousSignature = state.bookingQuerySignature;
    var allowedStatuses = ['pending', 'confirmed', 'completed', 'rejected', 'cancelled', 'expired'];
    var allowedDateFields = ['received', 'inspection', 'confirmed', 'completed', 'rejected', 'cancelled', 'expired'];
    state.filter = 'all';
    state.bookingSearch = String(params.get('search') || '').slice(0, 200);
    state.bookingStatuses = String(params.get('statuses') || '').split(',').filter(function (status) {
      return allowedStatuses.includes(status);
    });
    state.bookingDateField = allowedDateFields.includes(params.get('dateField')) ? params.get('dateField') : 'received';
    state.bookingDateFrom = isValidYmd(params.get('from')) ? params.get('from') : '';
    state.bookingDateTo = isValidYmd(params.get('to')) ? params.get('to') : '';
    state.bookingSort = ['asc', 'desc'].includes(params.get('sort')) ? params.get('sort') : 'desc';

    var legacyFilter = params.get('filter');
    if (!state.bookingStatuses.length && ['pending', 'confirmed', 'completed'].includes(legacyFilter)) {
      state.bookingStatuses = [legacyFilter];
    }
    if (legacyFilter === 'today' && !state.bookingDateFrom && !state.bookingDateTo) {
      state.bookingStatuses = ['pending', 'confirmed', 'completed'];
      state.bookingDateField = 'inspection';
      state.bookingDateFrom = todayYmd();
      state.bookingDateTo = todayYmd();
    }
    if (previousSignature !== bookingFilterSignature()) {
      state.bookingQueryTotal = 0;
      state.bookingQueryHasMore = false;
      state.bookingQueryOffset = 0;
      state.bookingQuerySignature = '';
    }
  }

  function applyInvoiceFilterParameters(params) {
    var previousSignature = state.invoiceQuerySignature;
    var parseList = function (name, allowed) {
      return String(params.get(name) || '').split(',').filter(function (value) { return allowed.includes(value); });
    };
    state.invoiceSearch = String(params.get('search') || '').slice(0, 200);
    state.invoiceStatuses = parseList('invoiceStatuses', ['draft', 'issued', 'payment', 'void']);
    state.invoicePaymentStatuses = parseList('paymentStatuses', ['unpaid', 'paid', 'void']);
    state.invoiceEmailStatuses = parseList('emailStatuses', ['not_sent', 'sent', 'failed', 'skipped']);
    state.invoiceDateField = ['created', 'issued', 'due', 'paid', 'voided'].includes(params.get('dateField')) ? params.get('dateField') : 'created';
    state.invoiceDateFrom = isValidYmd(params.get('from')) ? params.get('from') : '';
    state.invoiceDateTo = isValidYmd(params.get('to')) ? params.get('to') : '';
    state.invoiceAmountMin = validMoneyFilter(params.get('amountMin'));
    state.invoiceAmountMax = validMoneyFilter(params.get('amountMax'));
    state.invoiceSort = params.get('sort') === 'asc' ? 'asc' : 'desc';
    var legacyFilter = params.get('filter');
    if (legacyFilter === 'unpaid' && !state.invoicePaymentStatuses.length) state.invoicePaymentStatuses = ['unpaid'];
    if (legacyFilter === 'paid' && !state.invoicePaymentStatuses.length) state.invoicePaymentStatuses = ['paid'];
    if (legacyFilter === 'void' && !state.invoiceStatuses.length) state.invoiceStatuses = ['void'];
    if (previousSignature !== invoiceFilterSignature()) {
      state.invoiceQueryTotal = 0;
      state.invoiceQueryHasMore = false;
      state.invoiceQueryOffset = 0;
      state.invoiceQuerySignature = '';
    }
  }

  function applyRouteParameters(page) {
    var params = new URLSearchParams(window.location.search);
    state.page = page;
    state.filter = 'all';
    state.invoiceFilter = 'all';
    state.bookingSort = 'desc';
    state.bookingSearch = '';
    state.bookingStatuses = [];
    state.bookingDateField = 'received';
    state.bookingDateFrom = '';
    state.bookingDateTo = '';
    state.slotFilter = 'all';
    state.customerSearch = '';
    state.invoiceSearch = '';
    state.selectedSlotId = page === 'availability' ? params.get('slot') : null;
    state.calendarView = 'week';
    state.calendarAnchor = todayYmd();
    state.slotEditorOpen = false;
    state.hasRendered = false;

    if (page === 'bookings') applyBookingFilterParameters(params);
    if (page === 'invoices') applyInvoiceFilterParameters(params);
    syncSelectedModalState(modalRouteFromUrl());
  }

  function applyCurrentPageUrlParameters(page) {
    var params = new URLSearchParams(window.location.search);
    if (page === 'bookings') {
      applyBookingFilterParameters(params);
      syncBookingFilterControls();
    }
    if (page === 'invoices') {
      applyInvoiceFilterParameters(params);
      syncInvoiceFilterControls();
    }
    if (page === 'availability') {
      state.selectedSlotId = params.get('slot');
      var selectedSlot = state.selectedSlotId ? slotById(state.selectedSlotId) : null;
      if (selectedSlot) state.calendarAnchor = formatDate(selectedSlot.start_at);
    }
    syncSelectedModalState(modalRouteFromUrl());
  }

  function setupCurrentPageEvents() {
    if (state.page === 'availability') setupCalendarMedia();
    if (state.page === 'availability') setupDashboardEvents();
    if (state.page === 'dashboard') setupDashboardAnalyticsEvents();
    if (state.page === 'bookings') setupBookingEvents();
    if (state.page === 'availability') setupAvailabilityEvents();
    if (state.page === 'customers') setupCustomerEvents();
    if (state.page === 'invoices') setupInvoiceEvents();
    if (state.page === 'marketing') setupMarketingEvents();
    if (state.page === 'organization') setupOrganizationEvents();
    if (pageController && typeof pageController.afterEvents === 'function') {
      pageController.afterEvents({ state: state });
    }
  }

  function setupMarketingEvents() {
    var form = $('[data-marketing-form]');
    if (!form) return;
    if (!form.dataset.bound) {
      form.dataset.bound = 'true';
      form.addEventListener('submit', handleActionSubmit);
    }
    if (!form.dataset.marketingReadinessBound) {
      form.dataset.marketingReadinessBound = 'true';
      form.addEventListener('input', function () {
        clearFormValidation(form, $('[data-action-error]', form));
        syncMarketingFormState(form);
      });
      form.addEventListener('change', function () { syncMarketingFormState(form); });
    }
    syncMarketingFormState(form);
  }

  function saveCurrentScrollPosition() {
    if (!history.state || !history.state.checkautoAdmin) return;
    history.replaceState(
      Object.assign({}, history.state, { adminScrollY: Math.max(0, Number(window.scrollY || 0)) }),
      '',
      window.location.href
    );
  }

  function scheduleScrollPositionSave() {
    window.clearTimeout(scrollStateTimer);
    scrollStateTimer = window.setTimeout(saveCurrentScrollPosition, 120);
  }

  function historyStateForPage(page, url, historyIndex) {
    var route = modalRouteFromUrl(url);
    return {
      checkautoAdmin: true,
      adminPage: page,
      adminScrollY: 0,
      adminHistoryIndex: Number(historyIndex || 0),
      adminModalRoute: route,
      adminModalDepth: route ? 1 : 0
    };
  }

  function routePageFromUrl(value) {
    if (typeof router.pageFromUrl !== 'function') return null;
    return router.pageFromUrl(value);
  }

  function cleanupPageSurfaces() {
    setNavOpen(false, { focus: false });
    if (state.slotEditorOpen) setSlotEditorOpen(false, { restoreFocus: false });
    closeConfirmDialog();
    closeModal();
    document.body.classList.remove('admin-slot-editor-open');
    document.body.classList.remove('admin-modal-open');
    setPageInteractionBlocked(false);
  }

  async function confirmPageNavigation() {
    var notificationContent=$('[data-notifications-content]');
    if (!modalIsDirty() && !slotEditorIsDirty() && !(notificationContent && actionCenterHasDraft(notificationContent))) return true;
    var discard = await openConfirmDialog({
      title: 'Discard changes?',
      message: 'Leave this page and discard the changes you entered?',
      cancelLabel: 'Keep editing',
      confirmLabel: 'Discard changes',
      danger: true
    });
    if (!discard) return false;
    markModalClean();
    slotEditorBaseline = '';
    return true;
  }

  function reportNavigationRefreshError(error) {
    if (isAbortError(error)) return;
    if (!state.session) {
      redirectTo(PATHS.login);
      return;
    }
    if (viewIsLoaded(adminViewForPage(state.page))) {
      showToast(error instanceof Error ? error.message : 'Refresh failed.', 'error');
    }
  }

  async function navigatePage(page, url, options) {
    var opts = options || {};
    var destination = url instanceof URL ? url : new URL(String(url || ''), window.location.href);
    if (!page || page === 'login' || typeof router.mountPage !== 'function') {
      window.location.assign(destination.href);
      return;
    }

    var accessRedirected = !staffCanAccessPage(state.staff, page);
    if (accessRedirected) {
      page = 'dashboard';
      destination = new URL(PATHS.dashboard, window.location.href);
      if (opts.fromPopState) {
        history.replaceState(
          historyStateForPage(page, destination, state.historyIndex),
          '',
          destination.pathname + destination.search + destination.hash
        );
      }
      if (state.page === page) {
        setNavOpen(false, { focus: false });
        setActiveNav();
        return;
      }
    }

    if (!opts.fromPopState && !(await confirmPageNavigation())) return;
    if (!opts.fromPopState) saveCurrentScrollPosition();

    var nextView = adminViewForPage(page);
    if (activeDashboardLoad && activeDashboardLoad.view !== nextView) {
      activeDashboardLoad.controller.abort();
    }

    var navigationId = state.navigationId + 1;
    state.navigationId = navigationId;

    if (!opts.fromPopState) {
      var nextHistoryIndex = state.historyIndex + 1;
      history.pushState(
        historyStateForPage(page, destination, nextHistoryIndex),
        '',
        destination.pathname + destination.search + destination.hash
      );
      state.historyIndex = nextHistoryIndex;
    }

    cleanupPageSurfaces();
    applyRouteParameters(page);

    var mountedController;
    try {
      mountedController = await router.mountPage(
        page,
        pageController,
        state,
        function () { return state.navigationId === navigationId; }
      );
    } catch (error) {
      window.location.assign(destination.href);
      return;
    }
    if (!mountedController || state.navigationId !== navigationId) return;

    pageController = mountedController;
    els.stats = $('[data-admin-stats]');
    els.bookingList = $('[data-admin-booking-list]');
    clearPageLoadError();
    setActiveNav();
    setUserLabel();
    setupCurrentPageEvents();
    await showConsole({ preserveScroll: true });
    if(state.navigationId !== navigationId) return;

    if (pageDataIsPopulated(page)) {
      renderPage();
      renderModalFromCurrentUrl();
      state.hasRendered = true;
      setSyncState('Updating', 'loading');
    } else {
      setSyncState('Loading', 'loading');
    }

    startRealtime();

    if (opts.fromPopState) {
      window.requestAnimationFrame(function () {
        window.scrollTo(0, Math.max(0, Number(opts.restoreScroll || 0)));
      });
    } else {
      window.scrollTo(0, 0);
      focusElement($('#admin-main'));
    }

    refresh({
      background: viewIsLoaded(nextView),
      preserveScroll: true,
      view: nextView
    }).catch(reportNavigationRefreshError);
  }

  function navigateToAdminUrl(value, options) {
    var destination;
    try {
      destination = value instanceof URL ? value : new URL(String(value || ''), window.location.href);
    } catch (error) {
      return;
    }
    var page = routePageFromUrl(destination);
    if (!page || page === 'login') {
      window.location.assign(destination.href);
      return;
    }
    return navigatePage(page, destination, options);
  }

  function handleAdminRouteClick(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var target = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (!target || target.hasAttribute('download')) return;
    var linkTarget = String(target.getAttribute('target') || '').toLowerCase();
    if (linkTarget && linkTarget !== '_self') return;

    var destination;
    try {
      destination = new URL(target.href, window.location.href);
    } catch (error) {
      return;
    }
    if (
      destination.pathname === window.location.pathname &&
      destination.search === window.location.search &&
      destination.hash
    ) return;

    var page = routePageFromUrl(destination);
    if (!page || page === 'login') return;
    if (
      destination.pathname === window.location.pathname &&
      destination.search === window.location.search &&
      destination.hash === window.location.hash
    ) {
      event.preventDefault();
      setNavOpen(false, { focus: false });
      return;
    }
    event.preventDefault();
    navigatePage(page, destination).catch(reportNavigationRefreshError);
  }

  function handleAdminRouteIntent(event) {
    if (typeof router.preloadPage !== 'function') return;
    var target = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (!target) return;
    var page = routePageFromUrl(target.href);
    if (!page || page === 'login' || page === state.page) return;
    if (!staffCanAccessPage(state.staff, page)) return;
    router.preloadPage(page);
  }

  async function handleAdminPopState(event) {
    window.clearTimeout(scrollStateTimer);
    scrollStateTimer = null;
    var page = typeof router.pageFromPathname === 'function'
      ? router.pageFromPathname(window.location.pathname)
      : null;
    if (!page || page === 'login') return;

    var targetHistoryIndex = Number(event.state && event.state.adminHistoryIndex);
    if (!Number.isFinite(targetHistoryIndex)) targetHistoryIndex = state.historyIndex;

    if (state.restoringHistory) {
      state.restoringHistory = false;
      state.historyIndex = targetHistoryIndex;
      return;
    }

    var previousHistoryIndex = state.historyIndex;
    if (!(await confirmPageNavigation())) {
      var restoreDelta = previousHistoryIndex - targetHistoryIndex;
      if (restoreDelta) {
        state.restoringHistory = true;
        history.go(restoreDelta);
      }
      return;
    }

    state.historyIndex = targetHistoryIndex;
    if (page === state.page) {
      applyCurrentPageUrlParameters(page);
      syncSelectedModalState(modalRouteFromUrl());
      renderPage();
      renderModalFromCurrentUrl();
      window.requestAnimationFrame(function () {
        window.scrollTo(0, Math.max(0, Number(event.state && event.state.adminScrollY || 0)));
      });
      return;
    }
    await navigatePage(page, new URL(window.location.href), {
      fromPopState: true,
      restoreScroll: event.state && event.state.adminScrollY
    });
  }

  function refreshVisiblePageIfStale() {
    if (document.visibilityState === 'hidden' || !state.session || state.page === 'login' || state.isRefreshing) return;
    var view = adminViewForPage(state.page);
    var loaded = state.loadedViews && state.loadedViews[view];
    if (loaded && Date.now() - Number(loaded.loadedAt || 0) < VIEW_FOCUS_MAX_AGE_MS) return;
    refresh({ background: Boolean(loaded), preserveScroll: true, view: view }).catch(reportNavigationRefreshError);
  }

  function setupLoginEvents(initialMessage, initialTemporaryPasswordUser) {
    var passwordForm = $('[data-admin-login-form]');
    if (!passwordForm) return;

    var title = $('#admin-login-title');
    var sessionStatus = $('[data-admin-login-session]');
    var loginLoading = $('[data-admin-login-loading]');
    var temporaryPasswordStep = $('[data-admin-temp-password]');
    var enrollStep = $('[data-admin-mfa-enroll]');
    var challengeStep = $('[data-admin-mfa-challenge]');
    var recoveryStep = $('[data-admin-mfa-recovery]');
    var codesStep = $('[data-admin-mfa-codes]');
    var temporaryPasswordForm = $('[data-admin-temp-password-form]');
    var enrollForm = $('[data-admin-mfa-enroll-form]');
    var challengeForm = $('[data-admin-mfa-challenge-form]');
    var recoveryForm = $('[data-admin-mfa-recovery-form]');
    var activeFactor = null;
    var activeChallenge = null;
    var activeUser = initialTemporaryPasswordUser || null;
    var recoveryCodes = [];
    var firstMfaEnrollment = false;

    function loginSteps() {
      return [passwordForm, temporaryPasswordStep, enrollStep, challengeStep, recoveryStep, codesStep];
    }

    function showLoginStep(step, heading) {
      loginSteps().forEach(function (item) {
        if (item) item.hidden = item !== step;
      });
      if (title) {
        title.textContent = heading || 'Sign in';
        title.hidden = false;
      }
      if (sessionStatus) {
        sessionStatus.hidden = !sessionStatus.textContent;
      }
      var firstInput = $('input:not([type="checkbox"])', step);
      if (firstInput) focusElement(firstInput);
    }

    function setStatus(target, message, input) {
      if (!target) return;
      target.textContent = message || '';
      if (!target.id) target.id = 'admin-login-status-' + Math.random().toString(36).slice(2);
      if (input) {
        var descriptionId = String(input.dataset.adminDescriptionId || '').trim();
        if (message) {
          input.setAttribute('aria-invalid', 'true');
          input.setAttribute(
            'aria-describedby',
            (descriptionId ? descriptionId + ' ' : '') + target.id
          );
        } else {
          input.removeAttribute('aria-invalid');
          if (descriptionId) {
            input.setAttribute('aria-describedby', descriptionId);
          } else {
            input.removeAttribute('aria-describedby');
          }
        }
      }
    }

    function setStatuses(target, message, inputs) {
      (inputs || []).forEach(function (input) {
        setStatus(target, message, input);
      });
      if (!(inputs || []).length) setStatus(target, message);
    }

    function passwordValidationMessage(password, confirmation) {
      if (password !== confirmation) return 'The two passwords do not match.';
      if (Array.from(password).length < MIN_PASSWORD_CHARACTERS) {
        return 'Use at least ' + MIN_PASSWORD_CHARACTERS + ' characters.';
      }
      if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
        return 'Use no more than ' + MAX_PASSWORD_BYTES + ' UTF-8 bytes.';
      }
      if (/[\u0000-\u001f\u007f]/u.test(password) || !/\S/u.test(password)) {
        return 'Choose a password without control characters.';
      }
      var email = String(activeUser && activeUser.email || '');
      if (email && password.toLocaleLowerCase() === email.toLocaleLowerCase()) {
        return 'The password cannot be your email address.';
      }
      return '';
    }

    async function requestTemporaryPassword(payload, session) {
      var response = await fetch(TEMP_PASSWORD_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: 'Bearer ' + session.access_token
        },
        cache: 'no-store',
        body: JSON.stringify(payload)
      });
      var body = await response.json().catch(function () { return {}; });
      if (!response.ok) {
        var message = body.error || (
          payload.action === 'status'
            ? 'The account security state could not be checked.'
            : 'The temporary password could not be changed.'
        );
        if (body.code === 'password_unchanged') {
          message = 'Choose a password different from the temporary password.';
        }
        var passwordError = new Error(message);
        passwordError.code = body.code || '';
        passwordError.status = response.status;
        throw passwordError;
      }
      return body;
    }

    async function temporaryPasswordStatus(session) {
      var result = await requestTemporaryPassword({ action: 'status' }, session);
      return result && result.must_change_password === true;
    }

    async function requestTemporaryPasswordChange(password) {
      return requestTemporaryPassword(
        { action: 'complete', password: password },
        state.session
      );
    }

    function showTemporaryPasswordStep(user) {
      activeUser = user;
      if (temporaryPasswordForm) temporaryPasswordForm.reset();
      if (sessionStatus) sessionStatus.textContent = '';
      showLoginStep(temporaryPasswordStep, 'Change temporary password');
    }

    function normalizeVerificationCode(value) {
      return String(value || '').replace(/\D/g, '').slice(0, 6);
    }

    function normalizeRecoveryCode(value) {
      return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 32);
    }

    function bindCodeInput(input, normalizer) {
      if (!input) return;
      input.addEventListener('input', function () {
        var normalized = normalizer(input.value);
        if (input.value !== normalized) input.value = normalized;
        input.removeAttribute('aria-invalid');
      });
    }

    async function confirmApprovedStaff(session) {
      var response = await fetch(ADMIN_ENDPOINT + '?view=auth', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: 'Bearer ' + session.access_token
        },
        cache: 'no-store'
      });
      var body = await response.json().catch(function () { return {}; });
      if (response.ok || [
        'mfa_enrollment_required',
        'mfa_challenge_required',
        'session_reauthentication_required'
      ].includes(body.code)) return;
      throw new Error(body.error || 'This account is not approved for the admin console.');
    }

    async function beginMfa(session) {
      activeUser = await auth.getUser(session);
      var serverRequiresPasswordChange = await temporaryPasswordStatus(session);
      if (
        serverRequiresPasswordChange ||
        auth.requiresTemporaryPasswordChange(activeUser)
      ) {
        showTemporaryPasswordStep(activeUser);
        return;
      }
      await confirmApprovedStaff(session);
      var factors = await auth.listFactors(session);

      if (factors.totp.length) {
        activeFactor = factors.totp[0];
        activeChallenge = await auth.challengeTotp(session, activeFactor.id);
        if (sessionStatus) sessionStatus.textContent = '';
        showLoginStep(challengeStep, 'Verify it’s you');
        return;
      }

      for (var i = 0; i < factors.unverifiedTotp.length; i += 1) {
        await auth.removeFactor(session, factors.unverifiedTotp[i].id);
      }

      firstMfaEnrollment = true;
      activeFactor = await auth.enrollTotp(session);
      activeChallenge = await auth.challengeTotp(session, activeFactor.id);

      var qrRoot = $('[data-admin-mfa-qr]');
      var secretTarget = $('[data-admin-mfa-secret]');
      if (qrRoot) {
        qrRoot.replaceChildren();
        var qrCode = String(activeFactor && activeFactor.totp && activeFactor.totp.qr_code || '');
        if (qrCode.startsWith('data:image/svg+xml;utf-8,')) {
          var image = document.createElement('img');
          image.src = qrCode;
          image.alt = 'Authenticator setup QR code';
          image.width = 208;
          image.height = 208;
          qrRoot.appendChild(image);
        }
      }
      if (secretTarget) {
        secretTarget.textContent = String(activeFactor && activeFactor.totp && activeFactor.totp.secret || '');
      }
      if (sessionStatus) sessionStatus.textContent = '';
      showLoginStep(enrollStep, 'Set up two-step sign-in');
    }

    async function completeMfa(verificationCode, rememberDevice, status, codeInput) {
      if (!/^\d{6}$/.test(verificationCode)) {
        setStatus(status, 'Enter the 6-digit code from your authenticator app.', codeInput);
        focusElement(codeInput);
        return;
      }

      var verifiedSession = await auth.verifyTotp(
        state.session,
        activeFactor.id,
        activeChallenge.id,
        verificationCode
      );
      if (!verifiedSession || auth.assuranceLevel(verifiedSession) !== 'aal2') {
        throw new Error('Verification didn’t finish. Sign in again.');
      }

      storeSession(verifiedSession, rememberDevice);
      await showMfaRecoveryCodesOrContinue();
    }

    async function showMfaRecoveryCodesOrContinue(regenerate) {
      var result;
      try {
        var response=await adminAction({action:regenerate ? 'regenerateMfaRecoveryCodes' : 'ensureMfaRecoveryCodes'});
        result=response && response.result;
        if (result?.acknowledgementRequired) firstMfaEnrollment=true;
        if (firstMfaEnrollment && (!result || !result.created || !result.codes?.length)) {
          throw new Error('The recovery codes didn’t arrive. Create new ones to finish.');
        }
      } catch(error) {
        showLoginStep(codesStep,'Save your recovery codes');
        recoveryCodes=[];
        var list=$('[data-admin-mfa-code-list]'); if(list) list.replaceChildren();
        var status=$('[data-recovery-generation-status]',codesStep);
        if(!status){status=document.createElement('p');status.className='admin-status';status.dataset.recoveryGenerationStatus='';status.setAttribute('role','alert');codesStep.prepend(status);}
        status.textContent=error instanceof Error ? error.message : 'Recovery codes could not be created. Try again.';
        var finish=$('[data-admin-mfa-finish]'); if(finish){finish.disabled=true;finish.hidden=true;}
        var retry=$('[data-recovery-regenerate]',codesStep);
        if(!retry){retry=document.createElement('button');retry.type='button';retry.className='admin-button admin-button-primary';retry.dataset.recoveryRegenerate='';retry.textContent='Create new codes';if(finish)finish.before(retry);else codesStep.append(retry);retry.addEventListener('click',async function(){retry.disabled=true;await showMfaRecoveryCodesOrContinue(true);retry.disabled=false;});}
        return;
      }
      await loadDashboard('auth',{force:true});
      if(result?.created && result.codes?.length) {
        recoveryCodes=result.codes.slice();
        var list=$('[data-admin-mfa-code-list]'); if(list){list.replaceChildren();recoveryCodes.forEach(function(code){var item=document.createElement('li');item.textContent=code;list.appendChild(item);});}
        var status=$('[data-recovery-generation-status]',codesStep);if(status)status.remove();
        var retry=$('[data-recovery-regenerate]',codesStep);if(retry)retry.remove();
        showLoginStep(codesStep,'Save your recovery codes');
        var finish=$('[data-admin-mfa-finish]');if(finish){finish.disabled=true;finish.hidden=false;}
        var acknowledgement=$('[data-recovery-acknowledgement]',codesStep);
        if(!acknowledgement){var label=document.createElement('label');label.className='admin-checkbox admin-mfa-acknowledge';label.innerHTML='<input type="checkbox" data-recovery-acknowledgement><span>I’ve saved these codes somewhere safe</span>';var actions=finish.parentElement;actions.parentElement.insertBefore(label,actions);acknowledgement=$('input',label);acknowledgement.addEventListener('change',function(){if(finish)finish.disabled=!acknowledgement.checked;});}
        acknowledgement.checked=false;
        return;
      }
      redirectTo(PATHS.dashboard);
    }

    if(state.recoveryAcknowledgementRequired && state.session && auth.assuranceLevel(state.session)==='aal2') {firstMfaEnrollment=true;showMfaRecoveryCodesOrContinue().catch(function(error){showToast(error.message,'error');});}

    if (sessionStatus) {
      sessionStatus.textContent = initialMessage || '';
      sessionStatus.hidden = !sessionStatus.textContent;
    }
    if (loginLoading) loginLoading.hidden = true;
    if (activeUser && auth.requiresTemporaryPasswordChange(activeUser)) {
      showTemporaryPasswordStep(activeUser);
    } else if (!state.recoveryAcknowledgementRequired) {
      showLoginStep(passwordForm, 'Sign in');
    }

    if (temporaryPasswordForm) {
      var newPasswordInput = $('[name="newPassword"]', temporaryPasswordForm);
      var newPasswordConfirmationInput = $('[name="newPasswordConfirmation"]', temporaryPasswordForm);
      [newPasswordInput, newPasswordConfirmationInput].forEach(function (input) {
        if (!input) return;
        input.addEventListener('input', function () {
          setStatuses(
            $('[data-admin-temp-password-status]'),
            '',
            [newPasswordInput, newPasswordConfirmationInput]
          );
        });
      });

      temporaryPasswordForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        var status = $('[data-admin-temp-password-status]');
        var password = String(newPasswordInput && newPasswordInput.value || '');
        var confirmation = String(newPasswordConfirmationInput && newPasswordConfirmationInput.value || '');
        var validationMessage = passwordValidationMessage(password, confirmation);
        setStatuses(status, '', [newPasswordInput, newPasswordConfirmationInput]);
        if (validationMessage) {
          setStatuses(status, validationMessage, [newPasswordInput, newPasswordConfirmationInput]);
          focusElement(validationMessage === 'The two passwords do not match.'
            ? newPasswordConfirmationInput
            : newPasswordInput);
          return;
        }

        setFormBusy(temporaryPasswordForm, true, 'Changing password…');
        if (temporaryPasswordSignOut) temporaryPasswordSignOut.disabled = true;
        try {
          var result = await requestTemporaryPasswordChange(password);
          if (newPasswordInput) newPasswordInput.value = '';
          if (newPasswordConfirmationInput) newPasswordConfirmationInput.value = '';

          var reauthenticationEmail = String(activeUser && activeUser.email || '');
          storeSession(null);
          activeUser = null;
          if (passwordForm) {
            passwordForm.reset();
            var reauthenticationEmailInput = $('[name="email"]', passwordForm);
            if (reauthenticationEmailInput) reauthenticationEmailInput.value = reauthenticationEmail;
          }
          if (sessionStatus) {
            sessionStatus.textContent = result && result.requires_reauthentication === true
              ? 'Password changed. Sign in with your new password.'
              : 'Password changed. Sign in again.';
          }
          showLoginStep(passwordForm, 'Sign in');
          focusElement($('[name="password"]', passwordForm));
        } catch (error) {
          if (newPasswordInput) newPasswordInput.value = '';
          if (newPasswordConfirmationInput) newPasswordConfirmationInput.value = '';
          if (error && Number(error.status) === 401) {
            await revokeAndClearSession();
            activeUser = null;
            if (passwordForm) passwordForm.reset();
            if (sessionStatus) {
              sessionStatus.textContent = 'Your session expired. Sign in again to change the temporary password.';
            }
            showLoginStep(passwordForm, 'Sign in');
            return;
          }
          setStatuses(
            status,
            error instanceof Error ? error.message : 'The temporary password could not be changed.',
            [newPasswordInput, newPasswordConfirmationInput]
          );
          focusElement(newPasswordInput);
        } finally {
          if (document.body.contains(temporaryPasswordForm)) {
            setFormBusy(temporaryPasswordForm, false);
          }
          if (temporaryPasswordSignOut && document.body.contains(temporaryPasswordSignOut)) {
            temporaryPasswordSignOut.disabled = false;
          }
        }
      });
    }

    bindCodeInput($('[name="verificationCode"]', enrollForm), normalizeVerificationCode);
    bindCodeInput($('[name="verificationCode"]', challengeForm), normalizeVerificationCode);
    bindCodeInput($('[name="recoveryCode"]', recoveryForm), function (value) {
      return String(value || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 40);
    });

    var loginEmailInput = $('[name="email"]', passwordForm);
    var loginPasswordInput = $('[name="password"]', passwordForm);
    [loginEmailInput, loginPasswordInput].forEach(function (input) {
      if (!input) return;
      input.addEventListener('input', function () {
        setStatuses($('[data-admin-login-status]'), '', [loginEmailInput, loginPasswordInput]);
      });
    });

    passwordForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      var status = $('[data-admin-login-status]');
      var emailInput = loginEmailInput;
      var passwordInput = loginPasswordInput;
      var data = new FormData(passwordForm);
      var email = String(data.get('email') || '').trim();
      var password = String(data.get('password') || '');
      setStatuses(status, '', [emailInput, passwordInput]);
      if (!email) {
        setStatus(status, 'Enter your email address.', emailInput);
        focusElement(emailInput);
        return;
      }
      if (emailInput && !emailInput.validity.valid) {
        setStatus(status, 'Enter a valid email address.', emailInput);
        focusElement(emailInput);
        return;
      }
      if (!password) {
        setStatus(status, 'Enter your password.', passwordInput);
        focusElement(passwordInput);
        return;
      }
      setFormBusy(passwordForm, true, 'Signing in…');

      try {
        var session = await auth.signInWithPassword(email, password);
        storeSession(session, false);
        await beginMfa(session);
        if (passwordInput) passwordInput.value = '';
      } catch (error) {
        await revokeAndClearSession();
        setStatus(status, error instanceof Error ? error.message : 'Sign in failed.', emailInput);
        if (passwordInput) {
          passwordInput.setAttribute('aria-invalid', 'true');
          if (status && status.id) passwordInput.setAttribute('aria-describedby', status.id);
        }
        focusElement(emailInput);
      } finally {
        if (document.body.contains(passwordForm)) setFormBusy(passwordForm, false);
      }
    });

    var temporaryPasswordSignOut = $('[data-admin-temp-password-sign-out]');
    if (temporaryPasswordSignOut) {
      temporaryPasswordSignOut.addEventListener('click', async function () {
        setButtonBusy(temporaryPasswordSignOut, true, 'Signing out…');
        try {
          await revokeAndClearSession();
          activeUser = null;
          if (temporaryPasswordForm) temporaryPasswordForm.reset();
          if (passwordForm) passwordForm.reset();
          if (sessionStatus) sessionStatus.textContent = '';
          showLoginStep(passwordForm, 'Sign in');
        } finally {
          if (document.body.contains(temporaryPasswordSignOut)) {
            setButtonBusy(temporaryPasswordSignOut, false);
          }
        }
      });
    }

    if (enrollForm) {
      enrollForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        var status = $('[data-admin-mfa-enroll-status]');
        var codeInput = $('[name="verificationCode"]', enrollForm);
        var data = new FormData(enrollForm);
        setStatus(status, '', codeInput);
        setFormBusy(enrollForm, true, 'Verifying…');
        try {
          await completeMfa(
            normalizeVerificationCode(data.get('verificationCode')),
            false,
            status,
            codeInput
          );
        } catch (error) {
          setStatus(status, error instanceof Error ? error.message : 'Verification failed.', codeInput);
          focusElement(codeInput);
        } finally {
          if (document.body.contains(enrollForm)) setFormBusy(enrollForm, false);
        }
      });
    }

    if (challengeForm) {
      challengeForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        var status = $('[data-admin-mfa-challenge-status]');
        var codeInput = $('[name="verificationCode"]', challengeForm);
        var data = new FormData(challengeForm);
        setStatus(status, '', codeInput);
        setFormBusy(challengeForm, true, 'Verifying…');
        try {
          await completeMfa(
            normalizeVerificationCode(data.get('verificationCode')),
            data.get('rememberDevice') === 'on',
            status,
            codeInput
          );
        } catch (error) {
          setStatus(status, error instanceof Error ? error.message : 'Verification failed.', codeInput);
          focusElement(codeInput);
        } finally {
          if (document.body.contains(challengeForm)) setFormBusy(challengeForm, false);
        }
      });
    }

    var recoveryButton = $('[data-admin-mfa-use-recovery]');
    if (recoveryButton) {
      recoveryButton.addEventListener('click', function () {
        showLoginStep(recoveryStep, 'Use a recovery code');
      });
    }

    var recoveryBack = $('[data-admin-mfa-back]');
    if (recoveryBack) {
      recoveryBack.addEventListener('click', function () {
        showLoginStep(challengeStep, 'Verify it’s you');
      });
    }

    if (recoveryForm) {
      recoveryForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        var status = $('[data-admin-mfa-recovery-status]');
        var codeInput = $('[name="recoveryCode"]', recoveryForm);
        var code = normalizeRecoveryCode(codeInput && codeInput.value);
        setStatus(status, '', codeInput);
        if (code.length < 16) {
          setStatus(status, 'Enter one complete recovery code.', codeInput);
          focusElement(codeInput);
          return;
        }
        setFormBusy(recoveryForm, true, 'Recovering…');
        try {
          var response = await fetch(MFA_RECOVERY_ENDPOINT, {
            method: 'POST',
            headers: authHeaders(),
            cache: 'no-store',
            body: JSON.stringify({ recoveryCode: code })
          });
          var body = await response.json().catch(function () { return {}; });
          if (!response.ok) {
            var recoveryError = new Error(body.error || 'That recovery code could not be used.');
            recoveryError.retryAfter = response.headers.get('Retry-After');
            throw recoveryError;
          }
          storeSession(null);
          passwordForm.reset();
          recoveryForm.reset();
          if (sessionStatus) {
            sessionStatus.textContent = 'Recovery code accepted. Sign in again to set up a new authenticator.';
          }
          showLoginStep(passwordForm, 'Sign in');
        } catch (error) {
          setStatus(status, error instanceof Error ? error.message : 'Account recovery failed.', codeInput);
          focusElement(codeInput);
        } finally {
          if (document.body.contains(recoveryForm)) setFormBusy(recoveryForm, false);
        }
      });
    }

    var copyButton = $('[data-admin-mfa-copy]');
    if (copyButton) {
      copyButton.addEventListener('click', async function () {
        var secret = String($('[data-admin-mfa-secret]') && $('[data-admin-mfa-secret]').textContent || '');
        try {
          await navigator.clipboard.writeText(secret);
          copyButton.textContent = 'Copied';
        } catch (error) {
          copyButton.textContent = 'Select and copy the key';
        }
      });
    }

    var copyCodesButton = $('[data-admin-mfa-copy-codes]');
    if (copyCodesButton) {
      copyCodesButton.addEventListener('click', async function () {
        if (!recoveryCodes.length) return;
        try {
          await navigator.clipboard.writeText(recoveryCodes.join('\n'));
          copyCodesButton.textContent = 'Copied';
        } catch (error) {
          copyCodesButton.textContent = 'Select and copy the codes';
        }
      });
    }

    var downloadButton = $('[data-admin-mfa-download]');
    if (downloadButton) {
      downloadButton.addEventListener('click', function () {
        if (!recoveryCodes.length) return;
        var contents = [
          'checkauto.lt admin recovery codes',
          'Each code works once. Keep these private.',
          '',
          recoveryCodes.join('\n'),
          ''
        ].join('\n');
        var url = URL.createObjectURL(new Blob([contents], { type: 'text/plain;charset=utf-8' }));
        var link = document.createElement('a');
        link.href = url;
        link.download = 'checkauto-admin-recovery-codes.txt';
        link.click();
        URL.revokeObjectURL(url);
      });
    }

    var finishButton = $('[data-admin-mfa-finish]');
    if (finishButton) {
      finishButton.addEventListener('click', async function () {
        if (!recoveryCodes.length || !$('[data-recovery-acknowledgement]')?.checked) return;
        try { await adminAction({action:'acknowledgeMfaRecoveryCodes'}); } catch(error) { showToast('Recovery code acknowledgement could not be saved. Try again.','error');return; }
        recoveryCodes = [];
        firstMfaEnrollment=false;
        redirectTo(PATHS.dashboard);
      });
    }

    window.addEventListener('pagehide', function () {
      var newPasswordInput = $('[name="newPassword"]', temporaryPasswordForm);
      var newPasswordConfirmationInput = $('[name="newPasswordConfirmation"]', temporaryPasswordForm);
      if (newPasswordInput) newPasswordInput.value = '';
      if (newPasswordConfirmationInput) newPasswordConfirmationInput.value = '';
    }, { once: true });
  }

  function setupShellEvents() {
    accountMenu = setupAccountMenu();
    var navToggle = $('[data-admin-nav-toggle]');
    var sidebar = $('#admin-sidebar');
    if (sidebar && !sidebar.hasAttribute('tabindex')) sidebar.setAttribute('tabindex', '-1');
    if (window.matchMedia) {
      navigationMediaQuery = window.matchMedia('(max-width: 60rem)');
      var handleNavigationModeChange = function () {
        setNavOpen(false, { focus: false, restoreFocus: false });
      };
      if (typeof navigationMediaQuery.addEventListener === 'function') {
        navigationMediaQuery.addEventListener('change', handleNavigationModeChange);
      } else if (typeof navigationMediaQuery.addListener === 'function') {
        navigationMediaQuery.addListener(handleNavigationModeChange);
      }
    }
    setNavOpen(false, { focus: false, restoreFocus: false });
    if (navToggle) {
      navToggle.setAttribute('aria-expanded', 'false');
      navToggle.setAttribute('aria-controls', 'admin-sidebar');
      navToggle.addEventListener('click', function () {
        setNavOpen(!navIsOpen(), { focus: true, restoreFocus: true });
      });
    }
    $all('[data-admin-nav-close]').forEach(function (navClose) {
      navClose.addEventListener('click', function () {
        setNavOpen(false, { restoreFocus: true });
      });
    });
    $all('[data-admin-nav]').forEach(function (link) {
      link.addEventListener('click', function () {
        setNavOpen(false, { focus: false });
      });
    });
    document.addEventListener('keydown', function (event) {
      if (!navIsOpen()) return;
      if (!ensureConfirmRoot().hidden || !ensureModalRoot().hidden) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        setNavOpen(false, { restoreFocus: true });
        return;
      }
      if (event.key !== 'Tab' || !sidebar) return;
      var focusables = focusableElements(sidebar);
      if (!focusables.length) {
        event.preventDefault();
        sidebar.focus();
        return;
      }
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (event.shiftKey && (document.activeElement === first || !sidebar.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !sidebar.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    });

    var refreshButton = $('[data-admin-refresh]');
    if (refreshButton) {
      refreshButton.addEventListener('click', async function () {
        if (refreshButton.getAttribute('aria-disabled') === 'true') return;
        try {
          var refreshed = await refresh({ preserveScroll: true, force: true });
          if (refreshed) showToast('Admin data refreshed.', 'success');
        } catch (error) {
          if (viewIsLoaded(adminViewForPage(state.page))) {
            showToast(error instanceof Error ? error.message : 'Refresh failed.', 'error');
          }
        }
      });
    }

    var logoutButton = $('[data-admin-logout]');
    if (logoutButton) {
      logoutButton.addEventListener('click', async function () {
        accountMenu.close({ restoreFocus: true });
        var confirmed = await openConfirmDialog({
          title: 'Log out?',
          message: 'Are you sure you want to log out?',
          confirmLabel: 'Log out',
          danger: true
        });
        if (!confirmed) return;
        setButtonBusy(logoutButton, true, 'Signing out…');
        await revokeAndClearSession();
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

  function setupDashboardAnalyticsEvents() {
    dashboardView.setupEvents();
  }

  function commitBookingFilters(options) {
    var opts = options || {};
    state.bookingQuerySignature = '';
    state.bookingQueryHasMore = false;
    state.bookingQueryOffset = 0;
    replaceBookingFilterUrl();
    syncBookingFilterControls();
    return loadBookingQuery({ force: true, silent: opts.silent === true });
  }

  function resetBookingFilters() {
    state.bookingSearch = '';
    state.bookingStatuses = [];
    state.bookingDateField = 'received';
    state.bookingDateFrom = '';
    state.bookingDateTo = '';
    state.bookingSort = 'desc';
    commitBookingFilters();
  }

  function setupBookingEvents() {
    var sortControls = $('[data-admin-booking-sort]');
    var search = $('[data-booking-search]');
    setupFilterMenu($('[data-booking-filter-menu]'));

    if (search) search.addEventListener('input', function () {
      state.bookingSearch = search.value.trim().slice(0, 200);
      state.bookingQuerySignature = '';
      window.clearTimeout(bookingSearchTimer);
      replaceBookingFilterUrl();
      bookingSearchTimer = window.setTimeout(function () {
        commitBookingFilters({ silent: true });
      }, 250);
    });

    $all('[data-booking-status]').forEach(function (checkbox) {
      checkbox.addEventListener('change', function () {
        state.bookingStatuses = $all('[data-booking-status]:checked').map(function (item) { return item.value; });
        commitBookingFilters();
      });
    });

    var dateField = $('[data-booking-date-field]');
    var dateFrom = $('[data-booking-date-from]');
    var dateTo = $('[data-booking-date-to]');
    if (dateField) dateField.addEventListener('change', function () {
      state.bookingDateField = dateField.value;
      commitBookingFilters();
    });
    if (dateFrom) dateFrom.addEventListener('change', function () {
      state.bookingDateFrom = isValidYmd(dateFrom.value) ? dateFrom.value : '';
      commitBookingFilters();
    });
    if (dateTo) dateTo.addEventListener('change', function () {
      state.bookingDateTo = isValidYmd(dateTo.value) ? dateTo.value : '';
      commitBookingFilters();
    });

    $all('[data-booking-range]').forEach(function (button) {
      button.addEventListener('click', function () {
        var today = todayYmd();
        state.bookingDateFrom = button.dataset.bookingRange === 'month' ? today.slice(0, 8) + '01' : today;
        state.bookingDateTo = today;
        commitBookingFilters();
      });
    });

    var reset = $('[data-booking-filters-reset]');
    if (reset) reset.addEventListener('click', resetBookingFilters);

    if (sortControls) {
      sortControls.setAttribute('role', 'group');
      if (!sortControls.getAttribute('aria-label')) sortControls.setAttribute('aria-label', 'Sort bookings');
      $all('[data-booking-sort]', sortControls).forEach(function (item) {
        setPressed(item, item.dataset.bookingSort === state.bookingSort);
      });
      $all('[data-booking-sort]', sortControls).forEach(function (button) {
        button.addEventListener('click', function () {
          state.bookingSort = button.dataset.bookingSort === 'desc' ? 'desc' : 'asc';
          commitBookingFilters();
        });
      });
    }

    var loadMore = $('[data-booking-load-more]');
    if (loadMore) loadMore.addEventListener('click', function () {
      loadBookingQuery({ append: true, silent: true });
    });

    var root = $('[data-page-root]');
    if (root) root.addEventListener('click', function (event) {
      var retry = event.target.closest('[data-booking-query-retry]');
      if (retry) loadBookingQuery({ force: true });
    });
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

  function commitInvoiceFilters(options) {
    var opts = options || {};
    state.invoiceQuerySignature = '';
    state.invoiceQueryHasMore = false;
    state.invoiceQueryOffset = 0;
    replaceInvoiceFilterUrl();
    syncInvoiceFilterControls();
    return loadInvoiceQuery({ force: true, silent: opts.silent === true });
  }

  function resetInvoiceFilters() {
    state.invoiceSearch = '';
    state.invoiceStatuses = [];
    state.invoicePaymentStatuses = [];
    state.invoiceEmailStatuses = [];
    state.invoiceDateField = 'created';
    state.invoiceDateFrom = '';
    state.invoiceDateTo = '';
    state.invoiceAmountMin = '';
    state.invoiceAmountMax = '';
    state.invoiceSort = 'desc';
    commitInvoiceFilters();
  }

  function setupInvoiceEvents() {
    var search = $('[data-invoice-search]');
    setupFilterMenu($('[data-invoice-filter-menu]'));
    if (search) search.addEventListener('input', function () {
      state.invoiceSearch = search.value.trim().slice(0, 200);
      state.invoiceQuerySignature = '';
      window.clearTimeout(invoiceSearchTimer);
      replaceInvoiceFilterUrl();
      invoiceSearchTimer = window.setTimeout(function () {
        commitInvoiceFilters({ silent: true });
      }, 250);
    });

    [
      ['[data-invoice-status]', 'invoiceStatuses'],
      ['[data-invoice-payment-status]', 'invoicePaymentStatuses'],
      ['[data-invoice-email-status]', 'invoiceEmailStatuses']
    ].forEach(function (entry) {
      $all(entry[0]).forEach(function (checkbox) {
        checkbox.addEventListener('change', function () {
          state[entry[1]] = $all(entry[0] + ':checked').map(function (item) { return item.value; });
          commitInvoiceFilters();
        });
      });
    });

    var dateField = $('[data-invoice-date-field]');
    var dateFrom = $('[data-invoice-date-from]');
    var dateTo = $('[data-invoice-date-to]');
    var amountMin = $('[data-invoice-amount-min]');
    var amountMax = $('[data-invoice-amount-max]');
    if (dateField) dateField.addEventListener('change', function () {
      state.invoiceDateField = dateField.value;
      commitInvoiceFilters();
    });
    if (dateFrom) dateFrom.addEventListener('change', function () {
      state.invoiceDateFrom = isValidYmd(dateFrom.value) ? dateFrom.value : '';
      commitInvoiceFilters();
    });
    if (dateTo) dateTo.addEventListener('change', function () {
      state.invoiceDateTo = isValidYmd(dateTo.value) ? dateTo.value : '';
      commitInvoiceFilters();
    });
    [amountMin, amountMax].forEach(function (control) {
      if (!control) return;
      control.addEventListener('change', function () {
        var normalized = validMoneyFilter(control.value);
        control.value = normalized;
        if (control === amountMin) state.invoiceAmountMin = normalized;
        else state.invoiceAmountMax = normalized;
        commitInvoiceFilters();
      });
    });

    $all('[data-invoice-range]').forEach(function (button) {
      button.addEventListener('click', function () {
        var today = todayYmd();
        state.invoiceDateFrom = button.dataset.invoiceRange === 'month' ? today.slice(0, 8) + '01' : today;
        state.invoiceDateTo = today;
        commitInvoiceFilters();
      });
    });
    var reset = $('[data-invoice-filters-reset]');
    if (reset) reset.addEventListener('click', resetInvoiceFilters);
    $all('[data-invoice-sort]').forEach(function (button) {
      button.addEventListener('click', function () {
        state.invoiceSort = button.dataset.invoiceSort === 'asc' ? 'asc' : 'desc';
        commitInvoiceFilters();
      });
    });
    var loadMore = $('[data-invoice-load-more]');
    if (loadMore) loadMore.addEventListener('click', function () {
      loadInvoiceQuery({ append: true, silent: true });
    });
    var root = $('[data-page-root]');
    if (root) root.addEventListener('click', function (event) {
      if (event.target.closest('[data-invoice-query-retry]')) loadInvoiceQuery({ force: true });
    });
  }

  function setupAvailabilityEvents() {
    var form = $('[data-admin-slot-form]');
    if (!form) return;

    var editor = $('[data-admin-slot-editor]');
    var openButton = $('[data-admin-slot-open]');
    var dayScheduleButton = $('[data-admin-day-schedule-open]');
    var repeatToggle = $('[data-admin-repeat-toggle]', form);
    var repeatWeeks = $('[data-admin-repeat-weeks]', form);
    var serviceSelect = $('[data-admin-slot-service]', form);
    var dateInput = $('[data-admin-slot-date]', form);
    var startSelect = $('[data-admin-slot-start]', form);
    var deleteButton = $('[data-admin-slot-delete]', form);
    var errorEl = $('[data-admin-slot-error]', form);
    var scheduleReady = viewIsLoaded('schedule');

    if (!scheduleReady) {
      if (openButton) openButton.disabled = true;
      if (dayScheduleButton) dayScheduleButton.disabled = true;
    }

    if (openButton) {
      openButton.setAttribute('aria-expanded', 'false');
      openButton.addEventListener('click', function () {
        if (!viewIsLoaded('schedule')) return;
        slotEditorReturnFocus = openButton;
        slotEditorReturnFocusSelector = focusSelectorFor(openButton);
        resetSlotForm({ keepOpen: true, restoreFocus: false });
      });
    }
    if (dayScheduleButton) {
      dayScheduleButton.addEventListener('click', function () {
        if (!viewIsLoaded('schedule')) return;
        if (!staffHasAccess(state.staff, 'operations.manage', ['owner', 'admin', 'inspector'])) return;
        dayScheduleLastResult = null;
        navigateToModal('daySchedule', 'create');
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

    [serviceSelect, dateInput].forEach(function (input) {
      if (!input) return;
      input.addEventListener('change', function () {
        rebuildSlotTimeOptions(true);
        refreshCustomControls(form);
      });
    });

    if (startSelect) {
      startSelect.addEventListener('change', function () {
        rebuildSlotTimeOptions(false);
        refreshCustomControls(form);
      });
    }

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

    if (deleteButton) {
      deleteButton.addEventListener('click', async function () {
        var slotId = String(($('[data-admin-slot-id]', form) || {}).value || '').trim();
        if (!slotId) return;
        await deleteSlotWithChoice(slotId, deleteButton);
      });
    }

    form.addEventListener('submit', handleSlotSubmit);
    form.addEventListener('input', syncSlotSubmitState);
    form.addEventListener('change', syncSlotSubmitState);

    initCustomControls(form);
    installTimeChoices(form.parentElement);
    captureSlotEditorBaseline();
  }

  async function refresh(options) {
    var opts = options || {};
    var activityId = refreshActivityId + 1;
    refreshActivityId = activityId;
    var requestedView = opts.view || adminViewForPage(state.page);
    var hadLoadedView = viewIsLoaded(requestedView);
    var initialModalRoute = modalRouteFromUrl();
    state.isRefreshing = true;
    if (!hadLoadedView) clearPageLoadError();
    setPageBusy(true, opts.background ? 'Refreshing admin data' : 'Loading admin data');
    setSyncState(opts.background ? 'Updating' : 'Loading', 'loading');
    // Bookings and Billing rows come from their own query. Ask for them at
    // the same time as the page data and draw the page once, when both are in.
    var listQuery = null;
    if (state.page === 'bookings') listQuery = loadBookingQuery({ force: true, silent: true, preservePages: true, defer: true });
    else if (state.page === 'invoices') listQuery = loadInvoiceQuery({ force: true, silent: true, preservePages: true, defer: true });
    try {
      var applied = await loadDashboard(requestedView, { force: Boolean(opts.force) });
      window.CheckAutoStartup?.advance(.85);
      if (activityId !== refreshActivityId || !applied || adminViewForPage(state.page) !== requestedView) return false;
      if (!staffCanAccessPage(state.staff, state.page)) {
        redirectTo(PATHS.dashboard);
        return false;
      }
      clearPageLoadError();
      setUserLabel();
      setActiveNav();
      var slotEditorDraft = !opts.background && state.page === 'availability' ? captureSlotEditorDraft() : null;
      if (listQuery) {
        var commitRows = await listQuery;
        if (activityId !== refreshActivityId || adminViewForPage(state.page) !== requestedView) return false;
        if (typeof commitRows !== 'function' || !commitRows()) {
          throw new Error(state.page === 'bookings'
            ? 'Bookings could not be refreshed. Previously loaded records are retained.'
            : 'Invoices could not be refreshed. Previously loaded records are retained.');
        }
      }
      // Reconcile data behind an active editor without resetting its controls.
      if (opts.background && state.page === 'availability' && state.slotEditorOpen) {
        renderCalendar();
      } else if (opts.background) {
        renderPagePreservingDisclosures();
      } else {
        renderPage();
      }
      if (
        !state.hasRendered &&
        pageController &&
        typeof pageController.beforeInitialReveal === 'function'
      ) {
        await pageController.beforeInitialReveal({ state: state });
        if (
          activityId !== refreshActivityId ||
          adminViewForPage(state.page) !== requestedView
        ) return false;
      }
      restoreSlotEditorDraft(slotEditorDraft);
      var currentModalRoute = modalRouteFromUrl();
      if (currentModalRoute && (currentModalRoute.type === 'booking' || currentModalRoute.type === 'invoice')) {
        if (!(await loadSelectedModalRecord(currentModalRoute, activityId))) return false;
        if (activityId !== refreshActivityId || adminViewForPage(state.page) !== requestedView) return false;
        var detailBookingId = currentModalRoute.type === 'booking' ? currentModalRoute.id : invoiceById(currentModalRoute.id)?.booking_id;
        if (detailBookingId && !(await loadBookingOperations(detailBookingId, { render: false, force: true }))) {
          throw new Error('Booking details could not be refreshed. Previously loaded details are retained.');
        }
        if (activityId !== refreshActivityId || adminViewForPage(state.page) !== requestedView) return false;
      }
      currentModalRoute = modalRouteFromUrl();
      if ((initialModalRoute && currentModalRoute && initialModalRoute.type === currentModalRoute.type && initialModalRoute.id === currentModalRoute.id) || (!initialModalRoute && !currentModalRoute)) {
        if (currentModalRoute && modalIsOpen()) reconcileOpenModal();
        else if (!opts.background && !modalIsDirty()) renderModalFromCurrentUrl();
      }
      state.lastSuccessfulRefresh = Date.now();
      setSyncState('Synced', 'synced');
      renderOperationalStatus();
      window.CheckAutoStartup?.advance(.94);
      await showConsole({ preserveScroll: opts.preserveScroll || state.hasRendered });
      if(activityId !== refreshActivityId || adminViewForPage(state.page) !== requestedView) return false;
      startRealtime();
      state.hasRendered = true;
      return true;
    } catch (error) {
      if (isAbortError(error) || activityId !== refreshActivityId) return false;
      if (adminViewForPage(state.page) === requestedView) {
        if(state.loadedViews[requestedView]) state.loadedViews[requestedView].loadedAt=0;
        setSyncState('Sync failed', 'error', error instanceof Error ? error.message : '');
        if (!hadLoadedView) {
          if (state.page === 'dashboard') renderDashboardUnavailable();
          else renderPageLoadError();
        }
      }
      throw error;
    } finally {
      if (activityId === refreshActivityId) {
        state.isRefreshing = false;
        if (adminViewForPage(state.page) === requestedView) setPageBusy(false);
      }
    }
  }

  function renderOperationalStatus() {
    var summary=state.operationsSummary || state.operationsState;
    var count=summary && Number(summary.action_count);
    var badge=$('[data-admin-notification-badge]');
    if(badge && Number.isFinite(count)) {
      badge.textContent=String(count);badge.hidden=count===0;
      var notificationLink=$('[data-admin-nav="notifications"]');
      if(notificationLink) {
        notificationLink.setAttribute('aria-label','Notifications, '+count+(count===1 ? ' action needs attention' : ' actions need attention'));
        notificationLink.setAttribute('title',count ? 'Notifications ('+count+')' : 'Notifications');
      }
    }
    if(state.page!=='notifications') return;
    var content=$('[data-notifications-content]');
    var data=state.operationsState;
    if(!content || !data) return;
    var label=$('[data-notifications-count]');
    if(label) label.textContent=(data.action_count || 0)===1 ? '1 action needs attention' : (data.action_count || 0)+' actions need attention';
    if(!state.notificationActionSaved && (actionCenterHasDraft(content) || content.contains(document.activeElement))) return;
    state.notificationActionSaved=false;
    var openIds=$all('[data-review-id][open]',content).map(function(el){return el.dataset.reviewId;});
    var filter=state.notificationFilter || 'all';
    if(filter!=='all' && !(data.counts && data.counts[filter]>0)) filter=state.notificationFilter='all';
    content.innerHTML=renderActionCenter(data,filter);content.removeAttribute('aria-busy');
    bindActionCenter(content,function(value){state.notificationFilter=value;});
    applyActionFilter(content,filter);
    $all('[data-review-id]',content).forEach(function(el){el.open=openIds.includes(el.dataset.reviewId);});
    $all('[data-admin-action-form]',content).forEach(function(form){form.addEventListener('submit',handleActionSubmit);});
  }

  function renderPage() {
    clearPageLoadError();
    if (pageController && typeof pageController.beforeRender === 'function') {
      pageController.beforeRender({ state: state });
    }
    if (state.page === 'dashboard') renderDashboardPage();
    if (state.page === 'bookings') renderBookingsPage();
    if (state.page === 'availability') renderAvailabilityPage();
    if (state.page === 'customers') renderCustomersPage();
    if (state.page === 'invoices') renderInvoicesPage();
    if (state.page === 'marketing') renderMarketingPage();
    if (state.page === 'organization') renderOrganizationPage();
  }

  function renderPagePreservingDisclosures() {
    var pageRoot = $('[data-page-root]');
    var before = pageRoot ? $all('details', pageRoot) : [];
    var focusedIndex = before.findIndex(function (details) {
      return details.querySelector('summary') === document.activeElement;
    });
    var disclosures = before.map(function (details) {
      return {
        open: details.open,
        key: details.dataset.disclosureKey || '',
        className: details.className
      };
    });
    renderPage();
    if (!disclosures.length || !pageRoot) return;
    var after = $all('details', pageRoot);
    disclosures.forEach(function (saved, index) {
      var details = saved.key
        ? $('[data-disclosure-key="' + escapeSelectorValue(saved.key) + '"]', pageRoot)
        : after[index];
      if (details && (saved.key || details.className === saved.className)) {
        details.open = saved.open;
      }
    });
    if (focusedIndex >= 0 && before[focusedIndex] && !before[focusedIndex].isConnected) {
      var replacement = after[focusedIndex];
      var summary = replacement && replacement.className === disclosures[focusedIndex].className
        ? replacement.querySelector('summary') : null;
      if (summary) summary.focus({ preventScroll: true });
    }
  }

  async function init() {
    els.loading = $('[data-admin-loading]');
    els.console = $('[data-admin-console]');
    window.CheckAutoStartup?.advance(.45);
    clearLegacyDashboardCache();
    applyRouteParameters(document.body.dataset.adminPage || '');
    replaceCurrentHistoryState();

    state.session = await getActiveSession();
    var authenticatedUser = null;
    if (state.session) {
      try {
        authenticatedUser = await auth.getUser(state.session);
        state.authUser = authenticatedUser;
      } catch (error) {
        await revokeAndClearSession(state.session);
      }
    }
    window.CheckAutoStartup?.advance(.6);

    if (state.page === 'login') {
      if (state.session) {
        if (auth.requiresTemporaryPasswordChange(authenticatedUser)) {
          setupLoginEvents('', authenticatedUser);
          await showConsole();
          if (pageController && typeof pageController.afterInit === 'function') {
            pageController.afterInit({ state: state });
          }
          return;
        }
        if (auth.assuranceLevel(state.session) === 'aal2') {
          try {
            var factors = auth.factorsFromUser(authenticatedUser);
            if (factors.totp.length) {
              await loadDashboard('auth', { force: true });
              if(state.recoveryAcknowledgementRequired) {setupLoginEvents('Finish recovery-code setup.');await showConsole();return;}
              redirectTo(PATHS.dashboard);
              return;
            }
          } catch (error) {
            // Fall through to a clean password sign-in.
          }
        }
        await revokeAndClearSession(state.session);
        setupLoginEvents('For your security, sign in again.');
      } else {
        setupLoginEvents();
      }
      await showConsole();
      if (pageController && typeof pageController.afterInit === 'function') {
        pageController.afterInit({ state: state });
      }
      return;
    }

    if (state.session && auth.requiresTemporaryPasswordChange(authenticatedUser)) {
      redirectTo(PATHS.login);
      return;
    }

    if (!state.session || auth.assuranceLevel(state.session) !== 'aal2') {
      if (state.session) await revokeAndClearSession(state.session);
      redirectTo(PATHS.login);
      return;
    }

    await loadDashboard('auth',{force:true});
    window.CheckAutoStartup?.advance(.72);
    if(state.recoveryAcknowledgementRequired){redirectTo(PATHS.login);return;}
    els.loading = $('[data-admin-loading]');
    els.console = $('[data-admin-console]');
    els.stats = $('[data-admin-stats]');

    setupShellEvents();
    document.addEventListener('click', handleAdminRouteClick);
    document.addEventListener('pointerover', handleAdminRouteIntent, { passive: true });
    document.addEventListener('pointerdown', handleAdminRouteIntent, { passive: true });
    document.addEventListener('focusin', handleAdminRouteIntent);
    window.addEventListener('popstate', function (event) {
      handleAdminPopState(event).catch(reportNavigationRefreshError);
    });
    window.addEventListener('scroll', scheduleScrollPositionSave, { passive: true });
    document.addEventListener('visibilitychange', refreshVisiblePageIfStale);
    window.addEventListener('focus', refreshVisiblePageIfStale);
    setupCurrentPageEvents();
    window.addEventListener('storage', function(event) {
      if (event.key !== SESSION_KEY || state.sessionPersistence !== 'local') return;
      if (!event.newValue) { closeRealtime(); storeSession(null); redirectTo(PATHS.login); return; }
      try { state.session=JSON.parse(event.newValue); scheduleSessionRefresh(state.session); closeRealtime(); startRealtime(); } catch (_) {}
    });
    window.setInterval(function () {
      if (document.visibilityState === 'hidden' || !state.session || state.page === 'login' || state.page === 'marketing' || state.isRefreshing) return;
      refresh({ background: true, preserveScroll: true, force: true }).catch(reportNavigationRefreshError);
    }, 30000);
    startExpiryTicker();
    setPageBusy(true, 'Loading admin data');
    setSyncState('Loading', 'loading');

    try {
      await refresh();
    } catch (error) {
      if (redirectPending) return;
      if (!state.session) {
        redirectTo(PATHS.login);
        return;
      }
      setUserLabel();
      setActiveNav();
      await showConsole({ preserveScroll: true });
      if (viewIsLoaded(adminViewForPage(state.page))) {
        showToast(error instanceof Error ? error.message : 'Refresh failed.', 'error');
      }
    }
  }

  Object.assign(modals, {
    closeRoute: closeModalRoute,
    confirm: openConfirmDialog,
    isDirty: modalIsDirty,
    isOpen: modalIsOpen,
    markClean: markModalClean,
    navigate: navigateToModal,
    open: openModal,
    renderCurrent: renderModalFromCurrentUrl,
    reconcile: reconcileOpenModal
  });
  Object.assign(toast, { show: showToast });

  return init();
}
