import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { StorefrontContentPage } from '@/components/storefront/storefront-renderer';
import { StructuredData } from '@/components/storefront/structured-data';
import { getPublicStorefront } from '@/modules/catalog/queries';
import { entityMetadata, storefrontUrl } from '@/modules/seo/public';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; pageSlug: string }>;
}): Promise<Metadata> {
  const { slug, pageSlug } = await params;
  const store = await getPublicStorefront(slug);
  const page = store.site?.pages?.find((item) => item.slug === pageSlug);
  if (!page) notFound();
  return entityMetadata({
    store,
    entityType: 'PAGE',
    entityId: page.id,
    fallbackTitle: page.title,
    fallbackDescription: page.introduction,
    path: `/${page.slug}`,
    image: store.site?.business.heroMedia?.url,
  });
}

export default async function PublicInformationPage({
  params,
}: {
  params: Promise<{ slug: string; pageSlug: string }>;
}) {
  const { slug, pageSlug } = await params;
  const store = await getPublicStorefront(slug);
  if (!store.site) notFound();
  const page = (store.site.pages ?? []).find((item) => item.slug === pageSlug);
  if (!page) notFound();
  return (
    <>
      <StructuredData
        value={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: store.tenant.name,
              item: storefrontUrl(store).toString(),
            },
            { '@type': 'ListItem', position: 2, name: page.title },
          ],
        }}
      />
      <StorefrontContentPage slug={slug} configuration={store.site} page={page} />
    </>
  );
}
