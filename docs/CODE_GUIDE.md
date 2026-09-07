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
3. `modules/content/validation.ts` constrains every text field, color token, layout variant, navigation item, and media file before provider or database work.
4. `modules/content/actions.ts` re-resolves membership for every mutation. Logo and hero uploads run concurrently inside one Server Action with `Promise.allSettled`; any partial upload is removed before an error is returned.
5. `save_site_draft` updates tenant-scoped draft tables through a security-definer RPC. Direct browser writes remain denied by RLS.
6. `publish_site` atomically archives the old live version and saves a complete normalized snapshot. A saved draft cannot change anonymous output until this RPC succeeds.
7. `components/storefront/storefront-renderer.tsx` renders both the authenticated draft preview and public homepage. Never create a second preview-only rendering implementation.
8. `get_public_storefront` exposes active catalog products and only the current published site snapshot to anonymous visitors.

Keep tenant colors in validated tokens and pass them to storefront components through CSS variables. Marketing copy belongs in content records; only system UX labels may remain in code.

## Follow a customer-information page change

1. Routes under `app/t/[slug]/content/pages` authorize the tenant and compose the page list or editor.
2. `components/content` explains where the page appears, whether customers can see it, and that saving does not change the live store.
3. `modules/content/validation.ts` normalizes page names, addresses, headings, and plain text. Customer text is rendered as text, never injected as HTML.
4. `save_content_page`, `delete_content_page`, and `reorder_homepage_sections` enforce tenant roles and relationships inside PostgreSQL. Direct browser writes remain denied.
5. Homepage order is canonical in `content_blocks.sort_order`. Ordinary content saves preserve it; only the reorder action may change it.
6. Publication copies enabled pages and navigation into the same immutable snapshot as the homepage. Public routes never read an unpublished page.

## Follow a search-appearance change

1. `app/t/[slug]/marketing/search/page.tsx` authorizes the tenant and composes the explanatory editor and search-result preview.
2. `components/seo/search-appearance-form.tsx` uses customer-facing language for search title, description, listing, and links. It makes the save-versus-publish distinction explicit.
3. `modules/seo/validation.ts` normalizes untrusted input, and `modules/seo/actions.ts` re-resolves membership before calling `save_global_seo`.
4. Saved settings remain private in `tenant_seo_settings`. `publish_site` adds a normalized `seo` object to the immutable live snapshot and marks the onboarding search step complete.
5. `modules/seo/public.ts` builds canonical URLs only from `NEXT_PUBLIC_APP_URL` or an active verified custom hostname. Never derive canonical metadata from an incoming Host header.
6. The public homepage reads one request-memoized storefront result for both metadata and rendering. Sitemap and robots routes use only published settings and public storefront records.
7. Structured data is serialized with `<` escaped before being placed in a script element. Preserve this protection when adding product or breadcrumb schemas.
