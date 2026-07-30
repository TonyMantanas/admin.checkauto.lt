const ADMIN_BASE_PATH = typeof window !== 'undefined' && (
  window.location.pathname === '/admin' ||
  window.location.pathname.startsWith('/admin/')
) ? '/admin' : '';

function adminPath(path) {
  return ADMIN_BASE_PATH + path;
}

export const PATHS = {
  dashboard: adminPath('/'),
  bookings: adminPath('/bookings/'),
  availability: adminPath('/availability/'),
  customers: adminPath('/customers/'),
  invoices: adminPath('/invoices/'),
  marketing: adminPath('/marketing/'),
  account: adminPath('/account/'),
  resetPassword: adminPath('/reset-password/'),
  login: adminPath('/login/')
};

export const PAGE_TITLES = {
  dashboard: 'Dashboard',
  bookings: 'Bookings',
  availability: 'Availability',
  customers: 'Customers',
  invoices: 'Invoices',
  marketing: 'Marketing',
  account: 'Account settings',
  resetPassword: 'Reset password',
  login: 'Sign in'
};

const PAGE_BY_PATH = {
  '/': 'dashboard',
  '/bookings': 'bookings',
  '/availability': 'availability',
  '/customers': 'customers',
  '/invoices': 'invoices',
  '/marketing': 'marketing',
  '/account': 'account',
  '/login': 'login'
};

export function pageFromPathname(pathname) {
  let path = String(pathname || '/').replace(/\/{2,}/g, '/');

  if (ADMIN_BASE_PATH) {
    if (path === ADMIN_BASE_PATH) {
      path = '/';
    } else if (path.startsWith(ADMIN_BASE_PATH + '/')) {
      path = path.slice(ADMIN_BASE_PATH.length);
    } else {
      return null;
    }
  }

  if (path.length > 1) path = path.replace(/\/+$/, '');
  return PAGE_BY_PATH[path] || null;
}

export function pageFromUrl(value) {
  try {
    const url = value instanceof URL ? value : new URL(String(value || ''), window.location.href);
    if (url.origin !== window.location.origin) return null;
    return pageFromPathname(url.pathname);
  } catch (error) {
    return null;
  }
}
