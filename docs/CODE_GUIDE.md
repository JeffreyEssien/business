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

| Location | Responsibility | Examples |
| --- | --- | --- |
| `components/ui` | Reusable presentation and native controls; no Supabase queries | TextField, SelectField, Button, Panel, Checklist |
| `components/auth` | Authentication-specific compositions | AuthLayout, LoginForm, PasswordForm |
| `components/businesses` | Business-specific presentation and form orchestration | BusinessSummary, BusinessFilters, CreateBusinessForm |
| `components/layout` | Application navigation and framing | PlatformSidebar, PlatformTopbar |
| `components/super-admin` | Platform views composed from UI components | Shell, BusinessList, LaunchCard |
| `modules/tenants` | Data access, validation, configuration, domain types, authorized actions | queries, workspace-query, actions |
| `lib/supabase` | SDK construction and cookie handling | server, admin |
| `app` | Route parameters, redirects, metadata, composition | page.tsx, layout.tsx |

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

Cloudinary is the accepted production image provider (ADR 003). Keep media persistence provider-neutral and tenant scoped. Until that integration lands, the current Supabase Storage upload path is interim and must not become a hidden dependency for later image features.
