-- Portfolio phase 3b: photo albums for projects, and sample photos in starter content.
--
-- Albums: a project can hold up to 24 photos besides its cover, in the owner's order, each
-- with its own description. Files are uploaded to Cloudinary by trusted server code; the
-- database records ownership, order, and placement, and reports released files so the
-- app can delete them from Cloudinary after the transaction commits.
--
-- Sample photos: templates ship real photographs bundled with the app
-- (/portfolio-samples/*.webp). They are stored as ordinary media records flagged
-- is_sample, so rendering, publishing, replacing, and removing work exactly like uploads,
-- and the publish lock refuses while any visible sample photo remains.

-- 1. Sample photos -----------------------------------------------------------------

alter table public.media_assets add column is_sample boolean not null default false;

-- Records one bundled sample photo for a tenant. Only paths in the app's own sample
-- folder are accepted, so starter content can never point at an outside address.
create function private.insert_sample_image(target_tenant uuid, photo jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare asset_id uuid; path text := photo ->> 'src';
begin
  if path is null or path !~ '^/portfolio-samples/[a-z0-9]+(-[a-z0-9]+)*\.webp$' then
    raise exception 'INVALID_MEDIA' using errcode = '22023';
  end if;
  insert into public.media_assets (
    tenant_id, storage_provider, storage_key, public_url_or_resolvable_key, file_name,
    mime_type, file_size, alt_text, resource_type, format, is_sample)
  values (
    target_tenant, 'sample', 'sample/' || target_tenant::text || '/' || gen_random_uuid()::text,
    path, substring(path from '[^/]+$'), 'image/webp', 1,
    nullif(left(btrim(coalesce(photo ->> 'alt', '')), 300), ''), 'image', 'webp', true)
  returning id into asset_id;
  return asset_id;
end;
$$;
revoke all on function private.insert_sample_image(uuid, jsonb) from public;

-- 2. Albums ------------------------------------------------------------------------

create table public.portfolio_item_media (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  item_id uuid not null references public.portfolio_items(id) on delete cascade,
  asset_id uuid not null,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, asset_id) references public.media_assets(tenant_id, id),
  unique (item_id, asset_id)
);
create index portfolio_item_media_item on public.portfolio_item_media (item_id, sort_order);

alter table public.portfolio_item_media enable row level security;
revoke all on public.portfolio_item_media from anon, authenticated;
grant select on public.portfolio_item_media to authenticated;
create policy tenant_read on public.portfolio_item_media for select to authenticated
  using ((select private.is_super_admin()) or private.is_tenant_member(tenant_id));

-- An asset may be shared. Only delete it when nothing in this tenant still points at it,
-- including albums and the live snapshot (unchanged from phase 2 otherwise).
create or replace function private.portfolio_asset_in_use(target_tenant uuid, target_asset uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.tenant_business_settings
      where tenant_id = target_tenant and target_asset in (logo_asset_id, hero_asset_id))
    or exists (select 1 from public.portfolio_items
      where tenant_id = target_tenant and cover_asset_id = target_asset)
    or exists (select 1 from public.portfolio_item_media
      where tenant_id = target_tenant and asset_id = target_asset)
    or exists (select 1 from public.content_blocks
      where tenant_id = target_tenant and settings #>> '{photo,assetId}' = target_asset::text)
    or exists (select 1 from public.products
      where tenant_id = target_tenant and primary_image_asset_id = target_asset)
    or exists (select 1 from public.product_media
      where tenant_id = target_tenant and asset_id = target_asset)
    or exists (select 1 from public.tenant_site_versions v, public.media_assets a
      where v.tenant_id = target_tenant and v.status = 'PUBLISHED'
        and a.tenant_id = target_tenant and a.id = target_asset
        and strpos(v.configuration::text, a.public_url_or_resolvable_key) > 0);
$$;
revoke all on function private.portfolio_asset_in_use(uuid, uuid) from public;

-- Deletes released assets and returns them as [{provider, storageKey, resourceType}].
create function private.release_portfolio_assets(target_tenant uuid, assets uuid[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare candidate uuid; released jsonb := '[]'::jsonb; replaced public.media_assets%rowtype;
begin
  foreach candidate in array coalesce(assets, '{}') loop
    if candidate is not null and not private.portfolio_asset_in_use(target_tenant, candidate) then
      delete from public.media_assets where tenant_id = target_tenant and id = candidate
      returning * into replaced;
      if replaced.id is not null then
        released := released || jsonb_build_object('provider', replaced.storage_provider,
          'storageKey', replaced.storage_key, 'resourceType', replaced.resource_type);
      end if;
    end if;
  end loop;
  return released;
end;
$$;
revoke all on function private.release_portfolio_assets(uuid, uuid[]) from public;

-- One save for a project's album: keeps, reorders, re-describes, and removes existing
-- photos (`photos`, in display order, each {id, alt, remove}) and appends new uploads
-- (`added`, each an uploaded-asset object with alt). Returns the released files.
create function public.save_portfolio_item_photos(
  target_tenant uuid, target_item uuid, photos jsonb, added jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  photo jsonb;
  next_position integer := 0;
  removed uuid[] := '{}';
  removed_asset uuid;
  next_asset uuid;
  actor uuid;
begin
  perform private.assert_portfolio_editor(target_tenant);
  perform 1 from public.portfolio_items
  where tenant_id = target_tenant and id = target_item and item_type = 'PROJECT' for update;
  if not found then raise exception 'NOT_FOUND' using errcode = '22023'; end if;
  if jsonb_typeof(coalesce(photos, '[]')) <> 'array' or jsonb_typeof(coalesce(added, '[]')) <> 'array' then
    raise exception 'INVALID_CONTENT' using errcode = '22023';
  end if;

  for photo in select value from jsonb_array_elements(coalesce(photos, '[]')) loop
    if coalesce((photo ->> 'remove')::boolean, false) then
      delete from public.portfolio_item_media
      where tenant_id = target_tenant and item_id = target_item and id = (photo ->> 'id')::uuid
      returning asset_id into removed_asset;
      if removed_asset is not null then removed := removed || removed_asset; end if;
    else
      update public.portfolio_item_media set sort_order = next_position
      where tenant_id = target_tenant and item_id = target_item and id = (photo ->> 'id')::uuid
      returning asset_id into next_asset;
      if next_asset is not null then
        update public.media_assets set alt_text = nullif(left(btrim(coalesce(photo ->> 'alt', '')), 300), '')
        where tenant_id = target_tenant and id = next_asset;
        next_position := next_position + 1;
      end if;
    end if;
  end loop;

  -- Photos not mentioned keep their place after the listed ones.
  update public.portfolio_item_media m set sort_order = next_position + o.rank
  from (select id, row_number() over (order by sort_order, created_at) as rank
        from public.portfolio_item_media
        where tenant_id = target_tenant and item_id = target_item
          and not (id::text in (select value ->> 'id' from jsonb_array_elements(coalesce(photos, '[]'))))) o
  where m.id = o.id;
  select coalesce(max(sort_order) + 1, 0) into next_position
  from public.portfolio_item_media where tenant_id = target_tenant and item_id = target_item;

  for photo in select value from jsonb_array_elements(coalesce(added, '[]')) loop
    next_asset := private.insert_portfolio_image(target_tenant, photo, photo ->> 'alt');
    insert into public.portfolio_item_media (tenant_id, item_id, asset_id, sort_order)
    values (target_tenant, target_item, next_asset, next_position);
    next_position := next_position + 1;
  end loop;

  if (select count(*) from public.portfolio_item_media
      where tenant_id = target_tenant and item_id = target_item) > 24 then
    raise exception 'TOO_MANY_PHOTOS' using errcode = '22023';
  end if;

  select id into actor from public.users where auth_user_id = auth.uid();
  insert into public.audit_logs (tenant_id, actor_user_id, action, resource_type, resource_id)
  values (target_tenant, actor, 'PORTFOLIO_ALBUM_UPDATED', 'portfolio_items', target_item);
  return private.release_portfolio_assets(target_tenant, removed);
end;
$$;
revoke all on function public.save_portfolio_item_photos(uuid, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_portfolio_item_photos(uuid, uuid, jsonb, jsonb) to authenticated;

-- Deleting an entry releases its cover and every album photo. Returns a list now.
create or replace function public.delete_portfolio_item(target_tenant uuid, target_item uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare cover uuid; album uuid[]; actor uuid;
begin
  perform private.assert_portfolio_editor(target_tenant);
  select array_agg(asset_id) into album from public.portfolio_item_media
  where tenant_id = target_tenant and item_id = target_item;
  delete from public.portfolio_items where id = target_item and tenant_id = target_tenant
  returning cover_asset_id into cover;
  if not found then raise exception 'NOT_FOUND' using errcode = '22023'; end if;
  select id into actor from public.users where auth_user_id = auth.uid();
  insert into public.audit_logs (tenant_id, actor_user_id, action, resource_type, resource_id)
  values (target_tenant, actor, 'PORTFOLIO_ITEM_DELETED', 'portfolio_items', target_item);
  return private.release_portfolio_assets(target_tenant, coalesce(album, '{}') || cover);
end;
$$;

-- 3. Publish lock and snapshot -------------------------------------------------------

create or replace function private.stamp_site_version_kind() returns trigger
language plpgsql security definer set search_path = '' as $$
declare kind text := private.tenant_site_kind(new.tenant_id); remaining jsonb;
begin
  if kind = 'PORTFOLIO' then
    perform private.assert_feature(new.tenant_id, 'portfolio_sites');
    -- Visible example content blocks publishing: text in parts and entries, and any
    -- sample photo a visitor would see. Hidden parts and entries do not count.
    select coalesce(jsonb_agg(x order by x ->> 'kind', x ->> 'label'), '[]'::jsonb) into remaining from (
      select jsonb_build_object('kind', 'section', 'key', c.block_key, 'type', c.block_type, 'label', c.block_key, 'fields', to_jsonb(c.sample_fields)) x
      from public.content_blocks c join public.pages p on p.id = c.page_id and p.tenant_id = c.tenant_id
      where c.tenant_id = new.tenant_id and p.page_type = 'HOME' and c.is_enabled and cardinality(c.sample_fields) > 0
      union all
      select jsonb_build_object('kind', 'item', 'id', i.id, 'type', i.item_type, 'label', i.title)
      from public.portfolio_items i
      where i.tenant_id = new.tenant_id and i.status = 'ACTIVE' and i.is_sample
      union all
      select jsonb_build_object('kind', 'photo', 'slot', 'hero', 'key', 'hero', 'label', 'hero')
      from public.tenant_business_settings b join public.media_assets a
        on a.tenant_id = b.tenant_id and a.id = b.hero_asset_id
      where b.tenant_id = new.tenant_id and a.is_sample
      union all
      select jsonb_build_object('kind', 'photo', 'slot', 'about', 'key', c.block_key, 'label', c.block_key)
      from public.content_blocks c join public.media_assets a
        on a.tenant_id = c.tenant_id and a.id::text = c.settings #>> '{photo,assetId}'
      where c.tenant_id = new.tenant_id and c.is_enabled and a.is_sample
      union all
      select jsonb_build_object('kind', 'photo', 'slot', 'cover', 'id', i.id, 'type', i.item_type, 'label', i.title)
      from public.portfolio_items i join public.media_assets a
        on a.tenant_id = i.tenant_id and a.id = i.cover_asset_id
      where i.tenant_id = new.tenant_id and i.status = 'ACTIVE' and a.is_sample
      union all
      select distinct jsonb_build_object('kind', 'photo', 'slot', 'album', 'id', i.id, 'type', i.item_type, 'label', i.title)
      from public.portfolio_items i
      join public.portfolio_item_media m on m.item_id = i.id
      join public.media_assets a on a.tenant_id = m.tenant_id and a.id = m.asset_id
      where i.tenant_id = new.tenant_id and i.status = 'ACTIVE' and a.is_sample
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
        'cover', case when a.id is null then null else jsonb_build_object('url', a.public_url_or_resolvable_key, 'alt', a.alt_text) end,
        'gallery', coalesce((
          select jsonb_agg(jsonb_build_object('url', g.public_url_or_resolvable_key, 'alt', g.alt_text)
            order by m.sort_order, m.created_at)
          from public.portfolio_item_media m
          join public.media_assets g on g.tenant_id = m.tenant_id and g.id = m.asset_id
          where m.item_id = i.id), '[]'::jsonb)
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

-- 4. Seeding sample photos ------------------------------------------------------------

-- Template entries may carry `cover` and `gallery` sample photos ({src, alt}).
create or replace function private.seed_template_items(target_tenant uuid, template text) returns void
language plpgsql security definer set search_path = '' as $$
declare entry jsonb; entry_order integer := 0; columns jsonb; new_item uuid; photo jsonb; photo_order integer;
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
      (select coalesce(jsonb_object_agg(f, columns -> f), '{}'::jsonb)
       from jsonb_array_elements_text(coalesce(entry -> 'sampleFields', '[]'::jsonb)) f
       where columns ? f))
    returning id into new_item;
    if jsonb_typeof(entry -> 'cover') = 'object' then
      update public.portfolio_items
      set cover_asset_id = private.insert_sample_image(target_tenant, entry -> 'cover')
      where id = new_item;
    end if;
    photo_order := 0;
    for photo in select value from jsonb_array_elements(coalesce(entry -> 'gallery', '[]'::jsonb)) loop
      insert into public.portfolio_item_media (tenant_id, item_id, asset_id, sort_order)
      values (target_tenant, new_item, private.insert_sample_image(target_tenant, photo), photo_order);
      photo_order := photo_order + 1;
    end loop;
    entry_order := entry_order + 1;
  end loop;
end;
$$;

-- Template parts may carry a `photo` ({src, alt}): the opening picture for the hero, or
-- the About photo. Everything else is unchanged from phase 2.
create or replace function public.provision_portfolio_tenant(
  business_name text, business_slug text, owner_name text, owner_email text, template text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare tenant uuid; page uuid; chosen public.site_templates%rowtype; section jsonb; section_order integer := 0; body jsonb; settings jsonb; sample uuid;
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
    settings := '{}'::jsonb;
    if section ->> 'type' = 'hero' then
      body := body || jsonb_build_object('headline', trim(business_name));
      if jsonb_typeof(section -> 'photo') = 'object' then
        update public.tenant_business_settings
        set hero_asset_id = private.insert_sample_image(tenant, section -> 'photo')
        where tenant_id = tenant;
      end if;
    elsif section ->> 'type' = 'about' and jsonb_typeof(section -> 'photo') = 'object' then
      sample := private.insert_sample_image(tenant, section -> 'photo');
      settings := jsonb_build_object('photo', jsonb_build_object(
        'assetId', sample, 'url', section #>> '{photo,src}', 'alt', section #>> '{photo,alt}'));
    end if;
    insert into public.content_blocks (tenant_id, page_id, block_key, block_type, variant, sort_order, is_enabled, content, settings, sample_content)
    values (tenant, page, section ->> 'key', section ->> 'type', section ->> 'variant', section_order, true, body, settings,
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
