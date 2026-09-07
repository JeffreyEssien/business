import type { CSSProperties } from 'react';
import Link from 'next/link';
import { CatalogMedia } from '@/components/catalog/catalog-media';
import type { PublicProduct } from '@/modules/catalog/types';
import type { SiteConfiguration, SiteSection } from '@/modules/content/types';
import styles from './storefront.module.css';

function contentText(section: SiteSection, key: string) {
  const value = section.content[key];
  return typeof value === 'string' ? value : '';
}

function cta(section: SiteSection) {
  const value = section.content.primaryCta;
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  return typeof item.label === 'string' && typeof item.href === 'string'
    ? { label: item.label, href: item.href }
    : null;
}

function currency(product: PublicProduct) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: product.currency,
  }).format(product.price);
}

export function StorefrontRenderer({
  slug,
  configuration,
  products,
  preview = false,
}: {
  slug: string;
  configuration: SiteConfiguration;
  products: PublicProduct[];
  preview?: boolean;
}) {
  const tokens = configuration.theme.tokens;
  const themeStyle = {
    '--store-primary': tokens.primary,
    '--store-accent': tokens.accent,
    '--store-background': tokens.background,
    '--store-text': tokens.text,
  } as CSSProperties;
  const headerLinks = configuration.navigation.filter(
    (item) => item.enabled && item.location === 'HEADER',
  );
  return (
    <div
      className={styles.storefront}
      style={themeStyle}
      data-preset={configuration.theme.presetKey}
    >
      {preview && (
        <div className={styles.previewBanner}>
          Draft preview — customers cannot see these changes yet
        </div>
      )}
      <header className={styles.header}>
        <Link className={styles.brand} href={`/store/${slug}`}>
          {configuration.business.logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- Cloudinary URL is tenant data.
            <img
              src={configuration.business.logo.url}
              alt={configuration.business.logo.alt ?? ''}
            />
          ) : (
            <strong>{configuration.business.name}</strong>
          )}
        </Link>
        <nav aria-label="Store navigation">
          {headerLinks.map((item) => (
            <Link
              key={`${item.label}-${item.target}`}
              href={
                item.target.startsWith('/')
                  ? `/store/${slug}${item.target === '/' ? '' : item.target}`
                  : item.target
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main>
        {configuration.sections
          .filter((section) => section.enabled)
          .map((section) => {
            if (section.type === 'announcement') {
              return (
                <aside className={styles.announcement} key={section.key}>
                  {contentText(section, 'text')}
                </aside>
              );
            }
            if (section.type === 'hero') {
              const action = cta(section);
              return (
                <section
                  className={`${styles.hero} ${styles[section.variant] ?? ''}`}
                  key={section.key}
                >
                  <div className={styles.heroCopy}>
                    {contentText(section, 'eyebrow') && (
                      <p className={styles.eyebrow}>{contentText(section, 'eyebrow')}</p>
                    )}
                    <h1>{contentText(section, 'headline')}</h1>
                    {contentText(section, 'subheadline') && (
                      <p>{contentText(section, 'subheadline')}</p>
                    )}
                    {action?.label && (
                      <Link className={styles.cta} href={action.href}>
                        {action.label}
                      </Link>
                    )}
                  </div>
                  {configuration.business.heroMedia && (
                    // eslint-disable-next-line @next/next/no-img-element -- Cloudinary URL is tenant data.
                    <img
                      className={styles.heroImage}
                      src={configuration.business.heroMedia.url}
                      alt={configuration.business.heroMedia.alt ?? ''}
                    />
                  )}
                </section>
              );
            }
            if (section.type === 'products') {
              return (
                <section className={styles.products} id="products" key={section.key}>
                  <h2>{contentText(section, 'heading')}</h2>
                  {products.length ? (
                    <div className={styles.productGrid}>
                      {products.map((product) => (
                        <Link
                          className={styles.productCard}
                          key={product.id}
                          href={`/store/${slug}/products/${product.slug}`}
                        >
                          <CatalogMedia
                            url={product.mediaUrl}
                            type={product.mediaType}
                            alt={product.mediaAlt || product.name}
                          />
                          <h3>{product.name}</h3>
                          <p>{currency(product)}</p>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p>No products are available yet.</p>
                  )}
                </section>
              );
            }
            return null;
          })}
      </main>
      <footer className={styles.footer}>
        <div>
          <strong>{configuration.business.name}</strong>
          <p>{configuration.business.description}</p>
        </div>
        <div>
          {configuration.business.address && <p>{configuration.business.address}</p>}
          {configuration.business.phone && <p>{configuration.business.phone}</p>}
        </div>
      </footer>
    </div>
  );
}
