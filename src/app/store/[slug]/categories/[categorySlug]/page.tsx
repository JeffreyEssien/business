import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { StorefrontCategoryPage } from '@/components/storefront/storefront-renderer';
import { StructuredData } from '@/components/storefront/structured-data';
import { getPublicProducts } from '@/modules/catalog/queries';
import { entityMetadata, storefrontUrl } from '@/modules/seo/public';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; categorySlug: string }>;
}): Promise<Metadata> {
  const { slug, categorySlug } = await params;
  const store = await getPublicProducts(slug, { category: categorySlug });
  const category = store.category!;
  return entityMetadata({
    store,
    entityType: 'CATEGORY',
    entityId: category.id,
    fallbackTitle: category.name,
    fallbackDescription: category.description,
    path: `/categories/${category.slug}`,
    image: store.products[0]?.mediaUrl,
  });
}

export default async function PublicCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; categorySlug: string }>;
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { slug, categorySlug } = await params;
  const { cursor } = await searchParams;
  const store = await getPublicProducts(slug, { category: categorySlug, cursor });
  const category = store.category;
  if (!category || !store.site) notFound();
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
        products={store.products}
        afterProducts={
          store.nextCursor ? (
            <nav className="store-pagination" aria-label="Collection products">
              <Link
                href={`/store/${slug}/categories/${categorySlug}?${new URLSearchParams({ cursor: store.nextCursor })}`}
              >
                Show more products
              </Link>
            </nav>
          ) : null
        }
      />
    </>
  );
}
