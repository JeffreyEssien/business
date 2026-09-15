'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CartLink } from '@/components/commerce/cart-link';
import { useMobileNavigation } from '@/components/layout/use-mobile-navigation';
import styles from './storefront.module.css';

type StoreLink = { label: string; href: string };

export function StoreNavigation({
  slug,
  businessName,
  logo,
  links,
}: {
  slug: string;
  businessName: string;
  logo: { url: string; alt: string | null } | null;
  links: StoreLink[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const navigationRef = useRef<HTMLElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const closeNavigation = useCallback(() => setOpen(false), []);

  useEffect(() => setOpen(false), [pathname]);
  useMobileNavigation({
    open,
    onClose: closeNavigation,
    panelRef: navigationRef,
    triggerRef: menuTriggerRef,
  });

  const navigationLinks = () =>
    links.map((link) => {
      const active = pathname === link.href;
      return (
        <Link
          key={`${link.label}-${link.href}`}
          href={link.href}
          aria-current={active ? 'page' : undefined}
          onClick={closeNavigation}
        >
          {link.label}
        </Link>
      );
    });

  return (
    <>
      <header className={styles.header}>
        <Link className={styles.brand} href={`/store/${slug}`} aria-label={`${businessName} home`}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- Cloudinary URL is tenant data.
            <img src={logo.url} alt={logo.alt ?? businessName} />
          ) : (
            <strong>{businessName}</strong>
          )}
        </Link>
        <nav className={styles.desktopNavigation} aria-label="Store navigation">
          {navigationLinks()}
        </nav>
        <div className={styles.headerActions}>
          <CartLink className={styles.cartLink} slug={slug} />
          <button
            ref={menuTriggerRef}
            className={styles.storeMenuButton}
            type="button"
            aria-label="Open store navigation"
            aria-expanded={open}
            aria-controls="store-navigation"
            onClick={() => setOpen(true)}
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
        </div>
      </header>
      <button
        className={`${styles.storeBackdrop} ${open ? styles.visible : ''}`}
        type="button"
        aria-label="Close store navigation"
        tabIndex={open ? 0 : -1}
        onClick={closeNavigation}
      />
      <aside
        ref={navigationRef}
        id="store-navigation"
        className={`${styles.mobileNavigation} ${open ? styles.open : ''}`}
        aria-label="Store navigation"
      >
        <div className={styles.mobileNavigationHeader}>
          <strong>Menu</strong>
          <button type="button" aria-label="Close store navigation" onClick={closeNavigation}>
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <nav>{navigationLinks()}</nav>
      </aside>
    </>
  );
}
