# How the BusinessCare code is organized

The default is readable, modular code. Routes compose features; they do not contain entire forms or repeat UI patterns. Prefer a cohesive component over many tiny wrappers, and extract shared behavior when it has a clear responsibility.

## Follow a create-business request

1. `src/app/(platform)/businesses/new/page.tsx` checks administrator access and composes the page header and form.
2. `src/components/businesses/create-business-form.tsx` coordinates submission, pending state, and the server error message.
3. `business-fields.tsx` groups business details, owner details, and initial setup. These groups can also be composed into future settings forms.
4. `src/components/ui` supplies the common fields, labels, buttons, panels, sections, and feedback. Inputs own their styles and accessible label/description associations.
5. `src/modules/tenants/actions.ts` authenticates the request, calls validation, and invokes the transactional database RPC. It invalidates affected pages after success.
6. `validation.ts` normalizes and validates user input. `onboarding-options.ts` provides consistent form choices. The database independently validates input and permissions; UI validation is never the security boundary.
7. `supabase/migrations` owns immutable database changes. Existing migrations must not be reformatted or modified after application.

## Component responsibilities

| Location                 | Responsibility                                                           | Examples                                             |
| ------------------------ | ------------------------------------------------------------------------ | ---------------------------------------------------- |
| `components/ui`          | Reusable presentation and native controls; no Supabase queries           | TextField, SelectField, Button, Panel, Checklist     |
| `components/auth`        | Authentication-specific compositions                                     | AuthLayout, LoginForm, PasswordForm                  |
| `components/businesses`  | Business-specific presentation and form orchestration                    | BusinessSummary, BusinessFilters, CreateBusinessForm |
| `components/commerce`    | Cart, checkout, settings, order lists, and order-detail presentation      | CartCheckout, CheckoutSettings, OrderDetail          |
| `components/layout`      | Application navigation and framing                                       | PlatformSidebar, PlatformTopbar                      |
| `components/super-admin` | Platform views composed from UI components                               | Shell, BusinessList, LaunchCard                      |
| `modules/tenants`        | Data access, validation, configuration, domain types, authorized actions | queries, workspace-query, actions                    |
| `lib/supabase`           | SDK construction and cookie handling                                     | server, admin                                        |
| `app`                    | Route parameters, redirects, metadata, composition                       | page.tsx, layout.tsx                                 |

Use explicit prop types and descriptive names such as `submitAction`, `isPending`, `invitation`, and `onboarding`. Avoid positional data tuples for domain records. Pass data into presentation components instead of letting them query the database.

## Styling

- `app/globals.css` is the entry point, not a dumping ground.
- `styles/base.css` contains tokens and element/accessibility defaults.
- `styles/shell.css` contains application navigation and responsive framing.
- `styles/views.css` contains established shared dashboard/page patterns.
- `components/ui/ui.module.css` owns reusable controls and layout primitives. Its selectors are scoped by Next.js, so unrelated global rules cannot collide with input or field styles.
- Feature-specific rules live beside the feature, such as `create-business-form.module.css`.

A page should never need to remember a special global class to make a TextField visible. The component imports the styling it requires. Form sections use fieldsets and legends; labels target stable control IDs; help and error text is associated with aria-describedby.

## Comments and explanations

Comment the reason for an unusual choice, the security boundary, or a non-obvious data flow. Do not narrate obvious JSX line by line. Exported components with subtle responsibilities get a short documentation comment. This guide explains the larger flow so source comments can remain focused.

## Formatting and verification

Run `npm run format` before handing off code. `npm run format:check` enforces the same readable formatting in CI. Avoid compressed JSX, SQL embedded in page components, and multiple unrelated responsibilities in one large component.

Run `npm run typecheck` and the production build for structural changes. Run `npm run test:integration` for changed authorization or data paths. Run `npm run test:ui` against the local production server on port 3100 for UI changes. It uses an isolated temporary administrator and business, sends no emails, and removes its fixtures. It verifies actual browser login, desktop/mobile controls, validation, and submission, and produces screenshots in `artifacts/ui`.

Meaningful UI regression checks inspect rendered behavior: visible borders and hit areas, separated labels, responsive columns, no horizontal overflow, and successful submission. Compilation alone cannot verify a form's appearance.

## Follow a catalog mutation

1. Routes under `app/t/[slug]/catalog` authorize and compose catalog components.
2. `components/catalog` owns the product/category forms, tables, workspace navigation, and responsive storefront presentation.
3. `modules/catalog/validation.ts` normalizes untrusted form values before any upload or database call.
4. `modules/catalog/actions.ts` re-resolves the signed-in tenant membership for every mutation. Product images receive generated tenant-prefixed keys and are uploaded from the server; a failed database mutation removes the just-uploaded object.
5. Catalog RPCs independently enforce tenant ownership, editor roles, product limits, record relationships, and atomic writes. Browser roles have no direct table-write grants.
6. `get_public_storefront` is the only anonymous catalog database surface. It returns a deliberately limited projection of active products for one resolved, available tenant; anonymous users cannot select catalog tables.
7. Routes under `app/store/[slug]` render that public projection and never accept a tenant ID from the browser.

Cloudinary is the production media provider (ADR 003). `lib/cloudinary/server.ts` owns authenticated upload/deletion calls and is imported only by server code. The database stores the secure delivery URL, public ID, resource type, dimensions, and tenant ownership. Provider-aware cleanup retains compatibility with legacy Supabase Storage records without using that bucket for new uploads.

## Follow a theme and content publish

1. `app/t/[slug]/design/page.tsx` authorizes the tenant and composes the editor plus saved-draft preview.
2. `components/content` owns the grouped editor, publish status, and responsive two-panel layout.
3. `modules/content/validation.ts` constrains every text field, color token, layout variant, and media file before provider or database work.
4. `modules/content/actions.ts` re-resolves membership for every mutation. Logo and hero uploads run concurrently inside one Server Action with `Promise.allSettled`; any partial upload is removed before an error is returned.
5. `save_site_draft` updates tenant-scoped draft tables through a security-definer RPC. Direct browser writes remain denied by RLS.
6. `publish_site` atomically archives the old live version and saves a complete normalized snapshot. A saved draft cannot change anonymous output until this RPC succeeds.
7. `components/storefront/storefront-renderer.tsx` renders both the authenticated draft preview and public homepage. Never create a second preview-only rendering implementation.
8. `get_public_storefront` exposes active catalog products and only the current published site snapshot to anonymous visitors.

Store Design does not own navigation. `save_site_draft` intentionally leaves menu records untouched; use the dedicated Store menus flow below for every navigation change.

## Follow a Store menus change

1. `app/t/[slug]/content/navigation/page.tsx` authorizes and composes the dedicated menu workspace.
2. `components/content/navigation-manager.tsx` explains header/footer placement and lets an owner choose a store page, product collection, or explicit URL. It submits one ordered normalized payload rather than treating every destination as a URL string.
3. `modules/content/validation.ts` validates labels, placement, destination type, related IDs, and safe internal/HTTPS addresses before the action runs.
4. `save_navigation` independently verifies tenant ownership for every page and category, then atomically replaces only that tenant's navigation records. Direct writes remain denied.
5. `navigation_items.page_id` and `category_id` are tenant-scoped foreign keys. Database triggers derive public paths from related slugs; application code must not manually synchronize typed targets.
6. Page edits preserve an existing typed menu row in place. Page or category deletion removes related menu rows through foreign-key lifecycle rules.
7. Saving a menu remains private until `publish_site` copies the ordered links into the immutable public snapshot. Store Design never deletes or recreates them.

Keep tenant colors in validated tokens and pass them to storefront components through CSS variables. Marketing copy belongs in content records; only system UX labels may remain in code.

Application website styles are real storefront personality profiles stored in `theme.tokens.styleKey`. They layer typography, shape, spacing, and composition over the four base business presets without creating a second renderer. Store Design preserves the profile while its base preset is unchanged and selects the corresponding profile when an owner deliberately changes presets.

## Follow a customer-information page change

1. Routes under `app/t/[slug]/content/pages` authorize the tenant and compose the page list or editor.
2. `components/content` explains where the page appears, whether customers can see it, and that saving does not change the live store.
3. `modules/content/validation.ts` normalizes page names, addresses, headings, and plain text. Customer text is rendered as text, never injected as HTML.
4. `save_content_page`, `delete_content_page`, and `reorder_homepage_sections` enforce tenant roles and relationships inside PostgreSQL. Direct browser writes remain denied.
5. Homepage order is canonical in `content_blocks.sort_order`. Ordinary content saves preserve it; only the reorder action may change it.
6. Publication copies enabled pages and navigation into the same immutable snapshot as the homepage. Public routes never read an unpublished page.
7. The published-version integrity trigger rejects enabled homepage buttons or menu items whose internal page, product, or category is not currently public. Fix or enable the named destination instead of weakening this check.

## Follow a search-appearance change

1. `app/t/[slug]/marketing/search/page.tsx` authorizes the tenant and composes the explanatory editor and search-result preview.
2. `components/seo/search-appearance-form.tsx` uses customer-facing language for search title, description, listing, and links. It makes the save-versus-publish distinction explicit.
3. `modules/seo/validation.ts` normalizes untrusted input, and `modules/seo/actions.ts` re-resolves membership before calling `save_global_seo`.
4. Saved settings remain private in `tenant_seo_settings`. `publish_site` adds a normalized `seo` object to the immutable live snapshot and marks the onboarding search step complete.
5. `modules/seo/public.ts` builds canonical URLs only from `NEXT_PUBLIC_APP_URL` or an active verified custom hostname. Never derive canonical metadata from an incoming Host header.
6. The public homepage reads one request-memoized storefront result for both metadata and rendering. Sitemap and robots routes use only published settings and public storefront records.
7. Structured data is serialized with `<` escaped before being placed in a script element. Preserve this protection when adding product or breadcrumb schemas.
8. `getSeoWorkspace` loads global settings, relevant records, and saved overrides concurrently. Record editors call `save_entity_seo`, which independently verifies that the selected page, product, or category belongs to the authorized tenant.
9. Record overrides remain private until `publish_site` copies them into `seoEntries` in the immutable snapshot. Public metadata uses `entityMetadata` for one fallback chain across customer, product, and collection routes.
10. Product and breadcrumb schemas are generated from trusted catalog/content records through `StructuredData`. Do not accept raw structured-data JSON from tenant forms.
11. Sharing images upload through the server-only Cloudinary adapter. PostgreSQL owns the asset relationship; the publish trigger copies only the delivery URL into the immutable live snapshot.

## Follow a public catalog read

1. `get_public_storefront` returns published configuration plus no more than eight homepage products.
2. `/store/[slug]/products` calls `get_public_products`, which enforces a 24-item page, a 48-item absolute server maximum, sanitized search text, and a `(created_at,id)` keyset cursor.
3. Product detail calls `get_public_product` for one active product. Never reintroduce “load the storefront and find one product” behavior.
4. Collection pages use the bounded product-page RPC. Sitemap generation uses its slug-only read model because it needs URLs, not catalog payloads.
5. Stock and prices remain live catalog state. Do not cache them as part of a published design version or trust storefront output during order creation.

## Reliability boundaries

- `proxy.ts` generates `x-businesscare-request-id`; incoming IDs are not trusted. Public requests avoid the authenticated session-refresh call and private cache headers.
- `lib/observability/server.ts` emits bounded structured records only for slow or failed important operations. Never add form bodies, credentials, tokens, addresses, or customer contact data.
- `/api/health/live` checks only the application process. `/api/health/ready` makes one short call to the data-free database health RPC. Provider outages must not cascade into storefront unavailability.
- Slow-operation thresholds are operational configuration, not product business logic.

## Phase 5 commerce invariants

- PostgreSQL is authoritative for product price, inventory, checkout totals, orders, and order items. Browser cart values are untrusted suggestions.
- Order and shipping/customer relationships include `tenant_id`; cross-tenant IDs must fail inside the database transaction.
- Historical customer, address, product, SKU, and price values are snapshots. Never rebuild an old order from mutable catalog/customer records.
- Direct browser writes to commerce tables remain denied. `create_storefront_order` resolves the tenant from its public handle, locks inventory, computes all money from current database records, decrements stock, and writes the order plus snapshots in one transaction.
- The browser cart is tenant-scoped local convenience state. `get_public_checkout_quote` must succeed before checkout can continue, and order creation repeats every price, availability, delivery, and relationship check.
- A customer's payment notice means “awaiting verification,” never “paid.” Only an authorized merchant transition or a future verified provider event may confirm payment.
- Customer paid totals are derived from orders whose payment status is `PAID`. The deferred database trigger is the canonical summary writer; application code must not increment paid revenue optimistically.
- Cancelling fulfilment restores tracked stock exactly once and does not rewrite an already verified payment. Refunds remain a separate, durable returns-workflow operation.

## Follow a Paystack payment

1. A tenant manager connects a settlement account in Checkout settings. The server resolves the account with Paystack, creates or updates the tenant subaccount, and stores only the provider code, verified account name, bank, and final four digits.
2. Checkout creates the authoritative order and an `INITIALIZING` payment attempt in one database transaction before any provider request. Product totals, tenant, currency, inventory, and customer token come from PostgreSQL, not the browser.
3. `modules/payments/service.ts` initializes hosted Paystack checkout through the provider abstraction. Provider URLs are accepted only from the exact HTTPS Paystack checkout host.
4. The callback verifies the transaction server-side before redirecting to the token-protected customer status page. A callback by itself never changes payment state.
5. The webhook route reads a bounded raw body, verifies its HMAC-SHA512 signature, stores a sanitized event record, and applies success only when reference, amount, currency, order, and tenant all match. Duplicate delivery is harmless.
6. Tenant staff can inspect attempts and request provider reconciliation, but cannot manually confirm Paystack payment. Super admins use `/payment-operations` for bounded cross-platform visibility and safe re-verification.
7. `PaymentProvider.refundPayment` provides the validated provider capability. Do not expose it directly: the future returns/refunds workflow must add authorization, durable refund records, partial-refund accounting, notifications, and idempotency first.

`PAYSTACK_SECRET_KEY` is server-only. The hosted checkout currently needs no browser SDK; the public key remains an environment placeholder for future client-side Paystack features. Merchant payments remain separate from future BusinessCare subscription billing.
- Payment instructions are copied onto the order. Replacing a store bank account must not alter what an existing customer was originally shown.

## Follow a storefront checkout

1. `modules/commerce/cart.ts` keeps a small, tenant-specific browser cart and never claims its cached prices are final.
2. `/store/[slug]/cart` calls the public quote action. The database returns current products, stock availability, and eligible delivery rates from a bounded projection.
3. `components/commerce/cart-checkout.tsx` explains unavailable items, required customer details, delivery choices, and bank-transfer verification in customer language.
4. `modules/commerce/validation.ts` normalizes the form, while `create_storefront_order` independently revalidates every value and relationship inside PostgreSQL.
5. Successful creation returns only the reference, totals, snapshotted bank instructions, and an opaque order-access token. The token may submit a payment notice but cannot read tenant tables or confirm payment.
6. Routes under `/t/[slug]/orders` use membership-authorized bounded queries. Settings and every status/note mutation re-resolve tenant access on the server and call tenant-checking RPCs.
7. Order administration keeps payment and fulfilment as separate state machines. All transitions are audited, and customer/order/item snapshots remain immutable.
