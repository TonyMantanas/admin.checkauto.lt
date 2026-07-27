function icon(name) {
  return `<span class="admin-icon admin-icon-${name}" aria-hidden="true"></span>`;
}

export const ICONS = Object.freeze({
  add: icon('plus'),
  back: icon('arrow-left'),
  close: icon('x'),
  menu: icon('menu'),
  next: icon('chevron-right'),
  previous: icon('chevron-left'),
  refresh: icon('refresh'),
  send: icon('send'),
  signOut: icon('logout'),
  sortAscending: icon('sort-ascending'),
  sortDescending: icon('sort-descending')
});
