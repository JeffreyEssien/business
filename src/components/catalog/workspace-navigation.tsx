import Link from 'next/link';
import { SignOutForm } from '@/components/auth/sign-out-form';
import styles from './catalog.module.css';

function workspaceLinks(slug: string) {
  return [
    { href: `/t/${slug}`, label: 'Overview' },
    { href: `/t/${slug}/catalog`, label: 'Catalog' },
    { href: `/t/${slug}/orders`, label: 'Orders' },
    { href: `/t/${slug}/orders/settings`, label: 'Checkout & payments' },
    { href: `/t/${slug}/design`, label: 'Store design' },
    { href: `/t/${slug}/content/pages`, label: 'Website pages' },
    { href: `/t/${slug}/content/navigation`, label: 'Store menus' },
    { href: `/t/${slug}/marketing/search`, label: 'Search appearance' },
  ];
}

export function WorkspaceNavigation({ name, slug }: { name: string; slug: string }) {
  const links = workspaceLinks(slug);
  return (
    <header className={styles.workspaceNav}>
      <strong>{name}</strong>
      <nav className={styles.navLinks} aria-label="Business workspace">
        {links.map((link) => (
          <Link href={link.href} key={link.href}>
            {link.label}
          </Link>
        ))}
        <Link href={`/store/${slug}`} target="_blank">
          View store ↗
        </Link>
      </nav>
      <details className={styles.mobileWorkspaceMenu}>
        <summary>Open workspace menu</summary>
        <nav aria-label="Business workspace mobile navigation">
          {links.map((link) => (
            <Link href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
          <Link href={`/store/${slug}`} target="_blank">
            View store ↗
          </Link>
        </nav>
      </details>
      <SignOutForm />
    </header>
  );
}
