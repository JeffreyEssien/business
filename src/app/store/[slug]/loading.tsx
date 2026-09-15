import styles from '@/components/storefront/storefront.module.css';

export default function StoreLoading() {
  return (
    <div className={styles.storeLoading} role="status" aria-label="Loading store">
      <div className={styles.loadingHeader}>
        <span className={styles.loadingBrand} />
        <span className={styles.loadingNavigation} />
      </div>
      <main className={styles.loadingMain}>
        <div className={styles.loadingCopy}>
          <span />
          <span />
          <span />
        </div>
        <div className={styles.loadingGrid}>
          <span />
          <span />
          <span />
        </div>
      </main>
      <span className={styles.visuallyHidden}>Preparing the store…</span>
    </div>
  );
}
