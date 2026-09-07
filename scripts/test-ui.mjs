import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { chromium, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { v2 as cloudinary } from 'cloudinary';
import { database, reportError } from './database.mjs';

// Never use the real owner's password or include session tokens in screenshots/logs.
const sql = database();
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const base = process.env.INTEGRATION_APP_URL ?? 'http://127.0.0.1:3100';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const slug = `ui-test-${randomUUID()}`;
const email = `${slug}@example.invalid`;
const password = randomBytes(24).toString('base64url');
let userId, browser;
let mediaAssets = [];
let stage = 'Create temporary account';
const pageErrors = [];

async function checkFormLayout(page, mobile) {
  for (const name of ['name', 'slug', 'owner', 'email', 'template', 'plan', 'payment']) {
    const measurements = await page.locator(`[name="${name}"]`).evaluate((control) => {
      const rect = control.getBoundingClientRect();
      const label = document.querySelector(`label[for="${control.id}"]`).getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
        top: rect.top,
        labelBottom: label.bottom,
        border: parseFloat(getComputedStyle(control).borderTopWidth),
        right: rect.right,
      };
    });
    assert.ok(measurements.height >= 44, `${name}: visible control height`);
    assert.ok(measurements.width >= 150, `${name}: usable control width`);
    assert.ok(measurements.border >= 1, `${name}: visible border`);
    assert.ok(measurements.top >= measurements.labelBottom + 5, `${name}: label separation`);
  }
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'No page overflow',
  );
  const nameBox = await page.locator('[name="name"]').boundingBox();
  const slugBox = await page.locator('[name="slug"]').boundingBox();
  assert.ok(
    mobile ? slugBox.y > nameBox.y + nameBox.height : Math.abs(slugBox.y - nameBox.y) < 3,
    'Responsive field columns',
  );
}

try {
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert.ifError(created.error);
  userId = created.data.user.id;
  await sql`update public.users set platform_role='SUPER_ADMIN' where auth_user_id=${userId}`;
  stage = 'Launch Chromium';
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.on('pageerror', (error) => pageErrors.push(error.name));
  stage = 'Load login';
  await page.goto(`${base}/login`);
  stage = 'Sign in through the browser';
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in to your workspace' }).click();
  await page.waitForURL(base + '/', { timeout: 30000 });
  stage = 'Open create-business page';
  await page.goto(`${base}/businesses/new`);
  await expect(page.getByRole('heading', { name: 'Create a business.' })).toBeVisible();
  stage = 'Desktop layout';
  await checkFormLayout(page, false);
  await page.screenshot({ path: 'artifacts/ui/create-business-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  stage = 'Mobile layout';
  await checkFormLayout(page, true);
  await page.screenshot({ path: 'artifacts/ui/create-business-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByLabel('Business name', { exact: true }).fill('UI verification business');
  await page.getByLabel('Store handle', { exact: true }).fill('admin');
  await page.getByLabel('Owner name', { exact: true }).fill('Test owner');
  await page.getByLabel('Owner email', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Create business →', exact: true }).click();
  await expect(
    page.getByRole('form', { name: 'Create business' }).getByRole('alert'),
  ).toContainText('reserved');
  await expect(page.getByLabel('Business name', { exact: true })).toHaveValue(
    'UI verification business',
  );
  // Refill explicitly, so this assertion checks the actual create action after validation.
  await page.getByLabel('Business name', { exact: true }).fill('UI verification business');
  await page.getByLabel('Store handle', { exact: true }).fill(slug);
  await page.getByLabel('Owner name', { exact: true }).fill('Test owner');
  await page.getByLabel('Owner email', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Create business →', exact: true }).click();
  await page.waitForURL(/\/businesses\/[0-9a-f-]{36}$/, { timeout: 30000 });
  await expect(
    page.getByRole('heading', { name: 'UI verification business', exact: true }),
  ).toBeVisible();
  const [tenant] = await sql`select id from public.tenants where slug=${slug}`;
  const [profile] = await sql`select id from public.users where auth_user_id=${userId}`;
  await sql`insert into public.tenant_memberships(tenant_id,user_id,role) values(${tenant.id},${profile.id},'TENANT_OWNER') on conflict(tenant_id,user_id) do nothing`;
  await sql`update public.tenants set status='TRIAL' where id=${tenant.id}`;
  await sql`update public.tenant_onboarding set owner_accepted=true where tenant_id=${tenant.id}`;
  await page.setViewportSize({ width: 1440, height: 1100 });
  stage = 'Create category through tenant workspace';
  await page.goto(`${base}/t/${slug}/catalog/categories`);
  await expect(page.getByRole('heading', { name: 'Categories' })).toBeVisible();
  await page.getByLabel('Category name', { exact: true }).first().fill('Featured');
  await page.getByLabel('Handle', { exact: true }).first().fill('featured');
  await page.getByRole('button', { name: 'Add category' }).click();
  await expect(page.getByText('Featured', { exact: true })).toBeVisible();
  stage = 'Create product through tenant workspace';
  await page.goto(`${base}/t/${slug}/catalog/products/new`);
  await page.getByLabel('Product name', { exact: true }).fill('UI verification product');
  await page.getByLabel('Handle', { exact: true }).fill('ui-verification-product');
  await page.getByLabel('Short description').fill('A browser-tested catalog product.');
  await page.getByLabel('Full description').fill('Visible only in this temporary storefront.');
  await page.getByLabel('Price (NGN)').fill('4200');
  await page.getByLabel('Stock quantity').fill('7');
  await page.getByLabel('Status').selectOption('ACTIVE');
  await page.getByLabel('Categories').selectOption({ label: 'Featured' });
  const pixel = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  );
  await page.getByLabel('Primary media').setInputFiles({
    name: 'large-enough-to-test-action-limit.png',
    mimeType: 'image/png',
    buffer: Buffer.concat([pixel, Buffer.alloc(1_200_000)]),
  });
  await page.getByLabel('Media alt text or caption').fill('Tiny purple test pixel');
  await page.getByRole('button', { name: 'Save product' }).click();
  await page.waitForURL(`${base}/t/${slug}/catalog`, { timeout: 30000 });
  await expect(page.getByText('UI verification product', { exact: true })).toBeVisible();
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'Catalog has no desktop overflow',
  );
  await page.screenshot({ path: 'artifacts/ui/catalog-desktop.png', fullPage: true });
  stage = 'Create a customer information page';
  await page.goto(`${base}/t/${slug}/content/pages/new`);
  await expect(page.getByRole('heading', { name: 'What should customers know?' })).toBeVisible();
  await page.getByLabel('Page name').fill('About our business');
  await page.getByLabel('Page web address').fill('about-our-business');
  await page.getByLabel('Add this page to the main store menu').check();
  await page.getByLabel('Main page heading').fill('A business customers can trust');
  await page
    .getByLabel('Short introduction')
    .fill('Helpful information written by the store owner.');
  await page
    .getByLabel('Full page text')
    .fill('This customer page is saved first and published only when the owner is ready.');
  await page.getByRole('button', { name: 'Save without changing the live store' }).click();
  await page.waitForURL(`${base}/t/${slug}/content/pages`, { timeout: 30000 });
  await expect(page.getByRole('heading', { name: 'About our business' })).toBeVisible();
  await page.screenshot({ path: 'artifacts/ui/website-pages-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'Website pages list has no mobile overflow',
  );
  await page.screenshot({ path: 'artifacts/ui/website-pages-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1100 });
  stage = 'Save customer-friendly search appearance';
  await page.goto(`${base}/t/${slug}/marketing/search`);
  await expect(page.getByRole('heading', { name: 'Search appearance' })).toBeVisible();
  await page.getByLabel('Search result title').fill('Trusted UI verification store');
  await page
    .getByLabel('Search result description')
    .fill('A clear customer-facing description for search and sharing.');
  await page.getByLabel('Allow search services to list this store').check();
  await page.getByRole('button', { name: 'Save for the next publish' }).click();
  await expect(page.getByText(/Search appearance saved for review/)).toBeVisible({
    timeout: 30000,
  });
  await page.screenshot({ path: 'artifacts/ui/search-appearance-desktop.png', fullPage: true });
  stage = 'Save and preview storefront design with parallel media uploads';
  await page.goto(`${base}/t/${slug}/design`);
  await expect(page.getByRole('heading', { name: 'Design your storefront' })).toBeVisible();
  await page.getByLabel('Short description').fill('A tenant-controlled UI test storefront.');
  await page.getByLabel('Public phone').fill('+234 800 000 0000');
  await page.getByLabel('Short label above the heading').fill('Browser verified');
  await page
    .getByLabel('Main welcome heading', { exact: true })
    .fill('A storefront shaped by its owner');
  await page
    .getByLabel('Supporting welcome text')
    .fill('Saved changes are reviewed before customers see them.');
  await page.getByLabel('Main button text').fill('See the collection');
  await page.getByLabel('Heading above your products').fill('Owner-selected products');
  await page.getByLabel('Footer description').fill('Editable footer content.');
  const siteImage = {
    name: 'parallel-site-image.png',
    mimeType: 'image/png',
    buffer: Buffer.concat([pixel, Buffer.alloc(120_000)]),
  };
  await Promise.all([
    page.getByLabel('Replace logo').setInputFiles({ ...siteImage, name: 'parallel-logo.png' }),
    page
      .getByLabel('Replace hero image')
      .setInputFiles({ ...siteImage, name: 'parallel-hero.png' }),
  ]);
  await page.getByRole('button', { name: 'Save without changing the live store' }).click();
  await expect(
    page.getByText('Changes saved for review. Your live storefront has not changed.', {
      exact: true,
    }),
  ).toBeVisible({
    timeout: 30000,
  });
  await page.getByRole('button', { name: 'Move Product collection earlier' }).click();
  await expect(page.getByText(/Homepage order saved/)).toBeVisible({ timeout: 30000 });
  await page.locator('iframe').evaluate((frame) => {
    frame.setAttribute('src', frame.getAttribute('src'));
  });
  await expect(
    page.locator('iframe').contentFrame().getByRole('heading', {
      name: 'A storefront shaped by its owner',
    }),
  ).toBeVisible();
  await page.screenshot({ path: 'artifacts/ui/design-editor-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Make saved changes visible to customers' }).click();
  await expect(page.getByText('Version 1 is now live.', { exact: true })).toBeVisible({
    timeout: 30000,
  });
  stage = 'Verify public storefront layouts';
  await page.goto(`${base}/store/${slug}`, { waitUntil: 'domcontentloaded' });
  await expect(
    page.getByRole('heading', { name: 'A storefront shaped by its owner' }),
  ).toBeVisible();
  await expect(page).toHaveTitle('Trusted UI verification store');
  await expect(page.getByRole('heading', { name: 'UI verification product' })).toBeVisible();
  await page.getByRole('link', { name: 'About our business' }).click();
  await expect(page.getByRole('heading', { name: 'A business customers can trust' })).toBeVisible();
  await page.goBack({ waitUntil: 'domcontentloaded' });
  await page.screenshot({ path: 'artifacts/ui/storefront-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'UI verification product' })).toBeVisible();
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'Storefront has no mobile overflow',
  );
  await page.screenshot({ path: 'artifacts/ui/storefront-mobile.png', fullPage: true });
  stage = 'Delete product and Cloudinary media';
  const [uploadedAsset] = await sql`
    select a.storage_provider,a.storage_key,a.resource_type
    from public.products p join public.media_assets a on a.id=p.primary_image_asset_id and a.tenant_id=p.tenant_id
    where p.tenant_id=${tenant.id} and p.slug='ui-verification-product'
  `;
  assert.equal(uploadedAsset.storage_provider, 'cloudinary');
  mediaAssets.push(uploadedAsset);
  await page.goto(`${base}/t/${slug}/catalog`);
  const productRow = page.getByRole('row').filter({ hasText: 'UI verification product' });
  await productRow.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('UI verification product', { exact: true })).toHaveCount(0, {
    timeout: 30000,
  });
  const [remainingMedia] =
    await sql`select count(*)::integer as count from public.media_assets where tenant_id=${tenant.id}`;
  assert.equal(remainingMedia.count, 2, 'Site media remains after deleting product media');
  await expect
    .poll(
      async () => {
        try {
          await cloudinary.api.resource(uploadedAsset.storage_key, {
            resource_type: uploadedAsset.resource_type,
          });
          return false;
        } catch (error) {
          return error.error?.http_code === 404;
        }
      },
      { timeout: 30000 },
    )
    .toBe(true);
  assert.equal(pageErrors.length, 0, 'No browser runtime errors');
  console.log(
    'PASS: browser login, onboarding layouts, tenant catalog creation, website-page editing, search-appearance editing, Cloudinary upload/render/delete lifecycle, and responsive public storefront.',
  );
} catch (error) {
  console.error(`UI check failed at ${stage}: ${error.name}.`);
  let diagnostic = String(error.message).split('Call log:')[0];
  for (const sensitive of [
    email,
    password,
    process.env.DATABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ]) {
    if (sensitive) diagnostic = diagnostic.replaceAll(sensitive, '[redacted]');
  }
  console.error(diagnostic.slice(0, 1200));
  // Assertions contain test labels only. Never log Auth or database response payloads.
  if (error.code === 'ERR_ASSERTION') console.error(error.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  try {
    await sql.begin(async (tx) => {
      const fixtures = await tx`select id from public.tenants where slug=${slug}`;
      const ids = fixtures.map((record) => record.id);
      const remainingAssets =
        await tx`select storage_provider,storage_key,resource_type from public.media_assets where tenant_id=any(${ids}::uuid[])`;
      mediaAssets.push(...remainingAssets);
      for (const table of [
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
        'media_assets',
        'tenant_theme_settings',
        'tenant_layout_settings',
        'tenant_seo_settings',
        'tenant_email_settings',
        'tenant_sms_settings',
        'tenant_checkout_settings',
        'subscriptions',
        'tenant_domains',
        'tenant_onboarding',
        'tenant_memberships',
        'audit_logs',
      ]) {
        await tx`delete from ${tx('public.' + table)} where tenant_id=any(${ids}::uuid[])`;
      }
      await tx`delete from public.tenants where id=any(${ids}::uuid[])`;
    });
    for (const asset of mediaAssets.filter(
      (item, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.storage_provider === item.storage_provider &&
            candidate.storage_key === item.storage_key,
        ) === index,
    )) {
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
    if (userId) {
      const result = await admin.auth.admin.deleteUser(userId);
      assert.ifError(result.error);
    }
    console.log('UI fixture account and business removed.');
  } catch (error) {
    reportError(error);
  }
  await sql.end();
}
