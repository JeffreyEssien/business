import { themePresets, type ThemePresetKey } from './presets';
import type { SiteNavigationItem } from './types';

const hexColor = /^#[0-9a-fA-F]{6}$/;
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

function text(form: FormData, key: string, maximum: number) {
  const value = String(form.get(key) ?? '').trim();
  return value.length <= maximum ? value : null;
}

export function validatedSiteImage(form: FormData, key: string) {
  const value = form.get(key);
  if (!(value instanceof File) || value.size === 0) return null;
  if (!allowedImageTypes.has(value.type) || value.size > 5 * 1024 * 1024) {
    throw new Error('Site images must be JPG, PNG, or WebP files up to 5 MB.');
  }
  return value;
}

export function validateSiteDraft(form: FormData) {
  const preset = String(form.get('preset') ?? '') as ThemePresetKey;
  const values = {
    businessName: text(form, 'businessName', 160),
    businessDescription: text(form, 'businessDescription', 600),
    phone: text(form, 'phone', 40),
    address: text(form, 'address', 300),
    preset,
    primary: String(form.get('primary') ?? ''),
    accent: String(form.get('accent') ?? ''),
    background: String(form.get('background') ?? ''),
    text: String(form.get('text') ?? ''),
    announcement: text(form, 'announcement', 160),
    announcementEnabled: form.get('announcementEnabled') === 'on',
    heroEyebrow: text(form, 'heroEyebrow', 80),
    heroHeadline: text(form, 'heroHeadline', 160),
    heroSubheadline: text(form, 'heroSubheadline', 320),
    heroCtaLabel: text(form, 'heroCtaLabel', 60),
    heroVariant: String(form.get('heroVariant') ?? ''),
    productsHeading: text(form, 'productsHeading', 120),
    productsEnabled: form.get('productsEnabled') === 'on',
    footerDescription: text(form, 'footerDescription', 500),
  };
  if (
    !values.businessName ||
    !values.heroHeadline ||
    !values.productsHeading ||
    !(preset in themePresets) ||
    ![values.primary, values.accent, values.background, values.text].every((color) =>
      hexColor.test(color),
    ) ||
    !['centered', 'split', 'image-overlay'].includes(values.heroVariant) ||
    Object.values(values).some((value) => value === null)
  ) {
    return { error: 'Check the required text, color, and layout fields.', input: null };
  }
  const navigation: SiteNavigationItem[] = [0, 1, 2].flatMap((index) => {
    const label = text(form, `navLabel${index}`, 60);
    const target = text(form, `navTarget${index}`, 300);
    return label && target
      ? [{ label, target, location: 'HEADER', linkType: 'URL', enabled: true }]
      : [];
  });
  return {
    error: null,
    input: {
      ...values,
      businessName: values.businessName!,
      businessDescription: values.businessDescription!,
      phone: values.phone!,
      address: values.address!,
      announcement: values.announcement!,
      heroEyebrow: values.heroEyebrow!,
      heroHeadline: values.heroHeadline!,
      heroSubheadline: values.heroSubheadline!,
      heroCtaLabel: values.heroCtaLabel!,
      productsHeading: values.productsHeading!,
      footerDescription: values.footerDescription!,
      navigation,
    },
  };
}

export function contentErrorMessage(code?: string, message?: string) {
  if (code === '42501') return 'You do not have permission to edit this storefront.';
  if (code === '22023') return 'The storefront settings were rejected. Check every field.';
  if (message?.includes('duplicate')) return 'That media item already exists.';
  return 'The storefront could not be saved. Please try again.';
}
