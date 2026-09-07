'use client';
import { useActionState } from 'react';
import { saveSiteDraft, type ContentActionState } from '@/modules/content/actions';
import { themePresetOptions } from '@/modules/content/presets';
import type { SiteConfiguration } from '@/modules/content/types';
import { Button } from '@/components/ui/button';
import { SelectField, TextAreaField, TextField } from '@/components/ui/form-fields';
import {
  FormActions,
  FormError,
  FormGrid,
  FormSection,
  FormStack,
} from '@/components/ui/form-layout';
import styles from './site-editor.module.css';

const initialState: ContentActionState = { error: '', message: '' };
function section(configuration: SiteConfiguration, key: string) {
  return configuration.sections.find((item) => item.key === key);
}
function value(configuration: SiteConfiguration, block: string, key: string) {
  const result = section(configuration, block)?.content[key];
  return typeof result === 'string' ? result : '';
}
function ctaLabel(configuration: SiteConfiguration) {
  const result = section(configuration, 'hero')?.content.primaryCta;
  return result && typeof result === 'object' && 'label' in result ? String(result.label) : '';
}

export function SiteEditorForm({
  slug,
  configuration,
}: {
  slug: string;
  configuration: SiteConfiguration;
}) {
  const [state, action, pending] = useActionState(saveSiteDraft.bind(null, slug), initialState);
  const nav = configuration.navigation.filter((item) => item.location === 'HEADER').slice(0, 3);
  return (
    <FormStack action={action}>
      <FormError message={state.error} />
      {state.message && (
        <p className={styles.success} role="status">
          {state.message}
        </p>
      )}
      <FormSection title="Business profile" description="Used by the storefront header and footer.">
        <FormGrid>
          <TextField
            name="businessName"
            label="Business name"
            required
            maxLength={160}
            defaultValue={configuration.business.name}
          />
          <TextField
            name="phone"
            label="Public phone"
            maxLength={40}
            defaultValue={configuration.business.phone}
          />
          <TextAreaField
            name="businessDescription"
            label="Short description"
            maxLength={600}
            defaultValue={configuration.business.description}
          />
          <TextAreaField
            name="address"
            label="Public address"
            maxLength={300}
            defaultValue={configuration.business.address}
          />
          <TextField
            name="logo"
            label="Replace logo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hint="JPG, PNG, or WebP up to 5 MB."
          />
          <TextField
            name="heroImage"
            label="Replace hero image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hint="Logo and hero uploads run in parallel."
          />
        </FormGrid>
      </FormSection>
      <FormSection
        title="Theme"
        description="Preset values are editable design tokens shared by every storefront component."
      >
        <FormGrid>
          <SelectField
            name="preset"
            label="Theme preset"
            options={themePresetOptions}
            defaultValue={configuration.theme.presetKey}
          />
          <TextField
            name="primary"
            label="Primary color"
            type="color"
            defaultValue={configuration.theme.tokens.primary}
            required
          />
          <TextField
            name="accent"
            label="Accent color"
            type="color"
            defaultValue={configuration.theme.tokens.accent}
            required
          />
          <TextField
            name="background"
            label="Background color"
            type="color"
            defaultValue={configuration.theme.tokens.background}
            required
          />
          <TextField
            name="text"
            label="Text color"
            type="color"
            defaultValue={configuration.theme.tokens.text}
            required
          />
        </FormGrid>
      </FormSection>
      <FormSection title="Announcement">
        <label className={styles.checkbox}>
          <input
            name="announcementEnabled"
            type="checkbox"
            defaultChecked={section(configuration, 'announcement')?.enabled}
          />{' '}
          Show announcement bar
        </label>
        <TextField
          name="announcement"
          label="Announcement text"
          maxLength={160}
          defaultValue={value(configuration, 'announcement', 'text')}
        />
      </FormSection>
      <FormSection title="Homepage hero">
        <FormGrid>
          <SelectField
            name="heroVariant"
            label="Hero layout"
            defaultValue={section(configuration, 'hero')?.variant ?? 'centered'}
            options={[
              { value: 'centered', label: 'Centered' },
              { value: 'split', label: 'Split' },
              { value: 'image-overlay', label: 'Image overlay' },
            ]}
          />
          <TextField
            name="heroEyebrow"
            label="Eyebrow"
            maxLength={80}
            defaultValue={value(configuration, 'hero', 'eyebrow')}
          />
          <TextField
            name="heroHeadline"
            label="Headline"
            required
            maxLength={160}
            defaultValue={value(configuration, 'hero', 'headline')}
          />
          <TextAreaField
            name="heroSubheadline"
            label="Subheadline"
            maxLength={320}
            defaultValue={value(configuration, 'hero', 'subheadline')}
          />
          <TextField
            name="heroCtaLabel"
            label="Button label"
            maxLength={60}
            defaultValue={ctaLabel(configuration)}
          />
        </FormGrid>
      </FormSection>
      <FormSection title="Product section">
        <label className={styles.checkbox}>
          <input
            name="productsEnabled"
            type="checkbox"
            defaultChecked={section(configuration, 'products')?.enabled ?? true}
          />{' '}
          Show products
        </label>
        <TextField
          name="productsHeading"
          label="Section heading"
          required
          maxLength={120}
          defaultValue={value(configuration, 'products', 'heading') || 'Products'}
        />
      </FormSection>
      <FormSection
        title="Header navigation"
        description="Up to three storefront links. Use paths such as / or /#products."
      >
        <div className={styles.navigationGrid}>
          {[0, 1, 2].map((index) => (
            <FormGrid key={index}>
              <TextField
                name={`navLabel${index}`}
                label={`Link ${index + 1} label`}
                maxLength={60}
                defaultValue={nav[index]?.label ?? ''}
              />
              <TextField
                name={`navTarget${index}`}
                label={`Link ${index + 1} target`}
                maxLength={300}
                defaultValue={nav[index]?.target ?? ''}
              />
            </FormGrid>
          ))}
        </div>
      </FormSection>
      <FormSection title="Footer">
        <TextAreaField
          name="footerDescription"
          label="Footer description"
          maxLength={500}
          defaultValue={value(configuration, 'footer', 'description')}
        />
      </FormSection>
      <FormActions note="Save updates the draft preview only. Publish separately when it is ready.">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving draft…' : 'Save draft'}
        </Button>
      </FormActions>
    </FormStack>
  );
}
