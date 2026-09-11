import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { v2 as cloudinary } from 'cloudinary';
import { database, reportError } from './database.mjs';
const base = new URL(process.env.INTEGRATION_APP_URL ?? 'http://127.0.0.1:3100');
if (!['localhost', '127.0.0.1'].includes(base.hostname))
  throw new Error('Integration app must be local.');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anonymous = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const sql = database(),
  users = [],
  slugs = [],
  cloudinaryAssets = [];
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});
const prefix = `bc-test-${randomUUID()}`;
const password = randomBytes(24).toString('base64url');
let stage = 'Create integration identities';
async function newUser(label) {
  const email = `${prefix}-${label}@example.invalid`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.ifError(error);
  users.push(data.user.id);
  return { email, id: data.user.id };
}
async function session(email) {
  const jar = new Map();
  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (values) => values.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  assert.ifError(error);
  return { client, cookie: () => [...jar].map(([name, value]) => `${name}=${value}`).join('; ') };
}
async function page(path, session, expected, status = 200) {
  const response = await fetch(new URL(path, base), {
    headers: session ? { cookie: session.cookie() } : {},
    redirect: 'manual',
  });
  assert.equal(response.status, status, `HTTP status for ${path}`);
  const html = await response.text();
  if (expected) assert.ok(html.includes(expected), `Missing expected page content for ${path}`);
  return { response, html };
}
try {
  const platform = await newUser('admin'),
    ownerA = await newUser('owner-a');
  await sql`update public.users set platform_role='SUPER_ADMIN' where auth_user_id=${platform.id}`;
  const platformSession = await session(platform.email),
    ownerSession = await session(ownerA.email);
  await page('/', null, null, 307);
  await page('/businesses/new', platformSession, 'Create a business.');
  const slugA = `${prefix}-a`,
    slugB = `${prefix}-b`;
  slugs.push(slugA, slugB);
  const emailB = `${prefix}-owner-b@example.invalid`;
  const provision = async (slug, email) => {
    const { data, error } = await platformSession.client.rpc('provision_tenant', {
      business_name: slug,
      business_slug: slug,
      owner_name: 'Integration owner',
      owner_email: email,
      template: 'general',
      plan_slug: 'starter',
      payment_mode: 'bank_transfer',
    });
    assert.ifError(error);
    return data;
  };
  const a = await provision(slugA, ownerA.email),
    b = await provision(slugB, emailB);
  await page(`/businesses/${a}`, platformSession, slugA);
  const { data: invitations, error } = await platformSession.client
    .from('tenant_invitations')
    .select('id,tenant_id')
    .in('tenant_id', [a, b]);
  assert.ifError(error);
  const inviteA = invitations.find((i) => i.tenant_id === a),
    inviteB = invitations.find((i) => i.tenant_id === b);
  const wrong = await ownerSession.client.rpc('accept_tenant_invitation', {
    invitation_id: inviteB.id,
  });
  assert.ok(wrong.error, 'Wrong-email invitation must fail');
  const accepted = await ownerSession.client.rpc('accept_tenant_invitation', {
    invitation_id: inviteA.id,
  });
  assert.ifError(accepted.error);
  await page(`/t/${slugA}`, ownerSession, 'Welcome to your next chapter.');
  await page(`/t/${slugB}`, ownerSession, null, 404);
  await page(`/t/${slugA}/catalog`, ownerSession, 'Product catalog');
  await page(`/t/${slugA}/design`, ownerSession, 'Design your storefront');
  await page('/businesses', ownerSession, null, 307);
  const leaked = await ownerSession.client
    .from('tenant_business_settings')
    .select('*')
    .eq('tenant_id', b);
  assert.ifError(leaked.error);
  assert.equal(leaked.data.length, 0);
  // New-owner invitation: generate and consume token without sending any email.
  const invite = await admin.auth.admin.generateLink({ type: 'invite', email: emailB });
  assert.ifError(invite.error);
  users.push(invite.data.user.id);
  const newOwner = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const verified = await newOwner.auth.verifyOtp({
    token_hash: invite.data.properties.hashed_token,
    type: 'invite',
  });
  assert.ifError(verified.error);
  const updated = await newOwner.auth.updateUser({ password });
  assert.ifError(updated.error);
  const acceptedB = await newOwner.rpc('accept_tenant_invitation', { invitation_id: inviteB.id });
  assert.ifError(acceptedB.error);
  const ownerBSession = await session(emailB);
  await page(`/t/${slugB}`, ownerBSession, 'Welcome to your next chapter.');
  await page(`/t/${slugA}`, ownerBSession, null, 404);
  const categoryA = await ownerSession.client.rpc('save_category', {
    target_tenant: a,
    target_category: null,
    category_name: 'Integration category A',
    category_slug: 'integration-category-a',
    category_description: 'Tenant A only',
    category_status: 'ACTIVE',
  });
  assert.ifError(categoryA.error);
  const imageId = randomUUID();
  const imageBytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  );
  const upload = await cloudinary.uploader.upload(
    `data:image/png;base64,${imageBytes.toString('base64')}`,
    {
      folder: `businesscare/tenants/${a}/products`,
      public_id: imageId,
      resource_type: 'image',
      overwrite: false,
      unique_filename: false,
      use_filename: false,
    },
  );
  cloudinaryAssets.push({ publicId: upload.public_id, resourceType: 'image' });
  const productA = await ownerSession.client.rpc('save_product', {
    target_tenant: a,
    target_product: null,
    product_name: 'Integration product A',
    product_slug: 'integration-product-a',
    product_description: 'Visible only in storefront A',
    product_short_description: 'Tenant A product',
    product_sku: 'INTEGRATION-A',
    product_price: 2500,
    product_compare_at_price: null,
    product_stock_quantity: 3,
    product_track_inventory: true,
    product_status: 'ACTIVE',
    category_ids: [categoryA.data],
    asset_storage_key: upload.public_id,
    asset_public_url: upload.secure_url,
    asset_file_name: 'pixel.png',
    asset_mime_type: 'image/png',
    asset_file_size: upload.bytes,
    asset_alt_text: 'Integration test pixel',
    asset_storage_provider: 'cloudinary',
    asset_resource_type: 'image',
    asset_format: upload.format,
    asset_width: upload.width,
    asset_height: upload.height,
  });
  assert.ifError(productA.error);
  const categoryB = await ownerBSession.client.rpc('save_category', {
    target_tenant: b,
    target_category: null,
    category_name: 'Integration category B',
    category_slug: 'integration-category-b',
    category_description: 'Tenant B only',
    category_status: 'ACTIVE',
  });
  assert.ifError(categoryB.error);
  const productB = await ownerBSession.client.rpc('save_product', {
    target_tenant: b,
    target_product: null,
    product_name: 'Integration product B',
    product_slug: 'integration-product-b',
    product_description: 'Visible only in storefront B',
    product_short_description: 'Tenant B product',
    product_sku: 'INTEGRATION-B',
    product_price: 1800,
    product_compare_at_price: null,
    product_stock_quantity: 0,
    product_track_inventory: false,
    product_status: 'ACTIVE',
    category_ids: [categoryB.data],
  });
  assert.ifError(productB.error);
  const crossCatalog = await ownerBSession.client.from('products').select('id').eq('tenant_id', a);
  assert.ifError(crossCatalog.error);
  assert.equal(crossCatalog.data.length, 0, 'Tenant B must not read tenant A products');
  const directWrite = await ownerSession.client
    .from('products')
    .update({ name: 'Bypass' })
    .eq('id', productA.data);
  assert.ok(directWrite.error, 'Direct product writes must be denied');
  stage = 'Save storefront content';
  const draft = await ownerSession.client.rpc('save_site_draft', {
    target_tenant: a,
    business_name: 'Integration storefront A',
    business_description: 'Tenant-controlled storefront content',
    business_phone: '+234 800 000 0000',
    business_address: 'Lagos',
    theme_preset: 'fashion',
    primary_color: '#342d44',
    accent_color: '#ad8e64',
    background_color: '#faf8f5',
    text_color: '#25222a',
    announcement_text: 'Integration announcement A',
    announcement_enabled: true,
    hero_eyebrow: 'Integration collection',
    hero_headline: 'Integration homepage A',
    hero_subheadline: 'Editable tenant content',
    hero_cta_label: 'Browse products',
    hero_variant: 'split',
    products_heading: 'Integration products A',
    products_enabled: true,
    footer_description: 'Integration footer A',
    navigation: [
      { label: 'Home', target: '/', location: 'HEADER', linkType: 'URL', enabled: true },
    ],
  });
  assert.ifError(draft.error);
  stage = 'Save customer information page';
  const contentPage = await ownerSession.client.rpc('save_content_page', {
    target_tenant: a,
    target_page: null,
    page_type: 'ABOUT',
    page_name: 'About our business',
    page_slug: 'about-our-business',
    page_title: 'The integration story',
    page_introduction: 'A customer-friendly introduction.',
    page_body: 'This page belongs only to integration storefront A.',
    show_in_navigation: true,
    page_enabled: true,
  });
  assert.ifError(contentPage.error);
  stage = 'Save typed store menus';
  const homePage = await ownerSession.client
    .from('pages')
    .select('id')
    .eq('tenant_id', a)
    .eq('page_type', 'HOME')
    .single();
  assert.ifError(homePage.error);
  const menus = await ownerSession.client.rpc('save_navigation', {
    target_tenant: a,
    navigation: [
      {
        label: 'Home',
        linkType: 'PAGE',
        pageId: homePage.data.id,
        target: '',
        location: 'HEADER',
        enabled: true,
      },
      {
        label: 'About our business',
        linkType: 'PAGE',
        pageId: contentPage.data,
        target: '',
        location: 'HEADER',
        enabled: true,
      },
      {
        label: 'Integration collection',
        linkType: 'CATEGORY',
        categoryId: categoryA.data,
        target: '',
        location: 'FOOTER',
        enabled: true,
      },
    ],
  });
  assert.ifError(menus.error);
  stage = 'Save search appearance';
  const searchAppearance = await ownerSession.client.rpc('save_global_seo', {
    target_tenant: a,
    search_title: 'Integration Store A Search Title',
    search_title_template: '%s | Integration Store A',
    search_description: 'Tenant A search description for customers.',
    social_account: '@integration-a',
    allow_search_listing: true,
    allow_search_links: true,
    google_verification: '',
    bing_verification: '',
  });
  assert.ifError(searchAppearance.error);
  stage = 'Save page, product, and collection search wording';
  const recordSearchResults = await Promise.all([
    ownerSession.client.rpc('save_entity_seo', {
      target_tenant: a,
      target_entity_type: 'PAGE',
      target_entity: contentPage.data,
      search_title: 'Integration About Page',
      search_description: 'Published page-specific search description.',
      canonical_address: '',
      social_share_title: 'Share Integration About',
      social_share_description: 'Published page sharing description.',
      allow_search_listing: true,
      allow_search_links: true,
    }),
    ownerSession.client.rpc('save_entity_seo', {
      target_tenant: a,
      target_entity_type: 'PRODUCT',
      target_entity: productA.data,
      search_title: 'Integration Product Search Title',
      search_description: 'Published product-specific search description.',
      canonical_address: '',
      social_share_title: '',
      social_share_description: '',
      allow_search_listing: true,
      allow_search_links: true,
    }),
    ownerSession.client.rpc('save_entity_seo', {
      target_tenant: a,
      target_entity_type: 'CATEGORY',
      target_entity: categoryA.data,
      search_title: 'Integration Category Search Title',
      search_description: 'Published collection-specific search description.',
      canonical_address: '',
      social_share_title: '',
      social_share_description: '',
      allow_search_listing: true,
      allow_search_links: true,
    }),
  ]);
  recordSearchResults.forEach((result) => assert.ifError(result.error));
  stage = 'Publish storefront and customer page';
  const publish = await ownerSession.client.rpc('publish_site', { target_tenant: a });
  assert.ifError(publish.error);
  const publicProduct = await anonymous.rpc('get_public_product', {
    store_slug: slugA,
    product_slug: 'integration-product-a',
  });
  assert.ifError(publicProduct.error);
  assert.equal(publicProduct.data.product.id, productA.data, 'Public product lookup is direct');
  const publicProducts = await anonymous.rpc('get_public_products', {
    store_slug: slugA,
    search_term: 'Integration',
    category_slug: '',
    cursor_created_at: null,
    cursor_id: null,
    result_limit: 24,
  });
  assert.ifError(publicProducts.error);
  assert.ok(publicProducts.data.products.length <= 25, 'Public product page remains bounded');
  stage = 'Configure checkout and create an order';
  const bankAccount = await ownerSession.client.rpc('save_bank_account', {
    target_tenant: a,
    bank_name: 'Integration Bank',
    account_number: '0123456789',
    account_name: 'Integration Storefront A',
    instructions: 'Include the order reference.',
  });
  assert.ifError(bankAccount.error);
  const shippingRate = await ownerSession.client.rpc('save_shipping_rate', {
    target_tenant: a,
    target_rate: null,
    zone_name: 'Lagos',
    rate_name: 'Lagos delivery',
    rate_amount: 1000,
    delivery_states: ['Lagos'],
    pickup: false,
  });
  assert.ifError(shippingRate.error);
  const checkoutSettings = await ownerSession.client.rpc('save_checkout_settings_complete', {
    target_tenant: a,
    phone_required: true,
    email_required: true,
    address_required: true,
    notes_enabled: true,
    transfer_enabled: true,
    paystack_payment_enabled: false,
    confirmation_message: 'Your integration order has been received.',
  });
  assert.ifError(checkoutSettings.error);
  const cart = [{ productId: productA.data, quantity: 1 }];
  const quote = await anonymous.rpc('get_public_checkout_quote', {
    store_slug: slugA,
    cart_items: cart,
  });
  assert.ifError(quote.error);
  assert.equal(Number(quote.data.items[0].unitPrice), 2500, 'Quote must use database price');
  const checkout = await anonymous.rpc('create_storefront_order', {
    store_slug: slugA,
    cart_items: cart,
    customer_details: {
      name: 'Integration Customer',
      email: `${prefix}-customer@example.invalid`,
      phone: '08012345678',
    },
    shipping_address: {
      addressLine1: '1 Integration Street',
      city: 'Ikeja',
      state: 'Lagos',
      country: 'NG',
    },
    selected_shipping_rate: shippingRate.data,
    payment_choice: 'BANK_TRANSFER',
    customer_note: 'Call on arrival.',
  });
  assert.ifError(checkout.error);
  assert.equal(Number(checkout.data.total), 3500, 'Order total must include trusted delivery fee');
  const transferNotice = await anonymous.rpc('submit_bank_transfer_notice', {
    store_slug: slugA,
    order_reference: checkout.data.reference,
    access_token: checkout.data.accessToken,
  });
  assert.ifError(transferNotice.error);
  const storedOrder = await ownerSession.client
    .from('orders')
    .select('id,total,payment_status,customer_name_snapshot')
    .eq('tenant_id', a)
    .eq('id', checkout.data.orderId)
    .single();
  assert.ifError(storedOrder.error);
  assert.equal(storedOrder.data.payment_status, 'AWAITING_VERIFICATION');
  assert.equal(Number(storedOrder.data.total), 3500);
  const crossOrders = await ownerBSession.client.from('orders').select('id').eq('tenant_id', a);
  assert.ifError(crossOrders.error);
  assert.equal(crossOrders.data.length, 0, 'Tenant B must not read tenant A orders');
  const directOrderWrite = await ownerSession.client
    .from('orders')
    .update({ payment_status: 'PAID' })
    .eq('id', checkout.data.orderId);
  assert.ok(directOrderWrite.error, 'Direct payment confirmation must be denied');
  await page(`/t/${slugA}/orders`, ownerSession, checkout.data.reference);
  await page(`/t/${slugA}/orders/${checkout.data.orderId}`, ownerSession, 'Confirm bank payment');
  await page(`/t/${slugA}/orders/settings`, ownerSession, 'Checkout settings');
  await page(`/store/${slugA}/cart`, null, 'Review your cart');
  await page(`/store/${slugA}/checkout`, null, 'Delivery and contact details');
  const confirmedPayment = await ownerSession.client.rpc('update_order_status', {
    target_tenant: a,
    target_order: checkout.data.orderId,
    order_action: 'CONFIRM_PAYMENT',
    note: 'Verified during integration testing.',
  });
  assert.ifError(confirmedPayment.error);
  await page(`/t/${slugA}/catalog`, ownerSession, 'Integration product A');
  await page(`/t/${slugB}/catalog`, ownerBSession, 'Integration product B');
  stage = 'Read published storefront A';
  const storefrontA = await page(`/store/${slugA}`, null, 'Integration homepage A');
  assert.ok(storefrontA.html.includes('Integration product A'));
  assert.ok(storefrontA.html.includes('Integration Store A Search Title'));
  stage = 'Read published customer page A';
  await page(`/store/${slugA}/about-our-business`, null, 'Integration About Page');
  await page(
    `/store/${slugA}/products/integration-product-a`,
    null,
    'Integration Product Search Title',
  );
  await page(
    `/store/${slugA}/categories/integration-category-a`,
    null,
    'Integration Category Search Title',
  );
  const sitemap = await page(`/store/${slugA}/sitemap`, null, 'about-our-business');
  assert.ok(sitemap.html.includes('categories/integration-category-a'));
  await page(`/store/${slugA}/robots.txt`, null, 'Allow: /');
  stage = 'Read isolated storefront B';
  assert.ok(!storefrontA.html.includes('Integration product B'));
  const storefrontB = await page(`/store/${slugB}`, null, 'Integration product B');
  assert.ok(!storefrontB.html.includes('Integration product A'));
  const replay = await newOwner.auth.verifyOtp({
    token_hash: invite.data.properties.hashed_token,
    type: 'invite',
  });
  assert.ok(replay.error, 'Invite token replay must fail');
  const suspended = await platformSession.client.rpc('set_tenant_suspended', {
    target: a,
    suspended: true,
  });
  assert.ifError(suspended.error);
  await page(`/t/${slugA}`, ownerSession, 'Workspace temporarily unavailable.');
  const resumed = await platformSession.client.rpc('set_tenant_suspended', {
    target: a,
    suspended: false,
  });
  assert.ifError(resumed.error);
  await page(`/t/${slugA}`, ownerSession, 'Welcome to your next chapter.');
  console.log(
    'PASS: real Auth sessions, onboarding, two isolated catalogs and orders, Cloudinary upload, customer pages, checkout totals/inventory, manual-transfer verification, order admin, record-specific search metadata, collection routes, sitemap/robots output, direct-write denial, token replay denial, and suspension/reactivation.',
  );
} catch (error) {
  console.error(`Integration check failed at: ${stage}.`);
  if (error?.code === 'ERR_ASSERTION') console.error(String(error.message).slice(0, 400));
  reportError(error);
} finally {
  try {
    await Promise.all(
      cloudinaryAssets.map((asset) =>
        cloudinary.uploader.destroy(asset.publicId, {
          resource_type: asset.resourceType,
          invalidate: true,
        }),
      ),
    );
    await sql.begin(async (tx) => {
      const fixtures = await tx`select id from public.tenants where slug=any(${slugs}::text[])`;
      const ids = fixtures.map((t) => t.id);
      for (const table of [
        'payment_webhook_events',
        'payments',
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
        'tenant_payment_settings',
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
    for (const id of users) {
      const { error } = await admin.auth.admin.deleteUser(id);
      assert.ifError(error);
    }
    console.log('Integration fixture businesses and Auth accounts removed.');
  } catch (error) {
    console.error('Fixture cleanup failed; inspect only bc-test-prefixed integration records.');
    reportError(error);
  }
  await sql.end();
}
