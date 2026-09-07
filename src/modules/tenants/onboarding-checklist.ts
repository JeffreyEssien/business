import type { OnboardingProgress } from './types';

/** Both platform and owner dashboards describe the same persisted onboarding state. */
export function onboardingChecklist(progress: OnboardingProgress | null) {
  return [
    { label: 'Business profile', complete: progress?.business_profile_completed ?? false },
    { label: 'Owner accepted invitation', complete: progress?.owner_accepted ?? false },
    { label: 'Theme selected', complete: progress?.theme_selected ?? false },
    { label: 'Homepage configured', complete: progress?.homepage_configured ?? false },
    { label: 'Products added', complete: progress?.products_added ?? false },
    { label: 'Payments configured', complete: progress?.payment_configured ?? false },
    { label: 'Store published', complete: progress?.store_published ?? false },
  ];
}
