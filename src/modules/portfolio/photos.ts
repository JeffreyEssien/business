import 'server-only';
import { randomUUID } from 'node:crypto';
import {
  deleteCloudinaryMedia,
  uploadTenantMedia,
  type CloudinaryResourceType,
} from '@/lib/cloudinary/server';

export type PhotoSlot = 'hero' | 'about' | 'cover';

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxBytes = 5 * 1024 * 1024;

type PhotoRequest = { file: File | null; alt: string; remove: boolean; changed: boolean };

/**
 * Reads a PhotoField's inputs. Validation happens before any text is saved, so a bad file
 * never leaves the owner with half a change. `changed` is false when nothing about the
 * photo was touched, so ordinary text saves skip the photo work entirely.
 */
export function readPhoto(form: FormData, prefix: string): PhotoRequest | { error: string } {
  const value = form.get(`${prefix}File`);
  const file = value instanceof File && value.size > 0 ? value : null;
  if (file && (!allowedTypes.has(file.type) || file.size > maxBytes)) {
    return { error: 'Photos must be JPG, PNG, or WebP files up to 5 MB.' };
  }
  const alt = String(form.get(`${prefix}Alt`) ?? '')
    .trim()
    .slice(0, 300);
  const remove = form.get(`${prefix}Remove`) === 'on';
  const originalAlt = String(form.get(`${prefix}OriginalAlt`) ?? '');
  return { file, alt, remove, changed: Boolean(file) || remove || alt !== originalAlt };
}

type Supabase = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;
};

/** Best-effort removal of a file the database has released. Failures leave an orphan, never a broken page. */
async function releaseReplaced(replaced: unknown) {
  const item =
    replaced && typeof replaced === 'object' ? (replaced as Record<string, unknown>) : {};
  if (item.provider !== 'cloudinary' || typeof item.storageKey !== 'string') return;
  await deleteCloudinaryMedia(
    item.storageKey,
    (item.resourceType as CloudinaryResourceType) ?? 'image',
  ).catch(() => undefined);
}

/** Uploads (if needed) and places one photo; returns an owner-facing error or null. */
export async function applyPhoto(
  supabase: Supabase,
  tenantId: string,
  slot: PhotoSlot,
  ref: string,
  request: PhotoRequest,
): Promise<string | null> {
  if (!request.changed) return null;
  const upload = request.file
    ? await uploadTenantMedia(request.file, tenantId, randomUUID(), 'image', 'portfolio').catch(
        () => null,
      )
    : null;
  if (request.file && !upload) return 'The photo could not be uploaded. Please try again.';
  const { data, error } = await supabase.rpc('set_portfolio_photo', {
    target_tenant: tenantId,
    slot,
    target_ref: ref,
    asset: upload
      ? {
          storageKey: upload.publicId,
          publicUrl: upload.secureUrl,
          fileName: request.file?.name,
          mimeType: request.file?.type,
          fileSize: upload.bytes,
          width: upload.width,
          height: upload.height,
          format: upload.format,
        }
      : null,
    alt: request.alt,
    remove: request.remove,
  });
  if (error) {
    // The database refused the photo; remove the upload so nothing is left behind.
    if (upload) await deleteCloudinaryMedia(upload.publicId, 'image').catch(() => undefined);
    return 'The photo could not be saved. Please try again.';
  }
  await releaseReplaced(data);
  return null;
}

export { releaseReplaced };
