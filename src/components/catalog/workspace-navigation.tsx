import Link from 'next/link';
import { SignOutForm } from '@/components/auth/sign-out-form';
import styles from './catalog.module.css';

export function WorkspaceNavigation({ name, slug }: { name: string; slug: string }) {
  return (
    <header className={styles.workspaceNav}>
      <strong>{name}</strong>
      <nav className={styles.navLinks} aria-label="Business workspace">
        <Link href={`/t/${slug}`}>Overview</Link>
        <Link href={`/t/${slug}/catalog`}>Catalog</Link>
        <Link href={`/t/${slug}/design`}>Design</Link>
        <Link href={`/store/${slug}`} target="_blank">
          View store ↗
        </Link>
      </nav>
      <SignOutForm />
    </header>
  );
}
