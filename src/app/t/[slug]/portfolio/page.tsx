import Link from 'next/link';
import { BuilderNotice } from '@/components/portfolio/builder-notice';
import { EntryList } from '@/components/portfolio/entry-list';
import styles from '@/components/portfolio/builder.module.css';
import { PageHeader } from '@/components/ui/page-header';
import { getPortfolioBuilder } from '@/modules/portfolio/builder-queries';
import {
  entryCopy,
  entryTypeFromParam,
  entryTypes,
  partEntryType,
} from '@/modules/portfolio/entries';

export const metadata = { title: 'Work & experience' };
export default async function PortfolioEntriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ show?: string; notice?: string }>;
}) {
  const { slug } = await params;
  const { show, notice } = await searchParams;
  const type = entryTypeFromParam(show);
  const { entries, parts } = await getPortfolioBuilder(slug);
  // Fourteen tabs would overwhelm most people: show only the kinds this page uses or
  // already has entries for, plus whichever one was asked for.
  const usedTypes = new Set([
    type,
    ...parts.map((part) => partEntryType[part.type]).filter(Boolean),
    ...entries.map((entry) => entry.type),
  ]);
  const tabTypes = entryTypes.filter((option) => usedTypes.has(option));
  return (
    <main className="tenant-home">
      <PageHeader
        eyebrow="YOUR PORTFOLIO"
        title="Work & experience"
        description="Add, edit, and order the entries shown in your portfolio's lists."
      />
      <BuilderNotice notice={notice} />
      <nav aria-label="Kinds of entries">
        <ul className={styles.tabs}>
          {tabTypes.map((option) => (
            <li key={option}>
              <Link
                href={`/t/${slug}/portfolio?show=${entryCopy[option].param}`}
                aria-current={option === type ? 'page' : undefined}
              >
                {entryCopy[option].plural}
                <span className={styles.tabCount}>
                  {entries.filter((entry) => entry.type === option).length}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <EntryList slug={slug} type={type} entries={entries.filter((entry) => entry.type === type)} />
    </main>
  );
}
