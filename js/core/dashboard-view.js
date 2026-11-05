/* ==========================================================================
   Dashboard view

   Renders the operations overview from the dashboardAnalytics payload of the
   admin-bookings Edge Function. The runtime owns data loading and passes the
   shared helpers in; this module only turns that payload into markup.

   Layout, top to bottom: what needs a decision, today's schedule, the month
   so far, the booking trend, then payments and inspector workload.
   ========================================================================== */

const TIME_ZONE = 'Europe/Vilnius';
const DAY_MS = 24 * 60 * 60 * 1000;
const TREND_RANGES = [7, 30, 90, 365];

export function createDashboardView(deps) {
  const {
    state,
    paths,
    icons,
    escapeHtml,
    formatMoney,
    formatDate,
    formatTime,
    todayYmd,
    addDaysYmd,
    compareYmd,
    utcNoonFromYmd,
    isValidYmd,
    statusTone,
    statusLabel,
    expiryCountdownHtml,
    staffHasAccess,
    setPressed,
    notificationCount,
    onRetry
  } = deps;

  const $ = (selector, root) => (root || document).querySelector(selector);
  const $all = (selector, root) => Array.from((root || document).querySelectorAll(selector));

  /* Numbers and money
     ------------------------------------------------------------------------ */

  const integerFormat = new Intl.NumberFormat('lt-LT', { maximumFractionDigits: 0 });

  function number(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function count(value) {
    const parsed = number(value);
    return parsed === null ? '–' : integerFormat.format(parsed);
  }

  function plural(value, singular, pluralForm) {
    return count(value) + ' ' + (number(value) === 1 ? singular : pluralForm);
  }

  // Whole currency units for headline figures and chart axes, in the same
  // lt-LT style the rest of the admin uses for money ("1 120 €").
  function moneyWhole(cents, currency) {
    try {
      return new Intl.NumberFormat('lt-LT', {
        style: 'currency',
        currency: currency || 'EUR',
        currencyDisplay: 'narrowSymbol',
        maximumFractionDigits: 0
      }).format(Math.round((Number(cents) || 0) / 100));
    } catch (_) {
      return formatMoney(cents, currency);
    }
  }

  function moneyEntries(value) {
    if (!Array.isArray(value)) return [];
    return value.map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const amount = number(entry.amount_cents);
      const currency = String(entry.currency || '').trim().toUpperCase();
      if (amount === null || !currency) return null;
      return { amount_cents: amount, currency };
    }).filter(Boolean).sort((a, b) => a.currency.localeCompare(b.currency));
  }

  // "↑ 27% from 11". Change is shown in a neutral colour: a mid-month dip is
  // information, not an error.
  function change(current, previous, formatPrevious) {
    const now = number(current);
    const before = number(previous);
    if (now === null || before === null || before < 0) return null;
    const percent = before === 0 ? null : Math.round(((now - before) / before) * 100);
    return {
      direction: now === before || percent === 0 ? 'flat' : (now > before ? 'up' : 'down'),
      percent,
      previous: formatPrevious ? formatPrevious(before) : count(before)
    };
  }

  function changeMarkup(result, comparisonLabel) {
    if (!result) return '';
    let visible;
    let spoken;
    if (result.direction === 'flat') {
      visible = 'Same as ' + result.previous;
      spoken = 'Same as ' + comparisonLabel + ', ' + result.previous;
    } else if (result.percent === null) {
      visible = 'Up from ' + result.previous;
      spoken = 'Up from ' + result.previous + ' in ' + comparisonLabel;
    } else {
      const arrow = result.direction === 'up' ? '↑' : '↓';
      visible = arrow + ' ' + Math.abs(result.percent) + '% <span>from ' + escapeHtml(result.previous) + '</span>';
      spoken = (result.direction === 'up' ? 'Up ' : 'Down ') + Math.abs(result.percent) + '% from ' + result.previous + ' in ' + comparisonLabel;
      return '<span class="admin-dash-change" data-direction="' + result.direction + '">' +
        '<span aria-hidden="true">' + visible + '</span>' +
        '<span class="admin-visually-hidden">' + escapeHtml(spoken) + '</span>' +
      '</span>';
    }
    return '<span class="admin-dash-change" data-direction="' + result.direction + '">' +
      '<span aria-hidden="true">' + escapeHtml(visible) + '</span>' +
      '<span class="admin-visually-hidden">' + escapeHtml(spoken) + '</span>' +
    '</span>';
  }

  /* Dates, always in Vilnius time
     ------------------------------------------------------------------------ */

  function isDate(value) {
    return Boolean(value) && Number.isFinite(new Date(value).getTime());
  }

  function dayDifference(ymd) {
    return Math.round((utcNoonFromYmd(ymd) - utcNoonFromYmd(todayYmd())) / DAY_MS);
  }

  function shortDay(ymd, options) {
    const opts = options || {};
    const sameYear = ymd.slice(0, 4) === todayYmd().slice(0, 4);
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'UTC',
      weekday: opts.weekday ? 'short' : undefined,
      day: 'numeric',
      month: 'short',
      year: sameYear && !opts.year ? undefined : 'numeric'
    }).format(utcNoonFromYmd(ymd));
  }

  // "today", "tomorrow", "yesterday", "Sat 7 Nov" or "7 Oct".
  function dayLabel(value) {
    const ymd = formatDate(value);
    const difference = dayDifference(ymd);
    if (difference === 0) return 'today';
    if (difference === 1) return 'tomorrow';
    if (difference === -1) return 'yesterday';
    return shortDay(ymd, { weekday: Math.abs(difference) <= 6 });
  }

  // "today 14:15", "Sat 7 Nov, 14:15".
  function when(value) {
    if (!isDate(value)) return '';
    const day = dayLabel(value);
    return day + (/^[a-z]/.test(day) ? ' ' : ', ') + formatTime(value);
  }

  function capitalise(text) {
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
  }

  function timeRange(start, end) {
    if (!isDate(start)) return '';
    return isDate(end) ? formatTime(start) + '–' + formatTime(end) : formatTime(start);
  }

  function monthName(ymd, style) {
    return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: style || 'long' }).format(utcNoonFromYmd(ymd));
  }

  // The KPIs compare this month so far with the same days of last month.
  function previousMonthSpan() {
    const today = todayYmd();
    const year = Number(today.slice(0, 4));
    const month = Number(today.slice(5, 7));
    const day = Number(today.slice(8, 10));
    const previous = new Date(Date.UTC(month === 1 ? year - 1 : year, month === 1 ? 11 : month - 2, 1, 12));
    const lastDay = new Date(Date.UTC(previous.getUTCFullYear(), previous.getUTCMonth() + 1, 0, 12)).getUTCDate();
    const end = Math.min(day, lastDay);
    const name = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'long' }).format(previous);
    return end === 1 ? '1 ' + name : '1–' + end + ' ' + name;
  }

  /* Header
     ------------------------------------------------------------------------ */

  function renderHeader(analytics) {
    const date = $('[data-dashboard-date]');
    if (date) {
      date.textContent = new Intl.DateTimeFormat('en-GB', {
        timeZone: TIME_ZONE,
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      }).format(new Date());
    }
    const generated = $('[data-dashboard-generated]');
    if (!generated) return;
    if (analytics && isDate(analytics.generated_at)) {
      const sameDay = formatDate(analytics.generated_at) === todayYmd();
      generated.textContent = 'Updated ' + (sameDay ? formatTime(analytics.generated_at) : when(analytics.generated_at));
    } else {
      generated.textContent = '';
    }
  }

  /* Needs action
     ------------------------------------------------------------------------ */

  function attentionTask(item, isBilling) {
    const reference = escapeHtml(item.reference || 'Booking');
    if (isBilling) {
      return {
        tone: 'warning',
        label: 'Record invoice or payment',
        detail: reference + (isDate(item.completed_at) ? ' · completed ' + escapeHtml(when(item.completed_at)) : ' · no payment recorded'),
        meta: '',
        href: paths.bookings + '?statuses=completed&amp;booking=' + encodeURIComponent(item.id)
      };
    }
    const codes = Array.isArray(item.reason_codes) ? item.reason_codes : [];
    const href = paths.bookings + '?statuses=' + encodeURIComponent(item.status || '') + '&amp;booking=' + encodeURIComponent(item.id);
    if (codes.includes('overdue_confirmed')) {
      return {
        tone: 'danger',
        label: 'Record inspection outcome',
        detail: reference + (isDate(item.end_at) ? ' · ended ' + escapeHtml(when(item.end_at)) : ''),
        meta: '<span class="admin-chip" data-tone="danger">Overdue</span>',
        href
      };
    }
    if (codes.includes('pending_review')) {
      return {
        tone: 'warning',
        label: 'Review booking request',
        detail: reference + (isDate(item.pending_expires_at) ? ' · decide by ' + escapeHtml(when(item.pending_expires_at)) : ''),
        meta: expiryCountdownHtml(item, 'compact'),
        href
      };
    }
    return {
      tone: 'info',
      label: 'Assign an inspector',
      detail: reference + (isDate(item.start_at) ? ' · ' + escapeHtml(when(item.start_at)) : ''),
      meta: '',
      href
    };
  }

  function taskMarkup(task, id) {
    const body =
      '<span class="admin-dot" data-tone="' + task.tone + '" aria-hidden="true"></span>' +
      '<span class="admin-dash-task-text"><strong>' + escapeHtml(task.label) + '</strong><span>' + task.detail + '</span></span>' +
      '<span class="admin-dash-task-meta">' + (task.meta || '') + '</span>' +
      (id ? '<span class="admin-dash-go" aria-hidden="true">' + icons.next + '</span>' : '');
    return '<li>' + (id
      ? '<a class="admin-dash-task" href="' + task.href + '">' + body + '</a>'
      : '<div class="admin-dash-task">' + body + '</div>') + '</li>';
  }

  function setAttentionCount(total, tone) {
    const badge = $('[data-dashboard-attention-count]');
    if (!badge) return;
    badge.hidden = !(total > 0);
    badge.textContent = total > 0 ? count(total) : '';
    badge.dataset.tone = tone || 'neutral';
    badge.setAttribute('aria-label', total > 0 ? plural(total, 'item', 'items') : '');
  }

  function clearState(title, text) {
    return '<div class="admin-dash-clear" role="status">' +
      '<span class="admin-dash-clear-icon" aria-hidden="true">' + icons.check + '</span>' +
      '<span><strong>' + escapeHtml(title) + '</strong><span>' + escapeHtml(text) + '</span></span>' +
    '</div>';
  }

  function unavailable(message) {
    return '<p class="admin-dash-unavailable" role="status">' + escapeHtml(message) + '</p>';
  }

  // Inquiries, email problems and other follow-ups live in Notifications;
  // point there so the dashboard queue is never the whole story by accident.
  function queueLinks(hasMoreBookings) {
    const pending = typeof notificationCount === 'function' ? notificationCount() : 0;
    const links = [];
    if (hasMoreBookings) links.push('<a class="admin-link-more" href="' + paths.bookings + '">View all bookings' + icons.next + '</a>');
    if (pending > 0 && paths.notifications) {
      links.push('<a class="admin-link-more" href="' + paths.notifications + '">All notifications (' + count(pending) + ')' + icons.next + '</a>');
    }
    return links.length ? '<div class="admin-link-row">' + links.join('') + '</div>' : '';
  }

  function renderAttention(analytics) {
    const root = $('[data-dashboard-attention]');
    if (!root) return;
    const operations = analytics && analytics.operations && typeof analytics.operations === 'object' ? analytics.operations : null;
    const attention = operations && operations.attention && typeof operations.attention === 'object' ? operations.attention : null;
    const reminders = analytics && analytics.action_reminders && typeof analytics.action_reminders === 'object' ? analytics.action_reminders : {};
    const legacyToday = analytics && analytics.today && typeof analytics.today === 'object' ? analytics.today : null;
    const canManage = staffHasAccess(state.staff, 'operations.manage', ['owner', 'admin', 'inspector']);
    const title = $('[data-dashboard-attention-title]');
    if (title) title.textContent = canManage ? 'Needs action' : 'Booking watchlist';

    if (attention && Array.isArray(attention.items)) {
      const billingItems = Array.isArray(reminders.billing_items) ? reminders.billing_items : [];
      const total = (number(attention.total_unique_count) || 0) + (number(reminders.billing_total_count) || 0);
      const bookingTasks = attention.items.slice(0, 4).map((item) => ({ item, task: attentionTask(item, false) }));
      const billingTasks = billingItems.slice(0, 2).map((item) => ({ item, task: attentionTask(item, true) }));
      const tasks = bookingTasks.concat(billingTasks);
      setAttentionCount(total, tasks.some(({ task }) => task.tone === 'danger') ? 'danger' : 'warning');
      if (!tasks.length) {
        root.innerHTML = clearState('All clear', 'No booking decisions, overdue outcomes or unpaid work.') + queueLinks(false);
        return;
      }
      const hasMore = attention.has_more || reminders.billing_has_more || total > tasks.length;
      root.innerHTML = '<ul class="admin-dash-tasks">' + tasks.map(({ item, task }) => taskMarkup(task, item.id)).join('') + '</ul>' +
        queueLinks(hasMore);
      return;
    }

    // Older payloads only carry today's counters.
    const pending = number(legacyToday && legacyToday.pending_approvals);
    const unassigned = number(legacyToday && legacyToday.unassigned);
    if (pending === null || unassigned === null) {
      setAttentionCount(0);
      root.innerHTML = unavailable('The action list is not available right now.');
      return;
    }
    setAttentionCount(pending + unassigned, 'warning');
    if (!(pending + unassigned)) {
      root.innerHTML = clearState('All clear', 'No pending approvals or unassigned bookings.');
      return;
    }
    const legacyTasks = [];
    if (pending) legacyTasks.push({ tone: 'warning', label: 'Review booking requests', detail: escapeHtml(plural(pending, 'request', 'requests')) + ' waiting', meta: '', href: paths.bookings + '?filter=pending' });
    if (unassigned) legacyTasks.push({ tone: 'info', label: 'Assign inspectors', detail: escapeHtml(plural(unassigned, 'booking', 'bookings')) + ' without an inspector', meta: '', href: paths.bookings + '?filter=all' });
    root.innerHTML = '<ul class="admin-dash-tasks">' + legacyTasks.map((task) => taskMarkup(task, 'legacy')).join('') + '</ul>';
  }

  /* Today
     ------------------------------------------------------------------------ */

  function scheduleRow(booking, isNext) {
    const tone = booking.status === 'completed' ? 'success' : (booking.status === 'pending' ? 'warning' : (isNext ? 'accent' : 'neutral'));
    const context = [booking.service_name, booking.assigned_name || 'Unassigned'].filter(Boolean).join(' · ');
    const statusText = booking.status === 'confirmed' ? (isNext ? 'Next' : '') : statusLabel(booking.status || 'unknown');
    const body =
      '<span class="admin-dash-time">' + escapeHtml(timeRange(booking.start_at, booking.end_at) || '–') + '</span>' +
      '<span class="admin-dot" data-tone="' + tone + '" aria-hidden="true"></span>' +
      '<span class="admin-dash-task-text"><strong>' + escapeHtml(booking.reference || 'Booking') + '</strong><span>' + escapeHtml(context) + '</span></span>' +
      (statusText ? '<span class="admin-chip" data-tone="' + (isNext ? 'accent' : escapeHtml(statusTone(booking.status))) + '">' + escapeHtml(statusText) + '</span>' : '');
    const className = 'admin-dash-slot' + (booking.status === 'completed' ? ' is-done' : '') + (isNext ? ' is-next' : '');
    return '<li>' + (booking.id
      ? '<a class="' + className + '" href="' + paths.bookings + '?filter=today&amp;booking=' + encodeURIComponent(booking.id) + '">' + body + '</a>'
      : '<div class="' + className + '">' + body + '</div>') + '</li>';
  }

  function renderToday(analytics) {
    const root = $('[data-dashboard-today]');
    const progressRoot = $('[data-dashboard-today-progress]');
    if (!root) return;
    const legacyToday = analytics && analytics.today && typeof analytics.today === 'object' ? analytics.today : null;
    const operations = analytics && analytics.operations && typeof analytics.operations === 'object' ? analytics.operations : null;
    const today = operations && operations.today && typeof operations.today === 'object' ? operations.today : null;
    if (!legacyToday && !today) {
      if (progressRoot) progressRoot.innerHTML = '';
      root.innerHTML = unavailable("Today's schedule is not available right now.");
      return;
    }

    const progress = today && today.progress && typeof today.progress === 'object' ? today.progress : null;
    const capacity = today && today.capacity && typeof today.capacity === 'object' ? today.capacity : null;
    const bookings = today && Array.isArray(today.bookings)
      ? today.bookings
      : (legacyToday && Array.isArray(legacyToday.bookings) ? legacyToday.bookings : []);
    let accepted = number(progress && progress.accepted_count);
    let completed = number(progress && progress.completed_count);
    let remaining = number(progress && progress.remaining_confirmed_count);
    if (accepted === null) accepted = number(legacyToday && legacyToday.scheduled_count);
    if (completed === null) completed = bookings.filter((booking) => booking.status === 'completed').length;
    if (remaining === null) remaining = bookings.filter((booking) => booking.status === 'confirmed').length;
    const reminders = analytics.action_reminders && typeof analytics.action_reminders === 'object' ? analytics.action_reminders : null;
    const remainingThisWeek = number(reminders && reminders.remaining_through_sunday_count);
    if (remainingThisWeek !== null) remaining = remainingThisWeek;

    if (progressRoot) {
      progressRoot.innerHTML = accepted > 0
        ? '<span class="admin-dash-progress-label"><strong>' + escapeHtml(count(completed)) + ' of ' + escapeHtml(count(accepted)) + '</strong> done</span>' +
          '<span class="admin-dash-progress" role="progressbar" aria-label="Accepted inspections completed today" aria-valuemin="0" aria-valuemax="' + Math.max(1, accepted) + '" aria-valuenow="' + Math.max(0, completed || 0) + '">' +
            '<span style="--admin-dash-progress:' + Math.max(0, Math.min(100, ((completed || 0) / accepted) * 100)).toFixed(1) + '%"></span>' +
          '</span>'
        : '';
    }

    const now = Date.now();
    const sorted = bookings.filter((booking) => booking && typeof booking === 'object')
      .slice()
      .sort((a, b) => String(a.start_at || '').localeCompare(String(b.start_at || '')));
    const next = sorted.find((booking) => booking.status === 'confirmed' && isDate(booking.start_at) && new Date(booking.end_at || booking.start_at).getTime() >= now) || null;
    const visible = sorted.slice(0, 6);
    const hiddenCount = sorted.length - visible.length;

    const capacityWindow = analytics.capacity_window && typeof analytics.capacity_window === 'object' ? analytics.capacity_window : null;
    const windowDays = number(capacityWindow && capacityWindow.window_days);
    let openTimes = number(capacityWindow && capacityWindow.bookable_time_count);
    if (openTimes === null) openTimes = number(capacity && capacity.bookable_time_count);
    if (openTimes === null) openTimes = number(legacyToday && legacyToday.available_slots_remaining);
    const nextOpen = capacityWindow && isDate(capacityWindow.next_bookable_start_at) ? capacityWindow.next_bookable_start_at : null;
    const openText = openTimes === null
      ? ''
      : (openTimes === 0
        ? 'No open times' + (windowDays ? ' in the next ' + count(windowDays) + ' days' : ' later today')
        : plural(openTimes, 'open time', 'open times') + (windowDays ? ' in the next ' + count(windowDays) + ' days' : ' later today') +
          (nextOpen ? ', first ' + when(nextOpen) : ''));

    const schedule = visible.length
      ? '<ol class="admin-dash-schedule">' + visible.map((booking) => scheduleRow(booking, booking === next)).join('') + '</ol>'
      : '<div class="admin-dash-quiet" role="status"><strong>No inspections today</strong>' +
          (remaining > 0 ? '<span>' + escapeHtml(plural(remaining, 'confirmed inspection', 'confirmed inspections')) + ' left this week.</span>' : '') +
        '</div>';

    const facts = [];
    if (visible.length && remaining !== null) facts.push(escapeHtml(plural(remaining, 'confirmed inspection', 'confirmed inspections')) + ' left this week');
    if (openText) facts.push('<a href="' + paths.availability + '">' + escapeHtml(openText) + '</a>');

    root.innerHTML = schedule +
      '<div class="admin-card-foot">' +
        (facts.length ? '<ul class="admin-dash-facts">' + facts.map((fact) => '<li>' + fact + '</li>').join('') + '</ul>' : '') +
        '<a class="admin-link-more" href="' + paths.bookings + '?filter=today">' +
          (hiddenCount > 0 ? 'All ' + count(sorted.length) + ' of today\'s bookings' : 'Today\'s bookings') + icons.next +
        '</a>' +
      '</div>';
  }

  /* Month so far
     ------------------------------------------------------------------------ */

  function revenueFromTrend(analytics, offset) {
    const rows = Array.isArray(analytics && analytics.revenue_trend) ? analytics.revenue_trend : [];
    const months = rows.map((row) => String(row && row.month || '').slice(0, 7))
      .filter((month, index, values) => /^\d{4}-\d{2}$/.test(month) && values.indexOf(month) === index)
      .sort();
    const month = months[months.length - 1 - Math.max(0, Number(offset) || 0)];
    if (!month) return [];
    return rows.filter((row) => String(row && row.month || '').slice(0, 7) === month)
      .map((row) => ({ currency: row.currency, amount_cents: row.amount_cents }));
  }

  function tileMarkup(tile) {
    const tag = tile.href ? 'a' : 'div';
    return '<li><' + tag + ' class="admin-dash-tile"' + (tile.href ? ' href="' + escapeHtml(tile.href) + '"' : '') + '>' +
      '<span class="admin-dash-tile-value' + (tile.unavailable ? ' is-unavailable' : '') + '">' + tile.value + '</span>' +
      '<span class="admin-dash-tile-label">' + escapeHtml(tile.label) + '</span>' +
      (tile.note ? '<span class="admin-dash-tile-note">' + escapeHtml(tile.note) + '</span>' : '') +
      tile.change +
    '</' + tag + '></li>';
  }

  function renderMonth(analytics) {
    const root = $('[data-dashboard-kpis]');
    if (!root) return;
    const title = $('[data-dashboard-month-title]');
    const caption = $('[data-dashboard-month-caption]');
    const today = todayYmd();
    const comparison = previousMonthSpan();
    if (title) title.textContent = monthName(today) + ' so far';
    if (caption) caption.textContent = 'Compared with ' + comparison;

    const kpis = analytics && analytics.kpis && typeof analytics.kpis === 'object' ? analytics.kpis : null;
    if (!kpis) {
      root.innerHTML = '<li>' + unavailable('Monthly figures are not available right now.') + '</li>';
      return;
    }
    const monthStart = today.slice(0, 8) + '01';
    const countTile = (label, metric, href) => {
      const current = number(metric && metric.current);
      return {
        label,
        value: current === null ? 'Not available' : escapeHtml(count(current)),
        unavailable: current === null,
        change: changeMarkup(change(metric && metric.current, metric && metric.previous), comparison),
        href
      };
    };
    const tiles = [
      countTile('Bookings received', kpis.bookings_month, paths.bookings + '?dateField=received&from=' + monthStart + '&to=' + today),
      countTile('Inspections completed', kpis.completed_month, paths.bookings + '?statuses=completed&dateField=completed&from=' + monthStart + '&to=' + today)
    ];

    if (analytics.can_view_financials === true) {
      const metric = kpis.revenue_month && typeof kpis.revenue_month === 'object' ? kpis.revenue_month : null;
      const has = (key) => metric && Object.prototype.hasOwnProperty.call(metric, key);
      const current = has('current') ? moneyEntries(metric.current) : moneyEntries(revenueFromTrend(analytics, 0));
      const previous = has('previous') ? moneyEntries(metric.previous) : moneyEntries(revenueFromTrend(analytics, 1));
      const currencies = current.length ? current : (previous.length ? previous.map((entry) => ({ currency: entry.currency, amount_cents: 0 })) : [{ currency: 'EUR', amount_cents: 0 }]);
      const single = currencies.length === 1 && previous.length <= 1 && (!previous.length || previous[0].currency === currencies[0].currency);
      tiles.push({
        label: 'Payments received',
        note: analytics.reporting_warning || '',
        value: currencies.map((entry) => escapeHtml(moneyWhole(entry.amount_cents, entry.currency))).join('<span aria-hidden="true"> · </span>'),
        unavailable: false,
        change: single && previous.length
          ? changeMarkup(change(currencies[0].amount_cents, previous[0].amount_cents, (value) => moneyWhole(value, currencies[0].currency)), comparison)
          : '',
        href: paths.bookings + '?statuses=completed'
      });
    }
    root.style.setProperty('--admin-dash-tiles', String(tiles.length));
    root.innerHTML = tiles.map(tileMarkup).join('');
  }

  /* Charts: HTML bars with an SVG line overlay, so labels stay at their real
     size at every width instead of scaling with an SVG viewBox.
     ------------------------------------------------------------------------ */

  function niceStep(rough, integers) {
    if (!(rough > 0)) return 1;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
    const residual = rough / magnitude;
    let step;
    if (residual <= 1) step = 1;
    else if (residual <= 2) step = 2;
    else if (residual <= 2.5 && !(integers && magnitude === 1)) step = 2.5;
    else if (residual <= 5) step = 5;
    else step = 10;
    const value = step * magnitude;
    return integers ? Math.max(1, Math.round(value)) : value;
  }

  function chartScale(maximum, integers) {
    const step = niceStep(Math.max(0, maximum) / 4, integers);
    const ticks = Math.max(1, Math.ceil(Math.max(maximum, step) / step));
    return { top: step * ticks, ticks: Array.from({ length: ticks + 1 }, (_, index) => index * step) };
  }

  function chartMarkup(options) {
    const points = options.points;
    const n = points.length;
    const barKey = options.bar && options.bar.key;
    const lineKey = options.line && options.line.key;
    const maximum = points.reduce((highest, point) => Math.max(highest, barKey ? point[barKey] : 0, lineKey ? point[lineKey] : 0), 0);
    const scale = chartScale(maximum, options.integers !== false);
    const percent = (value) => Math.max(0, Math.min(100, ((Number(value) || 0) / scale.top) * 100));
    const labelStep = n <= 8 ? 1 : Math.ceil(n / 6);

    const tickLabels = scale.ticks.map((tick) => options.axisLabel(tick));
    // The widest label sits invisibly in the flow so the axis column is sized to fit it.
    const widest = tickLabels.reduce((longest, label) => (label.length > longest.length ? label : longest), '');
    const yLabels = '<span class="admin-dash-chart-y-size">' + escapeHtml(widest) + '</span>' + scale.ticks.map((tick, index) =>
      '<span style="bottom:' + percent(tick).toFixed(2) + '%">' + escapeHtml(tickLabels[index]) + '</span>'
    ).join('');
    const grid = scale.ticks.map((tick) =>
      '<span style="bottom:' + percent(tick).toFixed(2) + '%"></span>'
    ).join('');
    const columns = points.map((point, index) => {
      const tooltip = options.tooltip(point, index);
      const partial = options.partialLast && index === n - 1;
      return '<span class="admin-dash-chart-col' + (partial ? ' is-partial' : '') + '" role="img" tabindex="' + (index === n - 1 ? '0' : '-1') + '"' +
        ' aria-label="' + escapeHtml(tooltip) + '" data-dashboard-chart-point data-chart-tooltip="' + escapeHtml(tooltip) + '"' +
        ' style="--x:' + (((index + 0.5) / n) * 100).toFixed(3) + '%">' +
        (barKey ? '<span class="admin-dash-chart-bar" style="height:' + percent(point[barKey]).toFixed(2) + '%"></span>' : '') +
        (lineKey ? '<span class="admin-dash-chart-dot" style="bottom:' + percent(point[lineKey]).toFixed(2) + '%"></span>' : '') +
      '</span>';
    }).join('');
    const vertex = (point, index) => (index + 0.5).toFixed(2) + ' ' + (100 - percent(point[lineKey])).toFixed(2);
    // A partial last period gets a dashed final segment, like its dashed bar.
    const solidPoints = options.partialLast && n > 2 ? points.slice(0, -1) : points;
    const line = lineKey && n > 1
      ? '<svg class="admin-dash-chart-line" viewBox="0 0 ' + n + ' 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">' +
          '<path d="' + solidPoints.map((point, index) => (index ? 'L' : 'M') + vertex(point, index)).join(' ') + '"></path>' +
          (solidPoints.length < n ? '<path class="is-partial" d="M' + vertex(points[n - 2], n - 2) + ' L' + vertex(points[n - 1], n - 1) + '"></path>' : '') +
        '</svg>'
      : '';
    const xLabels = points.map((point, index) => {
      const fromEnd = n - 1 - index;
      if (fromEnd % labelStep !== 0) return '';
      const minor = (fromEnd / labelStep) % 2 === 1 ? ' class="is-minor"' : '';
      return '<span' + minor + ' style="--x:' + (((index + 0.5) / n) * 100).toFixed(3) + '%">' + escapeHtml(point.axisLabel) + '</span>';
    }).join('');

    return '<figure class="admin-dash-chart' + (options.compact ? ' is-compact' : '') + '" style="--columns:' + n + '">' +
      '<figcaption class="admin-visually-hidden">' + escapeHtml(options.description) + '</figcaption>' +
      '<div class="admin-dash-chart-y" aria-hidden="true">' + yLabels + '</div>' +
      '<div class="admin-dash-chart-plot" role="group" aria-label="' + escapeHtml(options.title) + '. Use the arrow keys to move between periods.">' +
        '<div class="admin-dash-chart-grid" aria-hidden="true">' + grid + '</div>' +
        line + columns +
        '<div class="admin-dash-chart-tip" data-dashboard-chart-tooltip aria-hidden="true" hidden></div>' +
      '</div>' +
      '<div class="admin-dash-chart-x" aria-hidden="true">' + xLabels + '</div>' +
    '</figure>';
  }

  function bindChart(root) {
    $all('.admin-dash-chart-plot', root).forEach((plot) => {
      const tip = $('[data-dashboard-chart-tooltip]', plot);
      const columns = $all('[data-dashboard-chart-point]', plot);
      if (!tip) return;
      const show = (column) => {
        const x = parseFloat(column.style.getPropertyValue('--x')) || 0;
        tip.textContent = column.dataset.chartTooltip || '';
        tip.style.setProperty('--x', x + '%');
        tip.classList.toggle('is-start', x < 18);
        tip.classList.toggle('is-end', x > 82);
        tip.hidden = false;
        columns.forEach((item) => item.classList.toggle('is-active', item === column));
      };
      const hide = () => {
        tip.hidden = true;
        columns.forEach((item) => item.classList.remove('is-active'));
      };
      columns.forEach((column, index) => {
        column.addEventListener('pointerenter', () => show(column));
        column.addEventListener('focus', () => show(column));
        column.addEventListener('blur', hide);
        column.addEventListener('keydown', (event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? columns.length - 1
            : Math.max(0, Math.min(columns.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)));
          if (nextIndex === index) return;
          event.preventDefault();
          column.setAttribute('tabindex', '-1');
          columns[nextIndex].setAttribute('tabindex', '0');
          columns[nextIndex].focus();
        });
      });
      plot.addEventListener('pointerleave', () => {
        if (!plot.contains(document.activeElement)) hide();
      });
    });
  }

  function dataTable(summary, headings, rows) {
    return '<details class="admin-dash-data"><summary>' + escapeHtml(summary) + '</summary>' +
      '<div class="admin-dash-table"><table><thead><tr>' + headings.map((heading) => '<th scope="col">' + escapeHtml(heading) + '</th>').join('') + '</tr></thead><tbody>' +
        rows.map((cells) => '<tr><th scope="row">' + escapeHtml(cells[0]) + '</th>' + cells.slice(1).map((cell) => '<td>' + escapeHtml(cell) + '</td>').join('') + '</tr>').join('') +
      '</tbody></table></div></details>';
  }

  /* Booking trend
     ------------------------------------------------------------------------ */

  function trendRows(value) {
    if (!Array.isArray(value)) return [];
    return value.map((row) => {
      if (!row || !isValidYmd(row.date)) return null;
      const values = ['total', 'completed', 'cancelled', 'rejected'].map((key) => number(row[key]));
      if (values.some((item) => item === null)) return null;
      return { date: row.date, total: values[0], completed: values[1], cancelled: values[2], rejected: values[3] };
    }).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date));
  }

  function trendWindow(rows, days, offset) {
    if (!rows.length) return [];
    const latest = rows[rows.length - 1].date;
    const end = addDaysYmd(latest, -(days * (offset || 0)));
    const start = addDaysYmd(end, -(days - 1));
    return rows.filter((row) => compareYmd(row.date, start) >= 0 && compareYmd(row.date, end) <= 0);
  }

  function totals(rows) {
    return rows.reduce((sum, row) => {
      sum.total += row.total;
      sum.completed += row.completed;
      sum.cancelled += row.cancelled;
      sum.rejected += row.rejected;
      return sum;
    }, { total: 0, completed: 0, cancelled: 0, rejected: 0 });
  }

  function trendBuckets(rows, days) {
    if (days <= 30) {
      return rows.map((row) => ({
        ...row,
        label: shortDay(row.date, { weekday: true }),
        axisLabel: days === 7 ? shortDay(row.date, { weekday: true }).split(' ').slice(0, 2).join(' ') : shortDay(row.date)
      }));
    }
    const groups = new Map();
    const latest = rows.length ? rows[rows.length - 1].date : '';
    rows.forEach((row) => {
      const key = days <= 90
        ? 'w' + Math.floor(Math.round((utcNoonFromYmd(latest) - utcNoonFromYmd(row.date)) / DAY_MS) / 7)
        : row.date.slice(0, 7);
      if (!groups.has(key)) groups.set(key, { first: row.date, last: row.date, total: 0, completed: 0, cancelled: 0, rejected: 0 });
      const bucket = groups.get(key);
      if (compareYmd(row.date, bucket.first) < 0) bucket.first = row.date;
      if (compareYmd(row.date, bucket.last) > 0) bucket.last = row.date;
      bucket.total += row.total;
      bucket.completed += row.completed;
      bucket.cancelled += row.cancelled;
      bucket.rejected += row.rejected;
    });
    return Array.from(groups.values()).sort((a, b) => a.first.localeCompare(b.first)).map((bucket, index) => {
      const monthly = days > 90;
      const showYear = index === 0 || bucket.first.slice(5, 7) === '01';
      return {
        date: bucket.first,
        total: bucket.total,
        completed: bucket.completed,
        cancelled: bucket.cancelled,
        rejected: bucket.rejected,
        label: monthly
          ? monthName(bucket.first, 'long') + ' ' + bucket.first.slice(0, 4)
          : shortDay(bucket.first) + (bucket.first === bucket.last ? '' : '–' + shortDay(bucket.last)),
        axisLabel: monthly ? monthName(bucket.first, 'short') + (showYear ? ' ' + bucket.first.slice(0, 4) : '') : shortDay(bucket.first)
      };
    });
  }

  function rangeLabel(days) {
    return days === 365 ? '12 months' : (days === 90 ? '3 months' : days + ' days');
  }

  function renderTrend(analytics) {
    const root = $('[data-dashboard-trend-chart]');
    const summary = $('[data-dashboard-trend-summary]');
    if (!root) return;
    const days = TREND_RANGES.includes(Number(state.dashboardTrendDays)) ? Number(state.dashboardTrendDays) : 30;
    state.dashboardTrendDays = days;
    const allRows = trendRows(analytics && analytics.booking_trend);
    const rows = trendWindow(allRows, days, 0);
    root.removeAttribute('aria-hidden');
    if (!rows.length) {
      if (summary) summary.innerHTML = '';
      root.innerHTML = unavailable('No booking history for this period yet.');
      return;
    }
    const current = totals(rows);
    const previousRows = trendWindow(allRows, days, 1);
    const previous = previousRows.length === days ? totals(previousRows) : null;
    const comparison = 'the ' + rangeLabel(days) + ' before';
    if (summary) {
      summary.innerHTML =
        '<span class="admin-dash-legend"><span class="admin-dash-key is-bar" aria-hidden="true"></span><strong>' + escapeHtml(count(current.total)) + '</strong> received ' +
          changeMarkup(previous ? change(current.total, previous.total) : null, comparison) + '</span>' +
        '<span class="admin-dash-legend"><span class="admin-dash-key is-line" aria-hidden="true"></span><strong>' + escapeHtml(count(current.completed)) + '</strong> completed ' +
          changeMarkup(previous ? change(current.completed, previous.completed) : null, comparison) + '</span>';
    }
    const points = trendBuckets(rows, days);
    const description = plural(current.total, 'booking received', 'bookings received') + ' and ' +
      plural(current.completed, 'inspection completed', 'inspections completed') + ' in the last ' + rangeLabel(days) + '.';
    root.innerHTML = chartMarkup({
      title: 'Bookings received and inspections completed',
      description,
      points,
      bar: { key: 'total' },
      line: { key: 'completed' },
      partialLast: days === 365,
      axisLabel: (value) => count(value),
      tooltip: (point, index) => point.label + (days === 365 && index === points.length - 1 ? ' (so far)' : '') + ': ' +
        count(point.total) + ' received, ' + count(point.completed) + ' completed'
    }) + dataTable('Show as a table', ['Period', 'Received', 'Completed', 'Cancelled', 'Rejected'], points.map((point) => [
      point.label, count(point.total), count(point.completed), count(point.cancelled), count(point.rejected)
    ]));
    bindChart(root);
  }

  /* Payments
     ------------------------------------------------------------------------ */

  function revenueRows(value) {
    if (!Array.isArray(value)) return [];
    return value.map((row) => {
      const amount = row && number(row.amount_cents);
      const month = row && String(row.month || '').slice(0, 7);
      const currency = row && String(row.currency || '').trim().toUpperCase();
      if (amount === null || !/^\d{4}-\d{2}$/.test(month) || !currency) return null;
      return { month, date: month + '-01', amount_cents: amount, currency };
    }).filter(Boolean).sort((a, b) => a.month.localeCompare(b.month) || a.currency.localeCompare(b.currency));
  }

  function renderRevenue(analytics) {
    const panel = $('[data-dashboard-revenue-panel]');
    const root = $('[data-dashboard-revenue]');
    if (!panel || !root) return false;
    const hide = () => { panel.hidden = true; root.innerHTML = ''; return false; };
    if (!analytics || analytics.can_view_financials !== true) return hide();
    const grouped = new Map();
    revenueRows(analytics.revenue_trend).forEach((row) => {
      if (!grouped.has(row.currency)) grouped.set(row.currency, []);
      grouped.get(row.currency).push(row);
    });
    // Only chart a currency once it has at least three full months of payments.
    const currencies = Array.from(grouped.keys()).sort().filter((currency) =>
      grouped.get(currency).slice(0, -1).filter((point) => point.amount_cents > 0).length >= 3
    );
    if (!currencies.length) return hide();
    panel.hidden = false;
    root.innerHTML = currencies.map((currency) => {
      const points = grouped.get(currency).map((point, index) => ({
        ...point,
        label: monthName(point.date) + ' ' + point.month.slice(0, 4),
        axisLabel: monthName(point.date, 'short') + (index === 0 || point.month.slice(5) === '01' ? ' ' + point.month.slice(0, 4) : '')
      }));
      const last = points[points.length - 1];
      const before = points[points.length - 2] || null;
      const summary = moneyWhole(last.amount_cents, currency) + ' so far in ' + monthName(last.date) +
        (before ? ' · ' + moneyWhole(before.amount_cents, currency) + ' in ' + monthName(before.date) : '');
      return '<section class="admin-dash-revenue-series">' +
        (currencies.length > 1 ? '<h3>' + escapeHtml(currency) + '</h3>' : '') +
        '<p class="admin-dash-card-summary">' + escapeHtml(summary) + '</p>' +
        chartMarkup({
          title: 'Payments received per month in ' + currency,
          description: 'Monthly payments received in ' + currency + '. ' + summary + '.',
          points,
          bar: { key: 'amount_cents' },
          partialLast: true,
          compact: true,
          integers: false,
          axisLabel: (value) => moneyWhole(value, currency),
          tooltip: (point, index) => point.label + (index === points.length - 1 ? ' (so far)' : '') + ': ' + formatMoney(point.amount_cents, currency)
        }) +
        dataTable('Show as a table', ['Month', 'Payments received'], points.map((point, index) => [
          point.label + (index === points.length - 1 ? ' (so far)' : ''), formatMoney(point.amount_cents, currency)
        ])) +
      '</section>';
    }).join('');
    bindChart(root);
    return true;
  }

  /* Inspector workload
     ------------------------------------------------------------------------ */

  function renderStaff(analytics) {
    const panel = $('[data-dashboard-staff-panel]');
    const root = $('[data-dashboard-staff]');
    if (!panel || !root) return false;
    const hide = () => { panel.hidden = true; root.innerHTML = ''; return false; };
    if (!analytics || !Array.isArray(analytics.staff_performance)) return hide();
    const periodDays = 30;
    const rows = analytics.staff_performance
      .filter((row) => number(row && row.period_days) === periodDays && (number(row && row.completed_count) || 0) > 0)
      .map((row) => ({ name: String(row.display_name || '').trim() || 'Staff member', count: Math.round(number(row.completed_count) || 0) }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    const total = rows.reduce((sum, row) => sum + row.count, 0);
    // A share only means something with more than one inspector and some volume.
    if (rows.length < 2 || total < 5) return hide();
    const shown = rows.length > 6 ? rows.slice(0, 5).concat({ name: 'Other inspectors', count: rows.slice(5).reduce((sum, row) => sum + row.count, 0) }) : rows;
    const highest = Math.max(...shown.map((row) => row.count), 1);
    const unattributedRow = (Array.isArray(analytics.unattributed_completed) ? analytics.unattributed_completed : [])
      .find((row) => number(row && row.period_days) === periodDays);
    const unattributedCount = Math.max(0, number(unattributedRow && unattributedRow.completed_count) || 0);
    panel.hidden = false;
    root.innerHTML =
      '<ol class="admin-dash-bars">' + shown.map((row) =>
        '<li>' +
          '<span class="admin-dash-bars-name">' + escapeHtml(row.name) + '</span>' +
          '<span class="admin-dash-bars-track" aria-hidden="true"><span style="width:' + ((row.count / highest) * 100).toFixed(1) + '%"></span></span>' +
          '<span class="admin-dash-bars-value">' + escapeHtml(count(row.count)) +
            '<span class="admin-visually-hidden"> inspections, ' + Math.round((row.count / total) * 100) + '% of ' + escapeHtml(count(total)) + '</span></span>' +
        '</li>'
      ).join('') + '</ol>' +
      (unattributedCount > 0
        ? '<p class="admin-dash-note">' + escapeHtml(plural(unattributedCount, 'completed inspection has', 'completed inspections have')) + ' no inspector recorded and ' + (unattributedCount === 1 ? 'is' : 'are') + ' not counted.</p>'
        : '');
    return true;
  }

  /* Page states
     ------------------------------------------------------------------------ */

  function renderUnavailable() {
    const status = $('[data-dashboard-status]');
    const content = $('[data-dashboard-content]');
    const generated = $('[data-dashboard-generated]');
    renderHeader(null);
    if (generated) generated.textContent = '';
    if (content) content.hidden = true;
    if (!status) return;
    status.hidden = false;
    status.setAttribute('role', 'alert');
    status.innerHTML =
      '<span class="admin-dash-clear-icon" data-tone="danger" aria-hidden="true">' + icons.alert + '</span>' +
      '<div><h2>The dashboard could not load</h2><p>Check your connection, then try again.</p></div>' +
      '<button class="admin-button admin-button-secondary" type="button" data-dashboard-retry>Try again</button>';
    const retry = $('[data-dashboard-retry]', status);
    if (retry) {
      retry.addEventListener('click', () => {
        retry.disabled = true;
        Promise.resolve(onRetry()).finally(() => {
          if (retry.isConnected) retry.disabled = false;
        });
      });
    }
  }

  function render() {
    const analytics = state.dashboardAnalytics;
    if (!analytics || typeof analytics !== 'object') {
      renderUnavailable();
      return;
    }
    const status = $('[data-dashboard-status]');
    const content = $('[data-dashboard-content]');
    if (status) {
      status.hidden = true;
      status.removeAttribute('role');
      status.innerHTML = '';
    }
    if (content) content.hidden = false;
    renderHeader(analytics);
    renderAttention(analytics);
    renderToday(analytics);
    renderMonth(analytics);
    renderTrend(analytics);
    const hasRevenue = renderRevenue(analytics);
    const hasStaff = renderStaff(analytics);
    const pair = $('[data-dashboard-secondary]');
    if (pair) {
      pair.hidden = !hasRevenue && !hasStaff;
      pair.classList.toggle('is-single', hasRevenue !== hasStaff);
    }
  }

  function setupEvents() {
    const controls = $('[data-dashboard-trend-range]');
    if (!controls) return;
    $all('[data-trend-days]', controls).forEach((button) => {
      const days = Number(button.dataset.trendDays);
      button.disabled = false;
      setPressed(button, days === Number(state.dashboardTrendDays));
      button.addEventListener('click', () => {
        if (!TREND_RANGES.includes(days) || days === Number(state.dashboardTrendDays)) return;
        state.dashboardTrendDays = days;
        $all('[data-trend-days]', controls).forEach((item) => setPressed(item, item === button));
        renderTrend(state.dashboardAnalytics || {});
      });
    });
  }

  return { render, renderUnavailable, setupEvents };
}
