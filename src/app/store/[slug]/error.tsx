'use client';
import { Button } from '@/components/ui/button';
import styles from '@/components/ui/ui.module.css';

/**
 * Shopper-facing error boundary for every store route. Store pages stream with
 * a 200 status, so React hoists the noindex tag below into <head> to keep a
 * temporary failure out of search results.
 */
export default function StoreError({ reset }: { reset: () => void }) {
  return (
    <main className={styles.authPage}>
      <meta name="robots" content="noindex" />
      <section className={styles.authCard}>
        <header className={styles.authHeader}>
          <h1 className={styles.title}>This store is taking a moment.</h1>
          <p className={styles.description}>
            We couldn’t load this page just now. Your cart is saved on this device, so please try
            again in a moment.
          </p>
        </header>
        <Button onClick={reset}>Try again</Button>
      </section>
    </main>
  );
}
