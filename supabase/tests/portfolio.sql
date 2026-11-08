-- Portfolio foundation: provisioning from a template, site-kind isolation of commerce
-- and section types, plan/kind pairing, entitlement gating, and publish snapshots.
create temporary table portfolio_fixture (k text primary key, id uuid not null, email text);
grant all on portfolio_fixture to authenticated;
insert into portfolio_fixture (k, id, email)
select k, gen_random_uuid(), gen_random_uuid()::text || '@example.invalid'
from unnest(array['admin', 'owner', 'outsider']) k;
insert into auth.users (id, email, email_confirmed_at) select id, email, now() from portfolio_fixture;
update public.users set platform_role = 'SUPER_ADMIN'
where auth_user_id = (select id from portfolio_fixture where k = 'admin');

-- Super Admin provisions one portfolio and one store.
select set_config('request.jwt.claim.sub', (select id::text from portfolio_fixture where k = 'admin'), true);
set local role authenticated;
insert into portfolio_fixture (k, id)
select 'portfolio', public.provision_portfolio_tenant(
  'Ada Lovelace', 'ada-' || gen_random_uuid()::text, 'Ada',
  (select email from portfolio_fixture where k = 'owner'), 'developer');
insert into portfolio_fixture (k, id)
select 'store', public.provision_tenant(
  'Fixture Store', 'store-' || gen_random_uuid()::text, 'Store Owner',
  'store-owner-' || gen_random_uuid()::text || '@example.invalid', 'general', 'starter', 'bank_transfer');
insert into portfolio_fixture (k, id)
select 'invite', id from public.tenant_invitations
where tenant_id = (select id from portfolio_fixture where k = 'portfolio');

do $$
declare portfolio uuid := (select id from portfolio_fixture where k = 'portfolio');
declare store uuid := (select id from portfolio_fixture where k = 'store');
declare section_types text[];
begin
  if (select site_kind from public.tenants where id = portfolio) <> 'PORTFOLIO' then
    raise exception 'Portfolio tenant has the wrong site kind';
  end if;
  if (select site_kind from public.tenants where id = store) <> 'STORE' then
    raise exception 'Store provisioning changed site kind';
  end if;
  if (select p.slug from public.tenants t join public.plans p on p.id = t.plan_id where t.id = portfolio) <> 'portfolio' then
    raise exception 'Portfolio was not placed on the portfolio plan';
  end if;
  if (select tokens->>'styleKey' from public.tenant_theme_settings where tenant_id = portfolio) <> 'professional-modern' then
    raise exception 'Template theme tokens were not applied';
  end if;
  select array_agg(c.block_type order by c.sort_order) into section_types
  from public.content_blocks c join public.pages p on p.id = c.page_id
  where c.tenant_id = portfolio and p.page_type = 'HOME';
  if section_types <> array['hero','about','skills','projects','experience','contact'] then
    raise exception 'Template sections were not seeded in order: %', section_types;
  end if;
  if (select c.content->>'headline' from public.content_blocks c where c.tenant_id = portfolio and c.block_key = 'hero') <> 'Ada Lovelace' then
    raise exception 'Hero headline was not personalised';
  end if;
  if exists (select 1 from public.content_blocks where tenant_id = portfolio and block_type = 'products') then
    raise exception 'Portfolio received a products section';
  end if;

  -- Templates and plans are validated against site kind.
  begin
    perform public.provision_portfolio_tenant('Bad', 'bad-' || gen_random_uuid()::text, 'Owner', 'a@example.invalid', 'fashion');
    raise exception 'Store template accepted for a portfolio';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.provision_portfolio_tenant('Bad', 'bad-' || gen_random_uuid()::text, 'Owner', 'a@example.invalid', 'missing-template');
    raise exception 'Unknown portfolio template accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.provision_tenant('Bad', 'bad-' || gen_random_uuid()::text, 'Owner', 'a@example.invalid', 'general', 'portfolio', 'bank_transfer');
    raise exception 'Store placed on the portfolio plan';
  exception when invalid_parameter_value then null; end;
end $$;
reset role;

-- Non-admins cannot provision portfolios.
select set_config('request.jwt.claim.sub', (select id::text from portfolio_fixture where k = 'outsider'), true);
set local role authenticated;
do $$ begin
  begin
    perform public.provision_portfolio_tenant('Nope', 'nope-' || gen_random_uuid()::text, 'Owner', 'a@example.invalid', 'developer');
    raise exception 'Non-admin portfolio provisioning allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- The portfolio owner accepts, cannot create commerce records, and can reorder and publish.
select set_config('request.jwt.claim.sub', (select id::text from portfolio_fixture where k = 'owner'), true);
set local role authenticated;
select public.accept_tenant_invitation((select id from portfolio_fixture where k = 'invite'));
do $$
declare portfolio uuid := (select id from portfolio_fixture where k = 'portfolio');
declare published jsonb;
begin
  begin
    perform public.save_category(portfolio, null, 'Shirts', 'shirts', '', 'ACTIVE');
    raise exception 'Portfolio created a store category';
  exception when insufficient_privilege then null; end;

  perform public.reorder_homepage_sections(portfolio,
    array['hero','projects','about','skills','experience','contact']);
  perform public.publish_site(portfolio);
  select configuration into published from public.tenant_site_versions
  where tenant_id = portfolio and status = 'PUBLISHED';
  if published->>'siteKind' <> 'PORTFOLIO' then
    raise exception 'Published snapshot is missing its site kind';
  end if;
  if published#>>'{sections,1,type}' <> 'projects' then
    raise exception 'Published snapshot ignored the section order';
  end if;
  if public.get_public_storefront((select slug from public.tenants where id = portfolio))#>>'{tenant,siteKind}' <> 'PORTFOLIO' then
    raise exception 'Public storefront does not expose the site kind';
  end if;
end $$;
reset role;

-- Database-level boundaries hold even for direct writes.
do $$
declare portfolio uuid := (select id from portfolio_fixture where k = 'portfolio');
declare store uuid := (select id from portfolio_fixture where k = 'store');
declare store_home uuid := (select id from public.pages where tenant_id = store and slug = 'home');
declare portfolio_home uuid := (select id from public.pages where tenant_id = portfolio and slug = 'home');
begin
  begin
    insert into public.content_blocks (tenant_id, page_id, block_key, block_type, content)
    values (store, store_home, 'about', 'about', '{}');
    raise exception 'Store accepted a portfolio-only section';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.content_blocks (tenant_id, page_id, block_key, block_type, content)
    values (portfolio, portfolio_home, 'products', 'products', '{}');
    raise exception 'Portfolio accepted a products section';
  exception when insufficient_privilege then null; end;
  begin
    update public.tenants set site_kind = 'STORE' where id = portfolio;
    raise exception 'Site kind changed after provisioning';
  exception when invalid_parameter_value then null; end;
  begin
    update public.tenants set plan_id = (select id from public.plans where slug = 'growth') where id = portfolio;
    raise exception 'Portfolio moved onto a store plan';
  exception when invalid_parameter_value then null; end;
end $$;

-- A global pause blocks new portfolios and publishing.
insert into public.feature_global_state (feature_key, enabled, reason, updated_by)
values ('portfolio_sites', false, 'portfolio suite',
  (select u.id from public.users u where u.auth_user_id = (select id from portfolio_fixture where k = 'admin')))
on conflict (feature_key) do update set enabled = false;
select set_config('request.jwt.claim.sub', (select id::text from portfolio_fixture where k = 'admin'), true);
set local role authenticated;
do $$ begin
  begin
    perform public.provision_portfolio_tenant('Paused', 'paused-' || gen_random_uuid()::text, 'Owner', 'a@example.invalid', 'resume');
    raise exception 'Paused feature still provisioned a portfolio';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', (select id::text from portfolio_fixture where k = 'owner'), true);
set local role authenticated;
do $$ begin
  begin
    perform public.publish_site((select id from portfolio_fixture where k = 'portfolio'));
    raise exception 'Paused feature still published a portfolio';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
