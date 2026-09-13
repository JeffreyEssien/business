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
DEV_RESEND_API_KEY
DEV_RESEND_WEBHOOK_SECRET
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
# Transactional email delivery

BusinessCare defaults to `EMAIL_DELIVERY_MODE=disabled`. For Resend account-only testing, configure a sending-only `RESEND_API_KEY`, the webhook signing secret, `EMAIL_DELIVERY_MODE=test`, `EMAIL_FROM_ADDRESS=onboarding@resend.dev`, and `EMAIL_TEST_RECIPIENT` as the email on the Resend account. Never expose these values with `NEXT_PUBLIC_`.

Register `/api/webhooks/resend` for email sent, delivered, delivery delayed, failed, bounced, suppressed, and complained events. The handler verifies the raw-body Svix signature and persists only bounded metadata.

Invoke `/api/jobs/email-delivery` with `Authorization: Bearer <CRON_SECRET>` from the deployment scheduler. Each invocation claims at most 25 due messages. Change to `EMAIL_DELIVERY_MODE=live` only after `EMAIL_FROM_ADDRESS` belongs to a verified sending domain and a real owner-observed delivery passes.

# Transactional SMS delivery

BusinessCare defaults to `SMS_DELIVERY_MODE=disabled`. Configure these as server-only deployment variables; never prefix them with `NEXT_PUBLIC_`:

```text
TERMII_API_KEY
TERMII_BASE_URL
TERMII_WEBHOOK_SECRET
TERMII_SMS_CHANNEL=generic
SMS_DELIVERY_MODE=disabled
SMS_TEST_RECIPIENT
CRON_SECRET
```

Use the account-specific HTTPS base URL shown in Termii's API-token settings. `TERMII_WEBHOOK_SECRET` is the secret used to verify Termii's `X-Termii-Signature`; when it is omitted, the adapter uses `TERMII_API_KEY`, matching Termii's signing documentation. Keep the explicit variable when the dashboard provides a separate webhook secret.

Register this delivery-report endpoint in the Termii dashboard:

```text
https://business-psi-umber.vercel.app/api/webhooks/termii
```

The route verifies HMAC-SHA512 over the untouched raw body, rejects bodies over 64 KB, and persists only sanitized event identifiers, message status, timestamp, cost, and channel. It does not retain the provider payload or customer phone number.

Invoke this delivery worker from the deployment scheduler with `Authorization: Bearer <CRON_SECRET>`:

```text
https://business-psi-umber.vercel.app/api/jobs/sms-delivery
```

Each run claims at most 25 messages. Keep delivery disabled while deploying and registering the webhook. Then use `test` mode with one canonical international `SMS_TEST_RECIPIENT`, submit a disposable tenant sender request, review it in `/sms-operations`, and wait for Termii approval. Send and observe one order update before switching to `live`. A tenant request alone never contacts Termii; the Super-Admin “Approve & send to Termii” action is the explicit provider side effect.
