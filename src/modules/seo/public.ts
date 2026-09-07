import type { PublicStorefront } from '@/modules/catalog/types';

function configuredPlatformOrigin() {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').origin;
  } catch {
    return 'http://localhost:3000';
  }
}

export function storefrontOrigin(store: PublicStorefront) {
  const customHostname = store.site?.seo?.customHostname;
  return customHostname ? `https://${customHostname}` : configuredPlatformOrigin();
}

export function storefrontUrl(store: PublicStorefront, path = '') {
  const customHostname = store.site?.seo?.customHostname;
  return customHostname
    ? new URL(path || '/', `https://${customHostname}`)
    : new URL(`/store/${store.tenant.slug}${path}`, configuredPlatformOrigin());
}
