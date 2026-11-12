'use client';
import { useActionState } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';
import { TextAreaField, TextField } from '@/components/ui/form-fields';
import {
  FormActions,
  FormError,
  FormGrid,
  FormSection,
  FormStack,
} from '@/components/ui/form-layout';
import { autosaveEntry, saveEntry, type BuilderActionState } from '@/modules/portfolio/actions';
import { entryCopy, type EntryField, type EntryType } from '@/modules/portfolio/entries';
import type { PortfolioEntry } from '@/modules/portfolio/types';
import { ExampleBadge } from './example-badge';
import { AlbumField } from './album-field';
import { PhotoField } from './photo-field';
import { autosaveLabel, useAutosave } from './use-autosave';
import styles from './builder.module.css';

const initialState: BuilderActionState = { error: '' };

/** Stored dates are YYYY-MM-DD; month pickers want YYYY-MM. */
const toMonth = (value: string) => value.slice(0, 7);

/**
 * One form for every entry type. Which fields appear, and their wording, come from
 * entryCopy so the owner only sees what makes sense for a project, job, school, or skill.
 */
export function EntryForm({
  slug,
  type,
  entry,
}: {
  slug: string;
  type: EntryType;
  entry?: PortfolioEntry;
}) {
  const copy = entryCopy[type];
  const dateStyle = copy.dateStyle ?? 'range';
  const [state, action, pending] = useActionState(
    saveEntry.bind(null, slug, entry?.id ?? null, type),
    initialState,
  );
  // Existing entries save themselves while typing; a new one is created by its first Save.
  const autosave = useAutosave(
    (form) => autosaveEntry(slug, entry?.id ?? '', type, form),
    Boolean(entry),
  );
  const has = (field: EntryField) => Boolean(copy.fields[field]);
  const badge = (field: EntryField) =>
    entry?.exampleFields.includes(field) ? <ExampleBadge /> : undefined;
  const text = (field: Exclude<EntryField, 'dates' | 'tags'>, multiline = false) => {
    const fieldCopy = copy.fields[field];
    if (!fieldCopy) return null;
    const shared = {
      name: field,
      label: fieldCopy.label,
      hint: fieldCopy.hint,
      required: fieldCopy.required,
      defaultValue: entry?.[field] ?? '',
      labelAddon: badge(field),
    };
    return multiline ? (
      <TextAreaField {...shared} rows={3} maxLength={field === 'summary' ? 600 : 300} />
    ) : (
      <TextField
        {...shared}
        maxLength={field === 'linkUrl' || field === 'sourceUrl' ? 500 : 160}
        inputMode={field === 'linkUrl' || field === 'sourceUrl' ? 'url' : undefined}
        autoCapitalize={field === 'linkUrl' || field === 'sourceUrl' ? 'none' : undefined}
      />
    );
  };
  const exampleCount = entry?.exampleFields.length ?? 0;
  return (
    <FormStack action={action} aria-busy={pending} onInput={autosave.onInput}>
      {exampleCount > 0 && (
        <p className={`${styles.notice} ${styles.noticeExample}`}>
          This {copy.singular} is an example from your template. Replace the marked parts with your
          own details, or delete it, before your portfolio goes live.
        </p>
      )}
      <FormSection title={`About this ${copy.singular}`}>
        <FormGrid>
          {text('title')}
          {text('subtitle')}
        </FormGrid>
        {text('summary', true)}
        {has('role') && text('role', true)}
        {has('outcome') && text('outcome')}
        {copy.photo && (
          <PhotoField
            prefix="cover"
            label={copy.photo.label}
            hint={copy.photo.hint}
            photo={entry?.cover ?? null}
          />
        )}
        {type === 'PROJECT' && <AlbumField photos={entry?.gallery ?? []} />}
        {has('tags') && (
          <TextField
            name="tags"
            label={copy.fields.tags!.label}
            hint={copy.fields.tags!.hint}
            defaultValue={entry?.tags.join(', ') ?? ''}
            labelAddon={badge('tags')}
          />
        )}
      </FormSection>
      {has('dates') && dateStyle === 'range' && (
        <FormSection title={copy.fields.dates!.label} description={copy.fields.dates!.hint}>
          <div className={styles.dateGrid}>
            <TextField
              name="startsOn"
              type="month"
              label="From"
              defaultValue={toMonth(entry?.startsOn ?? '')}
            />
            <TextField
              name="endsOn"
              type="month"
              label="To"
              hint="Leave empty if you tick the box below."
              defaultValue={toMonth(entry?.endsOn ?? '')}
            />
          </div>
          <label className={styles.checkboxRow}>
            <input type="checkbox" name="isCurrent" defaultChecked={entry?.isCurrent ?? false} />
            {copy.currentLabel}
          </label>
        </FormSection>
      )}
      {has('dates') && dateStyle !== 'range' && (
        // Writing, awards, and events have one date: a month, or (events) an exact day.
        <FormSection title={copy.fields.dates!.label} description={copy.fields.dates!.hint}>
          <TextField
            name="startsOn"
            type={dateStyle === 'day' ? 'date' : 'month'}
            label={dateStyle === 'day' ? 'Day' : 'Month'}
            defaultValue={
              dateStyle === 'day'
                ? (entry?.startsOn ?? '').slice(0, 10)
                : toMonth(entry?.startsOn ?? '')
            }
          />
        </FormSection>
      )}
      {(has('linkUrl') || has('sourceUrl')) && (
        <FormSection title="Links">
          <FormGrid>
            {text('linkUrl')}
            {text('sourceUrl')}
          </FormGrid>
        </FormSection>
      )}
      <label className={styles.checkboxRow}>
        <input type="checkbox" name="visible" defaultChecked={!entry?.hidden} />
        Show this {copy.singular} on my portfolio
      </label>
      <FormError message={state.error} />
      {entry && (
        <p className={styles.autosave} aria-live="polite" data-state={autosave.status.state}>
          {autosaveLabel(autosave.status)}
        </p>
      )}
      <FormActions note="Saved privately. Visitors see changes after you make your portfolio live.">
        <ButtonLink variant="secondary" href={`/t/${slug}/portfolio?show=${copy.param}`}>
          Cancel
        </ButtonLink>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : entry ? 'Save and go back' : `Save ${copy.singular}`}
        </Button>
      </FormActions>
    </FormStack>
  );
}
