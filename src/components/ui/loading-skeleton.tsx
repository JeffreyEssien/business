import styles from './ui.module.css';

/** Stable route fallback that preserves the expected page hierarchy while data loads. */
export function LoadingSkeleton({ label = 'Loading workspace' }: { label?: string }) {
  return (
    <div className={styles.loadingPage} role="status" aria-label={label} aria-live="polite">
      <span className="sr-only">{label}…</span>
      <div className={`${styles.skeleton} ${styles.skeletonEyebrow}`} />
      <div className={`${styles.skeleton} ${styles.skeletonTitle}`} />
      <div className={`${styles.skeleton} ${styles.skeletonDescription}`} />
      <div className={styles.skeletonGrid}>
        <div className={`${styles.skeleton} ${styles.skeletonCard}`} />
        <div className={`${styles.skeleton} ${styles.skeletonCard}`} />
        <div className={`${styles.skeleton} ${styles.skeletonCard}`} />
      </div>
      <div className={`${styles.skeleton} ${styles.skeletonPanel}`} />
    </div>
  );
}
