export const platformNavigation = [
  { href: '/', label: 'Overview', icon: '◫' },
  { href: '/businesses', label: 'Businesses', icon: '▦' },
  { href: '/setup', label: 'Launch checklist', icon: '☷' },
] as const;

/** Nested business routes keep the Businesses navigation item active. */
export function isNavigationActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}
export function workspaceTitle(pathname: string) {
  if (pathname === '/businesses/new') return 'Create business';
  return (
    platformNavigation.find((item) => isNavigationActive(pathname, item.href))?.label ?? 'Workspace'
  );
}
