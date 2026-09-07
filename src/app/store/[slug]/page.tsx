import { StorefrontRenderer } from '@/components/storefront/storefront-renderer';
import { getPublicStorefront } from '@/modules/catalog/queries';
import type { SiteConfiguration } from '@/modules/content/types';

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
    navigation: [
      { label: 'Home', target: '/', location: 'HEADER', linkType: 'URL', enabled: true },
    ],
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
