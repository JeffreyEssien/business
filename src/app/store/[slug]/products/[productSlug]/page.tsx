import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CatalogMedia } from '@/components/catalog/catalog-media';
import { getPublicStorefront } from '@/modules/catalog/queries';
import styles from '@/components/catalog/catalog.module.css';

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
  return (
    <div className={styles.storefront}>
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
