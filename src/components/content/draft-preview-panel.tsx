import styles from './site-editor.module.css';

/** Iframe preview of the saved (unpublished) draft, shared by store and portfolio design. */
export function DraftPreviewPanel({ slug, label }: { slug: string; label: string }) {
  return (
    <section className={styles.previewPanel} aria-label="Draft preview">
      <div className={styles.previewHeader}>
        <strong>Preview of saved changes</strong>
        <a href={`/t/${slug}/design/preview`} target="_blank">
          Open full preview ↗
        </a>
      </div>
      <iframe
        className={styles.previewFrame}
        title={`Saved ${label} draft preview`}
        src={`/t/${slug}/design/preview`}
      />
    </section>
  );
}
