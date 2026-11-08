'use client';
import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormError, FormStack } from '@/components/ui/form-layout';
import { completeSetup, type BuilderActionState } from '@/modules/portfolio/actions';
import { lookByStyle, portfolioLooks } from '@/modules/portfolio/looks';
import styles from './guided-start.module.css';

const initialState: BuilderActionState = { error: '' };

/** "What do you do?" answers, each suggesting the look made for that kind of work. */
const occupations = [
  {
    value: 'software',
    label: 'I build software',
    style: 'pf-terminal',
    example: 'Software engineer',
  },
  {
    value: 'design',
    label: 'I design products or brands',
    style: 'pf-case-study',
    example: 'Product designer',
  },
  {
    value: 'visual',
    label: 'I take photos or make visual work',
    style: 'pf-darkroom',
    example: 'Photographer',
  },
  {
    value: 'job',
    label: 'I am looking for a job',
    style: 'pf-one-page',
    example: 'Operations associate',
  },
  { value: 'other', label: 'Something else', style: '', example: 'Consultant' },
] as const;

const steps = ['What you do', 'Your look', 'Your details'] as const;

/**
 * Three short steps for a brand-new portfolio. Everything chosen here can be changed later,
 * and the page is already full of example content, so the owner lands on something real.
 */
export function GuidedStart({
  slug,
  currentStyle,
  name,
  email,
  whatsapp,
  skipAction,
}: {
  slug: string;
  currentStyle: string;
  name: string;
  email: string;
  whatsapp: string;
  skipAction: () => Promise<void>;
}) {
  const [state, action, pending] = useActionState(completeSetup.bind(null, slug), initialState);
  const [step, setStep] = useState(0);
  const [occupation, setOccupation] = useState<string>('');
  const [style, setStyle] = useState(
    lookByStyle(currentStyle) ? currentStyle : portfolioLooks[0].style,
  );
  const [withWhatsapp, setWithWhatsapp] = useState(Boolean(whatsapp));
  const suggested = occupations.find((option) => option.value === occupation);
  const look = lookByStyle(style) ?? portfolioLooks[0];

  return (
    <section className={styles.wizard} aria-labelledby="guided-start-title">
      <p className={styles.progress} aria-live="polite">
        Step {step + 1} of {steps.length} · {steps[step]}
      </p>
      <ol className={styles.dots} aria-hidden="true">
        {steps.map((label, index) => (
          <li
            key={label}
            data-state={index < step ? 'done' : index === step ? 'current' : 'next'}
          />
        ))}
      </ol>

      <FormStack
        action={action}
        aria-busy={pending}
        onKeyDown={(event) => {
          // Enter means "Next" until the last step, so the form never submits half-filled.
          if (
            event.key === 'Enter' &&
            step < steps.length - 1 &&
            event.target instanceof HTMLInputElement
          ) {
            event.preventDefault();
            setStep(step + 1);
          }
        }}
      >
        <input type="hidden" name="style" value={style} />
        <input type="hidden" name="palette" value={JSON.stringify(look.palettes[0].colors)} />

        {/* Steps stay mounted so typed answers survive Back/Next; only the current one shows. */}
        <div hidden={step !== 0} className={styles.step}>
          <h1 id="guided-start-title">What do you do?</h1>
          <p>We’ll suggest a look made for your kind of work. You can change everything later.</p>
          <div className={styles.choices} role="radiogroup" aria-label="What do you do?">
            {occupations.map((option) => (
              <label className={styles.choice} key={option.value}>
                <input
                  type="radio"
                  name="occupation"
                  value={option.value}
                  checked={occupation === option.value}
                  onChange={() => {
                    setOccupation(option.value);
                    if (option.style) setStyle(option.style);
                  }}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          <label className={styles.field}>
            <span>Your job title or what you call yourself</span>
            <input
              name="role"
              maxLength={80}
              placeholder={`e.g. ${suggested?.example ?? 'Product designer'}`}
            />
          </label>
        </div>

        <div hidden={step !== 1} className={styles.step}>
          <h1>Pick a look</h1>
          <p>Your words and photos stay the same whichever you choose.</p>
          <div className={styles.looks} role="radiogroup" aria-label="Look">
            {portfolioLooks.map((option) => (
              <label className={styles.look} key={option.style}>
                <input
                  type="radio"
                  name="lookChoice"
                  value={option.style}
                  checked={style === option.style}
                  onChange={() => setStyle(option.style)}
                />
                <span
                  className={styles.lookSample}
                  style={{
                    background: option.palettes[0].colors.background,
                    color: option.palettes[0].colors.text,
                  }}
                  aria-hidden="true"
                >
                  <i style={{ background: option.palettes[0].colors.primary }} />
                  Aa
                </span>
                <strong>
                  {option.name}
                  {suggested?.style === option.style && <em> · Suggested</em>}
                </strong>
                <small>{option.description}</small>
              </label>
            ))}
          </div>
        </div>

        <div hidden={step !== 2} className={styles.step}>
          <h1>Your name and email</h1>
          <p>Your name goes at the top of your page. People will contact you by email.</p>
          <label className={styles.field}>
            <span>Your name, or your studio’s name</span>
            <input name="name" required maxLength={160} defaultValue={name} autoComplete="name" />
          </label>
          <label className={styles.field}>
            <span>Email for people to contact you</span>
            <input
              name="email"
              type="email"
              required
              maxLength={254}
              defaultValue={email}
              autoComplete="email"
            />
          </label>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={withWhatsapp}
              onChange={(event) => setWithWhatsapp(event.target.checked)}
            />
            Add WhatsApp (optional)
          </label>
          {withWhatsapp && (
            <label className={styles.field}>
              <span>WhatsApp number, with country code</span>
              <input
                name="whatsapp"
                type="tel"
                inputMode="tel"
                maxLength={24}
                defaultValue={whatsapp}
                placeholder="+234 801 234 5678"
              />
            </label>
          )}
        </div>

        <FormError message={state.error} />
        <div className={styles.actions}>
          {step > 0 ? (
            <Button variant="secondary" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          ) : (
            <span />
          )}
          {step < steps.length - 1 ? (
            <Button onClick={() => setStep(step + 1)}>Next</Button>
          ) : (
            <Button type="submit" disabled={pending}>
              {pending ? 'Setting up…' : 'Create my page'}
            </Button>
          )}
        </div>
      </FormStack>
      <form action={skipAction} className={styles.skip}>
        <button type="submit">Skip for now — I’ll set things up myself</button>
      </form>
    </section>
  );
}
