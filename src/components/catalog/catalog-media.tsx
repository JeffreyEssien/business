import styles from './catalog.module.css';

export function CatalogMedia({
  url,
  type,
  alt,
  className = styles.productImage,
}: {
  url: string | null | undefined;
  type: 'image' | 'video' | null | undefined;
  alt: string;
  className?: string;
}) {
  if (!url) return <div className={styles.productPlaceholder}>No media</div>;
  if (type === 'video')
    return (
      <video className={className} controls preload="metadata" aria-label={alt}>
        <source src={url} />
      </video>
    );
  return <img className={className} src={url} alt={alt} />;
}
