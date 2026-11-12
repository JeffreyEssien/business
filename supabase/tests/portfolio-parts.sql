-- Portfolio phase 3: library templates provision with their new parts, Super Admin
-- template on/off, allow-listed players, button links, and the wider entry kinds.
create temporary table parts_fixture (k text primary key, id uuid not null, email text);
grant all on parts_fixture to authenticated;
insert into parts_fixture (k, id, email)
select k, gen_random_uuid(), gen_random_uuid()::text || '@example.invalid'
from unnest(array['admin', 'owner', 'outsider']) k;
insert into auth.users (id, email, email_confirmed_at) select id, email, now() from parts_fixture;
update public.users set platform_role = 'SUPER_ADMIN'
where auth_user_id = (select id from parts_fixture where k = 'admin');

-- Super Admin provisions a portfolio from a phase-3 template.
select set_config('request.jwt.claim.sub', (select id::text from parts_fixture where k = 'admin'), true);
set local role authenticated;
insert into parts_fixture (k, id)
select 'portfolio', public.provision_portfolio_tenant(
  'The Lagos Strings', 'strings-' || gen_random_uuid()::text, 'Lead',
  (select email from parts_fixture where k = 'owner'), 'musician-epk');
insert into parts_fixture (k, id)
select 'invite', id from public.tenant_invitations
where tenant_id = (select id from parts_fixture where k = 'portfolio');

do $$
declare portfolio uuid := (select id from parts_fixture where k = 'portfolio');
declare active_keys text[];
declare template text;
declare refused boolean := false;
begin
  if (select count(*) from public.site_templates where site_kind = 'PORTFOLIO') <> 24 then
    raise exception 'The template library does not have 24 portfolio templates';
  end if;
  if (select tokens->>'templateStyle' from public.tenant_theme_settings where tenant_id = portfolio) <> 'pf-press-kit' then
    raise exception 'Library template style was not applied';
  end if;
  if not exists (select 1 from public.content_blocks where tenant_id = portfolio and block_type = 'bios') then
    raise exception 'Library template parts were not seeded';
  end if;

  -- Hiding a template removes it from the public list and is audited.
  perform public.set_site_template_active('artist', false);
  if 'artist' = any (public.list_active_portfolio_templates()) then
    raise exception 'A hidden template is still listed';
  end if;
  if not exists (select 1 from public.audit_logs where action = 'SITE_TEMPLATE_DISABLED'
      and context ->> 'templateKey' = 'artist') then
    raise exception 'Hiding a template was not audited';
  end if;
  perform public.set_site_template_active('artist', true);

  -- The last offered template can never be hidden.
  active_keys := public.list_active_portfolio_templates();
  foreach template in array active_keys loop
    begin
      perform public.set_site_template_active(template, false);
    exception when others then
      if sqlerrm not like '%LAST_TEMPLATE%' then raise; end if;
      refused := true;
    end;
  end loop;
  if not refused or cardinality(public.list_active_portfolio_templates()) <> 1 then
    raise exception 'The last template could be hidden';
  end if;
  foreach template in array active_keys loop
    perform public.set_site_template_active(template, true);
  end loop;
end $$;
reset role;

-- Only Super Admin may switch templates; anyone may read which are offered.
select set_config('request.jwt.claim.sub', (select id::text from parts_fixture where k = 'outsider'), true);
set local role authenticated;
do $$ begin
  begin
    perform public.set_site_template_active('artist', false);
    raise exception 'Non-admin switched a template off';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
  if cardinality(public.list_active_portfolio_templates()) <> 24 then
    raise exception 'Visitors cannot read the offered templates';
  end if;
end $$;
reset role;

-- The owner edits the new parts and entry kinds.
select set_config('request.jwt.claim.sub', (select id::text from parts_fixture where k = 'owner'), true);
set local role authenticated;
select public.accept_tenant_invitation((select id from parts_fixture where k = 'invite'));
do $$
declare portfolio uuid := (select id from parts_fixture where k = 'portfolio');
declare player text;
declare band text;
declare person uuid;
begin
  player := public.add_portfolio_section(portfolio, 'embed');
  perform public.save_portfolio_section(portfolio, player,
    '{"heading":"Listen","url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}', 'player', true);
  if (select content ->> 'url' from public.content_blocks where tenant_id = portfolio and block_key = player)
      <> 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' then
    raise exception 'An allowed player link was not saved';
  end if;
  begin
    perform public.save_portfolio_section(portfolio, player,
      '{"heading":"Listen","url":"https://evil.example/embed"}', 'player', true);
    raise exception 'A player link from an unknown site was saved';
  exception when others then
    if sqlerrm not like '%INVALID_EMBED%' then raise; end if;
  end;
  begin
    perform public.save_portfolio_section(portfolio, player,
      '{"heading":"Listen","url":"https://youtube.com/watch?v=a\"onload=x"}', 'player', true);
    raise exception 'A player link with markup was saved';
  exception when others then
    if sqlerrm not like '%INVALID_EMBED%' then raise; end if;
  end;

  band := public.add_portfolio_section(portfolio, 'cta');
  begin
    perform public.save_portfolio_section(portfolio, band,
      '{"heading":"Book us","primaryCta":{"label":"Go","href":"javascript:alert(1)"}}', 'banner', true);
    raise exception 'A script link was saved on a button';
  exception when others then
    if sqlerrm not like '%INVALID_LINK%' then raise; end if;
  end;
  perform public.save_portfolio_section(portfolio, band,
    '{"heading":"Book us","primaryCta":{"label":"Email","href":"mailto:book@example.invalid"}}', 'centered', true);

  person := public.save_portfolio_item(portfolio, null,
    '{"itemType":"PERSON","title":"Ada Obi","subtitle":"Violin"}');
  if (select item_type from public.portfolio_items where id = person) <> 'PERSON' then
    raise exception 'A person entry was not saved';
  end if;
  begin
    perform public.save_portfolio_item(portfolio, null, '{"itemType":"LINK","title":"Press photos"}');
    raise exception 'A download without a link was saved';
  exception when others then
    if sqlerrm not like '%INVALID_LINK%' then raise; end if;
  end;
  begin
    perform public.save_portfolio_item(portfolio, null, '{"itemType":"BOGUS","title":"Nope"}');
    raise exception 'An unknown entry kind was saved';
  exception when others then
    if sqlerrm like '%was saved%' then raise; end if;
  end;
end $$;
reset role;
