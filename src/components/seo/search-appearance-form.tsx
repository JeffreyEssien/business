'use client';
import { useActionState, useState } from 'react';
import { saveGlobalSeo, type SeoActionState } from '@/modules/seo/actions';
import type { GlobalSeoDraft } from '@/modules/seo/queries';
import { Button } from '@/components/ui/button';
import { TextAreaField, TextField } from '@/components/ui/form-fields';
import { FormActions, FormError, FormSection, FormStack } from '@/components/ui/form-layout';
import { SearchPreview, SocialPreview } from './search-preview';
import styles from './search-appearance.module.css';

const initialState: SeoActionState = { error: '', message: '' };
export function SearchAppearanceForm({
  slug,
  settings,
}: {
  slug: string;
  settings: GlobalSeoDraft;
}) {
  const [state, action, pending] = useActionState(saveGlobalSeo.bind(null, slug), initialState);
  const [title, setTitle] = useState(settings.site_title);
  const [description, setDescription] = useState(settings.description);
  return (
    <FormStack action={action}>
      <FormError message={state.error} />
      {state.message && (
        <p className={styles.success} role="status">
          {state.message}
        </p>
      )}
      <SearchPreview
        title={title || 'Your store name'}
        description={description}
        address="your-store-address"
      />
      <SocialPreview
        title={title || 'Your store name'}
        description={description}
        imageUrl={settings.social_image_url}
      />
      <FormSection
        title="What people see in search"
        description="Search services may shorten or rewrite this text, but these details give them your preferred wording."
      >
        <div className={styles.fields}>
          <TextField
            name="title"
            label="Search result title"
            hint={`${title.length} of 60 characters. Include your business name and what you offer.`}
            required
            maxLength={60}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <TextAreaField
            name="description"
            label="Search result description"
            hint={`${description.length} of 160 characters. Explain what makes your store useful or different.`}
            maxLength={160}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <TextField
            name="socialAccount"
            label="Social account name (optional)"
            hint="For example, @yourstore. This can help social platforms connect shared links to your account."
            maxLength={50}
            defaultValue={settings.twitter_handle}
          />
        </div>
      </FormSection>
      <FormSection
        title="Image shown when your store is shared"
        description="Upload a wide image that represents your business. Social apps may crop it differently. JPG, PNG, or WebP up to 5 MB."
      >
        <TextField
          name="socialImage"
          label={settings.social_image_url ? 'Replace sharing image' : 'Choose sharing image'}
          type="file"
          accept="image/jpeg,image/png,image/webp"
        />
      </FormSection>
      <FormSection
        title="Who may discover your store"
        description="New stores usually stay hidden from search until their content and products are ready."
      >
        <div className={styles.options}>
          <label>
            <input
              name="allowSearchListing"
              type="checkbox"
              defaultChecked={settings.robots_index_enabled}
            />
            <span>
              <strong>Allow search services to list this store</strong>
              <small>Turn this on only when the storefront is ready for the public.</small>
            </span>
          </label>
          <label>
            <input
              name="allowSearchLinks"
              type="checkbox"
              defaultChecked={settings.robots_follow_enabled}
            />
            <span>
              <strong>Allow search services to explore links on this store</strong>
              <small>
                This helps them discover published products and customer information pages.
              </small>
            </span>
          </label>
        </div>
      </FormSection>
      <FormActions note="Saving does not change search results or your live store. Make all saved changes visible from Store design when ready.">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving your search appearance…' : 'Save for the next publish'}
        </Button>
      </FormActions>
    </FormStack>
  );
}
