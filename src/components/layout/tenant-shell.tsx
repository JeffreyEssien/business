'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SignOutForm } from '@/components/auth/sign-out-form';
import { SkipLink } from '@/components/ui/skip-link';
import { useMobileNavigation } from './use-mobile-navigation';

type TenantNavigationGroup = {
  label: string;
  links: ReadonlyArray<{ href: string; label: string; feature?: string }>;
};

const navigationGroups: ReadonlyArray<TenantNavigationGroup> = [
  {
    label: 'Workspace',
    links: [{ href: '', label: 'Overview' }],
  },
  {
    label: 'Commerce',
    links: [
      { href: '/catalog', label: 'Products & categories' },
      { href: '/orders', label: 'Orders' },
      { href: '/orders/settings', label: 'Checkout & payments' },
    ],
  },
  {
    label: 'Customer updates',
    links: [
      { href: '/communications/email', label: 'Customer emails' },
      {
        href: '/communications/sms',
        label: 'Customer text messages',
        feature: 'sms_notifications',
      },
    ],
  },
  {
    label: 'Website',
    links: [
      { href: '/design', label: 'Store design' },
      { href: '/content/pages', label: 'Website pages' },
      { href: '/content/navigation', label: 'Store menus' },
      { href: '/marketing/search', label: 'Search appearance' },
    ],
  },
];

function workspaceTitle(pathname: string, root: string) {
  const matches = navigationGroups
    .flatMap((group) => group.links)
    .map((link) => ({ ...link, address: `${root}${link.href}` }))
    .filter((link) => pathname === link.address || pathname.startsWith(`${link.address}/`))
    .sort((first, second) => second.address.length - first.address.length);
  return matches[0]?.label ?? 'Business workspace';
}

/** Persistent merchant navigation with a compact, dismissible mobile drawer. */
export function TenantShell({
  slug,
  entitlements,
  children,
}: {
  slug: string;
  entitlements: Record<string, unknown>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const navigationRef = useRef<HTMLElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const root = `/t/${slug}`;
  const title = workspaceTitle(pathname, root);
  const closeNavigation = useCallback(() => setOpen(false), []);

  useEffect(() => setOpen(false), [pathname]);
  useMobileNavigation({
    open,
    onClose: closeNavigation,
    panelRef: navigationRef,
    triggerRef: menuTriggerRef,
  });

  if (pathname === `${root}/design/preview`) return children;

  return (
    <div className="tenant-shell">
      <SkipLink className="skip-link" href="#tenant-main" />
      <button
        className={`tenant-backdrop ${open ? 'is-visible' : ''}`}
        type="button"
        aria-label="Close business navigation"
        tabIndex={open ? 0 : -1}
        onClick={closeNavigation}
      />
      <aside
        ref={navigationRef}
        id="tenant-navigation"
        className={`tenant-sidebar ${open ? 'is-open' : ''}`}
        aria-label="Business workspace navigation"
      >
        <Link href={root} className="brand tenant-brand">
          <span className="brand-mark" aria-hidden="true">
            b<span>c</span>
          </span>
          BusinessCare<span className="brand-dot">.</span>
        </Link>
        <button
          className="sidebar-close"
          type="button"
          aria-label="Close navigation"
          onClick={closeNavigation}
        >
          <span aria-hidden="true">×</span>
        </button>
        <div className="tenant-workspace-identity">
          <span>Business workspace</span>
          <strong>{slug.replaceAll('-', ' ')}</strong>
        </div>
        <nav>
          {navigationGroups.map((group) => (
            <div className="tenant-nav-group" key={group.label}>
              <p className="nav-label">{group.label}</p>
              {group.links.map((link) => {
                const address = `${root}${link.href}`;
                const locked = link.feature ? entitlements[link.feature] !== true : false;
                const exactCompetitor = group.links.some(
                  (candidate) =>
                    candidate.href.length > link.href.length &&
                    (pathname === `${root}${candidate.href}` ||
                      pathname.startsWith(`${root}${candidate.href}/`)),
                );
                const active =
                  !exactCompetitor &&
                  (pathname === address ||
                    (link.href !== '' && pathname.startsWith(`${address}/`)));
                return (
                  <Link
                    href={address}
                    className={`tenant-nav-link ${active ? 'active' : ''} ${locked ? 'locked' : ''}`}
                    aria-current={active ? 'page' : undefined}
                    key={address}
                  >
                    <span>{link.label}</span>
                    {locked && <small>Growth</small>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="tenant-sidebar-bottom">
          <Link href={`/store/${slug}`} className="tenant-store-link" target="_blank">
            View customer store <span aria-hidden="true">↗</span>
          </Link>
          <Link href="/workspace" className="tenant-switch-link">
            Switch business
          </Link>
          <SignOutForm />
        </div>
      </aside>
      <div className="tenant-main-shell">
        <header className="tenant-topbar">
          <button
            ref={menuTriggerRef}
            className="mobile-menu"
            type="button"
            aria-label="Open navigation"
            aria-expanded={open}
            aria-controls="tenant-navigation"
            onClick={() => setOpen((current) => !current)}
          >
            <span aria-hidden="true">☰</span>
          </button>
          <div className="tenant-breadcrumbs">
            <span>Your business</span>
            <span aria-hidden="true">/</span>
            <strong>{title}</strong>
          </div>
          <Link href={`/store/${slug}`} className="tenant-preview-link" target="_blank">
            View store <span aria-hidden="true">↗</span>
          </Link>
        </header>
        <div id="tenant-main" className="tenant-content">
          {children}
        </div>
      </div>
    </div>
  );
}
