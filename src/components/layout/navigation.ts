export const platformNavigation = [
  { href: '/', label: 'Overview', group: 'Platform' },
  { href: '/businesses', label: 'Businesses', group: 'Platform' },
  { href: '/businesses/applications', label: 'Applications', group: 'Platform' },
  { href: '/payment-operations', label: 'Payments', group: 'Operations' },
  { href: '/communications', label: 'Email delivery', group: 'Operations' },
  { href: '/sms-operations', label: 'SMS delivery', group: 'Operations' },
  { href: '/features', label: 'Plans & features', group: 'System' },
  { href: '/setup', label: 'Launch checklist', group: 'System' },
] as const;

export const platformNavigationGroups = ['Platform', 'Operations', 'System'] as const;

/** Nested business routes keep the Businesses navigation item active. */
export function isNavigationActive(pathname: string, href: string) {
  if (href === '/businesses' && pathname.startsWith('/businesses/applications')) return false;
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}
export function workspaceTitle(pathname: string) {
  if (pathname === '/businesses/new') return 'Create business';
  if (pathname.startsWith('/businesses/applications')) return 'Business applications';
  return (
    platformNavigation.find((item) => isNavigationActive(pathname, item.href))?.label ?? 'Workspace'
  );
}
