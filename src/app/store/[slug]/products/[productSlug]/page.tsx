import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CatalogMedia } from '@/components/catalog/catalog-media';
import { getPublicStorefront } from '@/modules/catalog/queries';
import { StructuredData } from '@/components/storefront/structured-data';
import { entityMetadata, storefrontUrl } from '@/modules/seo/public';
import styles from '@/components/catalog/catalog.module.css';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; productSlug: string }>;
}): Promise<Metadata> {
  const { slug, productSlug } = await params;
  const store = await getPublicStorefront(slug);
  const product = store.products.find((item) => item.slug === productSlug);
  if (!product) notFound();
  return entityMetadata({
    store,
    entityType: 'PRODUCT',
    entityId: product.id,
    fallbackTitle: product.name,
    fallbackDescription: product.shortDescription || product.description,
    path: `/products/${product.slug}`,
    image: product.mediaUrl,
  });
}

export default async function PublicProductPage({
  params,
}: {
  params: Promise<{ slug: string; productSlug: string }>;
}) {
  const { slug, productSlug } = await params;
  const store = await getPublicStorefront(slug);
  const product = store.products.find((item) => item.slug === productSlug);
  if (!product) notFound();
  const available = !product.trackInventory || product.stockQuantity > 0;
  const productUrl = storefrontUrl(store, `/products/${product.slug}`).toString();
  return (
    <div className={styles.storefront}>
      <StructuredData
        value={{
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.name,
          description: product.description || product.shortDescription,
          image: product.mediaUrl || undefined,
          url: productUrl,
          offers: {
            '@type': 'Offer',
            priceCurrency: product.currency,
            price: product.price,
            availability: available
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
            url: productUrl,
          },
        }}
      />
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
            { '@type': 'ListItem', position: 2, name: product.name },
          ],
        }}
      />
      <header className={styles.storeHeader}>
        <Link href={`/store/${slug}`}>
          <strong>{store.tenant.name}</strong>
        </Link>
        <Link href={`/store/${slug}`}>All products</Link>
      </header>
      <main className={styles.storeMain}>
        <div className={styles.productDetail}>
          <CatalogMedia
            url={product.mediaUrl}
            type={product.mediaType}
            alt={product.mediaAlt || product.name}
          />
          <div>
            {!!product.categories.length && (
              <div className={styles.categoryTags}>
                {product.categories.map((category) => (
                  <span key={category}>{category}</span>
                ))}
              </div>
            )}
            <h1>{product.name}</h1>
            <p className={styles.price}>
              {new Intl.NumberFormat('en-NG', {
                style: 'currency',
                currency: product.currency,
              }).format(product.price)}
            </p>
            <p>{product.description || product.shortDescription}</p>
            <p>{available ? 'Available' : 'Out of stock'}</p>
          </div>
        </div>
      </main>
    </div>
  );
}
