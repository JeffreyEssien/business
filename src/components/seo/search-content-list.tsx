import Link from 'next/link';
import type { SearchContentRecord, SeoEntryDraft } from '@/modules/seo/queries';
import styles from './search-appearance.module.css';

const groupDetails = {
  PAGE: {
    title: 'Customer information pages',
    description: 'About, contact, policy, and other helpful pages.',
    path: 'page',
  },
  PRODUCT: {
    title: 'Product pages',
    description: 'Individual products customers can find and share.',
    path: 'product',
  },
  CATEGORY: {
    title: 'Product collection pages',
    description: 'Groups of related products customers can browse.',
    path: 'category',
  },
} as const;

export function SearchContentList({
  slug,
  records,
  entries,
}: {
  slug: string;
  records: SearchContentRecord[];
  entries: SeoEntryDraft[];
}) {
  return (
    <div className={styles.contentGroups}>
      {Object.entries(groupDetails).map(([type, details]) => {
        const group = records.filter((record) => record.type === type);
        return (
          <section className={styles.contentGroup} key={type}>
            <div>
              <h3>{details.title}</h3>
              <p>{details.description}</p>
            </div>
            {group.length ? (
              <ul className={styles.contentList}>
                {group.map((record) => {
                  const customized = entries.some(
                    (entry) => entry.entity_type === record.type && entry.entity_id === record.id,
                  );
                  return (
                    <li key={record.id}>
                      <div>
                        <strong>{record.name}</strong>
                        <p>Store address: /{record.slug}</p>
                      </div>
                      <span className={styles.customizationStatus}>
                        {customized ? 'Custom wording saved' : 'Uses store defaults'}
                      </span>
                      <Link
                        className={styles.editLink}
                        href={`/t/${slug}/marketing/search/${details.path}/${record.id}`}
                      >
                        {customized ? 'Review search wording' : 'Customize search wording'}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className={styles.emptyGroup}>Nothing has been added here yet.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
