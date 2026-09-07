import {
  paymentOptions,
  planOptions,
  reservedHandles,
  templateOptions,
} from './onboarding-options';
export type CreateBusinessInput = {
  name: string;
  slug: string;
  owner: string;
  email: string;
  template: string;
  plan: string;
  payment: string;
};
type ValidationResult =
  | { valid: true; input: CreateBusinessInput }
  | { valid: false; error: string; input: CreateBusinessInput };
const hasOption = (options: readonly { value: string }[], value: string) =>
  options.some((option) => option.value === value);

/** Normalize untrusted form input once. PostgreSQL repeats validation at the write boundary. */
export function validateBusinessForm(form: FormData): ValidationResult {
  const read = (name: string) => String(form.get(name) ?? '').trim();
  const input: CreateBusinessInput = {
    name: read('name'),
    slug: read('slug'),
    owner: read('owner'),
    email: read('email'),
    template: read('template'),
    plan: read('plan'),
    payment: read('payment'),
  };
  if (!input.name || input.name.length > 160)
    return { valid: false, input, error: 'Enter a business name of up to 160 characters.' };
  if (
    !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(input.slug) ||
    input.slug.length < 3 ||
    input.slug.length > 63 ||
    reservedHandles.includes(input.slug)
  ) {
    return {
      valid: false,
      input,
      error:
        'Choose an available handle with 3–63 lowercase letters, numbers, or hyphens. This handle may be reserved.',
    };
  }
  if (
    !input.owner ||
    input.owner.length > 120 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) ||
    input.email.length > 254
  ) {
    return { valid: false, input, error: 'Enter the owner’s name and a valid email address.' };
  }
  if (
    !hasOption(templateOptions, input.template) ||
    !hasOption(planOptions, input.plan) ||
    !hasOption(paymentOptions, input.payment)
  ) {
    return { valid: false, input, error: 'Choose a valid template, plan, and payment method.' };
  }
  return { valid: true, input };
}
export function provisioningErrorMessage(code?: string) {
  if (code === '23505') return 'That store handle is already in use. Choose another.';
  if (code === '22023')
    return 'One of the setup values is invalid or reserved. Please check the form.';
  return 'The business could not be created. Please try again.';
}
