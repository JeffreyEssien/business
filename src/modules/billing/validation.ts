import type { BillingInterval } from './types';

/** Plain-language billing cycle choices. The database re-validates the stored value. */
export const BILLING_INTERVALS: { value: BillingInterval; label: string }[] = [
  { value: 'MONTHLY', label: 'Every month' },
  { value: 'YEARLY', label: 'Every year' },
];

export type PlanInput = {
  slug: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  billingInterval: BillingInterval;
  isPublic: boolean;
  sortOrder: number;
};

const MAX_PRICE = 100000000;

function isBillingInterval(value: string): value is BillingInterval {
  return BILLING_INTERVALS.some((interval) => interval.value === value);
}

/**
 * Validates untrusted plan-management form values at the trust boundary. The
 * security-definer RPC repeats every check; this only produces friendly messages.
 */
export function normalizePlanInput(form: FormData): { input?: PlanInput; error?: string } {
  const slug = String(form.get('plan') ?? '').trim();
  const name = String(form.get('name') ?? '').trim();
  const description = String(form.get('description') ?? '').trim();
  const currency = String(form.get('currency') ?? 'NGN')
    .trim()
    .toUpperCase();
  const billingInterval = String(form.get('billingInterval') ?? '');
  const price = Number(String(form.get('price') ?? '').trim());
  const sortOrder = Number(String(form.get('sortOrder') ?? '').trim());

  if (!slug) return { error: 'This plan could not be identified.' };
  if (name.length < 1 || name.length > 80)
    return { error: 'Enter a plan name of 80 characters or fewer.' };
  if (description.length > 500)
    return { error: 'Keep the plan summary to 500 characters or fewer.' };
  if (!Number.isFinite(price) || price < 0 || price > MAX_PRICE)
    return { error: 'Enter a price of 0 or more.' };
  if (!/^[A-Z]{3}$/.test(currency))
    return { error: 'Use a three-letter currency code such as NGN.' };
  if (!isBillingInterval(billingInterval))
    return { error: 'Choose how often this plan is billed.' };
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 1000)
    return { error: 'Display order must be a whole number between 0 and 1000.' };

  return {
    input: {
      slug,
      name,
      description,
      price: Math.round(price * 100) / 100,
      currency,
      billingInterval,
      isPublic: form.get('isPublic') === 'on',
      sortOrder,
    },
  };
}
