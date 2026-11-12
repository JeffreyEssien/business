'use client';
import Link from 'next/link';
import { useActionState, useState } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';
import { SelectField, TextAreaField, TextField } from '@/components/ui/form-fields';
import {
  FormActions,
  FormError,
  FormGrid,
  FormSection,
  FormStack,
} from '@/components/ui/form-layout';
import { autosavePart, savePart, type BuilderActionState } from '@/modules/portfolio/actions';
import { entryCopy, partEntryType, partLooks } from '@/modules/portfolio/entries';
import type { PortfolioPart } from '@/modules/portfolio/types';
import { ExampleBadge } from './example-badge';
import { PhotoField } from './photo-field';
import { autosaveLabel, useAutosave } from './use-autosave';
import styles from './builder.module.css';

const initialState: BuilderActionState = { error: '' };

const text = (part: PortfolioPart, key: string) => {
  const value = part.content[key];
  return typeof value === 'string' ? value : '';
};

function ctaOf(part: PortfolioPart) {
  const value = part.content.primaryCta;
  const item = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    label: typeof item.label === 'string' ? item.label : '',
    href: typeof item.href === 'string' ? item.href : '',
  };
}

/** Choose a layout by its picture. The sketch is decorative; the label names the choice. */
function LookPicker({ type, current }: { type: string; current: string }) {
  const looks = partLooks[type] ?? [];
  if (looks.length < 2) return null;
  return (
    <FormSection
      title="Look"
      description="Pick how this part is laid out. You can change it any time."
    >
      <div className={styles.lookGrid} role="radiogroup" aria-label="Look">
        {looks.map((look) => (
          <label className={styles.look} key={look.value}>
            <input
              type="radio"
              name="look"
              value={look.value}
              defaultChecked={look.value === current}
            />
            <span className={styles.sketch} data-look={look.value} aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            <strong>{look.label}</strong>
          </label>
        ))}
      </div>
    </FormSection>
  );
}

export function PartForm({
  slug,
  part,
  partName,
  destinations,
}: {
  slug: string;
  part: PortfolioPart;
  partName: string;
  /** Other parts the main button can jump to, as { value: '#key', label }. */
  destinations: Array<{ value: string; label: string }>;
}) {
  const [state, action, pending] = useActionState(
    savePart.bind(null, slug, part.key, part.type),
    initialState,
  );
  const autosave = useAutosave((form) => autosavePart(slug, part.key, part.type, form));
  const cta = ctaOf(part);
  const external = /^https:\/\//.test(cta.href);
  const [target, setTarget] = useState(
    external ? 'website' : cta.href || destinations[0]?.value || '',
  );
  const example = (field: string) =>
    part.exampleFields.includes(field) ? <ExampleBadge /> : undefined;
  const entryType = partEntryType[part.type];

  return (
    <FormStack action={action} aria-busy={pending} onInput={autosave.onInput}>
      {part.exampleFields.length > 0 && (
        <p className={`${styles.notice} ${styles.noticeExample}`}>
          This part still has example text from your template. Replace the marked fields with your
          own words before your portfolio goes live.
        </p>
      )}
      {part.type === 'hero' && (
        <>
          <FormSection title="Introduction">
            <TextField
              name="headline"
              label="Your name or main heading"
              hint="This is the biggest text on your page."
              required
              maxLength={120}
              defaultValue={text(part, 'headline')}
              labelAddon={example('headline')}
            />
            <TextField
              name="eyebrow"
              label="Small line above your name"
              hint="Usually your job title, e.g. Product designer"
              maxLength={80}
              defaultValue={text(part, 'eyebrow')}
              labelAddon={example('eyebrow')}
            />
            <TextAreaField
              name="subheadline"
              label="Short introduction"
              hint="One or two sentences about what you do and who you help."
              rows={3}
              maxLength={300}
              defaultValue={text(part, 'subheadline')}
              labelAddon={example('subheadline')}
            />
            <PhotoField
              prefix="photo"
              label="Big picture (optional)"
              hint="Shown beside or behind your introduction, depending on the look you choose."
              photo={part.photo}
            />
          </FormSection>
          <FormSection title="Main button">
            <FormGrid>
              <TextField
                name="ctaLabel"
                label="Button text"
                hint="e.g. Get in touch. Leave empty to hide the button."
                maxLength={40}
                defaultValue={cta.label}
              />
              <SelectField
                name="ctaTarget"
                label="When someone presses it"
                options={[
                  ...destinations.map((item) => ({
                    value: item.value,
                    label: `Go to ${item.label}`,
                  })),
                  { value: 'website', label: 'Open another website' },
                ]}
                value={target}
                onChange={(event) => setTarget(event.target.value)}
              />
            </FormGrid>
            {target === 'website' && (
              <TextField
                name="ctaUrl"
                label="Website address"
                hint="Paste the full address, e.g. calendly.com/your-name"
                inputMode="url"
                autoCapitalize="none"
                maxLength={500}
                defaultValue={external ? cta.href : ''}
              />
            )}
          </FormSection>
        </>
      )}

      {(part.type === 'about' || part.type === 'contact') && (
        <FormSection title={partName}>
          <TextField
            name="heading"
            label="Heading"
            maxLength={80}
            defaultValue={text(part, 'heading')}
            labelAddon={example('heading')}
          />
          <TextAreaField
            name="body"
            label="Text"
            hint={
              part.type === 'contact'
                ? 'Tell visitors how and when to reach you. Your email address is shown automatically.'
                : 'Leave an empty line between paragraphs.'
            }
            rows={part.type === 'contact' ? 4 : 8}
            maxLength={3000}
            defaultValue={text(part, 'body')}
            labelAddon={example('body')}
          />
          {part.type === 'about' && (
            <PhotoField
              prefix="photo"
              label="Your photo (optional)"
              hint="A friendly photo of you or your work. Choose a photo layout below to show it."
              photo={part.photo}
            />
          )}
        </FormSection>
      )}

      {entryType && (
        <FormSection title={partName}>
          <TextField
            name="heading"
            label="Heading"
            maxLength={80}
            defaultValue={text(part, 'heading')}
            labelAddon={example('heading')}
          />
          <TextAreaField
            name="intro"
            label="Short introduction (optional)"
            hint="A sentence shown above the list."
            rows={2}
            maxLength={300}
            defaultValue={text(part, 'intro')}
            labelAddon={example('intro')}
          />
          <p className={styles.entryMeta}>
            The {entryCopy[entryType].plural.toLowerCase()} themselves are managed in{' '}
            <Link href={`/t/${slug}/portfolio?show=${entryCopy[entryType].param}`}>
              Work &amp; experience
            </Link>
            .
          </p>
        </FormSection>
      )}

      <LookPicker type={part.type} current={part.variant} />

      {part.type !== 'hero' && (
        <label className={styles.checkboxRow}>
          <input type="checkbox" name="visible" defaultChecked={part.enabled} />
          Show this part on my portfolio
        </label>
      )}
      <FormError message={state.error} />
      <p className={styles.autosave} aria-live="polite" data-state={autosave.status.state}>
        {autosaveLabel(autosave.status)}
      </p>
      <FormActions note="Saved privately. Visitors see changes after you make your portfolio live.">
        <ButtonLink variant="secondary" href={`/t/${slug}/design`}>
          Cancel
        </ButtonLink>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save and go back'}
        </Button>
      </FormActions>
    </FormStack>
  );
}
