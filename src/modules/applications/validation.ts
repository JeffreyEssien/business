import {
  brandStyleOptions,
  businessTypeOptions,
  planApplicationOptions,
  productQuantityOptions,
  productReadinessOptions,
  requestedPageOptions,
} from './options';
import type { BusinessApplication, BusinessApplicationInput } from './types';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const colorPattern = /^#[0-9a-fA-F]{6}$/;
const websiteNamePattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const socialPattern = /^(https:\/\/[^\s]+|@?[A-Za-z0-9._-]+)$/;
const reservedNames = new Set([
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
  'get-started',
]);

const contains = (options: readonly { value: string }[], value: string) =>
  options.some((option) => option.value === value);

export function normalizeWebsiteName(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

function read(form: FormData, name: string, maximum: number) {
  return String(form.get(name) ?? '')
    .trim()
    .slice(0, maximum + 1);
}

export function applicationInputFromForm(form: FormData): BusinessApplicationInput {
  const primaryActionDestination = read(form, 'primaryActionDestination', 20);
  const requestedPages = form.getAll('requestedPages').map(String);
  const requiredDestinationPage = ['ABOUT', 'CONTACT', 'DELIVERY'].includes(
    primaryActionDestination,
  )
    ? primaryActionDestination
    : null;
  if (requiredDestinationPage && !requestedPages.includes(requiredDestinationPage))
    requestedPages.push(requiredDestinationPage);
  return {
    businessName: read(form, 'businessName', 160),
    businessType: read(form, 'businessType', 30),
    businessDescription: read(form, 'businessDescription', 600),
    ownerName: read(form, 'ownerName', 120),
    ownerEmail: read(form, 'ownerEmail', 254).toLowerCase(),
    businessPhone: read(form, 'businessPhone', 40),
    whatsapp: read(form, 'whatsapp', 80),
    businessEmail: read(form, 'businessEmail', 254).toLowerCase(),
    instagram: read(form, 'instagram', 200),
    facebook: read(form, 'facebook', 200),
    tiktok: read(form, 'tiktok', 200),
    hasPhysicalLocation: form.get('hasPhysicalLocation') === 'true',
    addressLine: read(form, 'addressLine', 200),
    city: read(form, 'city', 100),
    state: read(form, 'state', 100),
    country: read(form, 'country', 100),
    primaryColor: read(form, 'primaryColor', 7).toLowerCase(),
    secondaryColor: read(form, 'secondaryColor', 7).toLowerCase(),
    accentColor: read(form, 'accentColor', 7).toLowerCase(),
    styleKey: read(form, 'styleKey', 40),
    homepageHeadline: read(form, 'homepageHeadline', 160),
    homepageMessage: read(form, 'homepageMessage', 320),
    primaryActionLabel: read(form, 'primaryActionLabel', 60),
    primaryActionDestination,
    announcement: read(form, 'announcement', 160),
    requestedPages,
    productReadiness: read(form, 'productReadiness', 20),
    productQuantityRange: read(form, 'productQuantityRange', 20),
    productCategories: read(form, 'productCategories', 620)
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    preferredSlug: normalizeWebsiteName(read(form, 'preferredSlug', 63)),
    proposedPlan: read(form, 'proposedPlan', 20),
  };
}

export function validateApplicationInput(input: BusinessApplicationInput) {
  const errors: Record<string, string> = {};
  if (!input.businessName || input.businessName.length > 160)
    errors.businessName = 'Enter your business name so we know what to put on your website.';
  if (!contains(businessTypeOptions, input.businessType))
    errors.businessType = 'Choose the option that best describes your business.';
  if (input.businessDescription.length > 600)
    errors.businessDescription = 'Keep this introduction under 600 characters.';
  if (!input.ownerName || input.ownerName.length > 120)
    errors.ownerName = 'Enter the name of the person we should contact.';
  if (!emailPattern.test(input.ownerEmail) || input.ownerEmail.length > 254)
    errors.ownerEmail = 'Use a valid email such as hello@adahair.com.';
  if (input.businessEmail && !emailPattern.test(input.businessEmail))
    errors.businessEmail = 'Use a valid business email or leave this blank.';
  for (const key of ['instagram', 'facebook', 'tiktok'] as const) {
    if (input[key] && !socialPattern.test(input[key]))
      errors[key] = 'Enter a username or a complete link beginning with https://.';
  }
  if (
    input.hasPhysicalLocation &&
    (!input.addressLine || !input.city || !input.state || !input.country)
  ) {
    errors.addressLine = 'Add the full location customers can visit, including city and state.';
  }
  if (
    ![input.primaryColor, input.secondaryColor, input.accentColor].every((value) =>
      colorPattern.test(value),
    )
  )
    errors.primaryColor = 'Choose all three brand colours using the colour controls.';
  if (!contains(brandStyleOptions, input.styleKey)) errors.styleKey = 'Choose a website style.';
  if (!input.homepageHeadline || input.homepageHeadline.length > 160)
    errors.homepageHeadline = 'Add the main message customers should see first.';
  if (!input.primaryActionLabel)
    errors.primaryActionLabel = 'Choose words for the main website button.';
  if (!['PRODUCTS', 'ABOUT', 'CONTACT', 'DELIVERY'].includes(input.primaryActionDestination))
    errors.primaryActionDestination = 'Choose where the main button should take customers.';
  if (!input.requestedPages.every((value) => contains(requestedPageOptions, value)))
    errors.requestedPages = 'Choose only the available starter pages.';
  if (!contains(productReadinessOptions, input.productReadiness))
    errors.productReadiness = 'Tell us whether your products are ready.';
  if (
    input.productReadiness === 'READY' &&
    (!input.productQuantityRange || !contains(productQuantityOptions, input.productQuantityRange))
  )
    errors.productQuantityRange = 'Choose the approximate number of products you have.';
  if (
    input.productCategories.length > 10 ||
    input.productCategories.some((value) => value.length > 60)
  )
    errors.productCategories = 'Add no more than ten short category names.';
  if (
    !websiteNamePattern.test(input.preferredSlug) ||
    input.preferredSlug.length < 3 ||
    input.preferredSlug.length > 63 ||
    reservedNames.has(input.preferredSlug)
  ) {
    errors.preferredSlug = 'Choose a website name with letters, numbers, or hyphens.';
  }
  if (!contains(planApplicationOptions, input.proposedPlan)) errors.proposedPlan = 'Choose a plan.';
  return { valid: Object.keys(errors).length === 0, errors };
}

export function applicationToInput(application: BusinessApplication): BusinessApplicationInput {
  return {
    businessName: application.business_name,
    businessType: application.business_type,
    businessDescription: application.business_description,
    ownerName: application.owner_name,
    ownerEmail: application.owner_email,
    businessPhone: application.business_phone,
    whatsapp: application.whatsapp,
    businessEmail: application.business_email,
    instagram: application.instagram,
    facebook: application.facebook,
    tiktok: application.tiktok,
    hasPhysicalLocation: application.has_physical_location,
    addressLine: application.address_line,
    city: application.city,
    state: application.state,
    country: application.country,
    primaryColor: application.primary_color,
    secondaryColor: application.secondary_color,
    accentColor: application.accent_color,
    styleKey: application.style_key,
    homepageHeadline: application.homepage_headline,
    homepageMessage: application.homepage_message,
    primaryActionLabel: application.primary_action_label,
    primaryActionDestination: application.primary_action_destination,
    announcement: application.announcement,
    requestedPages: application.requested_pages,
    productReadiness: application.product_readiness,
    productQuantityRange: application.product_quantity_range,
    productCategories: application.product_categories,
    preferredSlug: application.preferred_slug,
    proposedPlan: application.proposed_plan,
  };
}
