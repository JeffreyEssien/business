'use server';
import { createHash, randomUUID } from 'node:crypto';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requirePlatformAdmin } from '@/modules/auth/authorization';
import {
  deleteCloudinaryMedia,
  uploadApplicationLogo,
  type UploadedMedia,
} from '@/lib/cloudinary/server';
import { applicationInputFromForm, validateApplicationInput } from './validation';
import type { ApplicationActionState } from './types';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedLogoTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

function publicError(code?: string) {
  if (code === 'RATE_LIMITED')
    return 'We have received several requests from this connection. Please wait an hour before trying again.';
  if (code === 'DUPLICATE_APPLICATION')
    return 'We already have a recent application for this email or website name. Contact BusinessCare if you need to update it.';
  if (code === 'WEBSITE_NAME_UNAVAILABLE' || code === '23505')
    return 'That website name has just been taken. Choose another and submit again.';
  return 'We could not submit your application safely. Your answers are still here, so please try again.';
}

function safeRequestFingerprint(headerList: Headers) {
  const forwarded =
    headerList.get('cf-connecting-ip') ||
    headerList.get('x-forwarded-for') ||
    headerList.get('x-real-ip') ||
    'unknown';
  const address = forwarded.split(',')[0].trim().slice(0, 80);
  return createHash('sha256').update(`businesscare-application:${address}`).digest('hex');
}

function logoFile(form: FormData, name = 'logo') {
  const value = form.get(name);
  if (!(value instanceof File) || value.size === 0) return null;
  if (!allowedLogoTypes.has(value.type) || value.size > 5 * 1024 * 1024) {
    throw new Error('Choose a JPG, PNG, or WebP logo no larger than 5 MB.');
  }
  return value;
}

function logoPayload(upload: UploadedMedia | null, file: File | null) {
  return upload && file
    ? {
        provider: upload.provider,
        storageKey: upload.publicId,
        secureUrl: upload.secureUrl,
        fileName: file.name.slice(0, 255),
        mimeType: file.type,
        fileSize: file.size,
        format: upload.format,
        width: upload.width,
        height: upload.height,
      }
    : null;
}

export async function checkWebsiteName(value: string) {
  const candidate = String(value).trim().toLowerCase();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(candidate) || candidate.length < 3)
    return { available: false };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('business_application_slug_available', { candidate });
  return { available: !error && data === true };
}

export async function submitBusinessApplication(
  _state: ApplicationActionState,
  form: FormData,
): Promise<ApplicationActionState> {
  if (String(form.get('website') ?? ''))
    return { error: 'Your application could not be submitted.' };
  if (form.get('contactConsent') !== 'on')
    return { error: 'Confirm that BusinessCare may contact you about this application.' };
  const applicationId = String(form.get('applicationId') ?? '');
  if (!uuidPattern.test(applicationId)) return { error: 'Reload the page and try again.' };
  const input = applicationInputFromForm(form);
  const validation = validateApplicationInput(input);
  if (!validation.valid)
    return {
      error: 'Check the highlighted answers before submitting.',
      fieldErrors: validation.errors,
    };

  let file: File | null;
  try {
    file = logoFile(form);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Choose a valid logo.' };
  }
  let upload: UploadedMedia | null = null;
  try {
    if (file) upload = await uploadApplicationLogo(file, applicationId, randomUUID());
    const requestHeaders = await headers();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('submit_business_application', {
      application_id: applicationId,
      payload: { ...input, logo: logoPayload(upload, file) },
      request_fingerprint: safeRequestFingerprint(requestHeaders),
    });
    const result = data as {
      ok?: boolean;
      code?: string;
      reference?: string;
      existing?: boolean;
    } | null;
    if (error || !result?.ok || !result.reference) {
      if (upload) await deleteCloudinaryMedia(upload.publicId, upload.resourceType).catch(() => {});
      return { error: publicError(result?.code ?? error?.code), fieldErrors: {} };
    }
    if (result.existing && upload)
      await deleteCloudinaryMedia(upload.publicId, upload.resourceType).catch(() => {});
    return { error: '', reference: result.reference };
  } catch {
    if (upload) await deleteCloudinaryMedia(upload.publicId, upload.resourceType).catch(() => {});
    return {
      error:
        'We could not submit your application safely. Your answers are still here, so please try again.',
    };
  }
}

export async function saveApplicationChanges(
  id: string,
  _state: ApplicationActionState,
  form: FormData,
): Promise<ApplicationActionState> {
  const { supabase } = await requirePlatformAdmin();
  if (!uuidPattern.test(id)) return { error: 'This application is unavailable.' };
  const input = applicationInputFromForm(form);
  const validation = validateApplicationInput(input);
  if (!validation.valid)
    return {
      error: 'Check the highlighted answers before saving.',
      fieldErrors: validation.errors,
    };
  let file: File | null;
  try {
    file = logoFile(form, 'replacementLogo');
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Choose a valid replacement logo.' };
  }
  const removeLogo = form.get('removeLogo') === 'on';
  if (file && removeLogo)
    return { error: 'Choose either a replacement logo or remove the current logo, not both.' };
  const currentLogo = await supabase
    .from('business_applications')
    .select('logo_storage_key')
    .eq('id', id)
    .maybeSingle();
  if (currentLogo.error) return { error: 'The current logo could not be checked. Please retry.' };
  let upload: UploadedMedia | null = null;
  try {
    if (file) upload = await uploadApplicationLogo(file, id, randomUUID());
  } catch {
    return {
      error: 'The replacement logo could not be uploaded. No application details were changed.',
    };
  }
  const { error } = await supabase.rpc('save_business_application', {
    target_application: id,
    payload: {
      ...input,
      ...(upload ? { logo: logoPayload(upload, file) } : {}),
      removeLogo,
    },
    note: String(form.get('internalNote') ?? '')
      .trim()
      .slice(0, 4001),
  });
  if (error) {
    if (upload) await deleteCloudinaryMedia(upload.publicId, upload.resourceType).catch(() => {});
    return { error: publicError(error.code), fieldErrors: validation.errors };
  }
  if (
    (removeLogo || upload) &&
    currentLogo.data?.logo_storage_key &&
    currentLogo.data.logo_storage_key !== upload?.publicId
  )
    await deleteCloudinaryMedia(currentLogo.data.logo_storage_key, 'image').catch(() => {});
  revalidatePath(`/businesses/applications/${id}`);
  revalidatePath('/businesses/applications');
  return {
    error: '',
    message: 'Application changes saved. The original submission is still preserved.',
  };
}

export async function changeApplicationStatus(
  id: string,
  status: 'UNDER_REVIEW' | 'REJECTED',
  _state: ApplicationActionState,
  form: FormData,
): Promise<ApplicationActionState> {
  const { supabase } = await requirePlatformAdmin();
  if (!uuidPattern.test(id)) return { error: 'This application is unavailable.' };
  const { error } = await supabase.rpc('change_business_application_status', {
    target_application: id,
    next_status: status,
    note: String(form.get('statusNote') ?? '')
      .trim()
      .slice(0, 4001),
  });
  if (error)
    return { error: 'The application status could not be changed. Refresh and try again.' };
  revalidatePath(`/businesses/applications/${id}`);
  revalidatePath('/businesses/applications');
  return {
    error: '',
    message:
      status === 'UNDER_REVIEW'
        ? 'Application marked as being reviewed.'
        : 'Application marked as not proceeding.',
  };
}

export async function approveAndCreateBusiness(
  id: string,
  _state: ApplicationActionState,
  _form: FormData,
): Promise<ApplicationActionState> {
  const { supabase } = await requirePlatformAdmin();
  if (!uuidPattern.test(id)) return { error: 'This application is unavailable.' };
  const { data, error } = await supabase.rpc('provision_business_application', {
    target_application: id,
  });
  if (error)
    return {
      error:
        error.code === '23505'
          ? 'The website name is no longer available. Save a different name before approving.'
          : 'The business could not be created. Nothing was partially provisioned; review the application and try again.',
    };
  revalidatePath('/');
  revalidatePath('/businesses');
  revalidatePath('/businesses/applications');
  redirect(`/businesses/${data}`);
}
