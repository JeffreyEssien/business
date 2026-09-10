# BusinessCare build progress

Last updated: 2026-09-09

This living tracker records completed work, validation, outstanding work, and owner inputs. BUSINESSCARE_BUILD_SPEC.md remains authoritative. Update after each stage.

## Current stage: Paystack merchant payments (Phase 6)

Status: Phase 5 is complete and verified. Customers can use a responsive tenant-scoped cart, receive a database-authoritative quote, place a bank-transfer order, and report payment without self-confirming it. Businesses can configure checkout and delivery, filter and inspect their own orders, keep private notes, verify payment, advance fulfilment, and cancel fulfilment with exactly-once inventory restoration. Historical product, customer, delivery, price, and payment-instruction snapshots remain stable. Phase 6 is now active and will add provider-independent payments plus verified, idempotent Paystack processing. No real business, customer, product, or order was created by the agent; all test fixtures and uploaded media were removed.

### Customer application and approval flow

- `/get-started` is a six-step, mobile-first application written for non-technical business owners. Its unfinished draft stays only in that browser; a database record is created only on final submission.
- Public submission never provisions a tenant. Super Admin receives a searchable, filterable application queue and can edit all critical values while the immutable original submission and revision history remain available.
- `Approve & create business` is one database transaction around the existing authoritative tenant provisioner. It applies the approved owner, plan, content, Cloudinary logo, contact/social details, theme preset, and all three real brand colours, and prepares requested pages as private drafts.
- Page-backed homepage buttons automatically require their destination starter page at both the form and database layers. Provisioned Home navigation remains a typed `PAGE` relationship.
- Public access is narrowed to submission and website-name availability functions. Server validation, file constraints, a honeypot, request-fingerprint throttling, email throttling, and duplicate controls protect intake; application tables and applicant details are Super-Admin-only.
- A dedicated browser regression proves browser draft recovery, responsive layouts, deferred Cloudinary upload, no tenant before approval, editable review, preserved original values, atomic provisioning, typed navigation, and fixture/media cleanup.
- All six customer-facing website styles now produce distinct storefront typography, geometry, spacing, or composition while retaining the shared renderer and four stable base presets.
- “Other” businesses receive a required plain-language explanation field. Approved product readiness and quantity tailor the owner checklist, and category names become private draft suggestions rather than public catalog records.
- The browser draft preserves its application identity across refreshes and explains that browser security prevents restoring a selected logo file.
- Publishing rejects visible internal buttons or menu links whose destination is disabled, missing, or not customer-ready. Storefront CTAs resolve internal paths inside the correct tenant store.
- Failed application-logo cleanup remains non-fatal but now emits a bounded warning containing the request, application, provider, asset key, and operation for investigation and future retries.

Deferred deliberately: applicant accounts/status tracking, cross-device server drafts, application confirmation and owner-invitation email delivery (Phase 7 provider decision required), a managed challenge such as Turnstile if production abuse warrants it, bulk product import from an application, custom-domain selection, durable background retries for failed provider cleanup, and bespoke copy fields for every requested policy page. A standalone `APPROVED` holding state is also omitted because the chosen approval action provisions atomically; add it only if a later operational process requires approval and provisioning to happen at different times.

## Completed

### Frontend foundation

Responsive platform shell, overview, directory, checklist, page metadata, focus states, login layout, error/loading states. Retained Next.js App Router, React, TypeScript, and Tailwind. System fonts avoid remote font build dependencies.

### Phase 0: secure foundation

- Supabase SSR authentication, session refresh, login/logout, and server-side active administrator checks.
- Users, tenant memberships, tenants, audit logs, Auth profile trigger, and RLS.
- Confirmed platform owner bootstrapped and independently verified; audit record saved.
- Database migration/checksum runner, rollback-only security tests, frontend and PostgreSQL CI configuration.
- Real Supabase authenticated HTTP/API checks pass with generated fixture identities. The real owner password was never accessed.

### Phase 1: business onboarding

- Live overview and business directory replace fictional records; server-side search/status filtering and pagination.
- Create-business form and atomic server-authorized database provisioning.
- Default business settings, theme/layout, draft homepage/content/navigation, SEO, disabled email/SMS, payment preference, plan/subscription assignment, reserved store handle, invitation, and checklist.
- Owner membership is created on verified invitation acceptance, not before email verification (ADR 002).
- Admin business details, onboarding checklist, activity history, suspension/reactivation.
- Copyable invitation generation; no emails sent. Existing users must sign in themselves; new-owner tokens are verified before password setup and membership acceptance.
- Separate tenant workspace at /t/{slug}; membership authorization and RLS; unavailable page for suspended businesses.
- Migration files: 202609050001_foundation.sql and 202609050002_onboarding.sql, both applied to development Supabase.

### Phase 2: catalog

- Tenant category create, update, list, and delete with draft/active/archived states.
- Tenant product create, update, list, and delete with descriptions, SKU, NGN pricing, compare-at pricing, inventory tracking, multiple categories, and draft/active/archived states.
- Product-limit enforcement resolves the tenant's configured plan feature inside the authorized database mutation.
- Product image/video uploads use Cloudinary through trusted server code, generated tenant-prefixed public IDs, and MIME/size validation. Secure delivery URLs, provider IDs, type, format, dimensions, and editable alt text/captions are tenant scoped in PostgreSQL.
- Public catalog and product-detail routes at `/store/{slug}`; only active products from an available resolved tenant are returned through a restricted public database projection.
- Tenant catalog routes at `/t/{slug}/catalog`; owner/admin/manager mutations are server-authorized and direct table writes remain denied.
- Migration file 202609060001_catalog.sql applied to development Supabase.
- Cloudinary media migration 202609070001_cloudinary_media.sql applied to development Supabase.

### Phase 3: theme and content foundation

- Tenant design workspace at `/t/{slug}/design` with grouped business profile, theme tokens, announcement, hero, product section, and footer controls.
- Four controlled theme presets and editable semantic color tokens; storefront components consume CSS variables rather than scattered tenant colors.
- Logo and hero files upload to tenant-scoped Cloudinary paths concurrently inside one authorized Server Action. Partial provider success is cleaned before database mutation, and the request limit supports two validated 5 MB files plus multipart overhead.
- Draft content remains private and editable. Publishing atomically archives the previous live version and creates a normalized immutable snapshot with an audit record.
- Saved draft preview and public homepage share `StorefrontRenderer`; no separate fake preview implementation exists.
- Anonymous storefront projection exposes the current published site snapshot plus active catalog products, without granting raw-table reads.
- Responsive desktop/mobile storefront variants, business profile footer, header navigation, media, editable homepage copy, and section enable/disable are rendered from tenant data.
- Migration file 202609070002_theme_content.sql applied to development Supabase.
- Homepage sections can be reordered through tenant-authorized database logic; ordinary content saves preserve the chosen order.
- About, Contact, Policy, and custom customer-information pages can be created, edited, hidden, shown in the main menu, and deleted without changing the live store until publication.
- Publishing includes all enabled customer pages in the same immutable site snapshot, and public pages use the same storefront header, theme, and footer as the homepage.
- Migration files 202609070003_content_pages.sql and 202609070004_homepage_default.sql applied to development Supabase.
- Store menus have their own descriptive workspace at `/t/{slug}/content/navigation`; Store Design no longer reads, rewrites, or owns navigation records.
- Page and product-collection menu destinations retain tenant-scoped foreign-key relationships. Their public paths are derived from the related records, so renaming a page or collection updates the existing menu link without losing its type, label, position, or header/footer location.
- Existing exact internal URL links were safely backfilled to typed page or collection records. Custom internal paths and HTTPS links remain explicit URL destinations.
- Migration files 202609080001_navigation_integrity.sql and 202609080002_navigation_page_lifecycle.sql applied to development Supabase.

### Phase 4: search appearance foundation

- Tenant workspace at `/t/{slug}/marketing/search` uses customer-friendly labels, explanations, character counts, and a live search-result preview.
- Search title, description, social account, and search-listing/link-following preferences are stored as private draft settings and become public only through the existing atomic publish action.
- Published homepages emit absolute canonical, robots, Open Graph, Twitter, and ownership-verification metadata from the trusted application URL or an active verified custom hostname; request host headers are never trusted.
- Public `/store/{slug}/sitemap` and `/store/{slug}/robots.txt` responses reflect only published settings and published/active storefront records.
- Storefronts include safely serialized Organization structured data. Public storefront reads are request-memoized so metadata and page rendering do not repeat the same database query.
- Migration file 202609070005_seo_foundation.sql applied to development Supabase.
- Customer pages, products, and product collections are listed in one understandable search workspace. Each record can inherit store defaults or save its own title, description, sharing wording, preferred HTTPS address, and search visibility.
- Advanced record controls are collapsed by default. The editor explains fallback behavior and shows a live result preview with character counts.
- Record overrides are tenant-authorized drafts and are copied into the immutable site snapshot only during publication. Deleting a source page, product, or collection removes its saved override.
- Public customer, product, and collection routes use published fallback rules consistently. Active collections have storefront pages and sitemap entries.
- Product and breadcrumb structured data is generated from validated application records and safely serialized; tenants cannot inject raw schema markup.
- Tenant mobile navigation now uses a compact expandable workspace menu instead of wrapping a long row of links.
- Migration file 202609070006_seo_overrides.sql applied to development Supabase.
- Global and page/product/collection sharing images upload to tenant-scoped Cloudinary paths. PostgreSQL stores provider identity and ownership; immutable published snapshots store delivery URLs.
- Search editors include an understandable social-card preview and validated JPG/PNG/WebP uploads up to 5 MB. Record images fall back to product/store imagery when no override exists.
- Replacing or deleting source records cleans database media metadata and provider assets through the existing server-authorized lifecycle.
- Migration files 202609080004_seo_social_images.sql and 202609080005_seo_asset_lifecycle.sql applied to development Supabase.

### Performance and reliability foundation

- Public homepage catalog reads are capped at eight products; homepage configuration is no longer used as the complete catalog transport.
- `/store/{slug}/products` provides bounded search and keyset pagination with a server-enforced maximum. Category browsing uses the same bounded read model.
- Product detail uses a dedicated one-record public RPC. The tenant product editor queries one tenant-owned product instead of hydrating and searching the entire catalog in JavaScript.
- Tenant product administration and SEO product selection are paginated and searchable. Counts use database aggregates rather than the visible page.
- Sitemap reads use a narrow slug-only projection with the sitemap protocol ceiling instead of loading product descriptions, prices, media, and inventory.
- Tenant-aware cursor/name indexes support implemented query patterns. SQL scale regression verifies bounded homepage and catalog lookahead results.
- Every matched application request receives a generated correlation ID. Structured server logging records only slow/failing operational boundaries without payloads, credentials, or customer data.
- `/api/health/live` is dependency-free. `/api/health/ready` performs one short, data-free database check and exposes no configuration or provider details.
- Migration file 202609080003_bounded_catalog_reads.sql applied to development Supabase.

### Phase 5: orders and checkout

- Tenant-scoped customers, customer addresses, shipping zones/rates, orders, and order items are defined with RLS and no browser write grants.
- Orders snapshot customer contact, shipping address, totals, currency, payment state, and fulfillment state. Order items snapshot product name, SKU, unit price, quantity, and line total.
- Checkout settings distinguish required contact/address fields, customer notes, bank transfer, future Paystack, and tenant success messaging. Active bank instructions and state-based flat delivery rates are managed in the same descriptive workspace.
- Commerce indexes cover tenant order chronology, payment state, fulfillment state, customers, order items, and shipping rates.
- The browser cart is isolated by store and gives immediate local feedback. A database quote then validates current availability, inventory, prices, currency, and eligible delivery rates before enabling checkout.
- `create_storefront_order` repeats all trust checks, locks product rows, computes totals server-side, snapshots the order, and decrements tracked inventory atomically. Mixed-currency, unavailable, cross-tenant, and out-of-stock requests fail without a partial order.
- Bank-transfer customers receive the order reference and snapshotted account instructions. Their opaque order token can report payment only as awaiting verification; it cannot mark an order paid.
- Tenant order administration provides bounded search/filter/pagination, complete historical detail, private notes, separate payment/fulfilment states, audited transitions, and exactly-once stock restoration on cancellation.
- Customer order counts and verified paid totals are derived from authoritative order state at transaction completion, preventing unpaid orders or retries from inflating revenue.
- Migration files 202609080006_orders_foundation.sql, 202609080007_checkout_order_workflow.sql, 202609080008_order_payment_snapshots.sql, and 202609080009_customer_paid_totals.sql applied to development Supabase.

## Validation

- PASS: TypeScript and production Webpack build.
- PASS: foundation and onboarding SQL suites against actual development Supabase. Every fixture rolled back.
- PASS: tenant isolation in both directions across all new tenant tables; denied direct writes and anonymous access; invalid/reserved/duplicate slug checks; non-admin RPC denial; invitation email binding and repeat acceptance; disabled identity/membership denial; suspension and restored status.
- PASS: real Auth password sessions and authenticated admin pages; two independently provisioned tenant workspaces; new-owner invite token verification, password setup, and login; cross-tenant HTTP 404 and API empty result; tenant cannot access platform pages; invite token replay rejected; suspension/reactivation behavior. Integration fixtures removed afterward.
- PASS: all eighteen migrations are applied; checksums and migration history are intact.
- PASS: catalog SQL suite covers forward/reverse tenant isolation, outsider and cross-tenant mutation denial, anonymous raw-table denial, public catalog projection, invalid cross-tenant category assignment, and onboarding checklist state.
- PASS: real Auth integration covers two independently populated catalogs, an authenticated Cloudinary upload, tenant catalog pages, anonymous storefront/product pages, direct-write denial, and fixture cleanup.
- PASS: browser creation of a category and active product; desktop tenant catalog and desktop/mobile public storefront inspected with no overflow or runtime errors.
- PASS: browser media submission uploads to Cloudinary, renders from the stored secure URL, deletes product/media metadata, and confirms the remote asset is no longer found. Temporary Cloudinary and database fixtures were removed.
- PASS: theme/content SQL suite covers cross-tenant draft/version isolation, outsider mutation denial, anonymous raw-table denial, draft/live separation, version history, and a single current published snapshot.
- PASS: authenticated integration covers the design route, draft mutation, atomic publish, public tenant-controlled homepage content, and existing onboarding/catalog regression paths.
- PASS: browser design flow uploads logo and hero media together, previews the saved draft through the production renderer, publishes version 1, preserves site media during product deletion, and cleans all database/Auth/Cloudinary fixtures.
- PASS: visually inspected desktop editor plus desktop/mobile storefront screenshots; controls, hierarchy, responsive stacking, tenant theme, preview, footer, and overflow are acceptable.
- PASS: content-page SQL coverage verifies saved/live separation, menu inclusion, persistent section ordering, outsider mutation denial, and anonymous raw-table denial.
- PASS: authenticated integration and browser flows create a customer page, reorder homepage sections, publish once, and render the page from the immutable public snapshot.
- PASS: search settings are tenant-isolated, stay private until publish, then drive exact homepage metadata, canonical output, sitemap, robots response, and Organization structured data.
- PASS: visually inspected desktop/mobile website-page screens and the desktop search-appearance editor; descriptive controls, responsive layouts, live preview, and overflow are acceptable.
- PASS: record-level search SQL coverage verifies PAGE/PRODUCT/CATEGORY ownership, draft/live separation, outsider denial, and the published snapshot.
- PASS: authenticated integration verifies record-specific public HTML, collection routing, category sitemap inclusion, and tenant isolation.
- PASS: browser editing and publishing of product search wording, exact public title output, and Product/Breadcrumb structured-data scripts. The compact mobile navigation and record editor were visually inspected with no overflow.
- PASS: navigation SQL regression covers typed PAGE/CATEGORY ownership, cross-tenant rejection, footer preservation, page/category rename propagation, and the exact create-page → save-menu → save-Store-Design sequence without relationship degradation.
- PASS: live integration saves typed store menus for a real authenticated tenant. Browser coverage confirms the page relationship survives a Store Design save; desktop/mobile menu editors were visually inspected with no overflow.
- PASS: sharing-image SQL coverage verifies tenant authorization, immutable global/record URLs, and published metadata. Browser coverage performs a real Cloudinary upload, publishes it, verifies `og:image`, and removes the provider/database/Auth fixtures.
- PASS: bounded-read SQL coverage verifies the eight-item homepage and capped catalog lookahead. Integration verifies direct product and bounded browse RPCs; browser coverage verifies Shop search and responsive desktop/mobile rendering.
- PASS: liveness and readiness endpoints return healthy responses against the production test server without exposing dependency details.
- PASS: Phase 5 SQL coverage verifies authoritative quotes/prices, inventory locking and decrement, out-of-stock rejection, immutable order/payment snapshots, payment-notice separation, merchant verification, accurate paid totals, exactly-once stock restoration, tenant A/B isolation, anonymous denial, and direct-write denial.
- PASS: authenticated integration configures checkout, creates a real anonymous order, verifies trusted totals/inventory, records a manual-transfer notice, confirms payment as the merchant, denies tenant B and direct writes, and removes every fixture.
- PASS: browser regression covers product-to-cart, responsive cart/checkout, order placement, bank-transfer confirmation, customer payment notice, merchant order filtering/detail, payment verification, and fulfilment progression. Desktop/mobile screenshots were inspected with no horizontal overflow or confusing technical labels.
- CI workflow configured for frontend plus PostgreSQL RLS checks; remote GitHub Actions has not been executed from this session.
- Browser verification added during the modularity refactor below; owner design review remains welcome.

## Current limitations

- The `/store/{slug}` catalog, theme, content pages, and global search appearance are functional. Reserved handles are not active DNS domains, and custom domains still require the Phase 11 verification/TLS lifecycle before they can become canonical.
- New image/video uploads live in Cloudinary; their delivery URLs, public IDs, resource types, and tenant-scoped metadata live in PostgreSQL. Legacy Supabase media remains readable and is removed through provider-aware cleanup when replaced or deleted.
- Plans have initial feature values and catalog product limits, but no pricing, recurring charges, tenant overrides, or complete entitlement-management interface. The full entitlement layer remains Phase 9.
- Online card/payment-provider mode is not connected yet; this is the active Phase 6 scope. Manual bank transfer is functional. Email/SMS remain disabled.
- Invitation generation sends no messages. Localhost links only work on the same computer; configure the deployed app URL before remote owner onboarding.
- Domain-verification UI, Paystack processing, refunds, and advanced operational controls remain future work.
- The Store design editor is responsive and functional, but its long settings column should receive further progressive disclosure so first-time users see fewer controls at once.
- `next build` with Turbopack intermittently stalled during this stage without diagnostics; the production Webpack build completed successfully. This should be rechecked after dependency or Next.js updates.
- Plain PostgreSQL CI emulates only the Auth schema contract; real Supabase Auth is covered by the separate development integration script.

## Remaining sequence

| Stage                  | Spec phase | Status                   | Acceptance gate                                            |
| ---------------------- | ---------- | ------------------------ | ---------------------------------------------------------- |
| Secure foundation      | 0          | Implemented and verified | Auth and isolation tests passed; CI configured             |
| Super-admin onboarding | 1          | Implemented and verified | Atomic creation, owner acceptance, two isolated workspaces |
| Catalog                | 2          | Implemented and verified | Tenant-scoped products, categories, media, inventory       |
| Theme and content      | 3          | Implemented and verified | Editor, pages, reordering, preview, atomic publishing       |
| SEO                    | 4          | Implemented and verified | Global/record metadata and sharing images; DNS gate Phase 11 |
| Orders and checkout    | 5          | Implemented and verified | Trusted totals, atomic inventory, bank transfer, order admin |
| Paystack               | 6          | In progress              | Verified/idempotent payment processing                     |
| Email                  | 7          | Planned                  | Branded delivery and logs                                  |
| SMS                    | 8          | Planned                  | Settings and entitlement enforcement                       |
| Entitlements/plans     | 9          | Planned                  | Central resolution and server enforcement                  |
| SaaS billing           | 10         | Planned                  | Subscriptions separate from merchant payments              |
| Domains                | 11         | Planned                  | Verified hostname/TLS lifecycle                            |
| Observability          | 12         | Planned                  | Audited platform visibility/monitoring                     |
| Hardening              | 13         | Planned                  | Security, restore, performance, release checks             |

## What the owner needs to provide next

- Now: first business name/handle, owner name/email, template, and initial plan through the create form.
- Now: sample products, categories, prices, images, and inventory preferences for real catalog review.
- Content stage: logos, branding, homepage/about/policy copy.
- Phase 6: Paystack test secret/public keys, the intended test callback base URL, and access to configure the environment-specific webhook endpoint. Never provide live keys for local or staging work.
- Integrations: email/SMS providers and sender identities when those stages begin.
- Billing: plan prices/limits, trial length, grace policy.
- Deployment: host, owned platform domain, DNS access, and deployed application URL. businesscare.ng remains an unverified specification example.

Credentials stay in local environment files, never this tracker. No production deployment, outbound invitations, or real customer transactions have occurred.

## Deferred architecture decisions

- Add cross-request published-version caching only after deployment topology is selected. Cache immutable design/navigation/SEO by version; never make cached storefront stock authoritative for checkout.
- Verify Supabase production pooler configuration during deployment. The application currently uses Supabase HTTP clients and does not open a PostgreSQL connection per browser request.
- Evaluate `pg_trgm` with realistic `EXPLAIN ANALYZE` evidence before adding fuzzy-search indexes. Current bounded name search does not justify indiscriminate extensions.
- Publish quotas belong to Phase 9 entitlements and require an explicit pricing decision. Draft editing and preview must remain available regardless of any future publish allowance.
- Audit archive/export requires background jobs, private object storage, verification, redaction, retention policy, email delivery, and retry state. Archive first, verify second, purge hot rows last.
- Choose external error tracking and provider dashboards after the production host is known. Durable payment/webhook events, idempotency, retries, and failed-event visibility remain release blockers before Paystack.

## UI repair and modularity refactor — 2026-09-06

Owner requested reusable, understandable, explained code and provided a screenshot of an unusable creation form.

Delivered:

- Shared UI fields, buttons, panels, page headers, form sections/actions/errors, checklists, pagination, copy field, empty states, and metric cards.
- Form styling owned by CSS Modules: visible bordered controls, explicit label spacing, helpful descriptions, 44px+ controls, two desktop columns and one mobile column.
- Feature forms moved from route folders to components/auth and components/businesses. Business form split into reusable business, owner, and setup groups.
- Thin overview/directory/detail/tenant routes; query helpers and explicit domain types; centralized validation and selectable options.
- Shared onboarding checklist between platform and tenant workspaces; navigation split into sidebar/topbar with correct nested active state.
- Readable formatting throughout source and scripts; base/shell/view stylesheet split; obsolete form rules removed.
- Documented responsibilities and request flow in CODE_GUIDE.md; owner conventions recorded in AGENTS.md; formatter check added to CI.
- Server validation returns submitted business values so an error does not clear the form.

Validation:

- PASS: final production build and TypeScript compilation.
- PASS: formatter check and diff whitespace check.
- PASS: authenticated integration checks after moving query/authorization code; fixtures removed.
- PASS: desktop/mobile browser layout checks and visually inspected screenshots; visible controls, label separation, no horizontal overflow, responsive columns, mobile navigation, and real create-business submission.
- PASS: final browser repeat asserts that server validation preserves the entered business name; valid creation afterward succeeds. All fixture accounts/businesses removed.
- No database schema migration was needed. Existing migrations were not edited.

Artifacts: artifacts/ui/create-business-desktop.png and artifacts/ui/create-business-mobile.png. Screenshots show empty fixture forms, not credentials or real business details.

## Invitation URL correction — 2026-09-06

Diagnosed two local servers: port 3000 belongs to the portfolio project; BusinessCare runs on port 3001. NEXT_PUBLIC_APP_URL still pointed to 3000, so generated links targeted the wrong app. Updated only that setting in .env.local to http://localhost:3001. Verified BusinessCare /invite returns HTTP 200 using a dummy ID without consuming a real invitation token. Existing links need their port changed from 3000 to 3001, preserving query parameters; new links use the updated base URL after environment reload.

## Password minimum — 2026-09-06

Owner requested an 8-character minimum. Updated both password fields, helper text, and server-side password validation/error text. Maximum remains 128 characters and confirmation must match.

## Product upload request limit — 2026-09-06

Product images allow up to 5 MB, but Next.js Server Actions retained their 1 MB default raw-body limit, causing submissions with larger images to fail before application validation. Configured a 6 MB Server Action request limit, leaving multipart overhead while preserving the 5 MB application and Storage limits. Verified with a real browser submission containing a 1.2 MB image; product creation, upload, storefront rendering, and fixture/media cleanup passed.
