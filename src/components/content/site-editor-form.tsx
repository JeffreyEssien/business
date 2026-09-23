'use client';
import { useActionState, useState } from 'react';
import { saveSiteDraft, type ContentActionState } from '@/modules/content/actions';
import {
  defaultWebsiteStyle,
  isWebsiteStyleKey,
  themePresetOptions,
  themePresets,
  websiteStyleOptions,
  type ThemePresetKey,
} from '@/modules/content/presets';
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
  saved = false,
}: {
  slug: string;
  configuration: SiteConfiguration;
  saved?: boolean;
}) {
  const [state, action, pending] = useActionState(
    saveSiteDraft.bind(null, slug),
    saved
      ? {
          error: '',
          message: 'Changes saved for review. Your live storefront has not changed.',
        }
      : initialState,
  );
  const initialPreset =
    configuration.theme.presetKey in themePresets
      ? (configuration.theme.presetKey as ThemePresetKey)
      : 'general';
  const initialStyle = configuration.theme.tokens.styleKey;
  const [websiteStyle, setWebsiteStyle] = useState(
    initialStyle && isWebsiteStyleKey(initialStyle)
      ? initialStyle
      : defaultWebsiteStyle(initialPreset),
  );
  const [palette, setPalette] = useState(initialPreset);
  const [colors, setColors] = useState({
    primary: configuration.theme.tokens.primary,
    secondary: configuration.theme.tokens.secondary ?? configuration.theme.tokens.accent,
    accent: configuration.theme.tokens.accent,
    background: configuration.theme.tokens.background,
    text: configuration.theme.tokens.text,
  });
  const styleDescription = websiteStyleOptions.find(
    (option) => option.value === websiteStyle,
  )?.description;
  function choosePalette(value: string) {
    if (!(value in themePresets)) return;
    const nextPalette = value as ThemePresetKey;
    setPalette(nextPalette);
    setColors(themePresets[nextPalette].tokens);
  }
  function updateColor(key: keyof typeof colors, value: string) {
    setColors((current) => ({ ...current, [key]: value }));
  }
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
        title="Store appearance"
        description="Choose the visual character and colors customers see across your storefront."
      >
        <FormGrid>
          <div>
            <SelectField
              name="websiteStyle"
              label="Website style"
              options={websiteStyleOptions}
              value={websiteStyle}
              onChange={(event) => {
                if (isWebsiteStyleKey(event.target.value)) setWebsiteStyle(event.target.value);
              }}
              hint="Controls typography, spacing, shapes, and product layout independently from color."
            />
            {styleDescription && <p className={styles.selectionHint}>{styleDescription}</p>}
          </div>
          <SelectField
            name="preset"
            label="Color palette"
            options={themePresetOptions}
            value={palette}
            onChange={(event) => choosePalette(event.target.value)}
            hint="Choosing a palette replaces the five colors below. You can adjust them afterward."
          />
          <TextField
            name="primary"
            label="Main button and link color"
            type="color"
            value={colors.primary}
            onChange={(event) => updateColor('primary', event.target.value)}
            required
          />
          <TextField
            name="accent"
            label="Highlight color"
            type="color"
            value={colors.accent}
            onChange={(event) => updateColor('accent', event.target.value)}
            required
          />
          <TextField
            name="secondary"
            label="Supporting brand color"
            type="color"
            value={colors.secondary}
            onChange={(event) => updateColor('secondary', event.target.value)}
            required
          />
          <TextField
            name="background"
            label="Page background color"
            type="color"
            value={colors.background}
            onChange={(event) => updateColor('background', event.target.value)}
            required
          />
          <TextField
            name="text"
            label="Main text color"
            type="color"
            value={colors.text}
            onChange={(event) => updateColor('text', event.target.value)}
            required
          />
        </FormGrid>
      </FormSection>
      <details className={styles.advancedEditor}>
        <summary>Homepage content and footer</summary>
        <p>Open these controls when you want to change storefront wording and sections.</p>
        <div className={styles.advancedEditorBody}>
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
          <FormSection title="Main welcome area">
            <FormGrid>
              <SelectField
                name="heroVariant"
                label="Welcome area layout"
                defaultValue={section(configuration, 'hero')?.variant ?? 'centered'}
                options={[
                  { value: 'centered', label: 'Text centered on the page' },
                  { value: 'split', label: 'Text beside the main image' },
                  { value: 'image-overlay', label: 'Text placed over the main image' },
                ]}
              />
              <TextField
                name="heroEyebrow"
                label="Short label above the heading"
                maxLength={80}
                defaultValue={value(configuration, 'hero', 'eyebrow')}
              />
              <TextField
                name="heroHeadline"
                label="Main welcome heading"
                required
                maxLength={160}
                defaultValue={value(configuration, 'hero', 'headline')}
              />
              <TextAreaField
                name="heroSubheadline"
                label="Supporting welcome text"
                maxLength={320}
                defaultValue={value(configuration, 'hero', 'subheadline')}
              />
              <TextField
                name="heroCtaLabel"
                label="Main button text"
                maxLength={60}
                defaultValue={ctaLabel(configuration)}
              />
            </FormGrid>
          </FormSection>
          <FormSection title="Product collection">
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
              label="Heading above your products"
              required
              maxLength={120}
              defaultValue={value(configuration, 'products', 'heading') || 'Products'}
            />
          </FormSection>
          <FormSection title="Footer">
            <TextAreaField
              name="footerDescription"
              label="Footer description"
              maxLength={500}
              defaultValue={value(configuration, 'footer', 'description')}
            />
          </FormSection>
        </div>
      </details>
      <FormActions note="Saving updates your private preview only. Customers keep seeing the currently published version.">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving your changes…' : 'Save without changing the live store'}
        </Button>
      </FormActions>
    </FormStack>
  );
}
