// Platform-subdomain storefront routing ({slug}.<platform domain>).
// Kept dependency-free so the proxy and unit tests share one implementation.

/** Subdomains that belong to the platform itself, never to a store. */
const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'admin', 'api', 'mail']);

/** Same shape as a store handle: lowercase letters, numbers, inner hyphens. */
const STORE_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * Returns the store handle for a request host such as `xelle.businesscare.ng`,
 * or null when the host is not a single-label store subdomain of the configured
 * platform domain. The handle is untrusted input exactly like `/store/{slug}`:
 * the storefront still resolves it against published tenant data.
 */
export function storeSlugFromHost(host: string | null, platformDomain: string | undefined) {
  const domain = platformDomain
    ?.trim()
    .toLowerCase()
    .replace(/^\.+|\.+$/g, '');
  if (!host || !domain) return null;
  const hostname = host.trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
  const suffix = `.${domain}`;
  if (!hostname.endsWith(suffix)) return null;
  const label = hostname.slice(0, -suffix.length);
  if (!STORE_LABEL.test(label) || RESERVED_SUBDOMAINS.has(label)) return null;
  return label;
}

export type StoreHostRoute =
  | { kind: 'pass' }
  | { kind: 'rewrite'; pathname: string }
  | { kind: 'admin' }
  | { kind: 'not-found'; pathname: string };

/**
 * Decides how a path on a store subdomain is served. Existing `/store/{slug}`
 * links keep working for the same store; another store's path is never served
 * on this host, so one tenant's domain cannot display a different tenant.
 */
export function routeStoreHostPath(slug: string, pathname: string): StoreHostRoute {
  if (pathname.startsWith('/_next/') || pathname.startsWith('/api/')) return { kind: 'pass' };
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return { kind: 'admin' };
  const own = `/store/${slug}`;
  if (pathname === own || pathname.startsWith(`${own}/`)) return { kind: 'pass' };
  if (pathname === '/store' || pathname.startsWith('/store/'))
    return { kind: 'not-found', pathname: `${own}/__unavailable` };
  return { kind: 'rewrite', pathname: pathname === '/' ? own : `${own}${pathname}` };
}
