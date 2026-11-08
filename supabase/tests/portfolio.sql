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
  if (select tokens->>'templateStyle' from public.tenant_theme_settings where tenant_id = portfolio) <> 'pf-terminal' then
    raise exception 'Template style was not applied';
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
declare remaining_detail text;
declare project uuid;
declare hidden_item uuid;
declare delete_me uuid;
begin
  begin
    perform public.save_category(portfolio, null, 'Shirts', 'shirts', '', 'ACTIVE');
    raise exception 'Portfolio created a store category';
  exception when insufficient_privilege then null; end;

  perform public.reorder_homepage_sections(portfolio,
    array['hero','projects','about','skills','experience','contact']);

  -- Example content blocks publishing, and the refusal lists what is left.
  begin
    perform public.publish_site(portfolio);
    raise exception 'Published with example content';
  exception when invalid_parameter_value then
    get stacked diagnostics remaining_detail = pg_exception_detail;
    if remaining_detail not like '%"hero"%' or remaining_detail not like '%Community events app%' then
      raise exception 'Publish refusal did not list remaining examples: %', remaining_detail;
    end if;
  end;

  -- Editing one example field is not enough; every example field must change.
  select id into project from public.portfolio_items
  where tenant_id = portfolio and title = 'Payments reconciliation API';
  perform public.save_portfolio_item(portfolio, project, jsonb_build_object(
    'title', 'Ledger sync service', 'summary', 'Matches bank transfers to invoices automatically for a growing online store.',
    'tags', jsonb_build_array('Go')));
  if not (select is_sample from public.portfolio_items where id = project) then
    raise exception 'Partly edited example entry was treated as finished';
  end if;
  perform public.save_portfolio_item(portfolio, project, jsonb_build_object(
    'title', 'Ledger sync service', 'summary', 'Reconciles payouts nightly.', 'role', 'Sole engineer.',
    'linkUrl', 'https://ledger.example.org', 'tags', jsonb_build_array('Go')));
  if (select is_sample from public.portfolio_items where id = project) then
    raise exception 'Fully edited example entry is still marked as an example';
  end if;

  -- Validation rejects unsafe links and unknown layouts.
  begin
    perform public.save_portfolio_item(portfolio, project, jsonb_build_object('title', 'X', 'linkUrl', 'javascript:alert(1)'));
    raise exception 'Unsafe link accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.save_portfolio_section(portfolio, 'projects', '{"heading":"Work"}', 'carousel', null);
    raise exception 'Unknown layout accepted';
  exception when invalid_parameter_value then null; end;

  -- Clear the remaining examples: edit sections, delete or hide entries, edit skills.
  perform public.save_portfolio_section(portfolio, 'hero',
    '{"eyebrow":"Backend engineer","headline":"Ada Lovelace","subheadline":"I build payment systems.","primaryCta":{"label":"Email me","href":"#contact"}}',
    'split', null);
  perform public.save_portfolio_section(portfolio, 'about', '{"heading":"About","body":"Ten years of shipping."}', null, null);
  perform public.save_portfolio_section(portfolio, 'contact', '{"heading":"Contact","body":"Email is best."}', null, null);
  hidden_item := (select id from public.portfolio_items where tenant_id = portfolio and title = 'Community events app');
  perform public.save_portfolio_item(portfolio, hidden_item, jsonb_build_object(
    'title', 'Community events app', 'summary', 'Lets neighbourhood groups publish events and take RSVPs from their phones.', 'status', 'HIDDEN'));
  delete_me := (select id from public.portfolio_items where tenant_id = portfolio and title = 'Open-source form library');
  perform public.delete_portfolio_item(portfolio, delete_me);
  begin
    update public.portfolio_items set is_sample = false where tenant_id = portfolio;
    raise exception 'Owner bypassed the example lock with a direct write';
  exception when insufficient_privilege then null; end;
  for project in select id from public.portfolio_items where tenant_id = portfolio and is_sample and status = 'ACTIVE' loop
    perform public.delete_portfolio_item(portfolio, project);
  end loop;

  -- Adding, removing, and reordering parts and entries.
  if public.add_portfolio_section(portfolio, 'education') <> 'education' then
    raise exception 'Added section has an unexpected key';
  end if;
  perform public.remove_portfolio_section(portfolio, 'education');
  begin
    perform public.remove_portfolio_section(portfolio, 'hero');
    raise exception 'Hero section was removed';
  exception when invalid_parameter_value then null; end;
  perform public.save_portfolio_item(portfolio, null, '{"itemType":"PROJECT","title":"Second project","summary":"New."}');
  perform public.reorder_portfolio_items(portfolio, 'PROJECT', array(
    select id from public.portfolio_items where tenant_id = portfolio and item_type = 'PROJECT' order by sort_order desc));
  begin
    perform public.reorder_portfolio_items(portfolio, 'PROJECT', array[gen_random_uuid()]);
    raise exception 'Reorder accepted an unknown entry';
  exception when invalid_parameter_value then null; end;

  perform public.publish_site(portfolio);
  select configuration into published from public.tenant_site_versions
  where tenant_id = portfolio and status = 'PUBLISHED';
  if published->>'siteKind' <> 'PORTFOLIO' then
    raise exception 'Published snapshot is missing its site kind';
  end if;
  if published#>>'{sections,1,type}' <> 'projects' then
    raise exception 'Published snapshot ignored the section order';
  end if;
  if jsonb_path_exists(published, '$.portfolioItems[*] ? (@.title == "Community events app")') then
    raise exception 'Hidden entry was published';
  end if;
  if not jsonb_path_exists(published, '$.portfolioItems[*] ? (@.title == "Ledger sync service")') then
    raise exception 'Edited entry is missing from the published snapshot';
  end if;
  if published#>>'{sections,0,variant}' <> 'split' then
    raise exception 'Section layout change was not published';
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

-- Photos: tenant-scoped storage keys, replace/remove cleanup, and live-page safety.
select set_config('request.jwt.claim.sub', (select id::text from portfolio_fixture where k = 'owner'), true);
set local role authenticated;
do $$
declare portfolio uuid := (select id from portfolio_fixture where k = 'portfolio');
declare project uuid;
declare result jsonb;
declare folder text := 'businesscare/tenants/' || (select id from portfolio_fixture where k = 'portfolio')::text || '/portfolio/';
begin
  select id into project from public.portfolio_items where tenant_id = portfolio and item_type = 'PROJECT' limit 1;
  begin
    perform public.set_portfolio_photo(portfolio, 'cover', project::text, jsonb_build_object(
      'storageKey', 'businesscare/tenants/' || gen_random_uuid()::text || '/x', 'publicUrl', 'https://res.cloudinary.com/x.jpg',
      'mimeType', 'image/jpeg', 'fileSize', 1000), 'Someone else''s file', false);
    raise exception 'Accepted another tenant''s file';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.set_portfolio_photo(portfolio, 'cover', project::text, jsonb_build_object(
      'storageKey', folder || 'big', 'publicUrl', 'https://res.cloudinary.com/big.jpg',
      'mimeType', 'image/jpeg', 'fileSize', 9000000), '', false);
    raise exception 'Accepted an oversized file';
  exception when invalid_parameter_value then null; end;

  result := public.set_portfolio_photo(portfolio, 'cover', project::text, jsonb_build_object(
    'storageKey', folder || 'a', 'publicUrl', 'https://res.cloudinary.com/a.jpg', 'mimeType', 'image/jpeg', 'fileSize', 1000),
    'First cover', false);
  if result <> '{}'::jsonb then raise exception 'First photo reported a replacement'; end if;
  result := public.set_portfolio_photo(portfolio, 'cover', project::text, null, 'Better description', false);
  if (select a.alt_text from public.portfolio_items i join public.media_assets a on a.id = i.cover_asset_id where i.id = project) <> 'Better description' then
    raise exception 'Description-only change was not saved';
  end if;
  result := public.set_portfolio_photo(portfolio, 'cover', project::text, jsonb_build_object(
    'storageKey', folder || 'b', 'publicUrl', 'https://res.cloudinary.com/b.jpg', 'mimeType', 'image/webp', 'fileSize', 1000),
    'Second cover', false);
  if result ->> 'storageKey' <> folder || 'a' then raise exception 'Replaced photo was not reported for cleanup: %', result; end if;

  result := public.set_portfolio_photo(portfolio, 'about', 'about', jsonb_build_object(
    'storageKey', folder || 'c', 'publicUrl', 'https://res.cloudinary.com/c.jpg', 'mimeType', 'image/png', 'fileSize', 1000),
    'Portrait', false);
  if (select settings #>> '{photo,url}' from public.content_blocks where tenant_id = portfolio and block_key = 'about') <> 'https://res.cloudinary.com/c.jpg' then
    raise exception 'About photo was not placed';
  end if;
end $$;
reset role;

-- A photo shown on the live page is kept when replaced, so visitors never see a broken image.
update public.tenant_site_versions set configuration = configuration || '{"probe":"https://res.cloudinary.com/b.jpg"}'
where tenant_id = (select id from portfolio_fixture where k = 'portfolio') and status = 'PUBLISHED';
select set_config('request.jwt.claim.sub', (select id::text from portfolio_fixture where k = 'owner'), true);
set local role authenticated;
do $$
declare portfolio uuid := (select id from portfolio_fixture where k = 'portfolio');
declare project uuid := (select cover_ref.id from public.portfolio_items cover_ref
  where cover_ref.tenant_id = (select id from portfolio_fixture where k = 'portfolio') and cover_ref.cover_asset_id is not null limit 1);
begin
  if public.set_portfolio_photo(portfolio, 'cover', project::text, null, '', true) <> '{}'::jsonb then
    raise exception 'A photo used by the live page was deleted';
  end if;
end $$;
reset role;

-- Looks and colours: switching keeps content, and unreadable colours are refused.
do $$ begin
  if round(private.color_contrast('#000000', '#ffffff')::numeric) <> 21 then
    raise exception 'Contrast maths is wrong';
  end if;
end $$;
select set_config('request.jwt.claim.sub', (select id::text from portfolio_fixture where k = 'owner'), true);
set local role authenticated;
do $$
declare portfolio uuid := (select id from portfolio_fixture where k = 'portfolio');
declare before_parts integer := (select count(*) from public.content_blocks where tenant_id = (select id from portfolio_fixture where k = 'portfolio'));
begin
  begin
    perform public.save_portfolio_look(portfolio, 'pf-darkroom',
      '{"background":"#777777","text":"#888888","primary":"#c9a46a","accent":"#c9a46a","secondary":"#8f8577"}');
    raise exception 'Unreadable colours accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.save_portfolio_look(portfolio, 'pf-not-a-look',
      '{"background":"#ffffff","text":"#111111","primary":"#111111","accent":"#111111","secondary":"#555555"}');
    raise exception 'Unknown look accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.save_portfolio_look(portfolio, 'pf-darkroom',
      '{"background":"red","text":"#111111","primary":"#111111","accent":"#111111","secondary":"#555555"}');
    raise exception 'Non-hex colour accepted';
  exception when invalid_parameter_value then null; end;
  perform public.save_portfolio_look(portfolio, 'pf-darkroom',
    '{"background":"#121110","text":"#F2EDE4","primary":"#c9a46a","accent":"#c9a46a","secondary":"#8f8577"}');
  if (select tokens ->> 'templateStyle' from public.tenant_theme_settings where tenant_id = portfolio) <> 'pf-darkroom'
    or (select tokens ->> 'text' from public.tenant_theme_settings where tenant_id = portfolio) <> '#f2ede4' then
    raise exception 'Look and colours were not saved';
  end if;
  if (select count(*) from public.content_blocks where tenant_id = portfolio) <> before_parts then
    raise exception 'Switching look changed the page parts';
  end if;
end $$;
reset role;

-- Guided start: answers saved together; email required; WhatsApp optional and checked.
select set_config('request.jwt.claim.sub', (select id::text from portfolio_fixture where k = 'owner'), true);
set local role authenticated;
do $$
declare portfolio uuid := (select id from portfolio_fixture where k = 'portfolio');
declare look jsonb := '{"background":"#ffffff","text":"#1d2733","primary":"#1f3a64","accent":"#9a6416","secondary":"#5b6b82"}';
begin
  if (select portfolio_setup_completed from public.tenant_onboarding where tenant_id = portfolio) then
    raise exception 'Guided start was marked done before it ran';
  end if;
  begin
    perform public.complete_portfolio_setup(portfolio, jsonb_build_object(
      'name', 'Ada Lovelace', 'role', 'Engineer', 'email', 'not-an-email', 'style', 'pf-one-page', 'palette', look));
    raise exception 'Invalid email accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.complete_portfolio_setup(portfolio, jsonb_build_object(
      'name', 'Ada Lovelace', 'email', 'ada@example.org', 'whatsapp', 'call me', 'style', 'pf-one-page', 'palette', look));
    raise exception 'Invalid WhatsApp number accepted';
  exception when invalid_parameter_value then null; end;
  perform public.complete_portfolio_setup(portfolio, jsonb_build_object(
    'name', 'Ada Lovelace', 'role', 'Backend engineer', 'email', 'Ada@Example.org', 'whatsapp', '',
    'style', 'pf-one-page', 'palette', look));
  if (select contact_email from public.tenant_business_settings where tenant_id = portfolio) <> 'ada@example.org'
    or (select content ->> 'eyebrow' from public.content_blocks where tenant_id = portfolio and block_type = 'hero') <> 'Backend engineer'
    or (select tokens ->> 'templateStyle' from public.tenant_theme_settings where tenant_id = portfolio) <> 'pf-one-page'
    or not (select portfolio_setup_completed from public.tenant_onboarding where tenant_id = portfolio) then
    raise exception 'Guided start answers were not all saved';
  end if;
end $$;
reset role;
