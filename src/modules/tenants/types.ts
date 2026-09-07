/** Application-facing records. Components receive these values, never a database client. */
export type Business = {
  id: string;
  name: string;
  slug: string;
  status: string;
  template_key: string;
  created_at: string;
  plans: { name: string } | null;
};
export type OnboardingProgress = {
  business_profile_completed: boolean;
  owner_accepted: boolean;
  theme_selected: boolean;
  homepage_configured: boolean;
  seo_configured: boolean;
  products_added: boolean;
  payment_configured: boolean;
  store_published: boolean;
};
export type OwnerInvitation = { id: string; owner_name: string; email: string; status: string };
export type ActivityEvent = { id: string; action: string; created_at: string };
export type BusinessDetails = {
  business: Business;
  invitation: OwnerInvitation | null;
  onboarding: OnboardingProgress | null;
  activity: ActivityEvent[];
};
