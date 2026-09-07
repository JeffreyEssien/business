# BusinessCare build progress

Last updated: 2026-09-07

This living tracker records completed work, validation, outstanding work, and owner inputs. BUSINESSCARE_BUILD_SPEC.md remains authoritative. Update after each stage.

## Current stage: search appearance and discovery (Phase 4)

Status: Phase 3 is complete and verified. The Phase 4 foundation now lets each business control its homepage search title and description, search-listing preferences, social account, canonical URL, sitemap, robots response, and organization data. These settings remain saved privately until the owner publishes the storefront. Page-, product-, and category-specific search overrides remain before Phase 4 is complete. No real business or product was created by the agent; integration fixtures and uploaded test media were removed.

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

- Tenant design workspace at `/t/{slug}/design` with grouped business profile, theme tokens, announcement, hero, product section, navigation, and footer controls.
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

### Phase 4: search appearance foundation

- Tenant workspace at `/t/{slug}/marketing/search` uses customer-friendly labels, explanations, character counts, and a live search-result preview.
- Search title, description, social account, and search-listing/link-following preferences are stored as private draft settings and become public only through the existing atomic publish action.
- Published homepages emit absolute canonical, robots, Open Graph, Twitter, and ownership-verification metadata from the trusted application URL or an active verified custom hostname; request host headers are never trusted.
- Public `/store/{slug}/sitemap` and `/store/{slug}/robots.txt` responses reflect only published settings and published/active storefront records.
- Storefronts include safely serialized Organization structured data. Public storefront reads are request-memoized so metadata and page rendering do not repeat the same database query.
- Migration file 202609070005_seo_foundation.sql applied to development Supabase.

## Validation

- PASS: TypeScript and production Webpack build.
- PASS: foundation and onboarding SQL suites against actual development Supabase. Every fixture rolled back.
- PASS: tenant isolation in both directions across all new tenant tables; denied direct writes and anonymous access; invalid/reserved/duplicate slug checks; non-admin RPC denial; invitation email binding and repeat acceptance; disabled identity/membership denial; suspension and restored status.
- PASS: real Auth password sessions and authenticated admin pages; two independently provisioned tenant workspaces; new-owner invite token verification, password setup, and login; cross-tenant HTTP 404 and API empty result; tenant cannot access platform pages; invite token replay rejected; suspension/reactivation behavior. Integration fixtures removed afterward.
- PASS: all eight migrations were skipped on the final rerun; checksums and migration history are intact.
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
- CI workflow configured for frontend plus PostgreSQL RLS checks; remote GitHub Actions has not been executed from this session.
- Browser verification added during the modularity refactor below; owner design review remains welcome.

## Current limitations

- The `/store/{slug}` catalog, theme, content pages, and global search appearance are functional. Reserved handles are not active DNS domains, and custom domains still require the Phase 11 verification/TLS lifecycle before they can become canonical.
- New image/video uploads live in Cloudinary; their delivery URLs, public IDs, resource types, and tenant-scoped metadata live in PostgreSQL. Legacy Supabase media remains readable and is removed through provider-aware cleanup when replaced or deleted.
- Plans have initial feature values and catalog product limits, but no pricing, recurring charges, tenant overrides, or complete entitlement-management interface. The full entitlement layer remains Phase 9.
- Preferred payment mode is recorded, not connected. Email/SMS remain disabled.
- Invitation generation sends no messages. Localhost links only work on the same computer; configure the deployed app URL before remote owner onboarding.
- Page-, product-, and category-specific search overrides, richer product/breadcrumb structured data, checkout, payment processing, and advanced operational controls remain future work.
- `next build` with Turbopack intermittently stalled during this stage without diagnostics; the production Webpack build completed successfully. This should be rechecked after dependency or Next.js updates.
- Plain PostgreSQL CI emulates only the Auth schema contract; real Supabase Auth is covered by the separate development integration script.

## Remaining sequence

| Stage                  | Spec phase | Status                   | Acceptance gate                                            |
| ---------------------- | ---------- | ------------------------ | ---------------------------------------------------------- |
| Secure foundation      | 0          | Implemented and verified | Auth and isolation tests passed; CI configured             |
| Super-admin onboarding | 1          | Implemented and verified | Atomic creation, owner acceptance, two isolated workspaces |
| Catalog                | 2          | Implemented and verified | Tenant-scoped products, categories, media, inventory       |
| Theme and content      | 3          | Implemented and verified | Editor, pages, reordering, preview, atomic publishing       |
| SEO                    | 4          | In progress              | Global output verified; record-specific overrides next     |
| Orders and checkout    | 5          | Planned                  | Totals, inventory, snapshots, manual verification          |
| Paystack               | 6          | Planned                  | Verified/idempotent payment processing                     |
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
- Commerce: delivery regions/rates, currency confirmation (NGN default), payment choices and test credentials.
- Integrations: email/SMS providers and sender identities when those stages begin.
- Billing: plan prices/limits, trial length, grace policy.
- Deployment: host, owned platform domain, DNS access, and deployed application URL. businesscare.ng remains an unverified specification example.

Credentials stay in local environment files, never this tracker. No production deployment, outbound invitations, or real customer transactions have occurred.

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
