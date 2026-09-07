-- Atomic tenant onboarding, draft configuration, and invitation acceptance.
create table public.plans (
 id uuid primary key default gen_random_uuid(), slug text not null unique,
 name text not null, is_active boolean not null default true
);
insert into public.plans(slug,name) values ('starter','Starter'),('growth','Growth'),('pro','Pro');
alter table public.plans enable row level security;
revoke all on public.plans from anon,authenticated;
grant select on public.plans to authenticated;
create policy plans_read on public.plans for select to authenticated using (true);
create table public.features (key text primary key, default_value jsonb not null);
create table public.plan_features (plan_id uuid references public.plans(id),feature_key text references public.features(key),value jsonb not null,primary key(plan_id,feature_key));
alter table public.features enable row level security;
alter table public.plan_features enable row level security;
revoke all on public.features,public.plan_features from anon,authenticated;
grant select on public.features,public.plan_features to authenticated;
create policy features_read on public.features for select to authenticated using (true);
create policy plan_features_read on public.plan_features for select to authenticated using (true);
insert into public.features values ('custom_domain','false'),('sms_notifications','false'),('product_limit','50'),('staff_limit','1');
insert into public.plan_features select p.id,f.key,case
 when f.key in ('custom_domain','sms_notifications') then to_jsonb(p.slug<>'starter')
 when f.key='product_limit' then case p.slug when 'starter' then '50'::jsonb when 'growth' then '500'::jsonb else 'null'::jsonb end
 else to_jsonb(case p.slug when 'starter' then 1 when 'growth' then 5 else 20 end) end
 from public.plans p cross join public.features f;
alter table public.tenants add column plan_id uuid references public.plans(id),
 add column template_key text not null default 'general',
 add column industry_key text not null default 'general',
 add column previous_status text;
create table public.tenant_invitations (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null unique references public.tenants(id),
 owner_name text not null, email text not null, status text not null default 'PENDING' check(status in ('PENDING','ACCEPTED')),
 accepted_by uuid references public.users(id), created_at timestamptz not null default now(),accepted_at timestamptz
);
create table public.tenant_business_settings(tenant_id uuid primary key references public.tenants(id),business_name text not null,contact_email text not null);
create table public.tenant_theme_settings(tenant_id uuid primary key references public.tenants(id),preset_key text not null,tokens jsonb not null);
create table public.tenant_layout_settings(tenant_id uuid primary key references public.tenants(id),sections jsonb not null default '["hero","products"]');
create table public.pages(id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),slug text not null,name text not null,status text not null default 'DRAFT' check(status in ('DRAFT','PUBLISHED')),unique(tenant_id,slug),unique(tenant_id,id));
create table public.content_blocks(id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),page_id uuid not null,block_key text not null,content jsonb not null,foreign key(tenant_id,page_id) references public.pages(tenant_id,id),unique(tenant_id,page_id,block_key));
create table public.navigation_items(id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),label text not null,target text not null,sort_order integer not null);
create table public.tenant_seo_settings(tenant_id uuid primary key references public.tenants(id),site_title text not null,description text not null default '',robots_index_enabled boolean not null default false);
create table public.tenant_email_settings(tenant_id uuid primary key references public.tenants(id),enabled boolean not null default false);
create table public.tenant_sms_settings(tenant_id uuid primary key references public.tenants(id),enabled boolean not null default false);
create table public.tenant_checkout_settings(tenant_id uuid primary key references public.tenants(id),payment_setup_mode text not null check(payment_setup_mode in ('bank_transfer','paystack')),payment_configured boolean not null default false);
create table public.subscriptions(id uuid primary key default gen_random_uuid(),tenant_id uuid not null unique references public.tenants(id),plan_id uuid not null references public.plans(id),status text not null default 'TRIAL',created_at timestamptz not null default now());
-- A reserved slug is not a working domain; DNS/TLS validation is a later phase.
create table public.tenant_domains(id uuid primary key default gen_random_uuid(),tenant_id uuid not null unique references public.tenants(id),platform_slug text not null unique,status text not null default 'NOT_CONFIGURED');
create table public.tenant_onboarding(tenant_id uuid primary key references public.tenants(id),business_profile_completed boolean not null default true,owner_accepted boolean not null default false,theme_selected boolean not null default true,homepage_configured boolean not null default false,products_added boolean not null default false,payment_configured boolean not null default false,store_published boolean not null default false);

do $$ declare table_name text; begin
 foreach table_name in array array['tenant_invitations','tenant_business_settings','tenant_theme_settings','tenant_layout_settings','pages','content_blocks','navigation_items','tenant_seo_settings','tenant_email_settings','tenant_sms_settings','tenant_checkout_settings','subscriptions','tenant_domains','tenant_onboarding'] loop
 execute format('alter table public.%I enable row level security',table_name);
 execute format('revoke all on public.%I from anon,authenticated',table_name);
 execute format('grant select on public.%I to authenticated',table_name);
 execute format('create policy tenant_read on public.%I for select to authenticated using ((select private.is_super_admin()) or private.is_tenant_member(tenant_id))',table_name);
 end loop;
end $$;

create function public.provision_tenant(business_name text,business_slug text,owner_name text,owner_email text,template text,plan_slug text,payment_mode text) returns uuid
language plpgsql security definer set search_path='' as $$
declare tenant uuid; plan uuid; page uuid; actor uuid; palette jsonb;
begin
 if not private.is_super_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if business_name is null or length(trim(business_name)) not between 1 and 160 or business_slug is null or length(business_slug) not between 3 and 63 or business_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or business_slug in ('www','app','admin','api','auth','login','support','mail','setup','businesses') then raise exception 'INVALID_BUSINESS' using errcode='22023'; end if;
 if owner_name is null or length(trim(owner_name)) not between 1 and 120 or owner_email is null or length(owner_email)>254 or owner_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'INVALID_OWNER' using errcode='22023'; end if;
 if template is null or template not in ('fashion','beauty','restaurant','general') or payment_mode is null or payment_mode not in ('bank_transfer','paystack') then raise exception 'INVALID_SETTINGS' using errcode='22023'; end if;
 select id into plan from public.plans where slug=plan_slug and is_active;
 if plan is null then raise exception 'INVALID_PLAN' using errcode='22023'; end if;
 select id into actor from public.users where auth_user_id=auth.uid();
 palette:=case template when 'fashion' then '{"primary":"#242630","background":"#faf9f6"}'::jsonb when 'beauty' then '{"primary":"#b86885","background":"#fff7fa"}'::jsonb when 'restaurant' then '{"primary":"#ad6839","background":"#211e1b"}'::jsonb else '{"primary":"#6655d7","background":"#ffffff"}'::jsonb end;
 insert into public.tenants(name,slug,status,plan_id,template_key,industry_key) values(trim(business_name),business_slug,'PROVISIONING',plan,template,template) returning id into tenant;
 insert into public.tenant_invitations(tenant_id,owner_name,email) values(tenant,trim(owner_name),lower(trim(owner_email)));
 insert into public.tenant_business_settings values(tenant,trim(business_name),lower(trim(owner_email)));
 insert into public.tenant_theme_settings values(tenant,template,palette);
 insert into public.tenant_layout_settings(tenant_id) values(tenant);
 insert into public.pages(tenant_id,slug,name) values(tenant,'home','Home') returning id into page;
 insert into public.content_blocks(tenant_id,page_id,block_key,content) values(tenant,page,'hero',jsonb_build_object('headline',trim(business_name),'description','Welcome to our store.'));
 insert into public.navigation_items(tenant_id,label,target,sort_order) values(tenant,'Home','/',0);
 insert into public.tenant_seo_settings(tenant_id,site_title) values(tenant,trim(business_name));
 insert into public.tenant_email_settings(tenant_id) values(tenant);
 insert into public.tenant_sms_settings(tenant_id) values(tenant);
 insert into public.tenant_checkout_settings(tenant_id,payment_setup_mode) values(tenant,payment_mode);
 insert into public.subscriptions(tenant_id,plan_id) values(tenant,plan);
 insert into public.tenant_domains(tenant_id,platform_slug) values(tenant,business_slug);
 insert into public.tenant_onboarding(tenant_id) values(tenant);
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id) values(tenant,actor,'TENANT_CREATED','tenants',tenant);
 return tenant;
end $$;
revoke all on function public.provision_tenant(text,text,text,text,text,text,text) from public,anon;
grant execute on function public.provision_tenant(text,text,text,text,text,text,text) to authenticated;

create function public.accept_tenant_invitation(invitation_id uuid) returns text
language plpgsql security definer set search_path='' as $$
declare invitation public.tenant_invitations; actor uuid; verified_email text; tenant_slug text;
begin
 select u.id,lower(a.email) into actor,verified_email from public.users u join auth.users a on a.id=u.auth_user_id where a.id=auth.uid() and a.email_confirmed_at is not null and u.status='ACTIVE';
 if actor is null then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select * into invitation from public.tenant_invitations where id=invitation_id for update;
 if invitation.id is null or invitation.email<>verified_email then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select slug into tenant_slug from public.tenants where id=invitation.tenant_id and status in ('PROVISIONING','TRIAL','ACTIVE') for update;
 if tenant_slug is null then raise exception 'TENANT_UNAVAILABLE' using errcode='42501'; end if;
 if invitation.status='ACCEPTED' then
  if invitation.accepted_by<>actor or not private.is_tenant_member(invitation.tenant_id) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  return tenant_slug;
 end if;
 insert into public.tenant_memberships(tenant_id,user_id,role) values(invitation.tenant_id,actor,'TENANT_OWNER');
 update public.tenant_invitations set status='ACCEPTED',accepted_by=actor,accepted_at=now() where id=invitation.id;
 update public.tenant_onboarding set owner_accepted=true where tenant_id=invitation.tenant_id;
 update public.tenants set status='TRIAL' where id=invitation.tenant_id and status='PROVISIONING';
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id) values(invitation.tenant_id,actor,'OWNER_INVITATION_ACCEPTED','tenant_invitations',invitation.id);
 return tenant_slug;
end $$;
revoke all on function public.accept_tenant_invitation(uuid) from public,anon;
grant execute on function public.accept_tenant_invitation(uuid) to authenticated;

create function public.set_tenant_suspended(target uuid,suspended boolean) returns void
language plpgsql security definer set search_path='' as $$
declare current_status text; actor uuid;
begin
 if not private.is_super_admin() or suspended is null then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select status into current_status from public.tenants where id=target for update;
 if current_status is null then raise exception 'TENANT_NOT_FOUND'; end if;
 select id into actor from public.users where auth_user_id=auth.uid();
 if suspended and current_status in ('PROVISIONING','TRIAL','ACTIVE','PAST_DUE') then
  update public.tenants set previous_status=status,status='SUSPENDED' where id=target;
 elsif not suspended and current_status='SUSPENDED' then
  update public.tenants set status=coalesce(previous_status,'PROVISIONING'),previous_status=null where id=target;
 else return;
 end if;
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id) values(target,actor,case when suspended then 'TENANT_SUSPENDED' else 'TENANT_REACTIVATED' end,'tenants',target);
end $$;
revoke all on function public.set_tenant_suspended(uuid,boolean) from public,anon;
grant execute on function public.set_tenant_suspended(uuid,boolean) to authenticated;

create function public.record_invitation_link(invitation_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare target uuid; actor uuid;
begin
 if not private.is_super_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select tenant_id into target from public.tenant_invitations where id=invitation_id and status='PENDING';
 if target is null then raise exception 'INVITATION_UNAVAILABLE'; end if;
 select id into actor from public.users where auth_user_id=auth.uid();
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id) values(target,actor,'OWNER_INVITATION_LINK_GENERATED','tenant_invitations',invitation_id);
end $$;
revoke all on function public.record_invitation_link(uuid) from public,anon;
grant execute on function public.record_invitation_link(uuid) to authenticated;

create index navigation_items_tenant_idx on public.navigation_items(tenant_id,sort_order);
create function private.sync_auth_email() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.users set email=coalesce(new.email,'') where auth_user_id=new.id;
 return new;
end $$;
revoke all on function private.sync_auth_email() from public;
create trigger businesscare_auth_email_updated after update of email on auth.users for each row execute function private.sync_auth_email();
