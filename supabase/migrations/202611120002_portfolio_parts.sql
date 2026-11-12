-- Portfolio builder, phase 3 (docs/plans/portfolio-templates.md §4, §7): the page parts
-- and entry kinds the 24-template library needs, allow-listed song/video embeds, and
-- Super Admin on/off control for templates. The template rows themselves are seeded by
-- the generated migration that follows this one.

-- 1. Entry kinds ---------------------------------------------------------------------

create function private.portfolio_item_types() returns text[]
language sql immutable set search_path = '' as $$
  select array['PROJECT', 'EXPERIENCE', 'EDUCATION', 'SKILL', 'PUBLICATION', 'SERVICE',
    'TESTIMONIAL', 'EVENT', 'AWARD', 'CLIENT', 'STAT', 'STEP', 'LINK', 'PERSON'];
$$;
revoke all on function private.portfolio_item_types() from public;

alter table public.portfolio_items drop constraint portfolio_items_item_type_check;
alter table public.portfolio_items add constraint portfolio_items_item_type_check
  check (item_type = any (private.portfolio_item_types()));

-- Same contract as phase 2, with the wider list of kinds. A download (LINK) is only a
-- button, so it must point somewhere.
create or replace function public.save_portfolio_item(target_tenant uuid, target_item uuid, payload jsonb)
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
    if kind is null or not kind = any (private.portfolio_item_types()) then
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
    kind := existing.item_type;
  end if;

  if kind = 'LINK' and private.clean_https(payload -> 'linkUrl') is null then
    raise exception 'INVALID_LINK' using errcode = '22023';
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

-- 2. Page parts and their layouts ----------------------------------------------------

create or replace function private.portfolio_section_variants(section_type text) returns text[]
language sql immutable set search_path = '' as $$
  select case section_type
    when 'hero' then array['centered', 'split', 'image-overlay']
    when 'about' then array['text', 'photo-left', 'photo-right']
    when 'projects' then array['grid', 'featured', 'masonry', 'list', 'case-study', 'modular']
    when 'experience' then array['timeline', 'compact']
    when 'education' then array['timeline', 'compact']
    when 'skills' then array['tags', 'grouped']
    when 'contact' then array['details']
    when 'publications' then array['list', 'editorial', 'index', 'citation']
    when 'services' then array['cards', 'list']
    when 'testimonials' then array['quotes', 'spotlight']
    when 'events' then array['list', 'poster']
    when 'awards' then array['list', 'compact']
    when 'clients' then array['strip', 'grid']
    when 'stats' then array['figures', 'band']
    when 'process' then array['numbered', 'columns']
    when 'downloads' then array['buttons']
    when 'team' then array['cards', 'list']
    when 'embed' then array['player']
    when 'bios' then array['stacked']
    when 'cta' then array['banner', 'centered']
    else null end;
$$;

-- Song and video links are accepted only from these hosts (mirrors embedHosts in
-- src/modules/portfolio/embeds.ts). The page renders a provider player from the link;
-- no embed code or HTML is ever stored.
create function private.clean_embed_url(value jsonb) returns text
language plpgsql immutable set search_path = '' as $$
declare result text := private.clean_text(value, 500); host text;
begin
  if result = '' then return ''; end if;
  host := lower(substring(result from '^https://([^/?#:@]+)(?:[/?#]|$)'));
  if host is null or not host = any (array[
    'youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'vimeo.com', 'www.vimeo.com',
    'open.spotify.com', 'music.apple.com', 'soundcloud.com', 'www.soundcloud.com',
    'm.soundcloud.com', 'audiomack.com', 'www.audiomack.com', 'boomplay.com', 'www.boomplay.com'])
    or result ~ '[[:space:]<>"]' then
    raise exception 'INVALID_EMBED' using errcode = '22023';
  end if;
  return result;
end;
$$;
revoke all on function private.clean_embed_url(jsonb) from public;

-- Buttons may jump to a part (#key), open an https site, or start an email.
create function private.clean_cta_href(value jsonb) returns text
language plpgsql immutable set search_path = '' as $$
declare result text := private.clean_text(value, 500);
begin
  if result <> '' and result !~ '^(#[a-z0-9-]{1,48}|https://[^[:space:]]+|mailto:[^[:space:]@]+@[^[:space:]]+)$' then
    raise exception 'INVALID_LINK' using errcode = '22023';
  end if;
  return result;
end;
$$;
revoke all on function private.clean_cta_href(jsonb) from public;

create or replace function public.save_portfolio_section(
  target_tenant uuid, target_key text, payload jsonb, section_variant text, section_visible boolean
) returns void language plpgsql security definer set search_path = '' as $$
declare block public.content_blocks%rowtype; cleaned jsonb; actor uuid;
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
    cleaned := jsonb_build_object(
      'eyebrow', private.clean_text(payload -> 'eyebrow', 80),
      'headline', private.clean_text(payload -> 'headline', 120),
      'subheadline', private.clean_text(payload -> 'subheadline', 300),
      'primaryCta', jsonb_build_object(
        'label', private.clean_text(payload #> '{primaryCta,label}', 40),
        'href', private.clean_cta_href(payload #> '{primaryCta,href}')));
    if cleaned ->> 'headline' = '' then raise exception 'INVALID_CONTENT' using errcode = '22023'; end if;
  elsif block.block_type in ('about', 'contact') then
    cleaned := jsonb_build_object(
      'heading', private.clean_text(payload -> 'heading', 80),
      'body', private.clean_text(payload -> 'body', 3000));
  elsif block.block_type = 'cta' then
    cleaned := jsonb_build_object(
      'heading', private.clean_text(payload -> 'heading', 80),
      'body', private.clean_text(payload -> 'body', 600),
      'primaryCta', jsonb_build_object(
        'label', private.clean_text(payload #> '{primaryCta,label}', 40),
        'href', private.clean_cta_href(payload #> '{primaryCta,href}')));
  elsif block.block_type = 'embed' then
    cleaned := jsonb_build_object(
      'heading', private.clean_text(payload -> 'heading', 80),
      'intro', private.clean_text(payload -> 'intro', 300),
      'url', private.clean_embed_url(payload -> 'url'));
  elsif block.block_type = 'bios' then
    cleaned := jsonb_build_object(
      'heading', private.clean_text(payload -> 'heading', 80),
      'oneLiner', private.clean_text(payload -> 'oneLiner', 200),
      'short', private.clean_text(payload -> 'short', 1200),
      'long', private.clean_text(payload -> 'long', 3000));
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

create or replace function public.add_portfolio_section(target_tenant uuid, section_type text)
returns text language plpgsql security definer set search_path = '' as $$
declare page uuid; new_key text; suffix integer := 1; actor uuid; initial jsonb;
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
  initial := jsonb_build_object('heading', case section_type
    when 'about' then 'About me' when 'projects' then 'Projects' when 'experience' then 'Experience'
    when 'education' then 'Education' when 'skills' then 'Skills' when 'publications' then 'Writing'
    when 'services' then 'Services' when 'testimonials' then 'Kind words' when 'events' then 'Events'
    when 'awards' then 'Awards' when 'clients' then 'Clients' when 'stats' then 'In numbers'
    when 'process' then 'How it works' when 'downloads' then 'Downloads' when 'team' then 'People'
    when 'embed' then 'Listen' when 'bios' then 'Bios' when 'cta' then 'Ready to talk?'
    else 'Get in touch' end);
  if section_type = 'embed' then initial := initial || '{"intro":"","url":""}';
  elsif section_type = 'bios' then initial := initial || '{"oneLiner":"","short":"","long":""}';
  elsif section_type = 'cta' then
    initial := initial || '{"body":"","primaryCta":{"label":"Get in touch","href":"#contact"}}';
  end if;
  insert into public.content_blocks (tenant_id, page_id, block_key, block_type, variant, sort_order, is_enabled, content)
  values (target_tenant, page, new_key, section_type,
    (private.portfolio_section_variants(section_type))[1],
    coalesce((select max(sort_order) + 1 from public.content_blocks where tenant_id = target_tenant and page_id = page), 0),
    true, initial);
  perform private.sync_layout_settings(target_tenant);
  select id into actor from public.users where auth_user_id = auth.uid();
  insert into public.audit_logs (tenant_id, actor_user_id, action, resource_type, resource_id)
  values (target_tenant, actor, 'PORTFOLIO_SECTION_ADDED', 'pages', page);
  return new_key;
end;
$$;

-- Portfolio-only parts are rejected for stores, and products for portfolios.
create or replace function private.enforce_block_site_kind() returns trigger
language plpgsql security definer set search_path = '' as $$
declare kind text := private.tenant_site_kind(new.tenant_id);
begin
  if kind = 'PORTFOLIO' and new.block_type = 'products' then
    raise exception 'STORE_ONLY_FEATURE' using errcode = '42501';
  end if;
  if kind = 'STORE' and new.block_type in ('about', 'skills', 'projects', 'experience',
    'education', 'contact', 'publications', 'services', 'testimonials', 'events', 'awards',
    'clients', 'stats', 'process', 'downloads', 'team', 'embed', 'bios', 'cta') then
    raise exception 'PORTFOLIO_ONLY_FEATURE' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- 3. Template on/off -------------------------------------------------------------------

-- Super Admin hides or offers a portfolio template. Existing portfolios keep their look;
-- a hidden template is no longer offered for new portfolios or look changes. At least
-- one portfolio template always stays available.
create function public.set_site_template_active(template_key text, active boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid;
begin
  if not private.is_super_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if active is null then raise exception 'INVALID_CONTENT' using errcode = '22023'; end if;
  perform 1 from public.site_templates where key = template_key and site_kind = 'PORTFOLIO' for update;
  if not found then raise exception 'NOT_FOUND' using errcode = '22023'; end if;
  if not active and not exists (
    select 1 from public.site_templates
    where site_kind = 'PORTFOLIO' and is_active and key <> template_key) then
    raise exception 'LAST_TEMPLATE' using errcode = '22023';
  end if;
  update public.site_templates set is_active = active where key = template_key;
  select id into actor from public.users where auth_user_id = auth.uid();
  insert into public.audit_logs (actor_user_id, action, resource_type, context)
  values (actor, case when active then 'SITE_TEMPLATE_ENABLED' else 'SITE_TEMPLATE_DISABLED' end,
    'site_templates', jsonb_build_object('templateKey', template_key));
end;
$$;
revoke all on function public.set_site_template_active(text, boolean) from public, anon;
grant execute on function public.set_site_template_active(text, boolean) to authenticated;

-- The public template gallery shows only templates Super Admin offers. Template rows are
-- marketing copy; this exposes keys only.
create function public.list_active_portfolio_templates() returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(key order by sort_order), '{}')
  from public.site_templates where site_kind = 'PORTFOLIO' and is_active;
$$;
revoke all on function public.list_active_portfolio_templates() from public;
grant execute on function public.list_active_portfolio_templates() to anon, authenticated;
