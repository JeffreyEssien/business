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

export function SocialPreview({
  title,
  description,
  imageUrl,
}: {
  title: string;
  description: string;
  imageUrl?: string | null;
}) {
  return (
    <section className={styles.socialPreview} aria-label="Preview of a shared link">
      <p className={styles.previewLabel}>Preview of a shared link</p>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Cloudinary URLs are tenant data.
        <img src={imageUrl} alt="" />
      ) : (
        <div className={styles.socialPlaceholder}>Your sharing image will appear here</div>
      )}
      <div>
        <strong>{title || 'Your page title'}</strong>
        <p>{description || 'Your page description will appear here.'}</p>
      </div>
    </section>
  );
}
