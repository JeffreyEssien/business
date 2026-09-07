import styles from './ui.module.css';
export type ChecklistItem = { label: string; complete: boolean; description?: string };
export function Checklist({ items }: { items: readonly ChecklistItem[] }) {
  return (
    <ol className={styles.checklist}>
      {items.map((item, index) => (
        <li key={item.label} className={styles.checklistItem}>
          <span
            aria-hidden="true"
            className={`${styles.stepNumber} ${item.complete ? styles.complete : ''}`}
          >
            {item.complete ? '✓' : index + 1}
          </span>
          <div>
            <h3 className={styles.checklistTitle}>{item.label}</h3>
            <p className={styles.checklistDescription}>
              {item.description ?? (item.complete ? 'Complete' : 'Pending')}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
