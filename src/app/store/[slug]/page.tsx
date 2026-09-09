import type { Metadata } from 'next';
import { StorefrontRenderer } from '@/components/storefront/storefront-renderer';
import { getPublicStorefront } from '@/modules/catalog/queries';
import type { SiteConfiguration } from '@/modules/content/types';
import { storefrontUrl } from '@/modules/seo/public';

function unpublishedConfiguration(name: string): SiteConfiguration {
  return {
    business: { name, description: '', phone: '', address: '', logo: null, heroMedia: null },
    theme: {
      presetKey: 'general',
      tokens: { primary: '#6655d7', accent: '#e2a94b', background: '#f8f8fb', text: '#242630' },
    },
    sections: [
      {
        key: 'products',
        type: 'products',
        variant: 'grid',
        enabled: true,
        content: { heading: 'Products' },
        settings: {},
      },
    ],
    pages: [],
    navigation: [
      { label: 'Home', target: '/', location: 'HEADER', linkType: 'URL', enabled: true },
    ],
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const store = await getPublicStorefront(slug);
  const seo = store.site?.seo;
  const title = seo?.title || store.tenant.name;
  const description = seo?.description || undefined;
  const canonical = storefrontUrl(store).toString();
  const image = seo?.socialImage || store.site?.business.heroMedia?.url;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    robots: {
      index: seo?.allowSearchListing ?? false,
      follow: seo?.allowSearchLinks ?? false,
    },
    openGraph: {
      type: 'website',
      title,
      description,
      url: canonical,
      siteName: store.tenant.name,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      site: seo?.twitterHandle || undefined,
      images: image ? [image] : undefined,
    },
    verification: {
      google: seo?.googleVerification || undefined,
      other: seo?.bingVerification ? { 'msvalidate.01': [seo.bingVerification] } : undefined,
    },
  };
}

export default async function StorefrontPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getPublicStorefront(slug);
  return (
    <StorefrontRenderer
      slug={slug}
      configuration={store.site ?? unpublishedConfiguration(store.tenant.name)}
      products={store.products}
    />
  );
}
