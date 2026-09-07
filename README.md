# BusinessCare

A shared commerce platform for independent businesses. Current implementation: a Supabase-backed platform workspace with business onboarding, isolated tenant workspaces, product/category management, inventory basics, media uploads, and public catalogs.

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000. Routes: `/` (overview), `/businesses` (live searchable directory), `/setup` (launch checklist).

## Validation

```bash
npm run typecheck
npm run build -- --webpack
```

Copy `.env.example` to `.env.local` and populate the Supabase settings. The admin routes now require authentication and an active SUPER_ADMIN profile.

Track completed work and upcoming owner inputs in [docs/BUILD_PROGRESS.md](docs/BUILD_PROGRESS.md). Product requirements and implementation order are defined in [BUSINESSCARE_BUILD_SPEC.md](BUSINESSCARE_BUILD_SPEC.md).

The Webpack option is a build fallback for environments that prohibit Turbopack worker ports. The default `npm run build` still uses Turbopack.

## Database and owner setup

All versioned SQL lives in `supabase/migrations`. See [migration instructions](supabase/migrations/README.md).

```bash
npm run db:migrate
npm run db:test
npm run owner:bootstrap
```

Use the Supabase Session pooler connection string for DATABASE_URL if direct IPv6 connectivity is unavailable. The owner bootstrap requires an existing confirmed Auth user matching PLATFORM_OWNER_EMAIL. Create that password-based account in the Supabase dashboard first; no password is stored in the repository. Then open `/login` and sign in.

Never run the secret key in browser code. Session-based application queries use the publishable key and RLS. Business counts are live. Commerce and billing metrics remain unavailable until those modules are connected.

## Business onboarding

1. Sign in as the platform owner and open Businesses → Create business.
2. Enter the business, owner, template, initial plan, and payment preference.
3. Open its details and generate an owner invitation link. No email is sent.
4. Share that link privately. Existing owners sign in; new owners verify the invitation and set a password.
5. Owners enter `/t/{slug}`. Super admins manage onboarding and suspend/reactivate from business details.

Invitation links use NEXT_PUBLIC_APP_URL. A localhost address is suitable for testing on the same computer; set a deployed application URL before inviting remote owners. Store handles are reserved only; storefront publishing and domain activation come in later stages. No plan charges or payment processing occur during this stage.

## Catalog

Tenant owners manage products and categories at `/t/{slug}/catalog`. Active products appear at `/store/{slug}` with product details at `/store/{slug}/products/{productSlug}`. Catalog media is uploaded server-side to Cloudinary; its secure delivery URL, public ID, type, dimensions, format, and tenant ownership are stored in PostgreSQL. Supported files are JPG, PNG, WebP, GIF, MP4, and WebM up to 5 MB.

The current public route is a local/platform-path storefront. Custom hostnames, explicit store publishing controls, theme/content editing, checkout, and payments remain later phases.

## Integration verification

With the production preview running on 127.0.0.1:3100, run `npm run test:integration`. This requires the development Supabase credentials and DATABASE_URL. The test creates uniquely named temporary Auth users and businesses, checks login and onboarding, then deletes only those fixtures. It sends no email and never uses the real owner's password. SQL suites under supabase/tests always roll their fixtures back.

CI runs frontend checks and PostgreSQL migration/RLS tests with a minimal Auth schema fixture. A gated post-push job runs the real Supabase Auth/integration and browser regression suites against the development environment.

Development delivery targets the `develop` branch. See [docs/DEVOPS.md](docs/DEVOPS.md) for pipeline stages, GitHub environment secrets, live integration tests, and recommended branch protection.

## Code organization

Read [the code guide](docs/CODE_GUIDE.md) for component responsibilities, styling conventions, the create-business data flow, and verification commands. Use `npm run format` / `npm run format:check` for source formatting.
