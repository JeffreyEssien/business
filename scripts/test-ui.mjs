import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { chromium, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { database, reportError } from './database.mjs';

// Never use the real owner's password or include session tokens in screenshots/logs.
const sql = database();
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const base = process.env.INTEGRATION_APP_URL ?? 'http://127.0.0.1:3100';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const slug = `ui-test-${randomUUID()}`;
const email = `${slug}@example.invalid`;
const password = randomBytes(24).toString('base64url');
let userId, browser;
let storageKeys = [];
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
  await page.getByLabel('Primary image').setInputFiles({
    name: 'large-enough-to-test-action-limit.png',
    mimeType: 'image/png',
    buffer: Buffer.concat([pixel, Buffer.alloc(1_200_000)]),
  });
  await page.getByLabel('Image alt text').fill('Tiny purple test pixel');
  await page.getByRole('button', { name: 'Save product' }).click();
  await page.waitForURL(`${base}/t/${slug}/catalog`, { timeout: 30000 });
  await expect(page.getByText('UI verification product', { exact: true })).toBeVisible();
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'Catalog has no desktop overflow',
  );
  await page.screenshot({ path: 'artifacts/ui/catalog-desktop.png', fullPage: true });
  stage = 'Verify public storefront layouts';
  await page.goto(`${base}/store/${slug}`);
  await expect(page.getByRole('heading', { name: 'UI verification product' })).toBeVisible();
  await page.screenshot({ path: 'artifacts/ui/storefront-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'UI verification product' })).toBeVisible();
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'Storefront has no mobile overflow',
  );
  await page.screenshot({ path: 'artifacts/ui/storefront-mobile.png', fullPage: true });
  assert.equal(pageErrors.length, 0, 'No browser runtime errors');
  console.log(
    'PASS: browser login, onboarding form layouts, tenant category/product creation, catalog layout, and responsive public storefront.',
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
      const assets =
        await tx`select storage_key from public.media_assets where tenant_id=any(${ids}::uuid[])`;
      storageKeys = assets.map((asset) => asset.storage_key);
      for (const table of [
        'product_media',
        'product_categories',
        'products',
        'categories',
        'media_assets',
        'content_blocks',
        'navigation_items',
        'pages',
        'tenant_invitations',
        'tenant_business_settings',
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
    if (storageKeys.length) {
      const result = await admin.storage.from('catalog-media').remove(storageKeys);
      assert.ifError(result.error);
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
