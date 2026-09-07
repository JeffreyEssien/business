'use client';
import { useActionState } from 'react';
import { saveContentPage, type ContentActionState } from '@/modules/content/actions';
import type { ContentPage } from '@/modules/content/types';
import { Button, ButtonLink } from '@/components/ui/button';
import { SelectField, TextAreaField, TextField } from '@/components/ui/form-fields';
import {
  FormActions,
  FormError,
  FormGrid,
  FormSection,
  FormStack,
} from '@/components/ui/form-layout';
import styles from './content-pages.module.css';

const initialState: ContentActionState = { error: '', message: '' };
export function ContentPageForm({ slug, page }: { slug: string; page?: ContentPage }) {
  const [state, action, pending] = useActionState(
    saveContentPage.bind(null, slug, page?.id ?? null),
    initialState,
  );
  return (
    <FormStack action={action}>
      <FormError message={state.error} />
      <FormSection
        title="Where this page belongs"
        description="Choose a purpose so the page is easy to recognize later. Customers will not see this technical category."
      >
        <FormGrid>
          <SelectField
            name="pageType"
            label="What is this page for?"
            defaultValue={page?.page_type ?? 'ABOUT'}
            options={[
              { value: 'ABOUT', label: 'Tell customers about the business' },
              { value: 'CONTACT', label: 'Help customers contact the business' },
              { value: 'POLICY', label: 'Explain a store policy' },
              { value: 'CUSTOM', label: 'Share other useful information' },
            ]}
          />
          <TextField
            name="name"
            label="Page name"
            hint="Used in your dashboard and, if selected below, in the store menu."
            required
            maxLength={80}
            defaultValue={page?.name}
          />
          <TextField
            name="slug"
            label="Page web address"
            hint="Use lowercase words separated by hyphens, such as about-us."
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            maxLength={100}
            defaultValue={page?.slug}
          />
        </FormGrid>
        <div className={styles.optionList}>
          <label>
            <input
              name="showInNavigation"
              type="checkbox"
              defaultChecked={page?.show_in_navigation}
            />
            <span>
              <strong>Add this page to the main store menu</strong>
              <small>Customers can open it directly from the top of your storefront.</small>
            </span>
          </label>
          <label>
            <input name="enabled" type="checkbox" defaultChecked={page?.is_enabled ?? true} />
            <span>
              <strong>Include this page the next time you publish</strong>
              <small>
                Clear this to keep the saved page without making it available to customers.
              </small>
            </span>
          </label>
        </div>
      </FormSection>
      <FormSection
        title="What customers will read"
        description="Write plain text only. Paragraph breaks are preserved safely on the storefront."
      >
        <div className={styles.fieldStack}>
          <TextField
            name="title"
            label="Main page heading"
            required
            maxLength={160}
            defaultValue={page?.title}
          />
          <TextAreaField
            name="introduction"
            label="Short introduction"
            hint="A brief summary shown below the heading. Up to 500 characters."
            maxLength={500}
            defaultValue={page?.introduction}
          />
          <TextAreaField
            name="body"
            label="Full page text"
            hint="Add all customer-facing details. Press Enter twice to separate paragraphs."
            required
            maxLength={20000}
            rows={14}
            defaultValue={page?.body}
          />
        </div>
      </FormSection>
      <FormActions note="Saving does not change the live store. Review it in Store design, then publish when ready.">
        <div className={styles.formActions}>
          <ButtonLink variant="secondary" href={`/t/${slug}/content/pages`}>
            Cancel
          </ButtonLink>
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving your page…' : 'Save without changing the live store'}
          </Button>
        </div>
      </FormActions>
    </FormStack>
  );
}
