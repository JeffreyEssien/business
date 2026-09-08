import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { StorefrontCategoryPage } from '@/components/storefront/storefront-renderer';
import { StructuredData } from '@/components/storefront/structured-data';
import { getPublicStorefront } from '@/modules/catalog/queries';
import { entityMetadata, storefrontUrl } from '@/modules/seo/public';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; categorySlug: string }>;
}): Promise<Metadata> {
  const { slug, categorySlug } = await params;
  const store = await getPublicStorefront(slug);
  const category = store.categories.find((item) => item.slug === categorySlug);
  if (!category) notFound();
  return entityMetadata({
    store,
    entityType: 'CATEGORY',
    entityId: category.id,
    fallbackTitle: category.name,
    fallbackDescription: category.description,
    path: `/categories/${category.slug}`,
    image: store.products.find((product) => category.productIds.includes(product.id))?.mediaUrl,
  });
}

export default async function PublicCategoryPage({
  params,
}: {
  params: Promise<{ slug: string; categorySlug: string }>;
}) {
  const { slug, categorySlug } = await params;
  const store = await getPublicStorefront(slug);
  const category = store.categories.find((item) => item.slug === categorySlug);
  if (!category || !store.site) notFound();
  const products = store.products.filter((product) => category.productIds.includes(product.id));
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
            { '@type': 'ListItem', position: 2, name: category.name },
          ],
        }}
      />
      <StorefrontCategoryPage
        slug={slug}
        configuration={store.site}
        name={category.name}
        description={category.description}
        products={products}
      />
    </>
  );
}
