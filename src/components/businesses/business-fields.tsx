import type { CreateBusinessInput } from '@/modules/tenants/validation';
import type { SiteKind } from '@/modules/portfolio/types';
type FieldGroupProps = { values?: Partial<CreateBusinessInput> };
import { TextField, SelectField } from '@/components/ui/form-fields';
import { FormGrid, FormSection } from '@/components/ui/form-layout';
import { templateOptions, planOptions, paymentOptions } from '@/modules/tenants/onboarding-options';

/** Domain field groups can be reused by onboarding and future business settings forms. */
export function BusinessDetailsFields({
  values = {},
  siteKind = 'STORE',
}: FieldGroupProps & { siteKind?: SiteKind }) {
  const isPortfolio = siteKind === 'PORTFOLIO';
  return (
    <FormSection title={isPortfolio ? '01 · Portfolio details' : '01 · Business details'}>
      <FormGrid>
        <TextField
          name="name"
          defaultValue={values.name}
          label={isPortfolio ? 'Name shown on the portfolio' : 'Business name'}
          required
          maxLength={160}
          placeholder={isPortfolio ? 'e.g. Ada Lovelace or Studio Ada' : 'e.g. Xelle'}
          autoComplete="organization"
        />
        <TextField
          name="slug"
          defaultValue={values.slug}
          label={isPortfolio ? 'Website handle' : 'Store handle'}
          required
          minLength={3}
          maxLength={63}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          placeholder={isPortfolio ? 'e.g. ada' : 'e.g. xelle'}
          autoCapitalize="none"
          spellCheck={false}
          hint={`Use lowercase letters, numbers, and hyphens. This reserves the future ${
            isPortfolio ? 'website' : 'store'
          } address.`}
        />
      </FormGrid>
    </FormSection>
  );
}
export function OwnerFields({ values = {} }: FieldGroupProps) {
  return (
    <FormSection
      title="02 · Business owner"
      description="After creation, you can generate an invitation link and share it privately with this owner."
    >
      <FormGrid>
        <TextField
          name="owner"
          defaultValue={values.owner}
          label="Owner name"
          required
          maxLength={120}
          autoComplete="name"
          placeholder="Full name"
        />
        <TextField
          name="email"
          defaultValue={values.email}
          label="Owner email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          placeholder="owner@example.com"
        />
      </FormGrid>
    </FormSection>
  );
}
export function InitialSetupFields({ values = {} }: FieldGroupProps) {
  return (
    <FormSection
      title="03 · Initial setup"
      description="Choose the starting plan and preferred payment method. No charges are made during setup."
    >
      <FormGrid>
        <SelectField
          name="template"
          defaultValue={values.template}
          label="Industry & template"
          options={templateOptions}
        />
        <SelectField
          name="plan"
          defaultValue={values.plan}
          label="Initial plan"
          options={planOptions}
        />
        <SelectField
          name="payment"
          defaultValue={values.payment}
          label="Preferred payment setup"
          options={paymentOptions}
          hint="Payment details will be added before the store launches."
        />
      </FormGrid>
    </FormSection>
  );
}
