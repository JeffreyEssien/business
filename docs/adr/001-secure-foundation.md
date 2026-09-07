# ADR 001: Supabase shared database and authentication

Accepted 2026-09-05. Owner selected Supabase.

Use Supabase Auth for identity and public.users for application roles. Ignore user-editable Auth metadata for authorization. Tenant membership is a separate relation supporting multiple businesses per user. RLS protects every exposed application table. Ordinary queries use the publishable key and the authenticated user's cookies, never the secret key. Private security-definer helpers use a fixed empty search path and restricted execute grants to avoid recursive RLS.

At foundation stage, authenticated access is read-only. Tenant writes and provisioning are deferred to Phase 1; no arbitrary role changes are exposed. Platform access requires an active SUPER_ADMIN record. Database membership queries will independently scope tenant routes when introduced.

Versioned SQL lives in supabase/migrations. The Node runner tracks checksums in a private businesscare_migrations.history table and applies pending files in one locked transaction. This runner, not Supabase CLI db push, owns migration history for this project. Never edit an applied migration. Add a new migration for forward fixes. Use DATABASE_URL for tooling only, not browser or request-time data access.

Owner bootstrap is an explicit local command against an existing confirmed Auth account matching PLATFORM_OWNER_EMAIL. It logs elevation; login never automatically promotes users. No invitation or email is sent by the bootstrap command.
