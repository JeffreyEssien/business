'use client';
import { useActionState, useState } from 'react';
import { saveEntitySeo, type SeoActionState } from '@/modules/seo/actions';
import type { SearchContentRecord, SeoEntryDraft } from '@/modules/seo/queries';
import { Button, ButtonLink } from '@/components/ui/button';
import { TextAreaField, TextField } from '@/components/ui/form-fields';
import { FormActions, FormError, FormSection, FormStack } from '@/components/ui/form-layout';
import { SearchPreview } from './search-preview';
import styles from './search-appearance.module.css';

const initialState: SeoActionState = { error: '', message: '' };

export function SearchEntryForm({
  slug,
  record,
  entry,
}: {
  slug: string;
  record: SearchContentRecord;
  entry?: SeoEntryDraft;
}) {
  const [state, action, pending] = useActionState(
    saveEntitySeo.bind(null, slug, record.type, record.id),
    initialState,
  );
  const [title, setTitle] = useState(entry?.seo_title ?? '');
  const [description, setDescription] = useState(entry?.meta_description ?? '');
  return (
    <FormStack action={action}>
      <FormError message={state.error} />
      {state.message && (
        <p className={styles.success} role="status">
          {state.message}
        </p>
      )}
      <SearchPreview
        title={title || record.name}
        description={description || record.description}
        address={`your-store-address/${record.slug}`}
      />
      <FormSection
        title="Preferred search wording"
        description="Leave either field empty to use the page name and your store's main search description. Search services may still shorten or rewrite this wording."
      >
        <div className={styles.fields}>
          <TextField
            name="title"
            label="Search result title (optional)"
            hint={`${title.length} of 60 characters. Use a clear title that identifies this specific page.`}
            maxLength={60}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <TextAreaField
            name="description"
            label="Search result description (optional)"
            hint={`${description.length} of 160 characters. Summarize what a visitor will find here.`}
            maxLength={160}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
      </FormSection>
      <details className={styles.advancedSettings}>
        <summary>More search and sharing controls</summary>
        <p>
          Most stores can keep these defaults. Change them only when this page needs different
          sharing text, a preferred external address, or limited search visibility.
        </p>
        <div className={styles.fields}>
          <TextField
            name="socialTitle"
            label="Title when this page is shared (optional)"
            maxLength={60}
            defaultValue={entry?.social_title}
          />
          <TextAreaField
            name="socialDescription"
            label="Description when this page is shared (optional)"
            maxLength={160}
            defaultValue={entry?.social_description}
          />
          <TextField
            name="canonicalUrl"
            label="Preferred page address (optional)"
            type="url"
            placeholder="https://example.com/preferred-page"
            hint="Only use this when the same content exists at another HTTPS address that search services should treat as the original."
            maxLength={2048}
            defaultValue={entry?.canonical_url ?? ''}
          />
          <div className={styles.options}>
            <label>
              <input
                name="allowSearchListing"
                type="checkbox"
                defaultChecked={entry?.robots_index ?? true}
              />
              <span>
                <strong>Allow search services to list this page</strong>
                <small>
                  Clear this if the page should remain available only through direct links.
                </small>
              </span>
            </label>
            <label>
              <input
                name="allowSearchLinks"
                type="checkbox"
                defaultChecked={entry?.robots_follow ?? true}
              />
              <span>
                <strong>Allow search services to explore links on this page</strong>
                <small>Leave this on so published links can be discovered.</small>
              </span>
            </label>
          </div>
        </div>
      </details>
      <FormActions note="Saving keeps these changes private. Publish from Store design when you are ready for customers and search services to receive them.">
        <div className={styles.formButtons}>
          <ButtonLink variant="secondary" href={`/t/${slug}/marketing/search`}>
            Back to search appearance
          </ButtonLink>
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving your search wording…' : 'Save for the next publish'}
          </Button>
        </div>
      </FormActions>
    </FormStack>
  );
}
