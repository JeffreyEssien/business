import styles from './builder.module.css';

/** Marks template example content the owner must replace before going live. */
export function ExampleBadge({ label = 'Example — replace it' }: { label?: string }) {
  return <span className={`${styles.badge} ${styles.badgeExample}`}>{label}</span>;
}

export function HiddenBadge() {
  return <span className={`${styles.badge} ${styles.badgeHidden}`}>Hidden</span>;
}
