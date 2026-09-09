import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { v2 as cloudinary } from 'cloudinary';
import { database } from './database.mjs';

const slug = process.argv[2];
assert.match(slug ?? '', /^ui-test-[0-9a-f-]+$/, 'Provide one exact generated UI-test slug.');
const sql = database();
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

try {
  const fixtureEmail = `${slug}@example.invalid`;
  const [authUser] = await sql`select id from auth.users where email=${fixtureEmail}`;
  let mediaAssets = [];
  await sql.begin(async (tx) => {
    const tenants = await tx`select id from public.tenants where slug=${slug} for update`;
    const tenantIds = tenants.map(({ id }) => id);
    if (!tenantIds.length) return;
    mediaAssets = await tx`
      select storage_provider, storage_key, resource_type
      from public.media_assets
      where tenant_id = any(${tenantIds}::uuid[])
    `;
    for (const table of [
      'order_items',
      'orders',
      'customer_addresses',
      'customers',
      'shipping_rates',
      'shipping_zones',
      'tenant_bank_accounts',
      'tenant_site_versions',
      'seo_entries',
      'product_media',
      'product_categories',
      'products',
      'categories',
      'content_blocks',
      'navigation_items',
      'pages',
      'tenant_invitations',
      'tenant_business_settings',
      'tenant_seo_settings',
      'media_assets',
      'tenant_theme_settings',
      'tenant_layout_settings',
      'tenant_email_settings',
      'tenant_sms_settings',
      'tenant_checkout_settings',
      'subscriptions',
      'tenant_domains',
      'tenant_onboarding',
      'tenant_memberships',
      'audit_logs',
    ]) {
      await tx`delete from ${tx('public.' + table)} where tenant_id=any(${tenantIds}::uuid[])`;
    }
    await tx`delete from public.tenants where id=any(${tenantIds}::uuid[])`;
  });

  for (const asset of mediaAssets) {
    if (asset.storage_provider === 'cloudinary') {
      await cloudinary.uploader.destroy(asset.storage_key, {
        resource_type: asset.resource_type,
        invalidate: true,
      });
    } else if (asset.storage_provider === 'supabase') {
      const result = await admin.storage.from('catalog-media').remove([asset.storage_key]);
      assert.ifError(result.error);
    }
  }
  if (authUser) {
    const result = await admin.auth.admin.deleteUser(authUser.id);
    assert.ifError(result.error);
  }
  console.log('Specific UI fixture removed.');
} finally {
  await sql.end();
}
