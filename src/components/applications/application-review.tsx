'use client';
import { useActionState } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-layout';
import { SelectField, TextAreaField, TextField } from '@/components/ui/form-fields';
import {
  approveAndCreateBusiness,
  changeApplicationStatus,
  saveApplicationChanges,
} from '@/modules/applications/actions';
import {
  applicationStatusLabels,
  brandStyleOptions,
  businessTypeOptions,
  planApplicationOptions,
  productQuantityOptions,
  productReadinessOptions,
  requestedPageOptions,
} from '@/modules/applications/options';
import type {
  ApplicationActionState,
  ApplicationEvent,
  ApplicationRevision,
  BusinessApplication,
} from '@/modules/applications/types';
import styles from './application-admin.module.css';

function displayDate(value: string) {
  return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

export function ApplicationReview({
  application,
  events,
  revisions,
}: {
  application: BusinessApplication;
  events: ApplicationEvent[];
  revisions: ApplicationRevision[];
}) {
  const initial: ApplicationActionState = { error: '' };
  const [saveState, saveAction, savePending] = useActionState(
    saveApplicationChanges.bind(null, application.id),
    initial,
  );
  const [reviewState, reviewAction, reviewPending] = useActionState(
    changeApplicationStatus.bind(null, application.id, 'UNDER_REVIEW'),
    initial,
  );
  const [rejectState, rejectAction, rejectPending] = useActionState(
    changeApplicationStatus.bind(null, application.id, 'REJECTED'),
    initial,
  );
  const [approveState, approveAction, approvePending] = useActionState(
    approveAndCreateBusiness.bind(null, application.id),
    initial,
  );
  const locked = application.status === 'PROVISIONED';
  const fieldError = (name: string) => saveState.fieldErrors?.[name];
  return (
    <div className={styles.reviewLayout}>
      <div className={styles.reviewMain}>
        <section className={styles.summaryCard}>
          <div>
            <span>Current status</span>
            <strong>{applicationStatusLabels[application.status]}</strong>
          </div>
          <div>
            <span>Submitted</span>
            <strong>{displayDate(application.submitted_at)}</strong>
          </div>
          <div>
            <span>Requested website</span>
            <strong>/store/{application.preferred_slug}</strong>
          </div>
          {application.logo_public_url && (
            <img
              src={application.logo_public_url}
              alt={`${application.business_name} submitted logo`}
            />
          )}
        </section>
        <form
          action={saveAction}
          className={styles.reviewForm}
          aria-label="Edit business application"
        >
          <fieldset disabled={locked || savePending}>
            <legend>Business</legend>
            <div className={styles.formGrid}>
              <TextField
                name="businessName"
                label="Business name"
                required
                defaultValue={application.business_name}
                error={fieldError('businessName')}
              />
              <SelectField
                name="businessType"
                label="Business type"
                options={businessTypeOptions}
                defaultValue={application.business_type}
                error={fieldError('businessType')}
              />
              <TextField
                name="otherBusinessType"
                label="Other business type explanation"
                hint="Required when the business type is Other."
                maxLength={100}
                defaultValue={application.other_business_type}
                error={fieldError('otherBusinessType')}
              />
              <TextAreaField
                name="businessDescription"
                label="Business description"
                defaultValue={application.business_description}
                maxLength={600}
              />
              <TextField
                name="preferredSlug"
                label="BusinessCare website name"
                required
                defaultValue={application.preferred_slug}
                error={fieldError('preferredSlug')}
              />
            </div>
          </fieldset>
          <fieldset disabled={locked || savePending}>
            <legend>Owner and customer contact</legend>
            <div className={styles.formGrid}>
              <TextField
                name="ownerName"
                label="Owner name"
                required
                defaultValue={application.owner_name}
                error={fieldError('ownerName')}
              />
              <TextField
                name="ownerEmail"
                label="Owner email"
                type="email"
                required
                defaultValue={application.owner_email}
                error={fieldError('ownerEmail')}
              />
              <TextField
                name="businessPhone"
                label="Business phone"
                defaultValue={application.business_phone}
              />
              <TextField name="whatsapp" label="WhatsApp" defaultValue={application.whatsapp} />
              <TextField
                name="businessEmail"
                label="Business email"
                type="email"
                defaultValue={application.business_email}
                error={fieldError('businessEmail')}
              />
              <TextField
                name="instagram"
                label="Instagram"
                defaultValue={application.instagram}
                error={fieldError('instagram')}
              />
              <TextField
                name="facebook"
                label="Facebook"
                defaultValue={application.facebook}
                error={fieldError('facebook')}
              />
              <TextField
                name="tiktok"
                label="TikTok"
                defaultValue={application.tiktok}
                error={fieldError('tiktok')}
              />
              <SelectField
                name="hasPhysicalLocation"
                label="Customer-facing location"
                options={[
                  { value: 'false', label: 'No physical customer location' },
                  { value: 'true', label: 'Customers can visit' },
                ]}
                defaultValue={String(application.has_physical_location)}
              />
              <TextField
                name="addressLine"
                label="Street address"
                defaultValue={application.address_line}
                error={fieldError('addressLine')}
              />
              <TextField name="city" label="City" defaultValue={application.city} />
              <TextField name="state" label="State" defaultValue={application.state} />
              <TextField name="country" label="Country" defaultValue={application.country} />
            </div>
          </fieldset>
          <fieldset disabled={locked || savePending}>
            <legend>Branding</legend>
            <div className={styles.formGrid}>
              <SelectField
                name="styleKey"
                label="Website style"
                options={brandStyleOptions}
                defaultValue={application.style_key}
              />
              <TextField
                name="primaryColor"
                label="Main brand colour"
                type="color"
                defaultValue={application.primary_color}
              />
              <TextField
                name="secondaryColor"
                label="Secondary brand colour"
                type="color"
                defaultValue={application.secondary_color}
              />
              <TextField
                name="accentColor"
                label="Accent colour"
                type="color"
                defaultValue={application.accent_color}
              />
              <TextField
                name="replacementLogo"
                label={
                  application.logo_public_url
                    ? 'Replace submitted logo (optional)'
                    : 'Add a logo (optional)'
                }
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hint="JPG, PNG, or WebP up to 5 MB. The replacement is used only after you save."
              />
            </div>
            {application.logo_public_url && (
              <label className={styles.removeLogo}>
                <input type="checkbox" name="removeLogo" /> Remove the submitted logo when these
                changes are saved
              </label>
            )}
          </fieldset>
          <fieldset disabled={locked || savePending}>
            <legend>Website</legend>
            <div className={styles.formGrid}>
              <TextField
                name="homepageHeadline"
                label="Homepage headline"
                required
                defaultValue={application.homepage_headline}
                error={fieldError('homepageHeadline')}
              />
              <TextAreaField
                name="homepageMessage"
                label="Homepage supporting message"
                defaultValue={application.homepage_message}
              />
              <TextField
                name="primaryActionLabel"
                label="Main button wording"
                required
                defaultValue={application.primary_action_label}
              />
              <SelectField
                name="primaryActionDestination"
                label="Main button destination"
                options={[
                  { value: 'PRODUCTS', label: 'Products' },
                  { value: 'ABOUT', label: 'About Us page' },
                  { value: 'CONTACT', label: 'Contact Us page' },
                  { value: 'DELIVERY', label: 'Delivery Information page' },
                ]}
                defaultValue={application.primary_action_destination}
              />
              <TextField
                name="announcement"
                label="Top-of-site message"
                defaultValue={application.announcement}
              />
            </div>
            <div className={styles.checkGrid}>
              {requestedPageOptions.map((option) => (
                <label key={option.value}>
                  <input
                    type="checkbox"
                    name="requestedPages"
                    value={option.value}
                    defaultChecked={application.requested_pages.includes(option.value)}
                  />{' '}
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset disabled={locked || savePending}>
            <legend>Products and plan</legend>
            <div className={styles.formGrid}>
              <SelectField
                name="productReadiness"
                label="Product readiness"
                options={productReadinessOptions}
                defaultValue={application.product_readiness}
              />
              <SelectField
                name="productQuantityRange"
                label="Approximate number of products"
                options={productQuantityOptions}
                defaultValue={application.product_quantity_range}
              />
              <TextAreaField
                name="productCategories"
                label="Product or service categories"
                defaultValue={application.product_categories.join(', ')}
              />
              <SelectField
                name="proposedPlan"
                label="Approved starting plan"
                options={planApplicationOptions}
                defaultValue={application.proposed_plan}
              />
            </div>
          </fieldset>
          <fieldset disabled={locked || savePending}>
            <legend>Private review note</legend>
            <TextAreaField
              name="internalNote"
              label="Note for the BusinessCare team"
              hint="Applicants cannot see this note."
              defaultValue={application.internal_note}
              maxLength={4000}
            />
          </fieldset>
          <FormError message={saveState.error} />
          {saveState.message && (
            <p className={styles.saved} role="status">
              {saveState.message}
            </p>
          )}
          {!locked && (
            <Button type="submit" disabled={savePending}>
              {savePending ? 'Saving application…' : 'Save application changes'}
            </Button>
          )}
        </form>
        <section className={styles.originalCard}>
          <h2>Original customer submission</h2>
          <p>This protected snapshot never changes when an administrator edits the application.</p>
          <dl>
            <div>
              <dt>Business</dt>
              <dd>{String(application.original_submission.businessName ?? '')}</dd>
            </div>
            <div>
              <dt>Business type</dt>
              <dd>
                {String(application.original_submission.businessType ?? '')}
                {application.original_submission.businessType === 'other' &&
                  Boolean(application.original_submission.otherBusinessType) &&
                  ` — ${String(application.original_submission.otherBusinessType)}`}
              </dd>
            </div>
            <div>
              <dt>Owner</dt>
              <dd>
                {String(application.original_submission.ownerName ?? '')} ·{' '}
                {String(application.original_submission.ownerEmail ?? '')}
              </dd>
            </div>
            <div>
              <dt>Website name</dt>
              <dd>{String(application.original_submission.preferredSlug ?? '')}</dd>
            </div>
            <div>
              <dt>Homepage headline</dt>
              <dd>{String(application.original_submission.homepageHeadline ?? '')}</dd>
            </div>
          </dl>
        </section>
      </div>
      <aside className={styles.reviewAside}>
        {!locked && (
          <section className={styles.actionCard}>
            <h2>Review decision</h2>
            <p>
              Save any corrections first. Creating the business is atomic: if setup fails, no
              partial business is left behind.
            </p>
            {application.status !== 'UNDER_REVIEW' && (
              <form action={reviewAction}>
                <FormError message={reviewState.error} />
                {reviewState.message && <p className={styles.saved}>{reviewState.message}</p>}
                <Button type="submit" variant="secondary" disabled={reviewPending}>
                  Mark as being reviewed
                </Button>
              </form>
            )}
            <form action={approveAction}>
              <FormError message={approveState.error} />
              <Button type="submit" disabled={approvePending}>
                {approvePending ? 'Creating the business…' : 'Approve & create business'}
              </Button>
            </form>
            <form action={rejectAction}>
              <TextAreaField
                name="statusNote"
                label="Reason or internal context (optional)"
                maxLength={4000}
              />
              <FormError message={rejectState.error} />
              {rejectState.message && <p className={styles.saved}>{rejectState.message}</p>}
              <Button type="submit" variant="secondary" disabled={rejectPending}>
                Mark as not proceeding
              </Button>
            </form>
          </section>
        )}
        {locked && (
          <section className={styles.actionCard}>
            <h2>Business created</h2>
            <p>
              This application is locked because its approved values have been used to create the
              business.
            </p>
            {application.provisioned_tenant_id && (
              <ButtonLink href={`/businesses/${application.provisioned_tenant_id}`}>
                Open created business →
              </ButtonLink>
            )}
          </section>
        )}
        <section className={styles.historyCard}>
          <h2>Application history</h2>
          {events.map((event) => (
            <div key={event.id}>
              <strong>{event.action.toLowerCase().replaceAll('_', ' ')}</strong>
              <span>{displayDate(event.created_at)}</span>
            </div>
          ))}
          {revisions.length > 0 && (
            <p>
              {revisions.length} previous edited{' '}
              {revisions.length === 1 ? 'version is' : 'versions are'} preserved.
            </p>
          )}
        </section>
      </aside>
    </div>
  );
}
