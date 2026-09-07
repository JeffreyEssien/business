'use client';
import Link from 'next/link';
import type { FormEvent } from 'react';
import { deleteContentPage } from '@/modules/content/actions';
import type { ContentPage } from '@/modules/content/types';
import { EmptyState } from '@/components/ui/empty-state';
import { ButtonLink } from '@/components/ui/button';
import styles from './content-pages.module.css';

const pagePurpose: Record<ContentPage['page_type'], string> = {
  ABOUT: 'About the business',
  CONTACT: 'Customer contact information',
  POLICY: 'Store policy',
  CUSTOM: 'Other customer information',
};

export function ContentPageList({ slug, pages }: { slug: string; pages: ContentPage[] }) {
  if (!pages.length) {
    return (
      <EmptyState
        title="No information pages yet"
        description="Add an About, Contact, policy, or other helpful page for your customers."
        action={
          <ButtonLink href={`/t/${slug}/content/pages/new`}>Create your first page</ButtonLink>
        }
      />
    );
  }
  function confirmDelete(event: FormEvent<HTMLFormElement>, name: string) {
    if (
      !window.confirm(
        `Delete “${name}”? This removes the saved page. Publish afterward to remove it from the live store.`,
      )
    )
      event.preventDefault();
  }
  return (
    <div className={styles.pageList}>
      {pages.map((page) => (
        <article key={page.id} className={styles.pageRow}>
          <div>
            <p className={styles.pagePurpose}>{pagePurpose[page.page_type]}</p>
            <h2>
              <Link href={`/t/${slug}/content/pages/${page.id}`}>{page.name}</Link>
            </h2>
            <p>Store address: /{page.slug}</p>
          </div>
          <div className={styles.pageStatus}>
            <span>
              {page.is_enabled ? 'Included in the next publish' : 'Saved but hidden from customers'}
            </span>
            <span>{page.show_in_navigation ? 'Shown in main menu' : 'Not shown in main menu'}</span>
          </div>
          <form
            action={deleteContentPage.bind(null, slug, page.id)}
            onSubmit={(event) => confirmDelete(event, page.name)}
          >
            <button className={styles.deleteButton} type="submit">
              Delete saved page
            </button>
          </form>
        </article>
      ))}
    </div>
  );
}
