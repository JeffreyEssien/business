import styles from './builder.module.css';

/** Plain-language confirmations after a builder action redirects back. */
const notices: Record<string, { text: string; warning?: boolean }> = {
  saved: { text: 'Saved. Visitors will see it after you make your portfolio live.' },
  'part-saved': { text: 'Saved. Visitors will see it after you make your portfolio live.' },
  deleted: { text: 'Deleted.' },
  moved: { text: 'New order saved.' },
  added: { text: 'New part added. Fill it in below, then press Save.' },
  'setup-done': {
    text: 'Your page is ready. Replace the example text marked in yellow, then make it live.',
  },
  'look-saved': {
    text: 'New look saved. Visitors will see it after you make your portfolio live.',
  },
  'part-removed': { text: 'That part has been removed from your page.' },
  'not-allowed': { text: 'You do not have permission to change this portfolio.', warning: true },
  'not-deleted': { text: 'That could not be deleted. Please try again.', warning: true },
  'not-moved': { text: 'The order could not be changed. Please try again.', warning: true },
  'not-added': { text: 'That part could not be added. Please try again.', warning: true },
  'not-removed': { text: 'That part could not be removed. Please try again.', warning: true },
};

export function BuilderNotice({ notice }: { notice?: string }) {
  const item = notice ? notices[notice] : undefined;
  if (!item) return null;
  return (
    <p
      className={`${styles.notice} ${item.warning ? styles.noticeWarning : ''}`}
      role={item.warning ? 'alert' : 'status'}
    >
      {item.text}
    </p>
  );
}
