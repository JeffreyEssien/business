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

/**
 * Best-effort removal of files the database has released (one object or a list).
 * Failures leave an orphan, never a broken page. Sample photos are bundled with the app
 * and are never deleted.
 */
async function releaseReplaced(replaced: unknown) {
  const items = Array.isArray(replaced) ? replaced : [replaced];
  await Promise.all(
    items.map(async (value) => {
      const item = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
      if (item.provider !== 'cloudinary' || typeof item.storageKey !== 'string') return;
      await deleteCloudinaryMedia(
        item.storageKey,
        (item.resourceType as CloudinaryResourceType) ?? 'image',
      ).catch(() => undefined);
    }),
  );
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

/** Most photos one album may hold; mirrors save_portfolio_item_photos. */
export const ALBUM_LIMIT = 24;
/** New photos one save may add; the browser shrinks each before upload. */
export const ALBUM_ADD_LIMIT = 8;

type AlbumChange = { id: string; alt: string; remove: boolean };
type AlbumRequest = { photos: AlbumChange[]; files: Array<{ file: File; alt: string }> };

/**
 * Reads an AlbumField: `album` is the existing photos in display order (JSON, written by
 * the field), `albumFiles` the new photos, and `albumNewAlts` their descriptions (JSON).
 * Returns null when the album was not on the form or nothing about it changed, so
 * ordinary text saves skip the album entirely.
 */
export function readAlbum(form: FormData): AlbumRequest | { error: string } | null {
  const raw = form.get('album');
  if (typeof raw !== 'string') return null;
  const hasFiles = form
    .getAll('albumFiles')
    .some((value) => value instanceof File && value.size > 0);
  if (form.get('albumChanged') !== '1' && !hasFiles) return null;
  let photos: AlbumChange[];
  let alts: unknown[];
  try {
    const parsed = JSON.parse(raw) as unknown;
    const parsedAlts = JSON.parse(String(form.get('albumNewAlts') ?? '[]')) as unknown;
    if (!Array.isArray(parsed) || !Array.isArray(parsedAlts)) throw new Error('shape');
    photos = parsed
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      .filter((item) => typeof item.id === 'string' && /^[0-9a-f-]{36}$/i.test(item.id))
      .map((item) => ({
        id: String(item.id),
        alt: String(item.alt ?? '')
          .trim()
          .slice(0, 300),
        remove: item.remove === true,
      }));
    alts = parsedAlts;
  } catch {
    return { error: 'The album could not be read. Please reload the page and try again.' };
  }
  const files = form
    .getAll('albumFiles')
    .filter((value): value is File => value instanceof File && value.size > 0);
  if (files.length > ALBUM_ADD_LIMIT) {
    return { error: `Add up to ${ALBUM_ADD_LIMIT} photos at a time, then save and add more.` };
  }
  if (files.some((file) => !allowedTypes.has(file.type) || file.size > maxBytes)) {
    return { error: 'Photos must be JPG, PNG, or WebP files up to 5 MB.' };
  }
  return {
    photos,
    files: files.map((file, index) => ({
      file,
      alt: String(alts[index] ?? '')
        .trim()
        .slice(0, 300),
    })),
  };
}

/**
 * Uploads new album photos concurrently, then saves the whole album in one database call.
 * Any upload the database does not keep is deleted again. Returns an error or null.
 */
export async function applyAlbum(
  supabase: Supabase,
  tenantId: string,
  itemId: string,
  request: AlbumRequest,
): Promise<string | null> {
  const uploads = await Promise.allSettled(
    request.files.map(({ file }) =>
      uploadTenantMedia(file, tenantId, randomUUID(), 'image', 'portfolio'),
    ),
  );
  const done = uploads.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
  const discard = () =>
    Promise.all(
      done.map((upload) => deleteCloudinaryMedia(upload.publicId, 'image').catch(() => undefined)),
    );
  if (done.length !== uploads.length) {
    await discard();
    return 'Some photos could not be uploaded. Please try again.';
  }
  const { data, error } = await supabase.rpc('save_portfolio_item_photos', {
    target_tenant: tenantId,
    target_item: itemId,
    photos: request.photos,
    added: done.map((upload, index) => ({
      storageKey: upload.publicId,
      publicUrl: upload.secureUrl,
      fileName: request.files[index].file.name,
      mimeType: request.files[index].file.type,
      fileSize: upload.bytes,
      width: upload.width,
      height: upload.height,
      format: upload.format,
      alt: request.files[index].alt,
    })),
  });
  if (error) {
    await discard();
    return error.message?.includes('TOO_MANY_PHOTOS')
      ? `An album can hold up to ${ALBUM_LIMIT} photos. Remove some to add more.`
      : 'The album could not be saved. Please try again.';
  }
  await releaseReplaced(data);
  return null;
}
