import Link from 'next/link';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { deleteEntry, moveEntries } from '@/modules/portfolio/actions';
import { entryCopy, type EntryType } from '@/modules/portfolio/entries';
import type { PortfolioEntry } from '@/modules/portfolio/types';
import { ConfirmButton } from './confirm-button';
import { ExampleBadge, HiddenBadge } from './example-badge';
import styles from './builder.module.css';

function formatMonth(value: string) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' }).format(
    new Date(`${value}T00:00:00`),
  );
}

/** A one-line summary under the title: company, dates, or skills, by entry type. */
function metaLine(entry: PortfolioEntry) {
  if (entry.type === 'SKILL') return entry.tags.join(' · ');
  const when =
    entry.startsOn &&
    `${formatMonth(entry.startsOn)} – ${entry.isCurrent ? 'now' : formatMonth(entry.endsOn) || '…'}`;
  return [entry.subtitle, when].filter(Boolean).join(' · ');
}

export function EntryList({
  slug,
  type,
  entries,
}: {
  slug: string;
  type: EntryType;
  entries: PortfolioEntry[];
}) {
  const copy = entryCopy[type];
  const addHref = `/t/${slug}/portfolio/new?type=${copy.param}`;
  if (!entries.length) {
    return (
      <EmptyState
        title={`No ${copy.plural.toLowerCase()} yet`}
        description={copy.emptyHint}
        action={<ButtonLink href={addHref}>{copy.addLabel}</ButtonLink>}
      />
    );
  }
  const ids = entries.map((entry) => entry.id);
  const moved = (from: number, to: number) => {
    const next = [...ids];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  };
  return (
    <>
      <div className={styles.toolbar}>
        <p>{copy.emptyHint}</p>
        <ButtonLink href={addHref}>{copy.addLabel}</ButtonLink>
      </div>
      <ol className={styles.entryList}>
        {entries.map((entry, index) => (
          <li className={styles.entry} key={entry.id}>
            <div className={styles.entryText}>
              <Link className={styles.entryTitle} href={`/t/${slug}/portfolio/${entry.id}`}>
                {entry.title}
                {entry.exampleFields.length > 0 && <ExampleBadge />}
                {entry.hidden && <HiddenBadge />}
              </Link>
              {metaLine(entry) && <p className={styles.entryMeta}>{metaLine(entry)}</p>}
            </div>
            <div className={styles.entryActions}>
              <form action={moveEntries.bind(null, slug, type, moved(index, index - 1))}>
                <button
                  className={styles.smallButton}
                  type="submit"
                  disabled={index === 0}
                  aria-label={`Move ${entry.title} up`}
                >
                  ↑ Up
                </button>
              </form>
              <form action={moveEntries.bind(null, slug, type, moved(index, index + 1))}>
                <button
                  className={styles.smallButton}
                  type="submit"
                  disabled={index === entries.length - 1}
                  aria-label={`Move ${entry.title} down`}
                >
                  ↓ Down
                </button>
              </form>
              <ButtonLink variant="secondary" href={`/t/${slug}/portfolio/${entry.id}`}>
                Edit
              </ButtonLink>
              <form action={deleteEntry.bind(null, slug, entry.id, type)}>
                <ConfirmButton label="Delete" confirmLabel="Yes, delete" />
              </form>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
