# ADR 003: Cloudinary for image and video storage

Date: 2026-09-06

Status: implemented

## Decision

BusinessCare images and videos will be uploaded to and delivered from Cloudinary. After a successful upload, the application stores the Cloudinary delivery URL in the tenant-scoped media record; storefront and admin views render the media from that URL. The record also retains the Cloudinary public ID and resource type needed for transformations, replacement, and deletion.

New Phase 2 uploads use Cloudinary. Existing Supabase `catalog-media` records remain readable and receive provider-aware cleanup when their media is replaced or their product is deleted; no new upload depends on that bucket.

## Required integration boundaries

- Uploads must run through trusted server-side code. Cloudinary secrets must never reach browser bundles.
- Cloudinary public IDs must be generated under a tenant-specific namespace such as `businesscare/tenants/{tenant_id}/...`; original filenames are not trusted as identifiers.
- Continue validating type, size, ownership, and required dimensions before recording an asset.
- Persist Cloudinary public ID, resource type (`image` or `video`), dimensions, format, byte size, delivery URL, alt text/caption, and tenant ownership where applicable.
- Treat Cloudinary as the source of the file and PostgreSQL as the source of ownership, relationships, descriptive metadata, and the delivery URL used by the application.
- Product mutations must reference only media assets owned by the same tenant.
- Replacements and deletions need explicit Cloudinary cleanup behavior so remote assets are not orphaned.
- Signed uploads may be introduced later, but signatures must be issued only after server-side authentication, membership, role, and tenant checks.

## Migration note

Existing `media_assets` fields are intentionally provider-oriented (`storage_provider`, `storage_key`, and `public_url_or_resolvable_key`). The Cloudinary integration should add a new immutable migration only if more provider metadata is required. Previously applied migrations must not be edited.

## Implementation

- `src/lib/cloudinary/server.ts` owns credential validation, authenticated streaming uploads, and provider deletion.
- `202609070001_cloudinary_media.sql` records resource type and format, validates Cloudinary tenant namespaces, and cleans replaced/deleted metadata transactionally.
- Product forms accept supported images and short videos up to 5 MB. The storefront selects an image or native video renderer from the stored resource type.
- Live integration and browser regression tests verify upload, delivery URL rendering, tenant isolation, database cleanup, and Cloudinary deletion.
