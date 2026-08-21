function summaryFor(menu) {
  return menu ? menu.querySelector('summary') : null;
}

function syncExpandedState(menu) {
  const summary = summaryFor(menu);
  if (summary) summary.setAttribute('aria-expanded', menu.open ? 'true' : 'false');
}

function closeFilterMenu(menu, restoreFocus) {
  if (!menu || !menu.open) return;
  menu.open = false;
  syncExpandedState(menu);
  const summary = summaryFor(menu);
  if (restoreFocus && summary) summary.focus();
}

function closeOtherFilterMenus(currentMenu) {
  document.querySelectorAll('.admin-filter-menu[open]').forEach((menu) => {
    if (menu !== currentMenu) closeFilterMenu(menu, false);
  });
}

function handlePointerDown(event) {
  const target = event.target instanceof Element ? event.target : null;
  const targetMenu = target ? target.closest('.admin-filter-menu') : null;
  document.querySelectorAll('.admin-filter-menu[open]').forEach((menu) => {
    if (menu !== targetMenu) closeFilterMenu(menu, false);
  });
}

function handleKeydown(event) {
  if (event.key !== 'Escape') return;
  const target = event.target instanceof Element ? event.target : null;
  const menu = (target && target.closest('.admin-filter-menu[open]')) ||
    document.querySelector('.admin-filter-menu[open]');
  if (!menu) return;
  event.preventDefault();
  closeFilterMenu(menu, true);
}

let documentBound = false;

export function setupFilterMenu(menu) {
  if (!menu || menu.dataset.filterBound === 'true') return;
  menu.dataset.filterBound = 'true';
  syncExpandedState(menu);
  menu.addEventListener('toggle', () => {
    syncExpandedState(menu);
    if (menu.open) closeOtherFilterMenus(menu);
  });
  menu.querySelectorAll('[data-filter-close]').forEach((button) => {
    button.addEventListener('click', () => closeFilterMenu(menu, true));
  });

  if (!documentBound) {
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeydown);
    documentBound = true;
  }
}
