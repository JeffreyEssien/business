import type { Metadata } from 'next';
import { unstable_rethrow } from 'next/navigation';
import type { PublicStorefront } from '@/modules/catalog/types';
import type { SeoEntityType } from '@/modules/content/types';

type PublicStoreIdentity = Pick<PublicStorefront, 'tenant' | 'site'>;

function configuredPlatformOrigin() {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').origin;
  } catch {
    return 'http://localhost:3000';
  }
}

export function storefrontOrigin(store: PublicStoreIdentity) {
  const customHostname = store.site?.seo?.customHostname;
  return customHostname ? `https://${customHostname}` : configuredPlatformOrigin();
}

export function storefrontUrl(store: PublicStoreIdentity, path = '') {
  const customHostname = store.site?.seo?.customHostname;
  return customHostname
    ? new URL(path || '/', `https://${customHostname}`)
    : new URL(`/store/${store.tenant.slug}${path}`, configuredPlatformOrigin());
}

export function publishedSeoEntry(
  store: PublicStoreIdentity,
  entityType: SeoEntityType,
  entityId: string,
) {
  return store.site?.seoEntries?.find(
    (entry) => entry.entityType === entityType && entry.entityId === entityId,
  );
}

export function entityMetadata({
  store,
  entityType,
  entityId,
  fallbackTitle,
  fallbackDescription,
  path,
  image,
}: {
  store: PublicStoreIdentity;
  entityType: SeoEntityType;
  entityId: string;
  fallbackTitle: string;
  fallbackDescription?: string;
  path: string;
  image?: string | null;
}): Metadata {
  const siteSeo = store.site?.seo;
  const entry = publishedSeoEntry(store, entityType, entityId);
  const template = siteSeo?.titleTemplate || `%s | ${store.tenant.name}`;
  const title = entry?.title || template.replace('%s', fallbackTitle);
  const description =
    entry?.description || fallbackDescription || siteSeo?.description || undefined;
  const canonical = entry?.canonicalUrl || storefrontUrl(store, path).toString();
  const socialTitle = entry?.socialTitle || title;
  const socialDescription = entry?.socialDescription || description;
  const socialImage = entry?.socialImage || image || siteSeo?.socialImage;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    robots: {
      index: (siteSeo?.allowSearchListing ?? false) && (entry?.allowSearchListing ?? true),
      follow: (siteSeo?.allowSearchLinks ?? false) && (entry?.allowSearchLinks ?? true),
    },
    openGraph: {
      type: 'website',
      title: socialTitle,
      description: socialDescription,
      url: canonical,
      siteName: store.tenant.name,
      images: socialImage ? [{ url: socialImage }] : undefined,
    },
    twitter: {
      card: socialImage ? 'summary_large_image' : 'summary',
      title: socialTitle,
      description: socialDescription,
      site: siteSeo?.twitterHandle || undefined,
      images: socialImage ? [socialImage] : undefined,
    },
  };
}

/**
 * Crawler-facing files (robots.txt, sitemap) must not answer a temporary
 * database failure with a bare 500. Next's own not-found signal is rethrown so
 * unknown stores still get a 404; anything else becomes a short-lived 503 that
 * tells crawlers to retry instead of treating the store as broken.
 */
export async function crawlerResponse(build: () => Promise<Response>) {
  try {
    return await build();
  } catch (error) {
    unstable_rethrow(error);
    return new Response('Temporarily unavailable. Please retry shortly.\n', {
      status: 503,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'retry-after': '300',
        'cache-control': 'no-store',
      },
    });
  }
}
