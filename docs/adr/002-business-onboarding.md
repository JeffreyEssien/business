# ADR 002: Atomic onboarding and verified owner acceptance

Accepted 2026-09-05.

Use an authenticated PostgreSQL RPC for provisioning. It rechecks the active platform role independently of Next.js and writes business, owner invitation, theme/layout, draft page/content/navigation, SEO, disabled notification settings, payment preference, subscription plan reference, domain reservation, and checklist in one transaction. The unique slug prevents duplicate businesses on retry. Pricing and billing remain unconfigured; plan entitlements are inherited via the plan reference.

An owner invitation is created atomically. The membership is created at acceptance, when the intended email has a confirmed Auth identity; this avoids inventing a verified identity or granting access to an unconfirmed user. Acceptance checks auth.users, not editable metadata or a browser-supplied tenant identifier. Invitation IDs are locators, not authentication credentials. Repeat acceptance is idempotent, and disabled memberships cannot be resurrected by replay.

For new owners, platform admins can generate a Supabase invite token and copy a link. Generation sends no email. The first POST verifies the invite token, then the owner sets a password and accepts the database invitation. Existing confirmed users receive an invitation page that requires their own login; no magic login token is minted for existing accounts. Link generation is audited without storing tokens. Generated Auth accounts are external side effects: generation is separate from tenant creation, can be retried, and failures do not claim an invitation was delivered. Invitation tokens are sensitive and must be shared only with their named owners.

A store handle is reserved, but no DNS hostname is advertised as active. Storefront content remains DRAFT and SEO indexing disabled. Tenant workspace routes use membership checks plus RLS, and suspended businesses show an unavailable page. Suspend/reactivate is audited and preserves records.

All live platform tables use server-side pagination. Sample commerce figures have been removed; unconnected metrics display an unavailable value.

CI runs migrations and RLS suites against isolated PostgreSQL with a minimal Supabase Auth contract. A gated post-push development job performs real Supabase Auth integration verification; the PostgreSQL stub itself does not claim to test Auth token behavior.
