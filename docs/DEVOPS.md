# Development delivery workflow

`develop` is the integration branch. Push feature branches and open pull requests into `develop`; direct production deployment and promotion to `main` are intentionally not automated until a hosting target and release policy are selected.

## Automatic checks

`.github/workflows/checks.yml` runs for pushes to `develop`, pull requests targeting `develop`, and manual dispatches.

- Quality: clean dependency installation, formatting, generated Next.js route types, TypeScript, production Webpack build, and a high-severity production-dependency audit.
- Database regression: all migrations against a fresh PostgreSQL 17 service, a second idempotency run, and every rollback-only SQL/RLS suite.
- Pull requests: GitHub dependency review rejects newly introduced high-severity dependencies.
- Live integration: real development Supabase Auth, tenant isolation, Storage/catalog behavior, and desktop/mobile Playwright regression tests. Browser screenshots are retained as workflow artifacts for 14 days.

The live job runs after quality and database regression checks. It is enabled on `develop` pushes when the repository variable `RUN_LIVE_INTEGRATION` equals `true`; it can also be started manually. It does not expose development secrets to pull-request code. Tests create uniquely prefixed fixtures and remove only those fixtures afterward. Use a development Supabase project, never production.

## GitHub environment configuration

Create a GitHub environment named `development` and add these environment secrets:

```text
DEV_SUPABASE_URL
DEV_SUPABASE_PUBLISHABLE_KEY
DEV_SUPABASE_SECRET_KEY
DEV_DATABASE_URL
DEV_CLOUDINARY_CLOUD_NAME
DEV_CLOUDINARY_API_KEY
DEV_CLOUDINARY_API_SECRET
```

Then create this repository variable:

```text
RUN_LIVE_INTEGRATION=true
```

Use development Cloudinary credentials and a non-production product environment. Integration and browser tests upload uniquely namespaced media and delete it during fixture cleanup.

## Recommended branch protection

Protect `develop`, require pull requests, dismiss stale approvals, and require these checks before merge:

```text
Format, types, build, and dependency audit
Migration and RLS regression tests
Pull request dependency review
```

The live development check runs after a successful push to `develop`, rather than as a secret-bearing pull-request check. Configure required reviewers on the GitHub `development` environment if manual approval is desired before that job accesses its secrets.
