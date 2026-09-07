import type { CreateBusinessInput } from '@/modules/tenants/validation';
type FieldGroupProps = { values?: Partial<CreateBusinessInput> };
import { TextField, SelectField } from '@/components/ui/form-fields';
import { FormGrid, FormSection } from '@/components/ui/form-layout';
import { templateOptions, planOptions, paymentOptions } from '@/modules/tenants/onboarding-options';

/** Domain field groups can be reused by onboarding and future business settings forms. */
export function BusinessDetailsFields({ values = {} }: FieldGroupProps) {
  return (
    <FormSection title="01 · Business details">
      <FormGrid>
        <TextField
          name="name"
          defaultValue={values.name}
          label="Business name"
          required
          maxLength={160}
          placeholder="e.g. Xelle"
          autoComplete="organization"
        />
        <TextField
          name="slug"
          defaultValue={values.slug}
          label="Store handle"
          required
          minLength={3}
          maxLength={63}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          placeholder="e.g. xelle"
          autoCapitalize="none"
          spellCheck={false}
          hint="Use lowercase letters, numbers, and hyphens. This reserves your future store address."
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
