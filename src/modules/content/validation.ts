import { themePresets, type ThemePresetKey } from './presets';
import type { NavigationEditorItem } from './types';

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
    },
  };
}

export function validateNavigation(form: FormData) {
  let items: unknown;
  try {
    items = JSON.parse(String(form.get('navigation') ?? '[]'));
  } catch {
    return { input: null, error: 'The store menu links could not be read. Reload and try again.' };
  }
  if (!Array.isArray(items) || items.length > 8)
    return { input: null, error: 'Use no more than eight store menu links.' };
  const navigation: NavigationEditorItem[] = [];
  for (const value of items) {
    if (!value || typeof value !== 'object')
      return { input: null, error: 'Check every store menu link.' };
    const item = value as Record<string, unknown>;
    const label = String(item.label ?? '').trim();
    const target = String(item.target ?? '').trim();
    const location = String(item.location ?? '');
    const linkType = String(item.linkType ?? '');
    const pageId = item.pageId ? String(item.pageId) : null;
    const categoryId = item.categoryId ? String(item.categoryId) : null;
    if (
      !label ||
      label.length > 60 ||
      !['HEADER', 'FOOTER'].includes(location) ||
      !['PAGE', 'URL', 'CATEGORY'].includes(linkType) ||
      (linkType === 'PAGE' && !pageId) ||
      (linkType === 'CATEGORY' && !categoryId) ||
      (linkType === 'URL' &&
        !/^\/[A-Za-z0-9/#?&._=%+-]*$/.test(target) &&
        !/^https:\/\/\S+$/.test(target))
    ) {
      return { input: null, error: 'Add a label and choose a valid destination for every link.' };
    }
    navigation.push({
      id: String(item.id ?? ''),
      label,
      target,
      location: location as NavigationEditorItem['location'],
      linkType: linkType as NavigationEditorItem['linkType'],
      enabled: item.enabled !== false,
      pageId,
      categoryId,
    });
  }
  return { input: navigation, error: null };
}

export function contentErrorMessage(code?: string, message?: string) {
  if (code === '42501') return 'You do not have permission to edit this storefront.';
  if (code === '22023') return 'The storefront settings were rejected. Check every field.';
  if (code === '23505' || message?.includes('duplicate'))
    return 'That web address is already being used. Choose another.';
  return 'The storefront could not be saved. Please try again.';
}

export function validateContentPage(form: FormData) {
  const pageType = String(form.get('pageType') ?? '');
  const name = text(form, 'name', 80);
  const slug = text(form, 'slug', 100);
  const title = text(form, 'title', 160);
  const introduction = text(form, 'introduction', 500);
  const body = text(form, 'body', 20000);
  if (
    !['ABOUT', 'CONTACT', 'POLICY', 'CUSTOM'].includes(pageType) ||
    !name ||
    !slug ||
    !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) ||
    ['home', 'products'].includes(slug) ||
    !title ||
    !body ||
    introduction === null
  ) {
    return { input: null, error: 'Add a page name, web address, heading, and page text.' };
  }
  return {
    error: null,
    input: {
      pageType,
      name,
      slug,
      title,
      introduction,
      body,
      showInNavigation: form.get('showInNavigation') === 'on',
      enabled: form.get('enabled') === 'on',
    },
  };
}
