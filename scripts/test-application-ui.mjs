import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { chromium, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { v2 as cloudinary } from 'cloudinary';
import { database, reportError } from './database.mjs';

const sql = database();
const base = process.env.INTEGRATION_APP_URL ?? 'http://127.0.0.1:3100';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const slug = `application-ui-${randomUUID()}`;
const email = `${slug}@example.invalid`;
const password = randomBytes(24).toString('base64url');
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

let userId;
let browser;
let stage = 'Create temporary administrator';
const uploadedAssets = [];
const pageErrors = [];

try {
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert.ifError(created.error);
  userId = created.data.user.id;
  await sql`update public.users set platform_role='SUPER_ADMIN' where auth_user_id=${userId}`;

  stage = 'Open the public application';
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.on('pageerror', (error) => pageErrors.push(error.name));
  await page.goto(`${base}/get-started`);
  await expect(
    page.getByRole('heading', { name: 'Let’s build something customers can trust.' }),
  ).toBeVisible();
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'Public application has no desktop overflow',
  );
  await page.screenshot({ path: 'artifacts/ui/application-desktop.png', fullPage: true });

  stage = 'Complete business details and prove browser-only draft recovery';
  await page.getByLabel('What is your business called?').fill('Customer-first test studio');
  await page.getByLabel(/Fashion & clothing/).check();
  await page
    .getByLabel('Tell customers a little about your business')
    .fill('Thoughtful pieces made for everyday life.');
  await page.getByLabel('Choose your BusinessCare website name').fill(slug);
  await expect(page.getByText('This name is currently available.')).toBeVisible({ timeout: 30000 });
  await page.reload();
  await expect(page.getByLabel('What is your business called?')).toHaveValue(
    'Customer-first test studio',
  );
  await expect(page.getByLabel('Choose your BusinessCare website name')).toHaveValue(slug);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'Public application has no mobile overflow',
  );
  await page.screenshot({ path: 'artifacts/ui/application-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Continue' }).click();

  stage = 'Complete contact details';
  await expect(page.getByRole('heading', { name: 'How should we reach you?' })).toBeVisible();
  await page.getByLabel('Your name').fill('Application Test Owner');
  await page.getByLabel('Your email address').fill(email);
  await page.getByLabel('Business email (optional)').fill(email);
  await page.getByLabel('WhatsApp number (optional)').fill('+2348012345678');
  await page.getByRole('button', { name: 'Continue' }).click();

  stage = 'Complete brand details';
  await expect(page.getByRole('heading', { name: 'Make it look like your brand' })).toBeVisible();
  const pixel = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  );
  await page.getByLabel('Your logo optional').setInputFiles({
    name: 'application-logo.png',
    mimeType: 'image/png',
    buffer: pixel,
  });
  await page.getByLabel('Main brand colour').fill('#173f35');
  await page.getByLabel('Secondary brand colour').fill('#c77842');
  await page.getByLabel(/Warm & natural/).check();
  await page.getByRole('button', { name: 'Continue' }).click();

  stage = 'Complete website details';
  await expect(
    page.getByRole('heading', { name: 'What should customers see first?' }),
  ).toBeVisible();
  await page.getByLabel('Homepage headline').fill('Made carefully for real life');
  await page.getByLabel('What should your main button say?').fill('Talk to our team');
  await page.getByLabel('Where should the button take customers?').selectOption('CONTACT');
  const contactPage = page.getByLabel(/Contact Us · needed for your main button/);
  await expect(contactPage).toBeChecked();
  await expect(contactPage).toBeDisabled();
  await page.getByRole('button', { name: 'Continue' }).click();

  stage = 'Complete products and review';
  await page.getByLabel(/Yes, my products are ready/).check();
  await page.getByLabel('Approximately how many products?').selectOption('11_50');
  await page.getByLabel('What kinds of products do you sell? (optional)').fill('Shirts, Trousers');
  await page.getByLabel(/Growth/).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText(`Made carefully for real life · /store/${slug}`)).toBeVisible();
  await page.getByLabel(/I’m ready to send this application/).check();
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({ path: 'artifacts/ui/application-review-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Submit my business' }).click();
  await expect(
    page.getByRole('heading', { name: 'Thank you. We’ll take it from here.' }),
  ).toBeVisible({ timeout: 30000 });
  assert.equal(
    await page.evaluate(() => localStorage.getItem('businesscare-application-draft-v1')),
    null,
    'The browser-only draft is removed after a successful submission',
  );

  const [submitted] = await sql`
    select id,status,reference,logo_storage_key,logo_public_url,requested_pages
    from public.business_applications where preferred_slug=${slug}
  `;
  assert.equal(submitted.status, 'PENDING');
  assert.ok(submitted.logo_public_url.includes('res.cloudinary.com'));
  assert.ok(submitted.requested_pages.includes('CONTACT'));
  uploadedAssets.push({
    storage_provider: 'cloudinary',
    storage_key: submitted.logo_storage_key,
    resource_type: 'image',
  });
  const [beforeApproval] =
    await sql`select count(*)::integer as count from public.tenants where slug=${slug}`;
  assert.equal(beforeApproval.count, 0, 'Submitting an application must not create a tenant');

  stage = 'Review the application as an administrator';
  await page.goto(`${base}/login`);
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in to your workspace' }).click();
  await page.waitForURL(base + '/', { timeout: 30000 });
  await page.goto(`${base}/businesses/applications`);
  await expect(page.getByText(submitted.reference, { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Review Customer-first test studio' }).click();
  await expect(page.getByRole('heading', { name: 'Customer-first test studio' })).toBeVisible();
  await page.getByLabel('Business name', { exact: true }).fill('Approved customer studio');
  await page.getByRole('button', { name: 'Save application changes' }).click();
  await expect(
    page.getByText('Application changes saved. The original submission is still preserved.'),
  ).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('Customer-first test studio', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mark as being reviewed' }).click();
  await expect(page.getByText('Being reviewed', { exact: true })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('button', { name: 'Mark as being reviewed' })).toHaveCount(0);
  await page.screenshot({ path: 'artifacts/ui/application-admin-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'Application review has no mobile overflow',
  );
  await page.screenshot({ path: 'artifacts/ui/application-admin-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1100 });

  stage = 'Approve and provision atomically';
  await page.getByRole('button', { name: 'Approve & create business' }).click();
  await page.waitForURL(/\/businesses\/[0-9a-f-]{36}$/, { timeout: 30000 });
  const [approved] = await sql`
    select a.status,a.provisioned_tenant_id,t.name,t.slug,s.contact_email,h.tokens
    from public.business_applications a
    join public.tenants t on t.id=a.provisioned_tenant_id
    join public.tenant_business_settings s on s.tenant_id=t.id
    join public.tenant_theme_settings h on h.tenant_id=t.id
    where a.id=${submitted.id}
  `;
  assert.equal(approved.status, 'PROVISIONED');
  assert.equal(approved.name, 'Approved customer studio');
  assert.equal(approved.slug, slug);
  assert.equal(approved.contact_email, email);
  assert.equal(approved.tokens.secondary, '#c77842');
  const pages = await sql`
    select slug,status,is_enabled from public.pages
    where tenant_id=${approved.provisioned_tenant_id} and slug<>'home'
  `;
  assert.ok(pages.some((item) => item.slug === 'contact-us'));
  assert.ok(pages.every((item) => item.status === 'DRAFT' && item.is_enabled === false));
  const [homeLink] = await sql`
    select link_type,page_id,target from public.navigation_items
    where tenant_id=${approved.provisioned_tenant_id} and label='Home'
  `;
  assert.equal(homeLink.link_type, 'PAGE');
  assert.ok(homeLink.page_id);
  assert.equal(homeLink.target, '/');
  assert.equal(pageErrors.length, 0, 'No browser runtime errors');
  console.log(
    'PASS: public application draft, responsive wizard, deferred upload, admin review, and atomic provisioning.',
  );
} catch (error) {
  console.error(`Application UI check failed at ${stage}: ${error.name}.`);
  let diagnostic = String(error.message).split('Call log:')[0];
  for (const sensitive of [
    email,
    password,
    process.env.DATABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
  ]) {
    if (sensitive) diagnostic = diagnostic.replaceAll(sensitive, '[redacted]');
  }
  console.error(diagnostic.slice(0, 1200));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  try {
    await sql.begin(async (tx) => {
      const applications = await tx`
        select id,logo_storage_key from public.business_applications where preferred_slug=${slug}
      `;
      const tenants = await tx`select id from public.tenants where slug=${slug}`;
      const ids = tenants.map((item) => item.id);
      if (ids.length) {
        const assets = await tx`
          select storage_provider,storage_key,resource_type from public.media_assets
          where tenant_id=any(${ids}::uuid[])
        `;
        uploadedAssets.push(...assets);
      }
      await tx`delete from public.business_applications where id=any(${applications.map((item) => item.id)}::uuid[])`;
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
      ])
        await tx`delete from ${tx(`public.${table}`)} where tenant_id=any(${ids}::uuid[])`;
      await tx`delete from public.tenants where id=any(${ids}::uuid[])`;
    });
    for (const asset of uploadedAssets.filter(
      (item, index, all) =>
        item.storage_key &&
        all.findIndex((candidate) => candidate.storage_key === item.storage_key) === index,
    ))
      await cloudinary.uploader.destroy(asset.storage_key, {
        resource_type: asset.resource_type,
        invalidate: true,
      });
    if (userId) {
      const removed = await admin.auth.admin.deleteUser(userId);
      assert.ifError(removed.error);
    }
    console.log('Application UI fixture account, application, media, and business removed.');
  } catch (error) {
    reportError(error);
  }
  await sql.end();
}
