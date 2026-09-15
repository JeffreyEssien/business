import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { CatalogMedia } from '@/components/catalog/catalog-media';
import { AddToCartButton } from '@/components/commerce/add-to-cart-button';
import type { PublicProduct } from '@/modules/catalog/types';
import { defaultWebsiteStyle, isWebsiteStyleKey, themePresets } from '@/modules/content/presets';
import type { PublishedContentPage, SiteConfiguration, SiteSection } from '@/modules/content/types';
import { SkipLink } from '@/components/ui/skip-link';
import { StoreNavigation } from './store-navigation';
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

function publicStoreHref(slug: string, target: string) {
  return target.startsWith('/') ? `/store/${slug}${target === '/' ? '' : target}` : target;
}

function storefrontPersonality(configuration: SiteConfiguration) {
  const style = configuration.theme.tokens.styleKey;
  return style && isWebsiteStyleKey(style)
    ? style
    : defaultWebsiteStyle(configuration.theme.presetKey);
}

function themeColor(value: string | undefined, fallback: string) {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function rgbChannels(color: string) {
  const value = color.trim().replace(/^#/, '');
  const normalized =
    value.length === 3
      ? value
          .split('')
          .map((channel) => channel + channel)
          .join('')
      : value;
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;
  return [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16));
}

function relativeLuminance(color: string) {
  const channels = rgbChannels(color);
  if (!channels) return null;
  const [red, green, blue] = channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function contrastRatio(first: string, second: string) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  if (firstLuminance === null || secondLuminance === null) return 0;
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function accessibleForeground(background: string) {
  return contrastRatio(background, '#ffffff') >= contrastRatio(background, '#111111')
    ? '#ffffff'
    : '#111111';
}

function storefrontStyle(configuration: SiteConfiguration) {
  const tokens = configuration.theme.tokens;
  const fallback = themePresets.general.tokens;
  const primary = themeColor(tokens.primary, fallback.primary);
  const accent = themeColor(tokens.accent, fallback.accent);
  const secondary = themeColor(tokens.secondary, accent);
  const background = themeColor(tokens.background, fallback.background);
  const foreground = themeColor(tokens.text, fallback.text);
  return {
    '--store-primary': primary,
    '--store-secondary': secondary,
    '--store-accent': accent,
    '--store-background': background,
    '--store-text': foreground,
    '--store-on-primary': accessibleForeground(primary),
    '--store-on-secondary': accessibleForeground(secondary),
    '--store-link': contrastRatio(primary, background) >= 4.5 ? primary : foreground,
  } as CSSProperties;
}

function StoreHeader({ slug, configuration }: { slug: string; configuration: SiteConfiguration }) {
  const headerLinks = configuration.navigation.filter(
    (item) => item.enabled && item.location === 'HEADER',
  );
  return (
    <StoreNavigation
      slug={slug}
      businessName={configuration.business.name}
      logo={configuration.business.logo}
      links={headerLinks.map((item) => ({
        label: item.label,
        href: publicStoreHref(slug, item.target),
      }))}
    />
  );
}

function ProductCard({ slug, product }: { slug: string; product: PublicProduct }) {
  return (
    <article className={styles.productCard}>
      <Link href={`/store/${slug}/products/${product.slug}`}>
        <CatalogMedia
          url={product.mediaUrl}
          type={product.mediaType}
          alt={product.mediaAlt || product.name}
        />
        <h3>{product.name}</h3>
        <p>{currency(product)}</p>
      </Link>
      <AddToCartButton slug={slug} product={product} />
    </article>
  );
}

export function StorefrontShell({
  slug,
  configuration,
  children,
}: {
  slug: string;
  configuration: SiteConfiguration;
  children: ReactNode;
}) {
  return (
    <div
      className={styles.storefront}
      style={storefrontStyle(configuration)}
      data-preset={configuration.theme.presetKey}
      data-style={storefrontPersonality(configuration)}
    >
      <SkipLink className={styles.skipLink} href="#store-main" />
      <StoreHeader slug={slug} configuration={configuration} />
      {children}
      <StoreFooter slug={slug} configuration={configuration} />
    </div>
  );
}

function StoreFooter({ slug, configuration }: { slug: string; configuration: SiteConfiguration }) {
  const socialLinks = [
    ['Instagram', configuration.business.instagram, 'https://instagram.com/'],
    ['Facebook', configuration.business.facebook, 'https://facebook.com/'],
    ['TikTok', configuration.business.tiktok, 'https://tiktok.com/@'],
  ] as const;
  const destination = (value: string, prefix: string) =>
    value.startsWith('https://') ? value : `${prefix}${value.replace(/^@/, '')}`;
  const footerLinks = configuration.navigation.filter(
    (item) => item.enabled && item.location === 'FOOTER',
  );
  return (
    <footer className={styles.footer}>
      <div>
        <strong>{configuration.business.name}</strong>
        <p>{configuration.business.description}</p>
      </div>
      <div className={styles.contactLinks}>
        {configuration.business.address && <p>{configuration.business.address}</p>}
        {configuration.business.phone && <p>{configuration.business.phone}</p>}
        {configuration.business.contactEmail && (
          <a href={`mailto:${configuration.business.contactEmail}`}>
            {configuration.business.contactEmail}
          </a>
        )}
        {configuration.business.whatsapp && (
          <a
            href={`https://wa.me/${configuration.business.whatsapp.replace(/\D/g, '')}`}
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp
          </a>
        )}
        <div className={styles.socialLinks}>
          {socialLinks.map(([label, value, prefix]) =>
            value ? (
              <a key={label} href={destination(value, prefix)} target="_blank" rel="noreferrer">
                {label}
              </a>
            ) : null,
          )}
        </div>
        {!!footerLinks.length && (
          <nav className={styles.footerNavigation} aria-label="Footer navigation">
            {footerLinks.map((item) => (
              <Link key={`${item.label}-${item.target}`} href={publicStoreHref(slug, item.target)}>
                {item.label}
              </Link>
            ))}
          </nav>
        )}
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
      data-style={storefrontPersonality(configuration)}
    >
      <SkipLink className={styles.skipLink} href="#store-main" />
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
      <main id="store-main">
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
                      <Link className={styles.cta} href={publicStoreHref(slug, action.href)}>
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
                        <ProductCard slug={slug} product={product} key={product.id} />
                      ))}
                    </div>
                  ) : (
                    <div className={styles.emptyProducts}>
                      <h3>New products are on the way</h3>
                      <p>
                        This store has not published anything to buy yet. Please check back soon.
                      </p>
                    </div>
                  )}
                  {products.length > 0 && (
                    <Link className={styles.viewAllProducts} href={`/store/${slug}/products`}>
                      Browse all products
                    </Link>
                  )}
                </section>
              );
            }
            return null;
          })}
      </main>
      <StoreFooter slug={slug} configuration={configuration} />
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
      data-style={storefrontPersonality(configuration)}
    >
      <SkipLink className={styles.skipLink} href="#store-main" />
      <StoreHeader slug={slug} configuration={configuration} />
      <main id="store-main" className={styles.informationPage}>
        <p className={styles.eyebrow}>{page.name}</p>
        <h1>{page.title}</h1>
        {page.introduction && <p className={styles.pageIntroduction}>{page.introduction}</p>}
        <div className={styles.pageBody}>{page.body}</div>
      </main>
      <StoreFooter slug={slug} configuration={configuration} />
    </div>
  );
}

export function StorefrontCategoryPage({
  slug,
  configuration,
  name,
  description,
  products,
  beforeContent,
  afterProducts,
  emptyTitle = 'No products here yet',
  emptyDescription = 'Explore the rest of the store or check back when new products are published.',
}: {
  slug: string;
  configuration: SiteConfiguration;
  name: string;
  description: string;
  products: PublicProduct[];
  beforeContent?: ReactNode;
  afterProducts?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  return (
    <div
      className={styles.storefront}
      style={storefrontStyle(configuration)}
      data-preset={configuration.theme.presetKey}
      data-style={storefrontPersonality(configuration)}
    >
      <SkipLink className={styles.skipLink} href="#store-main" />
      <StoreHeader slug={slug} configuration={configuration} />
      {beforeContent}
      <main id="store-main" className={`${styles.informationPage} ${styles.collectionPage}`}>
        <p className={styles.eyebrow}>PRODUCT COLLECTION</p>
        <h1>{name}</h1>
        {description && <p className={styles.pageIntroduction}>{description}</p>}
        {products.length ? (
          <div className={styles.productGrid}>
            {products.map((product) => (
              <ProductCard slug={slug} product={product} key={product.id} />
            ))}
          </div>
        ) : (
          <div className={styles.emptyProducts}>
            <h2>{emptyTitle}</h2>
            <p>{emptyDescription}</p>
            <Link className={styles.viewAllProducts} href={`/store/${slug}`}>
              Return to store home
            </Link>
          </div>
        )}
        {afterProducts}
      </main>
      <StoreFooter slug={slug} configuration={configuration} />
    </div>
  );
}
