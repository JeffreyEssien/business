'use client';
import { useActionState, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { TextAreaField, TextField } from '@/components/ui/form-fields';
import { FormError } from '@/components/ui/form-layout';
import { checkWebsiteName, submitBusinessApplication } from '@/modules/applications/actions';
import {
  brandStyleOptions,
  businessTypeOptions,
  defaultApplicationValues,
  planApplicationOptions,
  productQuantityOptions,
  productReadinessOptions,
  requestedPageOptions,
} from '@/modules/applications/options';
import { normalizeWebsiteName } from '@/modules/applications/validation';
import type { BusinessApplicationInput } from '@/modules/applications/types';
import styles from './applications.module.css';

const steps = [
  { title: 'Your Business', guidance: 'Tell us what you do and choose your future website name.' },
  {
    title: 'Contact Details',
    guidance: 'Share the best ways for BusinessCare and your customers to reach you.',
  },
  { title: 'Your Brand', guidance: 'Choose colours and a style that feel like your business.' },
  { title: 'Your Website', guidance: 'Decide what customers should see when they arrive.' },
  { title: 'Your Products', guidance: 'Give us a simple picture of what you plan to sell.' },
  {
    title: 'Review & Submit',
    guidance: 'Check your answers. You can return to any section before submitting.',
  },
] as const;

type Values = Omit<BusinessApplicationInput, 'productCategories'> & {
  productCategories: string;
};
const storageKey = 'businesscare-application-draft-v1';

function ChoiceCards({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: string;
  options: readonly { value: string; label: string; description?: string; preview?: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className={styles.choiceGrid} role="radiogroup">
      {options.map((option) => (
        <label
          className={`${styles.choiceCard} ${value === option.value ? styles.selected : ''}`}
          key={option.value}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          {option.preview && (
            <span className={`${styles.stylePreview} ${styles[option.preview]}`} aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          )}
          <span>
            <strong>{option.label}</strong>
            {option.description && <small>{option.description}</small>}
          </span>
        </label>
      ))}
    </div>
  );
}

function ReviewRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className={styles.reviewRow}>
      <div>
        <span>{label}</span>
        <strong>{value || 'Not provided'}</strong>
      </div>
      <button type="button" onClick={onEdit}>
        Edit
      </button>
    </div>
  );
}

export function ApplicationWizard() {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Values>({
    ...defaultApplicationValues,
    requestedPages: [...defaultApplicationValues.requestedPages],
  });
  const [applicationId, setApplicationId] = useState('');
  const [ready, setReady] = useState(false);
  const [stepError, setStepError] = useState('');
  const [websiteState, setWebsiteState] = useState<
    'idle' | 'checking' | 'available' | 'unavailable'
  >('idle');
  const [logoPreview, setLogoPreview] = useState('');
  const [state, submitAction, pending] = useActionState(submitBusinessApplication, { error: '' });

  useEffect(() => {
    let restoredId = '';
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as {
          applicationId?: unknown;
          values?: Partial<Values>;
        } & Partial<Values>;
        const savedValues = parsed.values ?? parsed;
        setValues({
          ...defaultApplicationValues,
          ...savedValues,
          requestedPages: Array.isArray(savedValues.requestedPages)
            ? savedValues.requestedPages
            : [...defaultApplicationValues.requestedPages],
        });
        if (
          typeof parsed.applicationId === 'string' &&
          /^[0-9a-f-]{36}$/i.test(parsed.applicationId)
        )
          restoredId = parsed.applicationId;
      }
    } catch {
      /* A damaged browser draft should never block a fresh application. */
    }
    setApplicationId(restoredId || crypto.randomUUID());
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready && applicationId && !state.reference)
      localStorage.setItem(storageKey, JSON.stringify({ applicationId, values }));
  }, [applicationId, ready, state.reference, values]);
  useEffect(() => {
    if (state.reference) localStorage.removeItem(storageKey);
  }, [state.reference]);
  useEffect(() => {
    const fields = Object.keys(state.fieldErrors ?? {});
    if (!fields.length) return;
    if (
      fields.some((field) =>
        ['businessName', 'businessType', 'otherBusinessType', 'preferredSlug'].includes(field),
      )
    )
      setStep(0);
    else if (
      fields.some((field) =>
        [
          'ownerName',
          'ownerEmail',
          'businessEmail',
          'instagram',
          'facebook',
          'tiktok',
          'addressLine',
        ].includes(field),
      )
    )
      setStep(1);
    else if (fields.some((field) => ['primaryColor', 'styleKey'].includes(field))) setStep(2);
    else if (
      fields.some((field) =>
        [
          'homepageHeadline',
          'primaryActionLabel',
          'primaryActionDestination',
          'requestedPages',
        ].includes(field),
      )
    )
      setStep(3);
    else setStep(4);
  }, [state.fieldErrors]);
  useEffect(() => {
    if (values.preferredSlug.length < 3) {
      setWebsiteState('idle');
      return;
    }
    setWebsiteState('checking');
    const timer = window.setTimeout(async () => {
      const result = await checkWebsiteName(values.preferredSlug);
      setWebsiteState(result.available ? 'available' : 'unavailable');
    }, 450);
    return () => window.clearTimeout(timer);
  }, [values.preferredSlug]);
  useEffect(
    () => () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    },
    [logoPreview],
  );

  const set = <Key extends keyof Values>(key: Key, value: Values[Key]) =>
    setValues((current) => ({ ...current, [key]: value }));
  const businessType = businessTypeOptions.find(
    (option) => option.value === values.businessType,
  )?.label;
  const style = brandStyleOptions.find((option) => option.value === values.styleKey)?.label;
  const selectedPages = requestedPageOptions
    .filter((option) => values.requestedPages.includes(option.value))
    .map((option) => option.label)
    .join(', ');
  const progress = `${((step + 1) / steps.length) * 100}%`;
  const fieldError = (name: string) => state.fieldErrors?.[name];
  const requiredDestinationPage = ['ABOUT', 'CONTACT', 'DELIVERY'].includes(
    values.primaryActionDestination,
  )
    ? values.primaryActionDestination
    : null;

  function canContinue() {
    if (
      step === 0 &&
      (!values.businessName ||
        !values.businessType ||
        (values.businessType === 'other' && !values.otherBusinessType.trim()) ||
        values.preferredSlug.length < 3 ||
        websiteState === 'unavailable')
    )
      return 'Add your business name, choose what you do, and pick an available website name.';
    if (step === 1 && (!values.ownerName || !/^\S+@\S+\.\S+$/.test(values.ownerEmail)))
      return 'Add your name and a valid email so we can contact you.';
    if (
      step === 1 &&
      values.hasPhysicalLocation &&
      (!values.addressLine || !values.city || !values.state || !values.country)
    )
      return 'Add the complete location customers can visit.';
    if (step === 3 && (!values.homepageHeadline || !values.primaryActionLabel))
      return 'Add the main headline and button wording for your website.';
    return '';
  }

  function continueForward() {
    const error = canContinue();
    if (error) {
      setStepError(error);
      return;
    }
    setStepError('');
    setStep((current) => Math.min(steps.length - 1, current + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (state.reference) {
    return (
      <section className={styles.success} aria-live="polite">
        <span className={styles.successMark}>✓</span>
        <p className={styles.kicker}>APPLICATION RECEIVED</p>
        <h1>Thank you. We’ll take it from here.</h1>
        <p>
          Our team will review your answers before creating your BusinessCare website. Nothing has
          been published or charged.
        </p>
        <div>
          <span>Your reference</span>
          <strong>{state.reference}</strong>
        </div>
        <p className={styles.smallPrint}>
          Keep this reference in case you need to contact us about your application.
        </p>
      </section>
    );
  }

  return (
    <div className={styles.wizardShell}>
      <aside className={styles.wizardIntro}>
        <a className={styles.publicBrand} href="/get-started">
          <span>bc</span> BusinessCare
        </a>
        <div>
          <p className={styles.kicker}>YOUR BUSINESS, ONLINE</p>
          <h1>Let’s build something customers can trust.</h1>
          <p>
            Answer a few simple questions. Our team will review everything with you before creating
            your website.
          </p>
        </div>
        <div className={styles.trustNote}>
          <strong>No technical knowledge needed.</strong>
          <span>Your answers stay saved in this browser until you submit.</span>
        </div>
      </aside>
      <main className={styles.wizardMain}>
        <div className={styles.progressHeader}>
          <div>
            <span>
              Step {step + 1} of {steps.length}
            </span>
            <strong>{steps[step].title}</strong>
          </div>
          <span>{Math.round(((step + 1) / steps.length) * 100)}%</span>
        </div>
        <div className={styles.progressTrack}>
          <span style={{ width: progress }} />
        </div>
        <form action={submitAction} className={styles.wizardForm}>
          <input type="hidden" name="applicationId" value={applicationId} />
          <div className={styles.honeypot} aria-hidden="true">
            <label htmlFor="website">Leave this empty</label>
            <input id="website" name="website" tabIndex={-1} autoComplete="off" />
          </div>
          <header className={styles.stepHeading}>
            <p>{steps[step].guidance}</p>
          </header>

          <section hidden={step !== 0} aria-labelledby="business-step">
            <h2 id="business-step">Tell us about your business</h2>
            <TextField
              name="businessName"
              label="What is your business called?"
              placeholder="Ada Hair Studio"
              required
              maxLength={160}
              value={values.businessName}
              error={fieldError('businessName')}
              onChange={(event) => {
                const name = event.target.value;
                setValues((current) => ({
                  ...current,
                  businessName: name,
                  preferredSlug:
                    current.preferredSlug &&
                    current.preferredSlug !== normalizeWebsiteName(current.businessName)
                      ? current.preferredSlug
                      : normalizeWebsiteName(name),
                }));
              }}
            />
            <div className={styles.fieldGroup}>
              <span className={styles.groupLabel}>What kind of business do you run?</span>
              <ChoiceCards
                name="businessType"
                value={values.businessType}
                options={businessTypeOptions}
                onChange={(value) => set('businessType', value)}
              />
              {fieldError('businessType') && (
                <p className={styles.fieldError}>{fieldError('businessType')}</p>
              )}
            </div>
            <TextAreaField
              name="businessDescription"
              label="Tell customers a little about your business"
              hint="A short introduction is enough. You can improve it later."
              placeholder="We help our customers…"
              maxLength={600}
              value={values.businessDescription}
              onChange={(event) => set('businessDescription', event.target.value)}
            />
            {values.businessType === 'other' && (
              <TextField
                name="otherBusinessType"
                label="Tell us what kind of business you run"
                hint="For example: Event planning, cleaning services, or an online learning business."
                required
                maxLength={100}
                value={values.otherBusinessType}
                error={fieldError('otherBusinessType')}
                onChange={(event) => set('otherBusinessType', event.target.value)}
              />
            )}
            {values.businessType !== 'other' && (
              <input type="hidden" name="otherBusinessType" value="" />
            )}
            <TextField
              name="preferredSlug"
              label="Choose your BusinessCare website name"
              hint="Use a short name customers can remember. You can change this with our team before approval."
              required
              minLength={3}
              maxLength={63}
              value={values.preferredSlug}
              error={fieldError('preferredSlug')}
              onChange={(event) => set('preferredSlug', normalizeWebsiteName(event.target.value))}
            />
            <div
              className={`${styles.addressPreview} ${websiteState === 'available' ? styles.available : websiteState === 'unavailable' ? styles.unavailable : ''}`}
              aria-live="polite"
            >
              <span>Your website will start at</span>
              <strong>/store/{values.preferredSlug || 'your-business-name'}</strong>
              <small>
                {websiteState === 'checking'
                  ? 'Checking this name…'
                  : websiteState === 'available'
                    ? 'This name is currently available.'
                    : websiteState === 'unavailable'
                      ? 'This name is already in use. Try another.'
                      : 'We will confirm availability before submission.'}
              </small>
            </div>
          </section>

          <section hidden={step !== 1} aria-labelledby="contact-step">
            <h2 id="contact-step">How should we reach you?</h2>
            <div className={styles.twoColumns}>
              <TextField
                name="ownerName"
                label="Your name"
                required
                autoComplete="name"
                value={values.ownerName}
                error={fieldError('ownerName')}
                onChange={(event) => set('ownerName', event.target.value)}
              />
              <TextField
                name="ownerEmail"
                label="Your email address"
                type="email"
                inputMode="email"
                required
                autoComplete="email"
                value={values.ownerEmail}
                error={fieldError('ownerEmail')}
                onChange={(event) => set('ownerEmail', event.target.value)}
              />
              <TextField
                name="businessPhone"
                label="Business phone number (optional)"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={values.businessPhone}
                onChange={(event) => set('businessPhone', event.target.value)}
              />
              <TextField
                name="whatsapp"
                label="WhatsApp number (optional)"
                type="tel"
                inputMode="tel"
                value={values.whatsapp}
                onChange={(event) => set('whatsapp', event.target.value)}
              />
              <TextField
                name="businessEmail"
                label="Business email (optional)"
                type="email"
                inputMode="email"
                value={values.businessEmail}
                error={fieldError('businessEmail')}
                onChange={(event) => set('businessEmail', event.target.value)}
              />
            </div>
            <div className={styles.socialFields}>
              <h3>
                Social pages <span>optional</span>
              </h3>
              <div className={styles.twoColumns}>
                <TextField
                  name="instagram"
                  label="Instagram username or link"
                  placeholder="@adahair or https://…"
                  value={values.instagram}
                  error={fieldError('instagram')}
                  onChange={(event) => set('instagram', event.target.value)}
                />
                <TextField
                  name="facebook"
                  label="Facebook username or link"
                  value={values.facebook}
                  error={fieldError('facebook')}
                  onChange={(event) => set('facebook', event.target.value)}
                />
                <TextField
                  name="tiktok"
                  label="TikTok username or link"
                  value={values.tiktok}
                  error={fieldError('tiktok')}
                  onChange={(event) => set('tiktok', event.target.value)}
                />
              </div>
            </div>
            <fieldset className={styles.locationChoice}>
              <legend>Do customers visit your business at a physical location?</legend>
              <label>
                <input
                  type="radio"
                  name="hasPhysicalLocation"
                  value="true"
                  checked={values.hasPhysicalLocation}
                  onChange={() => set('hasPhysicalLocation', true)}
                />{' '}
                Yes, customers can visit
              </label>
              <label>
                <input
                  type="radio"
                  name="hasPhysicalLocation"
                  value="false"
                  checked={!values.hasPhysicalLocation}
                  onChange={() => set('hasPhysicalLocation', false)}
                />{' '}
                No, I work online or travel to customers
              </label>
            </fieldset>
            {values.hasPhysicalLocation && (
              <div className={styles.twoColumns}>
                <TextField
                  name="addressLine"
                  label="Street address"
                  required
                  value={values.addressLine}
                  error={fieldError('addressLine')}
                  onChange={(event) => set('addressLine', event.target.value)}
                />
                <TextField
                  name="city"
                  label="City"
                  required
                  value={values.city}
                  onChange={(event) => set('city', event.target.value)}
                />
                <TextField
                  name="state"
                  label="State"
                  required
                  value={values.state}
                  onChange={(event) => set('state', event.target.value)}
                />
                <TextField
                  name="country"
                  label="Country"
                  required
                  value={values.country}
                  onChange={(event) => set('country', event.target.value)}
                />
              </div>
            )}
          </section>

          <section hidden={step !== 2} aria-labelledby="brand-step">
            <h2 id="brand-step">Make it look like your brand</h2>
            <p className={styles.sectionLead}>
              Choose the colours and style you want customers to see. You can change these later.
            </p>
            <div className={styles.logoField}>
              <label htmlFor="logo">
                <strong>
                  Your logo <span>optional</span>
                </strong>
                <small>JPG, PNG, or WebP up to 5 MB. Don’t have one yet? You can skip this.</small>
              </label>
              <input
                id="logo"
                name="logo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  if (logoPreview) URL.revokeObjectURL(logoPreview);
                  setLogoPreview(
                    event.target.files?.[0] ? URL.createObjectURL(event.target.files[0]) : '',
                  );
                }}
              />
              <p className={styles.fileNotice}>
                For your privacy, browsers cannot restore a selected file after a refresh. Your
                other answers will remain saved, but you would need to choose the logo again.
              </p>
              {logoPreview && (
                <div className={styles.logoPreview}>
                  <img src={logoPreview} alt="Preview of your chosen logo" />
                  <span>Your logo preview</span>
                </div>
              )}
            </div>
            <div className={styles.colorGrid}>
              {(['primaryColor', 'secondaryColor', 'accentColor'] as const).map((key) => (
                <label className={styles.colorField} key={key}>
                  <span>
                    {key === 'primaryColor'
                      ? 'Main brand colour'
                      : key === 'secondaryColor'
                        ? 'Secondary brand colour'
                        : 'Accent colour'}
                  </span>
                  <span className={styles.colorControl}>
                    <input
                      type="color"
                      name={key}
                      value={values[key]}
                      onChange={(event) => set(key, event.target.value)}
                    />
                    <strong>{values[key]}</strong>
                  </span>
                </label>
              ))}
            </div>
            <div
              className={styles.brandPreview}
              style={
                {
                  '--preview-primary': values.primaryColor,
                  '--preview-secondary': values.secondaryColor,
                  '--preview-accent': values.accentColor,
                } as React.CSSProperties
              }
            >
              <span />
              <div>
                <strong>{values.businessName || 'Your business'}</strong>
                <small>Your colours working together</small>
              </div>
              <button type="button">Shop now</button>
            </div>
            <div className={styles.fieldGroup}>
              <span className={styles.groupLabel}>Which style feels most like your business?</span>
              <ChoiceCards
                name="styleKey"
                value={values.styleKey}
                options={brandStyleOptions}
                onChange={(value) => set('styleKey', value)}
              />
            </div>
          </section>

          <section hidden={step !== 3} aria-labelledby="website-step">
            <h2 id="website-step">What should customers see first?</h2>
            <TextField
              name="homepageHeadline"
              label="Homepage headline"
              placeholder="Luxury Made Effortless"
              required
              maxLength={160}
              value={values.homepageHeadline}
              error={fieldError('homepageHeadline')}
              onChange={(event) => set('homepageHeadline', event.target.value)}
            />
            <TextAreaField
              name="homepageMessage"
              label="Add a short message about your business (optional)"
              maxLength={320}
              value={values.homepageMessage}
              onChange={(event) => set('homepageMessage', event.target.value)}
            />
            <div className={styles.twoColumns}>
              <TextField
                name="primaryActionLabel"
                label="What should your main button say?"
                required
                maxLength={60}
                value={values.primaryActionLabel}
                error={fieldError('primaryActionLabel')}
                onChange={(event) => set('primaryActionLabel', event.target.value)}
              />
              <label className={styles.nativeField}>
                <span>Where should the button take customers?</span>
                <select
                  name="primaryActionDestination"
                  value={values.primaryActionDestination}
                  onChange={(event) => {
                    const destination = event.target.value;
                    setValues((current) => ({
                      ...current,
                      primaryActionDestination: destination,
                      requestedPages:
                        destination !== 'PRODUCTS' && !current.requestedPages.includes(destination)
                          ? [...current.requestedPages, destination]
                          : current.requestedPages,
                    }));
                  }}
                >
                  <option value="PRODUCTS">Products</option>
                  <option value="ABOUT">About Us page</option>
                  <option value="CONTACT">Contact Us page</option>
                  <option value="DELIVERY">Delivery Information page</option>
                </select>
              </label>
            </div>
            <TextField
              name="announcement"
              label="Message at the top of your website (optional)"
              placeholder="Free delivery on orders over ₦50,000"
              maxLength={160}
              value={values.announcement}
              onChange={(event) => set('announcement', event.target.value)}
            />
            <fieldset className={styles.pageChoices}>
              <legend>Which pages would you like us to prepare?</legend>
              <p>
                We will create these as private starter drafts. Review them before making them
                visible to customers.
              </p>
              {requestedPageOptions.map((option) => (
                <label key={option.value}>
                  <input
                    type="checkbox"
                    name="requestedPages"
                    value={option.value}
                    checked={values.requestedPages.includes(option.value)}
                    disabled={requiredDestinationPage === option.value}
                    onChange={(event) =>
                      set(
                        'requestedPages',
                        event.target.checked
                          ? [...values.requestedPages, option.value]
                          : values.requestedPages.filter((value) => value !== option.value),
                      )
                    }
                  />{' '}
                  {option.label}
                  {requiredDestinationPage === option.value && ' · needed for your main button'}
                </label>
              ))}
            </fieldset>
          </section>

          <section hidden={step !== 4} aria-labelledby="products-step">
            <h2 id="products-step">Tell us about what you sell</h2>
            <div className={styles.fieldGroup}>
              <span className={styles.groupLabel}>Do you already have products ready to add?</span>
              <ChoiceCards
                name="productReadiness"
                value={values.productReadiness}
                options={productReadinessOptions}
                onChange={(value) => set('productReadiness', value)}
              />
            </div>
            {values.productReadiness === 'READY' && (
              <label className={styles.nativeField}>
                <span>Approximately how many products?</span>
                <select
                  name="productQuantityRange"
                  value={values.productQuantityRange}
                  onChange={(event) => set('productQuantityRange', event.target.value)}
                >
                  {productQuantityOptions.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {values.productReadiness !== 'READY' && (
              <input type="hidden" name="productQuantityRange" value="" />
            )}
            <TextAreaField
              name="productCategories"
              label={
                values.productReadiness === 'SERVICES'
                  ? 'What kinds of services do you offer? (optional)'
                  : 'What kinds of products do you sell? (optional)'
              }
              hint="Separate names with commas, for example: Dresses, Shoes, Handbags."
              value={values.productCategories}
              error={fieldError('productCategories')}
              onChange={(event) => set('productCategories', event.target.value)}
            />
            <div className={styles.planSection}>
              <h3>Choose a starting plan</h3>
              <p>
                Your choice is a proposal. Our team can help you change it before your business is
                created.
              </p>
              <ChoiceCards
                name="proposedPlan"
                value={values.proposedPlan}
                options={planApplicationOptions}
                onChange={(value) => set('proposedPlan', value)}
              />
            </div>
          </section>

          <section hidden={step !== 5} aria-labelledby="review-step">
            <h2 id="review-step">Everything look right?</h2>
            <p className={styles.sectionLead}>
              Submitting sends this application to BusinessCare for review. It does not create or
              publish a website yet.
            </p>
            <div className={styles.reviewList}>
              <ReviewRow
                label="Business"
                value={`${values.businessName}${businessType ? ` · ${businessType}` : ''}${values.otherBusinessType ? ` (${values.otherBusinessType})` : ''}`}
                onEdit={() => setStep(0)}
              />
              <ReviewRow
                label="Contact"
                value={`${values.ownerName} · ${values.ownerEmail}`}
                onEdit={() => setStep(1)}
              />
              <ReviewRow label="Brand" value={style ?? ''} onEdit={() => setStep(2)} />
              <ReviewRow
                label="Website"
                value={`${values.homepageHeadline} · /store/${values.preferredSlug}`}
                onEdit={() => setStep(3)}
              />
              <ReviewRow
                label="Starter pages"
                value={selectedPages || 'No starter pages requested'}
                onEdit={() => setStep(3)}
              />
              <ReviewRow
                label="Products and plan"
                value={`${productReadinessOptions.find((option) => option.value === values.productReadiness)?.label} · ${planApplicationOptions.find((option) => option.value === values.proposedPlan)?.label}`}
                onEdit={() => setStep(4)}
              />
            </div>
            <div className={styles.reviewColors} aria-label="Chosen brand colours">
              <span style={{ background: values.primaryColor }} />
              <span style={{ background: values.secondaryColor }} />
              <span style={{ background: values.accentColor }} />
              <small>Your chosen brand colours</small>
            </div>
            <label className={styles.consent}>
              <input type="checkbox" name="contactConsent" required />
              <span>
                <strong>I’m ready to send this application.</strong>
                <small>
                  BusinessCare may use these details to review my request and contact me about
                  setting up my business.
                </small>
              </span>
            </label>
          </section>

          <FormError message={state.error} />
          {stepError && (
            <p className={styles.stepError} role="alert">
              {stepError}
            </p>
          )}
          <footer className={styles.wizardActions}>
            {step > 0 ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setStepError('');
                  setStep((current) => current - 1);
                }}
              >
                Back
              </Button>
            ) : (
              <span />
            )}
            {step < steps.length - 1 ? (
              <Button type="button" onClick={continueForward}>
                Continue
              </Button>
            ) : (
              <Button type="submit" disabled={pending || !applicationId}>
                {pending ? 'Sending your application…' : 'Submit my business'}
              </Button>
            )}
          </footer>
        </form>
      </main>
    </div>
  );
}
