import type { CSSProperties } from 'react';
import Link from 'next/link';
import { CatalogMedia } from '@/components/catalog/catalog-media';
import type { PublicProduct } from '@/modules/catalog/types';
import type { PublishedContentPage, SiteConfiguration, SiteSection } from '@/modules/content/types';
import { StructuredData } from './structured-data';
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

function storefrontStyle(configuration: SiteConfiguration) {
  const tokens = configuration.theme.tokens;
  return {
    '--store-primary': tokens.primary,
    '--store-accent': tokens.accent,
    '--store-background': tokens.background,
    '--store-text': tokens.text,
  } as CSSProperties;
}

function StoreHeader({ slug, configuration }: { slug: string; configuration: SiteConfiguration }) {
  const headerLinks = configuration.navigation.filter(
    (item) => item.enabled && item.location === 'HEADER',
  );
  return (
    <header className={styles.header}>
      <Link className={styles.brand} href={`/store/${slug}`}>
        {configuration.business.logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- Cloudinary URL is tenant data.
          <img src={configuration.business.logo.url} alt={configuration.business.logo.alt ?? ''} />
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
  );
}

function StoreFooter({ configuration }: { configuration: SiteConfiguration }) {
  return (
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
  );
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
  return (
    <div
      className={styles.storefront}
      style={storefrontStyle(configuration)}
      data-preset={configuration.theme.presetKey}
    >
      <StructuredData
        value={{
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: configuration.business.name,
          description: configuration.business.description || undefined,
          telephone: configuration.business.phone || undefined,
          address: configuration.business.address || undefined,
          logo: configuration.business.logo?.url,
        }}
      />
      {preview && (
        <div className={styles.previewBanner}>
          Preview of saved changes — customers cannot see these changes yet
        </div>
      )}
      <StoreHeader slug={slug} configuration={configuration} />
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
      <StoreFooter configuration={configuration} />
    </div>
  );
}

export function StorefrontContentPage({
  slug,
  configuration,
  page,
}: {
  slug: string;
  configuration: SiteConfiguration;
  page: PublishedContentPage;
}) {
  return (
    <div
      className={styles.storefront}
      style={storefrontStyle(configuration)}
      data-preset={configuration.theme.presetKey}
    >
      <StoreHeader slug={slug} configuration={configuration} />
      <main className={styles.informationPage}>
        <p className={styles.eyebrow}>{page.name}</p>
        <h1>{page.title}</h1>
        {page.introduction && <p className={styles.pageIntroduction}>{page.introduction}</p>}
        <div className={styles.pageBody}>{page.body}</div>
      </main>
      <StoreFooter configuration={configuration} />
    </div>
  );
}

export function StorefrontCategoryPage({
  slug,
  configuration,
  name,
  description,
  products,
}: {
  slug: string;
  configuration: SiteConfiguration;
  name: string;
  description: string;
  products: PublicProduct[];
}) {
  return (
    <div
      className={styles.storefront}
      style={storefrontStyle(configuration)}
      data-preset={configuration.theme.presetKey}
    >
      <StoreHeader slug={slug} configuration={configuration} />
      <main className={styles.informationPage}>
        <p className={styles.eyebrow}>PRODUCT COLLECTION</p>
        <h1>{name}</h1>
        {description && <p className={styles.pageIntroduction}>{description}</p>}
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
          <p>No products are available in this collection yet.</p>
        )}
      </main>
      <StoreFooter configuration={configuration} />
    </div>
  );
}
