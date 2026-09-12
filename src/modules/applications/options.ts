export const businessTypeOptions = [
  { value: 'fashion', label: 'Fashion & clothing' },
  { value: 'beauty', label: 'Beauty & skincare' },
  { value: 'hair', label: 'Hair & salon' },
  { value: 'food', label: 'Food & restaurant' },
  { value: 'cakes', label: 'Cakes & baking' },
  { value: 'jewellery', label: 'Jewellery & accessories' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'home', label: 'Home & lifestyle' },
  { value: 'professional', label: 'Professional services' },
  { value: 'other', label: 'Other' },
] as const;

export const brandStyleOptions = [
  {
    value: 'clean-minimal',
    label: 'Clean & minimal',
    description: 'Calm spacing and a simple, modern look.',
    preview: 'clean',
  },
  {
    value: 'elegant-luxury',
    label: 'Elegant & luxury',
    description: 'Refined type and an editorial feel.',
    preview: 'elegant',
  },
  {
    value: 'bright-bold',
    label: 'Bright & bold',
    description: 'Confident colour and energetic highlights.',
    preview: 'bold',
  },
  {
    value: 'soft-friendly',
    label: 'Soft & friendly',
    description: 'Welcoming shapes and a gentle visual tone.',
    preview: 'soft',
  },
  {
    value: 'warm-natural',
    label: 'Warm & natural',
    description: 'Earthy character and comfortable contrast.',
    preview: 'warm',
  },
  {
    value: 'professional-modern',
    label: 'Professional & modern',
    description: 'Structured, clear, and business-focused.',
    preview: 'professional',
  },
] as const;

export const planApplicationOptions = [
  {
    value: 'starter',
    label: 'Starter',
    description: 'A proposed starting point for a smaller initial website.',
  },
  {
    value: 'growth',
    label: 'Growth',
    description: 'A proposal for businesses expecting a larger catalogue or team.',
  },
  {
    value: 'pro',
    label: 'Pro',
    description: 'A proposal for established businesses with broader operational needs.',
  },
] as const;

export const requestedPageOptions = [
  { value: 'ABOUT', label: 'About Us' },
  { value: 'CONTACT', label: 'Contact Us' },
  { value: 'DELIVERY', label: 'Delivery Information' },
  { value: 'RETURNS', label: 'Return / Refund Policy' },
  { value: 'PRIVACY', label: 'Privacy Policy' },
  { value: 'TERMS', label: 'Terms & Conditions' },
] as const;

export const productReadinessOptions = [
  { value: 'READY', label: 'Yes, my products are ready' },
  { value: 'NOT_YET', label: 'Not yet' },
  { value: 'SERVICES', label: 'I sell services instead' },
] as const;

export const productQuantityOptions = [
  { value: '', label: 'Choose an approximate amount' },
  { value: '1_10', label: '1–10' },
  { value: '11_50', label: '11–50' },
  { value: '51_100', label: '51–100' },
  { value: 'OVER_100', label: 'More than 100' },
] as const;

export const applicationStatusOptions = [
  { value: '', label: 'All applications' },
  { value: 'PENDING', label: 'Waiting for review' },
  { value: 'UNDER_REVIEW', label: 'Being reviewed' },
  { value: 'REJECTED', label: 'Not proceeding' },
  { value: 'PROVISIONED', label: 'Business created' },
] as const;

export const applicationStatusLabels = {
  PENDING: 'Waiting for review',
  UNDER_REVIEW: 'Being reviewed',
  REJECTED: 'Not proceeding',
  PROVISIONED: 'Business created',
} as const;

export const defaultApplicationValues = {
  businessName: '',
  businessType: '',
  otherBusinessType: '',
  businessDescription: '',
  ownerName: '',
  ownerEmail: '',
  businessPhone: '',
  whatsapp: '',
  businessEmail: '',
  instagram: '',
  facebook: '',
  tiktok: '',
  hasPhysicalLocation: false,
  addressLine: '',
  city: '',
  state: '',
  country: 'Nigeria',
  primaryColor: '#6655d7',
  secondaryColor: '#8b7fc7',
  accentColor: '#e2a94b',
  styleKey: 'clean-minimal',
  homepageHeadline: '',
  homepageMessage: '',
  primaryActionLabel: 'Shop Now',
  primaryActionDestination: 'PRODUCTS',
  announcement: '',
  requestedPages: ['ABOUT', 'CONTACT'],
  productReadiness: 'NOT_YET',
  productQuantityRange: '',
  productCategories: '',
  preferredSlug: '',
  proposedPlan: 'starter',
} as const;
