import styles from './search-appearance.module.css';

export function SearchPreview({
  title,
  description,
  address,
}: {
  title: string;
  description: string;
  address: string;
}) {
  return (
    <section className={styles.preview} aria-label="Preview of a possible search result">
      <p className={styles.previewLabel}>Preview of a possible search result</p>
      <h2>{title || 'Your page title'}</h2>
      <p className={styles.previewAddress}>{address}</p>
      <p>{description || 'Add a short description that tells people what they will find here.'}</p>
    </section>
  );
}
