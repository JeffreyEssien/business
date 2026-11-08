-- Portfolio builder, phase 2 (ADR 004; docs/plans/portfolio-templates.md §6).
-- Adds portfolio entries, owner-editable page parts, example (sample) content that is
-- tracked by the database, and a publish lock that refuses example content.

-- 1. Example-content tracking -----------------------------------------------------

-- A field is still "example" while its value equals the template's example value and is
-- not empty. Values are compared as JSON so text and lists (skills) behave the same.
create function private.unedited_sample_fields(current_values jsonb, sample jsonb)
returns text[] language sql immutable set search_path = '' as $$
  select coalesce(array_agg(s.key order by s.key), '{}')
  from jsonb_each(coalesce(sample, '{}'::jsonb)) s
  where current_values -> s.key = s.value
    and s.value not in ('""'::jsonb, '[]'::jsonb, 'null'::jsonb);
$$;
revoke all on function private.unedited_sample_fields(jsonb, jsonb) from public;

alter table public.content_blocks
  add column sample_content jsonb not null default '{}'::jsonb
    check (jsonb_typeof(sample_content) = 'object'),
  add column sample_fields text[] not null default '{}';

create function private.track_block_samples() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.sample_fields := private.unedited_sample_fields(new.content, new.sample_content);
  return new;
end;
$$;
revoke all on function private.track_block_samples() from public;
create trigger content_blocks_track_samples before insert or update on public.content_blocks
for each row execute function private.track_block_samples();

-- 2. Portfolio entries -------------------------------------------------------------

create table public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  item_type text not null check (item_type in ('PROJECT', 'EXPERIENCE', 'EDUCATION', 'SKILL')),
  title text not null check (length(title) between 1 and 160),
  subtitle text not null default '' check (length(subtitle) <= 160),
  summary text not null default '' check (length(summary) <= 600),
  body text not null default '' check (length(body) <= 6000),
  role text not null default '' check (length(role) <= 300),
  outcome text not null default '' check (length(outcome) <= 300),
  link_url text check (link_url ~ '^https://[^[:space:]]+$' and length(link_url) <= 500),
  source_url text check (source_url ~ '^https://[^[:space:]]+$' and length(source_url) <= 500),
  starts_on date,
  ends_on date,
  is_current boolean not null default false,
  tags text[] not null default '{}' check (cardinality(tags) <= 20),
  cover_asset_id uuid,
  sort_order integer not null default 0 check (sort_order >= 0),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'HIDDEN')),
  sample_content jsonb not null default '{}'::jsonb check (jsonb_typeof(sample_content) = 'object'),
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, cover_asset_id) references public.media_assets (tenant_id, id),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
create index portfolio_items_tenant_type on public.portfolio_items (tenant_id, item_type, sort_order);
create trigger portfolio_items_updated before update on public.portfolio_items
for each row execute function private.touch_updated_at();

-- Entries are portfolio-only, like commerce rows are store-only.
create function private.reject_store_portfolio_items() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if private.tenant_site_kind(new.tenant_id) <> 'PORTFOLIO' then
    raise exception 'PORTFOLIO_ONLY_FEATURE' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.reject_store_portfolio_items() from public;
create trigger portfolio_items_portfolio_only before insert on public.portfolio_items
for each row execute function private.reject_store_portfolio_items();

create function private.track_item_samples() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- to_jsonb(new) exposes snake_case columns; example keys use the same names.
  new.is_sample := cardinality(private.unedited_sample_fields(to_jsonb(new), new.sample_content)) > 0;
  return new;
end;
$$;
revoke all on function private.track_item_samples() from public;
create trigger portfolio_items_track_samples before insert or update on public.portfolio_items
for each row execute function private.track_item_samples();

alter table public.portfolio_items enable row level security;
revoke all on public.portfolio_items from anon, authenticated;
grant select on public.portfolio_items to authenticated;
create policy tenant_read on public.portfolio_items for select to authenticated
  using ((select private.is_super_admin()) or private.is_tenant_member(tenant_id));

insert into public.features (key, default_value, name, description, value_type, category)
values (
  'portfolio_item_limit', 'null', 'Portfolio entries',
  'Maximum number of projects, jobs, education, and skill groups on one portfolio. A null value means unlimited.',
  'INTEGER', 'Portfolio'
);
insert into public.plan_features (plan_id, feature_key, value)
select p.id, 'portfolio_item_limit', 'null'::jsonb from public.plans p
on conflict (plan_id, feature_key) do nothing;

-- 3. Owner operations --------------------------------------------------------------

create function private.assert_portfolio_editor(target_tenant uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_manage_catalog(target_tenant) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if private.tenant_site_kind(target_tenant) is distinct from 'PORTFOLIO' then
    raise exception 'PORTFOLIO_ONLY_FEATURE' using errcode = '42501';
  end if;
end;
$$;
revoke all on function private.assert_portfolio_editor(uuid) from public;

create function private.portfolio_home_page(target_tenant uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.pages where tenant_id = target_tenant and page_type = 'HOME' limit 1;
$$;
revoke all on function private.portfolio_home_page(uuid) from public;

-- tenant_layout_settings mirrors the homepage order; keep it in step with every change.
create function private.sync_layout_settings(target_tenant uuid) returns void
language sql security definer set search_path = '' as $$
  update public.tenant_layout_settings set sections = coalesce((
    select jsonb_agg(jsonb_build_object('key', c.block_key, 'enabled', c.is_enabled,
      'variant', c.variant, 'sortOrder', c.sort_order) order by c.sort_order)
    from public.content_blocks c
    where c.tenant_id = target_tenant and c.page_id = private.portfolio_home_page(target_tenant)
  ), '[]'::jsonb) where tenant_id = target_tenant;
$$;
revoke all on function private.sync_layout_settings(uuid) from public;

create function private.clean_text(value jsonb, max_length integer) returns text
language plpgsql immutable set search_path = '' as $$
declare result text;
begin
  if value is null or value = 'null'::jsonb then return ''; end if;
  if jsonb_typeof(value) <> 'string' then raise exception 'INVALID_CONTENT' using errcode = '22023'; end if;
  result := btrim(value #>> '{}');
  if length(result) > max_length then raise exception 'INVALID_CONTENT' using errcode = '22023'; end if;
  return result;
end;
$$;
revoke all on function private.clean_text(jsonb, integer) from public;

create function private.clean_https(value jsonb) returns text
language plpgsql immutable set search_path = '' as $$
declare result text := private.clean_text(value, 500);
begin
  if result = '' then return null; end if;
  if result !~ '^https://[^[:space:]]+$' then raise exception 'INVALID_LINK' using errcode = '22023'; end if;
  return result;
end;
$$;
revoke all on function private.clean_https(jsonb) from public;

create function private.clean_date(value jsonb) returns date
language plpgsql immutable set search_path = '' as $$
declare result text := private.clean_text(value, 10);
begin
  if result = '' then return null; end if;
  if result !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'INVALID_DATE' using errcode = '22023'; end if;
  return result::date;
end;
$$;
revoke all on function private.clean_date(jsonb) from public;

-- Creates or updates one entry. The payload uses the app's camelCase field names.
create function public.save_portfolio_item(target_tenant uuid, target_item uuid, payload jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  item_id uuid := target_item;
  kind text := payload ->> 'itemType';
  entry_title text := private.clean_text(payload -> 'title', 160);
  entry_tags text[];
  existing public.portfolio_items%rowtype;
  actor uuid;
  usage bigint;
begin
  perform private.assert_portfolio_editor(target_tenant);
  if jsonb_typeof(payload) is distinct from 'object' or entry_title = '' then
    raise exception 'INVALID_CONTENT' using errcode = '22023';
  end if;
  select coalesce(array_agg(left(btrim(t), 40)) filter (where btrim(t) <> ''), '{}')
  into entry_tags from jsonb_array_elements_text(coalesce(payload -> 'tags', '[]'::jsonb)) t;
  if cardinality(entry_tags) > 20 then raise exception 'INVALID_CONTENT' using errcode = '22023'; end if;
  select id into actor from public.users where auth_user_id = auth.uid();

  if item_id is null then
    if kind not in ('PROJECT', 'EXPERIENCE', 'EDUCATION', 'SKILL') then
      raise exception 'INVALID_CONTENT' using errcode = '22023';
    end if;
    -- Serialize concurrent creation so the entry limit cannot be exceeded.
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(target_tenant::text || ':portfolio_item_limit', 0));
    select count(*) into usage from public.portfolio_items where tenant_id = target_tenant;
    perform private.assert_usage_within_limit(target_tenant, 'portfolio_item_limit', usage);
    insert into public.portfolio_items (tenant_id, item_type, title, sort_order)
    values (target_tenant, kind, entry_title, coalesce((
      select max(sort_order) + 1 from public.portfolio_items
      where tenant_id = target_tenant and item_type = kind), 0))
    returning id into item_id;
  else
    select * into existing from public.portfolio_items
    where id = item_id and tenant_id = target_tenant for update;
    if existing.id is null then raise exception 'NOT_FOUND' using errcode = '22023'; end if;
  end if;

  update public.portfolio_items set
    title = entry_title,
    subtitle = private.clean_text(payload -> 'subtitle', 160),
    summary = private.clean_text(payload -> 'summary', 600),
    body = private.clean_text(payload -> 'body', 6000),
    role = private.clean_text(payload -> 'role', 300),
    outcome = private.clean_text(payload -> 'outcome', 300),
    link_url = private.clean_https(payload -> 'linkUrl'),
    source_url = private.clean_https(payload -> 'sourceUrl'),
    starts_on = private.clean_date(payload -> 'startsOn'),
    ends_on = case when coalesce((payload ->> 'isCurrent')::boolean, false) then null
      else private.clean_date(payload -> 'endsOn') end,
    is_current = coalesce((payload ->> 'isCurrent')::boolean, false),
    tags = entry_tags,
    status = case when payload ->> 'status' = 'HIDDEN' then 'HIDDEN' else 'ACTIVE' end
  where id = item_id;
  insert into public.audit_logs (tenant_id, actor_user_id, action, resource_type, resource_id)
  values (target_tenant, actor, case when target_item is null then 'PORTFOLIO_ITEM_CREATED'
    else 'PORTFOLIO_ITEM_UPDATED' end, 'portfolio_items', item_id);
  return item_id;
end;
$$;
revoke all on function public.save_portfolio_item(uuid, uuid, jsonb) from public, anon;
grant execute on function public.save_portfolio_item(uuid, uuid, jsonb) to authenticated;

create function public.delete_portfolio_item(target_tenant uuid, target_item uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid;
begin
  perform private.assert_portfolio_editor(target_tenant);
  delete from public.portfolio_items where id = target_item and tenant_id = target_tenant;
  if not found then raise exception 'NOT_FOUND' using errcode = '22023'; end if;
  select id into actor from public.users where auth_user_id = auth.uid();
  insert into public.audit_logs (tenant_id, actor_user_id, action, resource_type, resource_id)
  values (target_tenant, actor, 'PORTFOLIO_ITEM_DELETED', 'portfolio_items', target_item);
end;
$$;
revoke all on function public.delete_portfolio_item(uuid, uuid) from public, anon;
grant execute on function public.delete_portfolio_item(uuid, uuid) to authenticated;

-- The new order must name every entry of that type exactly once.
create function public.reorder_portfolio_items(target_tenant uuid, target_type text, item_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare expected integer;
begin
  perform private.assert_portfolio_editor(target_tenant);
  select count(*) into expected from public.portfolio_items
  where tenant_id = target_tenant and item_type = target_type;
  if item_ids is null or cardinality(item_ids) <> expected
    or (select count(distinct ref) from unnest(item_ids) ref) <> expected
    or exists (select 1 from unnest(item_ids) ref where not exists (
      select 1 from public.portfolio_items i
      where i.id = ref and i.tenant_id = target_tenant and i.item_type = target_type)) then
    raise exception 'INVALID_ORDER' using errcode = '22023';
  end if;
  update public.portfolio_items i set sort_order = ordered.position - 1
  from unnest(item_ids) with ordinality ordered(ref, position)
  where i.id = ordered.ref and i.tenant_id = target_tenant;
end;
$$;
revoke all on function public.reorder_portfolio_items(uuid, text, uuid[]) from public, anon;
grant execute on function public.reorder_portfolio_items(uuid, text, uuid[]) to authenticated;

-- Page parts the owner can add, and the layouts each one offers. Hero is always present.
create function private.portfolio_section_variants(section_type text) returns text[]
language sql immutable set search_path = '' as $$
  select case section_type
    when 'hero' then array['centered', 'split', 'image-overlay']
    when 'about' then array['text', 'photo-left', 'photo-right']
    when 'projects' then array['grid', 'featured', 'masonry', 'list']
    when 'experience' then array['timeline', 'compact']
    when 'education' then array['timeline', 'compact']
    when 'skills' then array['tags', 'grouped']
    when 'contact' then array['details']
    else null end;
$$;
revoke all on function private.portfolio_section_variants(text) from public;

-- Replaces a page part's text with validated values and optionally its layout.
create function public.save_portfolio_section(
  target_tenant uuid, target_key text, payload jsonb, section_variant text, section_visible boolean
) returns void language plpgsql security definer set search_path = '' as $$
declare block public.content_blocks%rowtype; cleaned jsonb; cta_href text; actor uuid;
begin
  perform private.assert_portfolio_editor(target_tenant);
  select * into block from public.content_blocks
  where tenant_id = target_tenant and page_id = private.portfolio_home_page(target_tenant)
    and block_key = target_key for update;
  if block.id is null or private.portfolio_section_variants(block.block_type) is null then
    raise exception 'NOT_FOUND' using errcode = '22023';
  end if;
  if section_variant is not null
    and not section_variant = any (private.portfolio_section_variants(block.block_type)) then
    raise exception 'INVALID_CONTENT' using errcode = '22023';
  end if;
  if block.block_type = 'hero' then
    cta_href := private.clean_text(payload #> '{primaryCta,href}', 500);
    if cta_href <> '' and cta_href !~ '^(#[a-z0-9-]{1,48}|https://[^[:space:]]+|mailto:[^[:space:]@]+@[^[:space:]]+)$' then
      raise exception 'INVALID_LINK' using errcode = '22023';
    end if;
    cleaned := jsonb_build_object(
      'eyebrow', private.clean_text(payload -> 'eyebrow', 80),
      'headline', private.clean_text(payload -> 'headline', 120),
      'subheadline', private.clean_text(payload -> 'subheadline', 300),
      'primaryCta', jsonb_build_object(
        'label', private.clean_text(payload #> '{primaryCta,label}', 40), 'href', cta_href));
    if cleaned ->> 'headline' = '' then raise exception 'INVALID_CONTENT' using errcode = '22023'; end if;
  elsif block.block_type in ('about', 'contact') then
    cleaned := jsonb_build_object(
      'heading', private.clean_text(payload -> 'heading', 80),
      'body', private.clean_text(payload -> 'body', 3000));
  else
    cleaned := jsonb_build_object(
      'heading', private.clean_text(payload -> 'heading', 80),
      'intro', private.clean_text(payload -> 'intro', 300));
  end if;
  -- The hero must stay visible: it carries the name and the main button.
  update public.content_blocks set
    content = cleaned,
    variant = coalesce(section_variant, variant),
    is_enabled = case when block.block_type = 'hero' then true else coalesce(section_visible, is_enabled) end
  where id = block.id;
  perform private.sync_layout_settings(target_tenant);
  select id into actor from public.users where auth_user_id = auth.uid();
  insert into public.audit_logs (tenant_id, actor_user_id, action, resource_type, resource_id)
  values (target_tenant, actor, 'PORTFOLIO_SECTION_UPDATED', 'content_blocks', block.id);
end;
$$;
revoke all on function public.save_portfolio_section(uuid, text, jsonb, text, boolean) from public, anon;
grant execute on function public.save_portfolio_section(uuid, text, jsonb, text, boolean) to authenticated;

create function public.add_portfolio_section(target_tenant uuid, section_type text)
returns text language plpgsql security definer set search_path = '' as $$
declare page uuid; new_key text; suffix integer := 1; actor uuid;
begin
  perform private.assert_portfolio_editor(target_tenant);
  if section_type = 'hero' or private.portfolio_section_variants(section_type) is null then
    raise exception 'INVALID_CONTENT' using errcode = '22023';
  end if;
  page := private.portfolio_home_page(target_tenant);
  new_key := section_type;
  while exists (select 1 from public.content_blocks where tenant_id = target_tenant and page_id = page and block_key = new_key) loop
    suffix := suffix + 1;
    new_key := section_type || '-' || suffix;
  end loop;
  if suffix > 5 then raise exception 'INVALID_CONTENT' using errcode = '22023'; end if;
  insert into public.content_blocks (tenant_id, page_id, block_key, block_type, variant, sort_order, is_enabled, content)
  values (target_tenant, page, new_key, section_type,
    (private.portfolio_section_variants(section_type))[1],
    coalesce((select max(sort_order) + 1 from public.content_blocks where tenant_id = target_tenant and page_id = page), 0),
    true,
    jsonb_build_object('heading', case section_type
      when 'about' then 'About me' when 'projects' then 'Projects' when 'experience' then 'Experience'
      when 'education' then 'Education' when 'skills' then 'Skills' else 'Get in touch' end));
  perform private.sync_layout_settings(target_tenant);
  select id into actor from public.users where auth_user_id = auth.uid();
  insert into public.audit_logs (tenant_id, actor_user_id, action, resource_type, resource_id)
  values (target_tenant, actor, 'PORTFOLIO_SECTION_ADDED', 'pages', page);
  return new_key;
end;
$$;
revoke all on function public.add_portfolio_section(uuid, text) from public, anon;
grant execute on function public.add_portfolio_section(uuid, text) to authenticated;

create function public.remove_portfolio_section(target_tenant uuid, target_key text)
returns void language plpgsql security definer set search_path = '' as $$
declare page uuid; actor uuid;
begin
  perform private.assert_portfolio_editor(target_tenant);
  page := private.portfolio_home_page(target_tenant);
  delete from public.content_blocks
  where tenant_id = target_tenant and page_id = page and block_key = target_key and block_type <> 'hero';
  if not found then raise exception 'NOT_FOUND' using errcode = '22023'; end if;
  perform private.sync_layout_settings(target_tenant);
  select id into actor from public.users where auth_user_id = auth.uid();
  insert into public.audit_logs (tenant_id, actor_user_id, action, resource_type, resource_id)
  values (target_tenant, actor, 'PORTFOLIO_SECTION_REMOVED', 'pages', page);
end;
$$;
revoke all on function public.remove_portfolio_section(uuid, text) from public, anon;
grant execute on function public.remove_portfolio_section(uuid, text) to authenticated;

-- 4. Publish lock and entries in the published snapshot -----------------------------

create or replace function private.stamp_site_version_kind() returns trigger
language plpgsql security definer set search_path = '' as $$
declare kind text := private.tenant_site_kind(new.tenant_id); remaining jsonb;
begin
  if kind = 'PORTFOLIO' then
    perform private.assert_feature(new.tenant_id, 'portfolio_sites');
    -- Visible example content blocks publishing. Hidden parts and entries are never shown,
    -- so they do not count. The detail lists what is left so the owner can be guided to it.
    select coalesce(jsonb_agg(x order by x ->> 'kind', x ->> 'label'), '[]'::jsonb) into remaining from (
      select jsonb_build_object('kind', 'section', 'key', c.block_key, 'type', c.block_type, 'label', c.block_key, 'fields', to_jsonb(c.sample_fields)) x
      from public.content_blocks c join public.pages p on p.id = c.page_id and p.tenant_id = c.tenant_id
      where c.tenant_id = new.tenant_id and p.page_type = 'HOME' and c.is_enabled and cardinality(c.sample_fields) > 0
      union all
      select jsonb_build_object('kind', 'item', 'id', i.id, 'type', i.item_type, 'label', i.title)
      from public.portfolio_items i
      where i.tenant_id = new.tenant_id and i.status = 'ACTIVE' and i.is_sample
    ) samples;
    if jsonb_array_length(remaining) > 0 then
      raise exception 'STARTER_CONTENT_PRESENT' using errcode = '22023', detail = left(remaining::text, 4000);
    end if;
    new.configuration := new.configuration || jsonb_build_object('portfolioItems', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'type', i.item_type, 'title', i.title, 'subtitle', i.subtitle,
        'summary', i.summary, 'body', i.body, 'role', i.role, 'outcome', i.outcome,
        'linkUrl', i.link_url, 'sourceUrl', i.source_url, 'startsOn', i.starts_on,
        'endsOn', i.ends_on, 'isCurrent', i.is_current, 'tags', to_jsonb(i.tags),
        'cover', case when a.id is null then null else jsonb_build_object('url', a.public_url_or_resolvable_key, 'alt', a.alt_text) end
      ) order by i.item_type, i.sort_order, i.created_at)
      from public.portfolio_items i
      left join public.media_assets a on a.tenant_id = i.tenant_id and a.id = i.cover_asset_id
      where i.tenant_id = new.tenant_id and i.status = 'ACTIVE'
    ), '[]'::jsonb));
  end if;
  new.configuration := new.configuration || jsonb_build_object('siteKind', coalesce(kind, 'STORE'));
  return new;
end;
$$;

-- 5. Starter content ---------------------------------------------------------------

alter table public.site_templates
  add column default_items jsonb not null default '[]'::jsonb check (jsonb_typeof(default_items) = 'array');

-- Seeds a template's example entries and marks every example field. Used by
-- provisioning and by the one-time backfill of phase-1 portfolios below.
create function private.seed_template_items(target_tenant uuid, template text) returns void
language plpgsql security definer set search_path = '' as $$
declare entry jsonb; entry_order integer := 0; columns jsonb;
begin
  for entry in select value from public.site_templates t, jsonb_array_elements(t.default_items)
    where t.key = template loop
    columns := jsonb_build_object(
      'title', entry ->> 'title', 'subtitle', coalesce(entry ->> 'subtitle', ''),
      'summary', coalesce(entry ->> 'summary', ''), 'role', coalesce(entry ->> 'role', ''),
      'outcome', coalesce(entry ->> 'outcome', ''), 'link_url', entry -> 'linkUrl',
      'source_url', entry -> 'sourceUrl', 'tags', coalesce(entry -> 'tags', '[]'::jsonb));
    insert into public.portfolio_items (
      tenant_id, item_type, title, subtitle, summary, role, outcome, link_url, source_url,
      starts_on, ends_on, is_current, tags, sort_order, sample_content)
    values (
      target_tenant, entry ->> 'type', columns ->> 'title', columns ->> 'subtitle',
      columns ->> 'summary', columns ->> 'role', columns ->> 'outcome',
      columns ->> 'link_url', columns ->> 'source_url',
      (entry ->> 'startsOn')::date, (entry ->> 'endsOn')::date,
      coalesce((entry ->> 'isCurrent')::boolean, false),
      array(select jsonb_array_elements_text(columns -> 'tags')), entry_order,
      -- Only the listed fields are examples; e.g. a job title can be kept as written.
      (select coalesce(jsonb_object_agg(f, columns -> f), '{}'::jsonb)
       from jsonb_array_elements_text(coalesce(entry -> 'sampleFields', '[]'::jsonb)) f
       where columns ? f));
    entry_order := entry_order + 1;
  end loop;
end;
$$;
revoke all on function private.seed_template_items(uuid, text) from public;

-- Same signature as phase 1; sections now record which fields are examples, and the
-- template's example entries are seeded.
create or replace function public.provision_portfolio_tenant(
  business_name text, business_slug text, owner_name text, owner_email text, template text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare tenant uuid; page uuid; chosen public.site_templates%rowtype; section jsonb; section_order integer := 0; body jsonb;
begin
  if not private.is_super_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  tenant := private.provision_tenant_core(business_name, business_slug, owner_name, owner_email,
    template, 'portfolio', 'bank_transfer', 'PORTFOLIO');
  perform private.assert_feature(tenant, 'portfolio_sites');
  select * into chosen from public.site_templates where key = template;
  update public.tenant_theme_settings
  set preset_key = chosen.default_preset, tokens = chosen.default_tokens
  where tenant_id = tenant;
  select id into page from public.pages where tenant_id = tenant and slug = 'home';
  delete from public.content_blocks where tenant_id = tenant and page_id = page;
  for section in select value from jsonb_array_elements(chosen.default_sections) loop
    body := coalesce(section -> 'content', '{}'::jsonb);
    if section ->> 'type' = 'hero' then body := body || jsonb_build_object('headline', trim(business_name)); end if;
    insert into public.content_blocks (tenant_id, page_id, block_key, block_type, variant, sort_order, is_enabled, content, sample_content)
    values (tenant, page, section ->> 'key', section ->> 'type', section ->> 'variant', section_order, true, body,
      (select coalesce(jsonb_object_agg(f, body -> f), '{}'::jsonb)
       from jsonb_array_elements_text(coalesce(section -> 'sampleFields', '[]'::jsonb)) f where body ? f));
    section_order := section_order + 1;
  end loop;
  perform private.seed_template_items(tenant, template);
  perform private.sync_layout_settings(tenant);
  update public.navigation_items set link_type = 'PAGE', page_id = page, target = '/'
  where tenant_id = tenant and label = 'Home';
  update public.tenant_onboarding set theme_selected = true where tenant_id = tenant;
  return tenant;
end;
$$;

-- Example fields and entries for the four launch templates. Headings and button labels
-- are sensible defaults, not examples; descriptive copy and every entry detail are.
update public.site_templates set default_sections = (
  select jsonb_agg(
    s || jsonb_build_object('sampleFields', case s ->> 'type'
      when 'hero' then '["eyebrow","subheadline"]'::jsonb
      when 'about' then '["body"]'::jsonb
      when 'contact' then '["body"]'::jsonb
      else '[]'::jsonb end)
    order by ord)
  from jsonb_array_elements(default_sections) with ordinality e(s, ord)
) where site_kind = 'PORTFOLIO';

update public.site_templates set default_items = '[
  {"type":"PROJECT","title":"Payments reconciliation API","subtitle":"Backend service","summary":"Matches bank transfers to invoices automatically for a growing online store.","role":"Lead developer: designed the API and data model.","outcome":"Daily reconciliation went from hours of manual checks to minutes.","tags":["Node.js","PostgreSQL","Docker"],"linkUrl":"https://example.com/project","sourceUrl":"https://github.com/your-name/project","sampleFields":["title","summary","role","outcome","link_url","source_url"]},
  {"type":"PROJECT","title":"Community events app","subtitle":"Web app","summary":"Lets neighbourhood groups publish events and take RSVPs from their phones.","role":"Full-stack developer, from design to launch.","outcome":"Used by 40 groups in its first three months.","tags":["React","Next.js","Supabase"],"linkUrl":"https://example.com/app","sampleFields":["title","summary","role","outcome","link_url"]},
  {"type":"PROJECT","title":"Open-source form library","subtitle":"Open source","summary":"A small library for accessible, validated forms.","role":"Creator and maintainer.","outcome":"","tags":["TypeScript","Accessibility"],"sourceUrl":"https://github.com/your-name/forms","sampleFields":["title","summary","role","source_url"]},
  {"type":"EXPERIENCE","title":"Software Engineer","subtitle":"Example Company, Lagos","summary":"Built and maintained customer-facing features; led the move to automated testing.","startsOn":"2023-01-01","isCurrent":true,"sampleFields":["subtitle","summary"]},
  {"type":"EXPERIENCE","title":"Junior Developer","subtitle":"Sample Studio, Remote","summary":"Shipped websites for small businesses and set up their hosting.","startsOn":"2021-06-01","endsOn":"2022-12-01","sampleFields":["subtitle","summary"]},
  {"type":"SKILL","title":"Languages","tags":["TypeScript","Python","SQL"],"sampleFields":["tags"]},
  {"type":"SKILL","title":"Frameworks","tags":["React","Next.js","Express"],"sampleFields":["tags"]},
  {"type":"SKILL","title":"Tools","tags":["Git","Docker","AWS"],"sampleFields":["tags"]}
]' where key = 'developer';

update public.site_templates set default_items = '[
  {"type":"PROJECT","title":"Simplifying a savings app sign-up","subtitle":"Case study · Fintech","summary":"New users dropped off during a long identity check. I redesigned the flow around what people had to hand.","role":"Lead product designer: research, flows, and final UI.","outcome":"Sign-up completion rose from 41% to 63%.","tags":["Research","Mobile","Onboarding"],"sampleFields":["title","subtitle","summary","role","outcome"]},
  {"type":"PROJECT","title":"A design system for a logistics team","subtitle":"Case study · B2B","summary":"Five products looked and behaved differently. I built a shared component library with the engineers.","role":"Design system lead.","outcome":"New screens now ship in days instead of weeks.","tags":["Design systems","Figma"],"sampleFields":["title","subtitle","summary","role","outcome"]},
  {"type":"PROJECT","title":"Booking for a neighbourhood clinic","subtitle":"Case study · Health","summary":"Patients queued for hours. I designed a simple booking tool that works on any phone.","role":"Product designer, working with a solo developer.","outcome":"","tags":["Service design","Accessibility"],"sampleFields":["title","subtitle","summary","role"]},
  {"type":"SKILL","title":"What I do","tags":["Product design","UX research","Prototyping","Design systems"],"sampleFields":["tags"]}
]' where key = 'designer';

update public.site_templates set default_items = '[
  {"type":"PROJECT","title":"Portraits in Lagos","subtitle":"Series · 2025","summary":"Natural-light portraits of artists and makers in their studios.","tags":["Portrait"],"sampleFields":["title","subtitle","summary"]},
  {"type":"PROJECT","title":"Weddings","subtitle":"Series · Ongoing","summary":"Documentary-style coverage, from getting ready to the last dance.","tags":["Events"],"sampleFields":["title","summary"]}
]' where key = 'photographer';

update public.site_templates set default_items = '[
  {"type":"EXPERIENCE","title":"Operations Associate","subtitle":"Example Company, Lagos","summary":"Coordinated daily operations for a team of 12 and cut order errors by a third.","startsOn":"2023-03-01","isCurrent":true,"sampleFields":["subtitle","summary"]},
  {"type":"EXPERIENCE","title":"Customer Support Officer","subtitle":"Sample Bank, Abuja","summary":"Resolved customer issues by phone and chat, consistently above the team satisfaction target.","startsOn":"2021-01-01","endsOn":"2023-02-01","sampleFields":["subtitle","summary"]},
  {"type":"EDUCATION","title":"B.Sc. Business Administration","subtitle":"Example University","summary":"Second Class Upper.","startsOn":"2016-09-01","endsOn":"2020-07-01","sampleFields":["title","subtitle","summary"]},
  {"type":"SKILL","title":"Skills","tags":["Customer service","Microsoft Excel","Team coordination","Reporting"],"sampleFields":["tags"]}
]' where key = 'resume';

-- 6. Phase-1 portfolios -------------------------------------------------------------

-- Existing portfolios get the same example tracking: any template text they have not
-- changed yet is marked, and the template's example entries are added (phase 1 had no
-- entries, so nothing of theirs is replaced).
do $$
declare target record; section jsonb;
begin
  for target in select id, template_key from public.tenants where site_kind = 'PORTFOLIO' loop
    for section in select value from public.site_templates t, jsonb_array_elements(t.default_sections)
      where t.key = target.template_key loop
      update public.content_blocks c set sample_content = (
        select coalesce(jsonb_object_agg(f, section #> array['content', f]), '{}'::jsonb)
        from jsonb_array_elements_text(coalesce(section -> 'sampleFields', '[]'::jsonb)) f
        where section -> 'content' ? f)
      where c.tenant_id = target.id and c.block_key = section ->> 'key'
        and c.page_id = private.portfolio_home_page(target.id);
    end loop;
    if not exists (select 1 from public.portfolio_items where tenant_id = target.id) then
      perform private.seed_template_items(target.id, target.template_key);
    end if;
  end loop;
end $$;
