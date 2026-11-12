'use client';
import { useActionState, useMemo, useState } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';
import { FormActions, FormError, FormSection, FormStack } from '@/components/ui/form-layout';
import { accessibleForeground, contrastRatio, isHexColor, readableTextRatio } from '@/lib/color';
import { saveLook, type BuilderActionState } from '@/modules/portfolio/actions';
import { lookByStyle, offeredLooks, type Palette } from '@/modules/portfolio/looks';
import styles from './look.module.css';

const initialState: BuilderActionState = { error: '' };

const colourFields: Array<{ key: keyof Palette; label: string; hint: string }> = [
  { key: 'background', label: 'Page background', hint: 'The main page colour.' },
  { key: 'text', label: 'Text', hint: 'Most of the writing on your page.' },
  { key: 'primary', label: 'Main colour', hint: 'Buttons and links.' },
  { key: 'accent', label: 'Highlight', hint: 'Small labels and details.' },
  { key: 'secondary', label: 'Soft text', hint: 'Dates and less important details.' },
];

function samePalette(first: Palette, second: Palette) {
  return (Object.keys(first) as Array<keyof Palette>).every(
    (key) => first[key].toLowerCase() === second[key].toLowerCase(),
  );
}

function Swatches({ colors }: { colors: Palette }) {
  return (
    <span className={styles.swatches} aria-hidden="true">
      {[colors.background, colors.text, colors.primary, colors.accent].map((color, index) => (
        <i key={`${color}-${index}`} style={{ background: color }} />
      ))}
    </span>
  );
}

/**
 * Change look and colours. Ready-made sets are always readable; "My own colours" shows a
 * live sample and blocks saving while text would be hard to read (the database refuses too).
 */
export function LookForm({
  slug,
  currentStyle,
  currentPalette,
  availableStyles,
}: {
  slug: string;
  currentStyle: string;
  currentPalette: Palette;
  /** Styles of templates Super Admin offers; null shows every look. */
  availableStyles: string[] | null;
}) {
  const [state, action, pending] = useActionState(saveLook.bind(null, slug), initialState);
  const looks = offeredLooks(availableStyles, currentStyle);
  const [style, setStyle] = useState(lookByStyle(currentStyle) ? currentStyle : looks[0].style);
  const look = lookByStyle(style) ?? looks[0];
  const matching = look.palettes.findIndex((option) => samePalette(option.colors, currentPalette));
  const [choice, setChoice] = useState<string>(
    style === currentStyle && matching < 0 ? 'custom' : String(Math.max(matching, 0)),
  );
  const [custom, setCustom] = useState<Palette>(currentPalette);

  const palette =
    choice === 'custom'
      ? custom
      : (look.palettes[Number(choice)]?.colors ?? look.palettes[0].colors);
  const valid = Object.values(palette).every(isHexColor);
  const ratio = valid ? contrastRatio(palette.text, palette.background) : 0;
  const readable = ratio >= readableTextRatio;
  const serialized = useMemo(() => JSON.stringify(palette), [palette]);

  return (
    <FormStack action={action} aria-busy={pending}>
      <input type="hidden" name="style" value={style} />
      <input type="hidden" name="palette" value={serialized} />

      <FormSection
        title="Look"
        description="Changing the look keeps all your words, photos, and entries."
      >
        <div className={styles.lookGrid} role="radiogroup" aria-label="Look">
          {looks.map((option) => (
            <label className={styles.lookCard} key={option.style}>
              <input
                type="radio"
                name="lookChoice"
                value={option.style}
                checked={style === option.style}
                onChange={() => {
                  setStyle(option.style);
                  setChoice('0');
                }}
              />
              <Swatches colors={option.palettes[0].colors} />
              <strong>{option.name}</strong>
              <span>{option.description}</span>
            </label>
          ))}
        </div>
      </FormSection>

      <FormSection title="Colours" description="Pick a ready-made set, or choose your own.">
        <div className={styles.paletteGrid} role="radiogroup" aria-label="Colours">
          {look.palettes.map((option, index) => (
            <label className={styles.paletteCard} key={option.name}>
              <input
                type="radio"
                name="paletteChoice"
                value={String(index)}
                checked={choice === String(index)}
                onChange={() => setChoice(String(index))}
              />
              <Swatches colors={option.colors} />
              <strong>{option.name}</strong>
            </label>
          ))}
          <label className={styles.paletteCard}>
            <input
              type="radio"
              name="paletteChoice"
              value="custom"
              checked={choice === 'custom'}
              onChange={() => {
                setCustom(palette);
                setChoice('custom');
              }}
            />
            <Swatches colors={custom} />
            <strong>My own colours</strong>
          </label>
        </div>

        {choice === 'custom' && (
          <div className={styles.customGrid}>
            {colourFields.map((field) => (
              <label className={styles.colourField} key={field.key}>
                <input
                  type="color"
                  value={custom[field.key]}
                  onChange={(event) => setCustom({ ...custom, [field.key]: event.target.value })}
                />
                <span>
                  <strong>{field.label}</strong>
                  <small>{field.hint}</small>
                </span>
              </label>
            ))}
          </div>
        )}

        <div
          className={styles.sample}
          style={{ background: palette.background, color: palette.text }}
          aria-label="Sample of these colours"
        >
          <small style={{ color: palette.accent }}>SAMPLE</small>
          <strong>Your name</strong>
          <span>This is how text will look on your page.</span>
          <span
            className={styles.sampleButton}
            style={{
              background: palette.primary,
              color: valid ? accessibleForeground(palette.primary) : '#ffffff',
            }}
          >
            Get in touch
          </span>
        </div>
        {!readable && (
          <p className={styles.warning} role="alert">
            Text would be hard to read on this background. Choose a darker text colour or a lighter
            background (or the other way round).
          </p>
        )}
      </FormSection>

      <FormError message={state.error} />
      <FormActions note="Visitors see the new look after you make your portfolio live.">
        <ButtonLink variant="secondary" href={`/t/${slug}/design`}>
          Cancel
        </ButtonLink>
        <Button type="submit" disabled={pending || !readable}>
          {pending ? 'Saving…' : 'Save look and colours'}
        </Button>
      </FormActions>
    </FormStack>
  );
}
