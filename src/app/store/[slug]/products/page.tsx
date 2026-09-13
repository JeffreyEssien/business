import type { Metadata } from 'next';
import Link from 'next/link';
import { StorefrontCategoryPage } from '@/components/storefront/storefront-renderer';
import { ProductSearchForm } from '@/components/storefront/product-search-form';
import { getPublicProducts } from '@/modules/catalog/queries';
import { storefrontUrl } from '@/modules/seo/public';
import styles from '@/components/catalog/catalog.module.css';

export const metadata: Metadata = { title: 'Products' };

export default async function PublicProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ search?: string; cursor?: string }>;
}) {
  const { slug } = await params;
  const filters = await searchParams;
  const store = await getPublicProducts(slug, filters);
  if (!store.site) return null;
  const nextAddress = store.nextCursor
    ? `${storefrontUrl(store, '/products').pathname}?${new URLSearchParams({ ...(filters.search && { search: filters.search }), cursor: store.nextCursor })}`
    : null;
  return (
    <StorefrontCategoryPage
      slug={slug}
      configuration={store.site}
      name="All products"
      description={
        filters.search
          ? `Results for “${filters.search.slice(0, 100)}”`
          : 'Browse everything available from this store.'
      }
      products={store.products}
      beforeContent={<ProductSearchForm defaultValue={filters.search} />}
      emptyTitle={filters.search ? 'No matching products' : 'No products here yet'}
      emptyDescription={
        filters.search
          ? 'Try a shorter or more general search, or return to the store home.'
          : 'This store has not published any products yet. Please check back soon.'
      }
      afterProducts={
        nextAddress ? (
          <nav className={styles.publicPagination} aria-label="Product results">
            <Link href={nextAddress}>Show more products</Link>
          </nav>
        ) : null
      }
    />
  );
}
