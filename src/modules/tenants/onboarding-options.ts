/** Display choices shared by the creation form and server-side validation.
 * The database independently validates these values before provisioning.
 */
export const templateOptions = [
  { value: 'general', label: 'General store · Modern' },
  { value: 'fashion', label: 'Fashion · Luxury' },
  { value: 'beauty', label: 'Beauty · Soft' },
  { value: 'restaurant', label: 'Restaurant · Dark' },
] as const;
export const planOptions = [
  { value: 'starter', label: 'Starter' },
  { value: 'growth', label: 'Growth' },
  { value: 'pro', label: 'Pro' },
] as const;
export const paymentOptions = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'paystack', label: 'Paystack' },
] as const;
export const reservedHandles = [
  'www',
  'app',
  'admin',
  'api',
  'auth',
  'login',
  'support',
  'mail',
  'setup',
  'businesses',
];
