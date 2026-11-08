import 'server-only';
import { notFound } from 'next/navigation';
import { getPublicStorefront } from '@/modules/catalog/queries';
import { getTenantWorkspace } from '@/modules/tenants/workspace-query';
import { siteKindOf } from './types';

/**
 * Store-only workspace areas (catalog, orders, customer updates) do not exist for
 * portfolios. This is a routing convenience: the database independently rejects
 * commerce writes for portfolio tenants.
 */
export async function requireStoreWorkspace(slug: string) {
  const workspace = await getTenantWorkspace(slug);
  if (siteKindOf(workspace.tenant.site_kind) !== 'STORE') notFound();
  return workspace;
}

/** Public cart, checkout, product, and category routes are unavailable on portfolios. */
export async function requirePublicStore(slug: string) {
  const store = await getPublicStorefront(slug);
  if (siteKindOf(store.tenant.siteKind) !== 'STORE') notFound();
  return store;
}
