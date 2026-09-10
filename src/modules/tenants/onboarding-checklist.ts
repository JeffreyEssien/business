import type { OnboardingProgress } from './types';

/** Both platform and owner dashboards describe the same persisted onboarding state. */
export function onboardingChecklist(progress: OnboardingProgress | null) {
  const categoryNames = progress?.suggested_categories ?? [];
  const productGuidance = progress?.products_added
    ? 'Your first customer-ready product is in the catalog.'
    : progress?.application_product_readiness === 'READY'
      ? `Your application said your products are ready${progress.expected_product_range ? ` (${progress.expected_product_range.replace('_', '–').replace('OVER–100', 'more than 100')})` : ''}. Add the first product${categoryNames.length ? ` using your draft category suggestions: ${categoryNames.join(', ')}` : ''}.`
      : progress?.application_product_readiness === 'SERVICES'
        ? `Add each service customers can choose as a catalog item${categoryNames.length ? `; your suggested service groups are ${categoryNames.join(', ')}` : ''}.`
        : 'Start adding products when they are ready. Nothing from the application was presented to customers automatically.';
  return [
    {
      label: 'Add business contact details',
      description: 'Give customers the name and contact details they will see on your store.',
      complete: progress?.business_profile_completed ?? false,
    },
    {
      label: 'Accept the owner invitation',
      description: 'The invited owner must verify their email before they can manage this store.',
      complete: progress?.owner_accepted ?? false,
    },
    {
      label: 'Choose the store design',
      description: 'Select the colors and layout customers will see.',
      complete: progress?.theme_selected ?? false,
    },
    {
      label: 'Prepare the homepage',
      description: 'Add the welcome message, images, menu, and footer information.',
      complete: progress?.homepage_configured ?? false,
    },
    {
      label: 'Set how the store appears in search',
      description: 'Write the title and description shown by search and sharing services.',
      complete: progress?.seo_configured ?? false,
    },
    {
      label: 'Add products customers can buy',
      description: productGuidance,
      complete: progress?.products_added ?? false,
    },
    {
      label: 'Choose how customers will pay',
      description: 'Confirm the payment method the store will accept.',
      complete: progress?.payment_configured ?? false,
    },
    {
      label: 'Make the store visible to customers',
      description: 'Publish the reviewed store when it is ready for customers.',
      complete: progress?.store_published ?? false,
    },
  ];
}
