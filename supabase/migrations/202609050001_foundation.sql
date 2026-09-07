-- Foundation only. All future schema/policy changes must be new migrations.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.users (
 id uuid primary key default gen_random_uuid(),
 auth_user_id uuid not null unique references auth.users(id) on delete cascade,
 name text not null default '',
 email text not null,
 platform_role text check (platform_role in ('SUPER_ADMIN','PLATFORM_SUPPORT')),
 status text not null default 'ACTIVE' check (status in ('ACTIVE','DISABLED')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.tenants (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(trim(name)) between 1 and 160),
 slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 status text not null default 'PROVISIONING' check (status in ('PROVISIONING','TRIAL','ACTIVE','PAST_DUE','SUSPENDED','CANCELLED','ARCHIVED')),
 default_currency text not null default 'NGN',
 timezone text not null default 'Africa/Lagos',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.tenant_memberships (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id),
 user_id uuid not null references public.users(id) on delete cascade,
 role text not null check (role in ('TENANT_OWNER','TENANT_ADMIN','TENANT_MANAGER','TENANT_STAFF')),
 status text not null default 'ACTIVE' check (status in ('ACTIVE','INVITED','DISABLED')),
 created_at timestamptz not null default now(),
 unique(tenant_id,user_id)
);
create index tenant_memberships_user_idx on public.tenant_memberships(user_id,tenant_id);
create table public.audit_logs (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid references public.tenants(id),
 actor_user_id uuid references public.users(id),
 action text not null,
 resource_type text not null,
 resource_id uuid,
 created_at timestamptz not null default now()
);
create index audit_logs_tenant_created_idx on public.audit_logs(tenant_id,created_at desc);

create function private.is_super_admin() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.users where auth_user_id=(select auth.uid()) and platform_role='SUPER_ADMIN' and status='ACTIVE');
$$;
create function private.is_tenant_member(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.tenant_memberships m join public.users u on u.id=m.user_id
 where m.tenant_id=target and u.auth_user_id=(select auth.uid()) and u.status='ACTIVE' and m.status='ACTIVE');
$$;
revoke all on function private.is_super_admin() from public;
revoke all on function private.is_tenant_member(uuid) from public;
grant execute on function private.is_super_admin(), private.is_tenant_member(uuid) to authenticated;

alter table public.users enable row level security;
alter table public.tenants enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.audit_logs enable row level security;
revoke all on public.users,public.tenants,public.tenant_memberships,public.audit_logs from anon,authenticated;
grant select on public.users,public.tenants,public.tenant_memberships,public.audit_logs to authenticated;
-- No browser writes yet, including role/membership edits. Provisioning comes in Phase 1.
create policy users_read on public.users for select to authenticated using (
 (auth_user_id=(select auth.uid()) and status='ACTIVE') or (select private.is_super_admin())
);
create policy tenants_read on public.tenants for select to authenticated using (
 (select private.is_super_admin()) or private.is_tenant_member(id)
);
create policy memberships_read on public.tenant_memberships for select to authenticated using (
 (select private.is_super_admin()) or private.is_tenant_member(tenant_id)
);
create policy audit_read on public.audit_logs for select to authenticated using ((select private.is_super_admin()));

create function private.handle_auth_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 insert into public.users(auth_user_id,email) values(new.id,coalesce(new.email,''));
 return new;
end;
$$;
revoke all on function private.handle_auth_user() from public;
create trigger businesscare_auth_user_created after insert on auth.users for each row execute function private.handle_auth_user();
-- Existing Auth accounts receive no elevated role.
insert into public.users(auth_user_id,email) select id,coalesce(email,'') from auth.users on conflict(auth_user_id) do nothing;

create function private.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at=now(); return new; end;
$$;
revoke all on function private.touch_updated_at() from public;
create trigger users_updated before update on public.users for each row execute function private.touch_updated_at();
create trigger tenants_updated before update on public.tenants for each row execute function private.touch_updated_at();
