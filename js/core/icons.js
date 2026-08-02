function icon(name) {
  return `<span class="admin-icon admin-icon-${name}" aria-hidden="true"></span>`;
}

export const ICONS = Object.freeze({
  add: icon('plus'),
  alert: icon('alert-circle'),
  back: icon('arrow-left'),
  booking: icon('calendar-event'),
  check: icon('circle-check'),
  close: icon('x'),
  email: icon('mail'),
  external: icon('external-link'),
  invoice: icon('file-invoice'),
  info: icon('info-circle'),
  map: icon('map-pin'),
  menu: icon('menu'),
  next: icon('chevron-right'),
  phone: icon('phone'),
  previous: icon('chevron-left'),
  refresh: icon('refresh'),
  send: icon('send'),
  signOut: icon('logout'),
  sortAscending: icon('sort-ascending'),
  sortDescending: icon('sort-descending'),
  user: icon('user')
});
