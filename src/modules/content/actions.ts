'use server';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  deleteCloudinaryMedia,
  uploadTenantMedia,
  type UploadedMedia,
} from '@/lib/cloudinary/server';
import { getTenantWorkspace } from '@/modules/tenants/workspace-query';
import {
  contentErrorMessage,
  validateNavigation,
  validatedSiteImage,
  validateContentPage,
  validateSiteDraft,
} from './validation';

export type ContentActionState = { error: string; message: string };
type StoredSiteMedia = {
  id: string;
  storage_provider: string;
  storage_key: string;
  resource_type: 'image' | 'video';
};

function canEdit(role: string) {
  return ['TENANT_OWNER', 'TENANT_ADMIN', 'TENANT_MANAGER'].includes(role);
}

function uploadArguments(upload: UploadedMedia | null, file: File | null, alt: string) {
  return {
    storage_key: upload?.publicId ?? null,
    public_url: upload?.secureUrl ?? null,
    file_name: upload && file ? file.name.slice(0, 255) : null,
    mime_type: upload && file ? file.type : null,
    file_size: upload?.bytes ?? null,
    alt_text: upload ? alt : null,
    format: upload?.format ?? null,
    width: upload?.width ?? null,
    height: upload?.height ?? null,
  };
}

export async function saveSiteDraft(
  slug: string,
  _state: ContentActionState,
  form: FormData,
): Promise<ContentActionState> {
  const validation = validateSiteDraft(form);
  if (!validation.input) return { error: validation.error ?? 'Invalid storefront.', message: '' };
  let logoFile: File | null;
  let heroFile: File | null;
  try {
    logoFile = validatedSiteImage(form, 'logo');
    heroFile = validatedSiteImage(form, 'heroImage');
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Invalid site image.', message: '' };
  }
  const workspace = await getTenantWorkspace(slug);
  if (!canEdit(workspace.membership.role))
    return { error: 'You do not have permission to edit this storefront.', message: '' };

  let replacedMedia: StoredSiteMedia[] = [];
  if (logoFile || heroFile) {
    const { data: settings, error: settingsError } = await workspace.supabase
      .from('tenant_business_settings')
      .select('logo_asset_id,hero_asset_id')
      .eq('tenant_id', workspace.tenant.id)
      .single();
    if (settingsError) return { error: 'Existing site media could not be resolved.', message: '' };
    const replacedIds = [
      logoFile ? settings.logo_asset_id : null,
      heroFile ? settings.hero_asset_id : null,
    ].filter((id): id is string => Boolean(id));
    if (replacedIds.length) {
      const { data, error } = await workspace.supabase
        .from('media_assets')
        .select('id,storage_provider,storage_key,resource_type')
        .eq('tenant_id', workspace.tenant.id)
        .in('id', replacedIds);
      if (error) return { error: 'Existing site media could not be loaded.', message: '' };
      replacedMedia = (data ?? []) as StoredSiteMedia[];
    }
  }

  // One action owns all independent uploads because Next.js queues actions from a single client.
  const uploadFiles = [logoFile, heroFile] as const;
  const uploadResults = await Promise.allSettled(
    uploadFiles.map((file) =>
      file
        ? uploadTenantMedia(file, workspace.tenant.id, randomUUID(), 'image', 'site')
        : Promise.resolve(null),
    ),
  );
  const successfulUploads = uploadResults
    .filter(
      (result): result is PromiseFulfilledResult<UploadedMedia | null> =>
        result.status === 'fulfilled',
    )
    .map((result) => result.value)
    .filter((upload): upload is UploadedMedia => Boolean(upload));
  if (uploadResults.some((result) => result.status === 'rejected')) {
    await Promise.allSettled(
      successfulUploads.map((upload) =>
        deleteCloudinaryMedia(upload.publicId, upload.resourceType),
      ),
    );
    return {
      error: 'One or more site images could not be uploaded. Nothing was saved.',
      message: '',
    };
  }
  const [logoUpload, heroUpload] = uploadResults.map((result) =>
    result.status === 'fulfilled' ? result.value : null,
  );
  const logo = uploadArguments(logoUpload, logoFile, `${validation.input.businessName} logo`);
  const hero = uploadArguments(heroUpload, heroFile, validation.input.heroHeadline);
  const { error } = await workspace.supabase.rpc('save_site_draft', {
    target_tenant: workspace.tenant.id,
    business_name: validation.input.businessName,
    business_description: validation.input.businessDescription,
    business_phone: validation.input.phone,
    business_address: validation.input.address,
    theme_preset: validation.input.preset,
    primary_color: validation.input.primary,
    accent_color: validation.input.accent,
    background_color: validation.input.background,
    text_color: validation.input.text,
    announcement_text: validation.input.announcement,
    announcement_enabled: validation.input.announcementEnabled,
    hero_eyebrow: validation.input.heroEyebrow,
    hero_headline: validation.input.heroHeadline,
    hero_subheadline: validation.input.heroSubheadline,
    hero_cta_label: validation.input.heroCtaLabel,
    hero_variant: validation.input.heroVariant,
    products_heading: validation.input.productsHeading,
    products_enabled: validation.input.productsEnabled,
    footer_description: validation.input.footerDescription,
    navigation: [],
    logo_storage_key: logo.storage_key,
    logo_public_url: logo.public_url,
    logo_file_name: logo.file_name,
    logo_mime_type: logo.mime_type,
    logo_file_size: logo.file_size,
    logo_alt_text: logo.alt_text,
    logo_format: logo.format,
    logo_width: logo.width,
    logo_height: logo.height,
    hero_storage_key: hero.storage_key,
    hero_public_url: hero.public_url,
    hero_file_name: hero.file_name,
    hero_mime_type: hero.mime_type,
    hero_file_size: hero.file_size,
    hero_alt_text: hero.alt_text,
    hero_format: hero.format,
    hero_width: hero.width,
    hero_height: hero.height,
  });
  if (error) {
    await Promise.allSettled(
      successfulUploads.map((upload) =>
        deleteCloudinaryMedia(upload.publicId, upload.resourceType),
      ),
    );
    return { error: contentErrorMessage(error.code, error.message), message: '' };
  }
  await Promise.allSettled(
    replacedMedia
      .filter((media) => media.storage_provider === 'cloudinary')
      .map((media) => deleteCloudinaryMedia(media.storage_key, media.resource_type)),
  );
  revalidatePath(`/t/${slug}/design`);
  revalidatePath(`/t/${slug}/design/preview`);
  return {
    error: '',
    message: 'Changes saved for review. Your live storefront has not changed.',
  };
}

export async function saveNavigation(
  slug: string,
  _state: ContentActionState,
  form: FormData,
): Promise<ContentActionState> {
  const validation = validateNavigation(form);
  if (!validation.input)
    return { error: validation.error ?? 'Check every store menu link.', message: '' };
  const workspace = await getTenantWorkspace(slug);
  if (!canEdit(workspace.membership.role))
    return { error: 'You do not have permission to change store menus.', message: '' };
  const { error } = await workspace.supabase.rpc('save_navigation', {
    target_tenant: workspace.tenant.id,
    navigation: validation.input,
  });
  if (error)
    return {
      error:
        error.code === '22023'
          ? 'One or more menu destinations are no longer available. Check every menu link.'
          : contentErrorMessage(error.code, error.message),
      message: '',
    };
  revalidatePath(`/t/${slug}/content/navigation`);
  revalidatePath(`/t/${slug}/design`);
  revalidatePath(`/t/${slug}/design/preview`);
  return {
    error: '',
    message: 'Store menus saved for review. Customers will see them after you publish.',
  };
}

export async function publishSite(
  slug: string,
  _state: ContentActionState,
  _form: FormData,
): Promise<ContentActionState> {
  const workspace = await getTenantWorkspace(slug);
  if (!canEdit(workspace.membership.role))
    return { error: 'You do not have permission to publish this storefront.', message: '' };
  const { data, error } = await workspace.supabase.rpc('publish_site', {
    target_tenant: workspace.tenant.id,
  });
  if (error) return { error: contentErrorMessage(error.code, error.message), message: '' };
  revalidatePath(`/t/${slug}`);
  revalidatePath(`/t/${slug}/design`);
  revalidatePath(`/store/${slug}`);
  return { error: '', message: `Version ${data} is now live.` };
}

export async function reorderHomepageSections(
  slug: string,
  sectionKeys: string[],
  _state: ContentActionState,
  _form: FormData,
): Promise<ContentActionState> {
  const workspace = await getTenantWorkspace(slug);
  if (!canEdit(workspace.membership.role))
    return { error: 'You do not have permission to change the homepage order.', message: '' };
  const { error } = await workspace.supabase.rpc('reorder_homepage_sections', {
    target_tenant: workspace.tenant.id,
    section_keys: sectionKeys,
  });
  if (error) return { error: contentErrorMessage(error.code, error.message), message: '' };
  revalidatePath(`/t/${slug}/design`);
  revalidatePath(`/t/${slug}/design/preview`);
  return {
    error: '',
    message: 'Homepage order saved. Customers will see it after you publish your saved changes.',
  };
}

export async function saveContentPage(
  slug: string,
  pageId: string | null,
  _state: ContentActionState,
  form: FormData,
): Promise<ContentActionState> {
  const validation = validateContentPage(form);
  if (!validation.input)
    return { error: validation.error ?? 'Check the page details.', message: '' };
  const workspace = await getTenantWorkspace(slug);
  if (!canEdit(workspace.membership.role))
    return { error: 'You do not have permission to edit website pages.', message: '' };
  const { error } = await workspace.supabase.rpc('save_content_page', {
    target_tenant: workspace.tenant.id,
    target_page: pageId,
    page_type: validation.input.pageType,
    page_name: validation.input.name,
    page_slug: validation.input.slug,
    page_title: validation.input.title,
    page_introduction: validation.input.introduction,
    page_body: validation.input.body,
    show_in_navigation: validation.input.showInNavigation,
    page_enabled: validation.input.enabled,
  });
  if (error) return { error: contentErrorMessage(error.code, error.message), message: '' };
  revalidatePath(`/t/${slug}/content/pages`);
  revalidatePath(`/t/${slug}/design`);
  redirect(`/t/${slug}/content/pages`);
}

export async function deleteContentPage(slug: string, pageId: string, _form: FormData) {
  const workspace = await getTenantWorkspace(slug);
  if (!canEdit(workspace.membership.role)) throw new Error('FORBIDDEN');
  const { error } = await workspace.supabase.rpc('delete_content_page', {
    target_tenant: workspace.tenant.id,
    target_page: pageId,
  });
  if (error) throw new Error(contentErrorMessage(error.code, error.message));
  revalidatePath(`/t/${slug}/content/pages`);
  revalidatePath(`/t/${slug}/design`);
}
