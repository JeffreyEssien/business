# Database migrations

Every database schema, function, policy, trigger, index, or grant change belongs in a timestamped SQL migration here: `YYYYMMDDHHMM_description.sql`.

Run from the project root:

```sh
npm run db:migrate
npm run db:test
```

The scripts load DATABASE_URL from .env.local. The migration runner applies pending SQL in a locked transaction and records checksums in businesscare_migrations.history. Do not edit applied migrations or alternate with Supabase CLI db push; that uses a different history table. Add a new migration for changes. The test runner always rolls back its isolated random fixtures.

After migrations, create a confirmed password-based account for the owner using Supabase Authentication > Users. Set PLATFORM_OWNER_EMAIL to that account and run `npm run owner:bootstrap`. The script grants the first owner role and audits it; it never sends email or sets passwords.

Do not run migrations against production before staging verification and release review. Never store credentials in SQL.
