import Link from 'next/link';
import { BuilderNotice } from '@/components/portfolio/builder-notice';
import { EntryList } from '@/components/portfolio/entry-list';
import styles from '@/components/portfolio/builder.module.css';
import { PageHeader } from '@/components/ui/page-header';
import { getPortfolioBuilder } from '@/modules/portfolio/builder-queries';
import { entryCopy, entryTypeFromParam, entryTypes } from '@/modules/portfolio/entries';

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
  const { entries } = await getPortfolioBuilder(slug);
  return (
    <main className="tenant-home">
      <PageHeader
        eyebrow="YOUR PORTFOLIO"
        title="Work & experience"
        description="Add, edit, and order the projects, jobs, education, and skills on your portfolio."
      />
      <BuilderNotice notice={notice} />
      <nav aria-label="Kinds of entries">
        <ul className={styles.tabs}>
          {entryTypes.map((option) => (
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
