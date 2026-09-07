import Link from 'next/link';
import { getPublicStorefront } from '@/modules/catalog/queries';
import styles from '@/components/catalog/catalog.module.css';

export default async function StorefrontPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getPublicStorefront(slug);
  return (
    <div className={styles.storefront}>
      <header className={styles.storeHeader}>
        <Link href={`/store/${slug}`}>
          <strong>{store.tenant.name}</strong>
        </Link>
        <span>Shop</span>
      </header>
      <main className={styles.storeMain}>
        <div className={styles.storeIntro}>
          <h1>{store.tenant.name}</h1>
          <p>Explore our latest products.</p>
        </div>
        {store.products.length ? (
          <div className={styles.productGrid}>
            {store.products.map((product) => (
              <Link
                className={styles.productCard}
                key={product.id}
                href={`/store/${slug}/products/${product.slug}`}
              >
                {product.imageUrl ? (
                  <img
                    className={styles.productImage}
                    src={product.imageUrl}
                    alt={product.imageAlt || product.name}
                  />
                ) : (
                  <div className={styles.productPlaceholder}>No image</div>
                )}
                <h2>{product.name}</h2>
                <p>
                  {new Intl.NumberFormat('en-NG', {
                    style: 'currency',
                    currency: product.currency,
                  }).format(product.price)}
                </p>
                {!!product.categories.length && (
                  <div className={styles.categoryTags}>
                    {product.categories.map((category) => (
                      <span key={category}>{category}</span>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <p>No products are published yet.</p>
        )}
      </main>
    </div>
  );
}
