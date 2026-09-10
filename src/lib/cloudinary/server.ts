import 'server-only';
import { v2 as cloudinary } from 'cloudinary';

export type CloudinaryResourceType = 'image' | 'video';
export type UploadedMedia = {
  provider: 'cloudinary';
  publicId: string;
  secureUrl: string;
  resourceType: CloudinaryResourceType;
  format: string;
  bytes: number;
  width: number | null;
  height: number | null;
};

type TenantMediaFolder = 'products' | 'site' | 'seo';

function configuredClient() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) throw new Error('CLOUDINARY_NOT_CONFIGURED');
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
  return cloudinary;
}

/** Uploads authenticated media without exposing signing credentials to the browser. */
export async function uploadTenantMedia(
  file: File,
  tenantId: string,
  generatedId: string,
  resourceType: CloudinaryResourceType,
  folder: TenantMediaFolder,
): Promise<UploadedMedia> {
  return uploadMedia(file, `businesscare/tenants/${tenantId}/${folder}`, generatedId, resourceType);
}

async function uploadMedia(
  file: File,
  folder: string,
  generatedId: string,
  resourceType: CloudinaryResourceType,
): Promise<UploadedMedia> {
  const client = configuredClient();
  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await new Promise<Awaited<ReturnType<typeof client.uploader.upload>>>(
    (resolve, reject) => {
      const stream = client.uploader.upload_stream(
        {
          folder,
          public_id: generatedId,
          resource_type: resourceType,
          overwrite: false,
          unique_filename: false,
          use_filename: false,
        },
        (error, response) => {
          if (error || !response) reject(error ?? new Error('CLOUDINARY_UPLOAD_FAILED'));
          else resolve(response);
        },
      );
      stream.end(buffer);
    },
  );
  return {
    provider: 'cloudinary',
    publicId: result.public_id,
    secureUrl: result.secure_url,
    resourceType,
    format: result.format,
    bytes: result.bytes,
    width: result.width || null,
    height: result.height || null,
  };
}

/** Stages one logo before a tenant exists; approval later transfers database ownership. */
export function uploadApplicationLogo(file: File, applicationId: string, generatedId: string) {
  return uploadMedia(file, `businesscare/applications/${applicationId}/logo`, generatedId, 'image');
}

export function uploadCatalogMedia(
  file: File,
  tenantId: string,
  generatedId: string,
  resourceType: CloudinaryResourceType,
) {
  return uploadTenantMedia(file, tenantId, generatedId, resourceType, 'products');
}

/** Public ID plus resource type is the stable deletion identity; delivery URLs are not. */
export async function deleteCloudinaryMedia(
  publicId: string,
  resourceType: CloudinaryResourceType,
) {
  const client = configuredClient();
  const result = await client.uploader.destroy(publicId, {
    resource_type: resourceType,
    invalidate: true,
  });
  if (!['ok', 'not found'].includes(result.result)) throw new Error('CLOUDINARY_DELETE_FAILED');
}
