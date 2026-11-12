import { undoChange } from '@/modules/portfolio/actions';
import styles from './builder.module.css';

/** Reverts the last burst of changes to one part or entry (photos are not included). */
export function UndoButton({
  slug,
  kind,
  refKey,
}: {
  slug: string;
  kind: 'part' | 'entry';
  refKey: string;
}) {
  return (
    <form action={undoChange.bind(null, slug, kind, refKey)} className={styles.undo}>
      <button className={styles.smallButton} type="submit">
        <span aria-hidden="true">↶</span> Undo last change
      </button>
    </form>
  );
}
