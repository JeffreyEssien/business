export type ApplicationStatus = 'PENDING' | 'UNDER_REVIEW' | 'REJECTED' | 'PROVISIONED';

export type BusinessApplicationInput = {
  businessName: string;
  businessType: string;
  otherBusinessType: string;
  businessDescription: string;
  ownerName: string;
  ownerEmail: string;
  businessPhone: string;
  whatsapp: string;
  businessEmail: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  hasPhysicalLocation: boolean;
  addressLine: string;
  city: string;
  state: string;
  country: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  styleKey: string;
  homepageHeadline: string;
  homepageMessage: string;
  primaryActionLabel: string;
  primaryActionDestination: string;
  announcement: string;
  requestedPages: string[];
  productReadiness: string;
  productQuantityRange: string;
  productCategories: string[];
  preferredSlug: string;
  proposedPlan: string;
};

export type BusinessApplication = {
  id: string;
  reference: string;
  status: ApplicationStatus;
  submitted_at: string;
  reviewed_at: string | null;
  rejected_at: string | null;
  provisioned_at: string | null;
  provisioned_tenant_id: string | null;
  original_submission: Record<string, unknown>;
  internal_note: string;
  logo_public_url: string | null;
  logo_storage_key: string | null;
  business_name: string;
  business_type: string;
  other_business_type: string;
  business_description: string;
  owner_name: string;
  owner_email: string;
  business_phone: string;
  whatsapp: string;
  business_email: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  has_physical_location: boolean;
  address_line: string;
  city: string;
  state: string;
  country: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  style_key: string;
  homepage_headline: string;
  homepage_message: string;
  primary_action_label: string;
  primary_action_destination: string;
  announcement: string;
  requested_pages: string[];
  product_readiness: string;
  product_quantity_range: string;
  product_categories: string[];
  preferred_slug: string;
  proposed_plan: string;
};

export type ApplicationEvent = {
  id: string;
  action: string;
  created_at: string;
};

export type ApplicationRevision = {
  id: string;
  previous_values: Record<string, unknown>;
  created_at: string;
};

export type ApplicationActionState = {
  error: string;
  message?: string;
  reference?: string;
  fieldErrors?: Record<string, string>;
};
