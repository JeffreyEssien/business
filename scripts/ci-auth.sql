-- Minimal Auth contract for PostgreSQL RLS CI, not a replacement for live Supabase Auth tests.
create role anon nologin;
create role authenticated nologin;
-- Supabase provisions this role and uses it for trusted server-side operations.
-- Keep BYPASSRLS here so local CI exercises the same privilege boundary.
create role service_role nologin bypassrls;
create schema auth;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role',true),'') $$;
grant usage on schema auth to anon,authenticated,service_role;
grant execute on function auth.uid() to anon,authenticated,service_role;
grant execute on function auth.role() to anon,authenticated,service_role;
