-- Portfolio builder, phase 2: photos (opening image, About photo, project covers).
-- Files are uploaded to Cloudinary by trusted server code; this records ownership and
-- placement, and reports the replaced file so the app can delete it from Cloudinary.

-- Validates and records one tenant-owned image. Mirrors the catalog media checks: the
-- storage key must sit under this tenant's Cloudinary folder, so one tenant can never
-- register another tenant's file.
create function private.insert_portfolio_image(target_tenant uuid, asset jsonb, alt text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare asset_id uuid; actor uuid;
begin
  if asset ->> 'storageKey' is null
    or asset ->> 'storageKey' not like 'businesscare/tenants/' || target_tenant::text || '/%'
    or coalesce(asset ->> 'publicUrl', '') !~ '^https://[^[:space:]]+$'
    or asset ->> 'mimeType' not in ('image/jpeg', 'image/png', 'image/webp')
    or coalesce((asset ->> 'fileSize')::bigint, 0) not between 1 and 5242880 then
    raise exception 'INVALID_MEDIA' using errcode = '22023';
  end if;
  select id into actor from public.users where auth_user_id = auth.uid();
  insert into public.media_assets (
    tenant_id, storage_provider, storage_key, public_url_or_resolvable_key, file_name,
    mime_type, file_size, width, height, alt_text, created_by, resource_type, format)
  values (
    target_tenant, 'cloudinary', asset ->> 'storageKey', asset ->> 'publicUrl',
    left(coalesce(asset ->> 'fileName', 'photo'), 255), asset ->> 'mimeType',
    (asset ->> 'fileSize')::bigint, (asset ->> 'width')::integer, (asset ->> 'height')::integer,
    nullif(left(btrim(coalesce(alt, '')), 300), ''), actor, 'image', nullif(asset ->> 'format', ''))
  returning id into asset_id;
  return asset_id;
end;
$$;
revoke all on function private.insert_portfolio_image(uuid, jsonb, text) from public;

-- An asset may be shared (e.g. the same picture as logo and hero). Only delete it when
-- nothing in this tenant still points at it.
create function private.portfolio_asset_in_use(target_tenant uuid, target_asset uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.tenant_business_settings
      where tenant_id = target_tenant and target_asset in (logo_asset_id, hero_asset_id))
    or exists (select 1 from public.portfolio_items
      where tenant_id = target_tenant and cover_asset_id = target_asset)
    or exists (select 1 from public.content_blocks
      where tenant_id = target_tenant and settings #>> '{photo,assetId}' = target_asset::text)
    or exists (select 1 from public.products
      where tenant_id = target_tenant and primary_image_asset_id = target_asset)
    or exists (select 1 from public.product_media
      where tenant_id = target_tenant and asset_id = target_asset)
    -- The live page keeps working until the next publish: a photo still in the published
    -- snapshot is not deleted now (it becomes an orphan to clean up later, never a broken image).
    or exists (select 1 from public.tenant_site_versions v, public.media_assets a
      where v.tenant_id = target_tenant and v.status = 'PUBLISHED'
        and a.tenant_id = target_tenant and a.id = target_asset
        and strpos(v.configuration::text, a.public_url_or_resolvable_key) > 0);
$$;
revoke all on function private.portfolio_asset_in_use(uuid, uuid) from public;

-- Places, replaces, or removes one photo, or only updates its description.
--   slot 'hero'  : the opening image (tenant_business_settings.hero_asset_id)
--   slot 'about' : a part's photo, stored on the block as settings.photo
--   slot 'cover' : an entry's cover (portfolio_items.cover_asset_id)
-- asset = null with remove = true clears the photo; asset = null with remove = false keeps
-- the current photo and updates its description. Returns the replaced file, if any, so the
-- caller can delete it from Cloudinary after the transaction commits.
create function public.set_portfolio_photo(
  target_tenant uuid, slot text, target_ref text, asset jsonb, alt text, remove boolean
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  previous uuid;
  next_asset uuid;
  block public.content_blocks%rowtype;
  replaced public.media_assets%rowtype;
  actor uuid;
begin
  perform private.assert_portfolio_editor(target_tenant);
  if slot = 'hero' then
    select hero_asset_id into previous from public.tenant_business_settings
    where tenant_id = target_tenant for update;
  elsif slot = 'about' then
    select * into block from public.content_blocks
    where tenant_id = target_tenant and page_id = private.portfolio_home_page(target_tenant)
      and block_key = target_ref and block_type = 'about' for update;
    if block.id is null then raise exception 'NOT_FOUND' using errcode = '22023'; end if;
    previous := nullif(block.settings #>> '{photo,assetId}', '')::uuid;
  elsif slot = 'cover' then
    select cover_asset_id into previous from public.portfolio_items
    where tenant_id = target_tenant and id = nullif(target_ref, '')::uuid for update;
    if not found then raise exception 'NOT_FOUND' using errcode = '22023'; end if;
  else
    raise exception 'INVALID_CONTENT' using errcode = '22023';
  end if;

  if asset is not null and jsonb_typeof(asset) = 'object' then
    next_asset := private.insert_portfolio_image(target_tenant, asset, alt);
  elsif coalesce(remove, false) then
    next_asset := null;
  else
    -- Description-only change for the current photo.
    if previous is not null then
      update public.media_assets set alt_text = nullif(left(btrim(coalesce(alt, '')), 300), '')
      where tenant_id = target_tenant and id = previous;
    end if;
    next_asset := previous;
  end if;

  if slot = 'hero' then
    update public.tenant_business_settings set hero_asset_id = next_asset where tenant_id = target_tenant;
  elsif slot = 'about' then
    update public.content_blocks set settings = case when next_asset is null
      then settings - 'photo'
      else settings || jsonb_build_object('photo', (
        select jsonb_build_object('assetId', a.id, 'url', a.public_url_or_resolvable_key, 'alt', a.alt_text)
        from public.media_assets a where a.id = next_asset)) end
    where id = block.id;
  else
    update public.portfolio_items set cover_asset_id = next_asset
    where tenant_id = target_tenant and id = target_ref::uuid;
  end if;

  select id into actor from public.users where auth_user_id = auth.uid();
  insert into public.audit_logs (tenant_id, actor_user_id, action, resource_type, resource_id)
  values (target_tenant, actor, 'PORTFOLIO_PHOTO_UPDATED', 'media_assets', coalesce(next_asset, previous));

  if previous is not null and previous is distinct from next_asset
    and not private.portfolio_asset_in_use(target_tenant, previous) then
    delete from public.media_assets where tenant_id = target_tenant and id = previous
    returning * into replaced;
    if replaced.id is not null then
      return jsonb_build_object('provider', replaced.storage_provider,
        'storageKey', replaced.storage_key, 'resourceType', replaced.resource_type);
    end if;
  end if;
  return '{}'::jsonb;
end;
$$;
revoke all on function public.set_portfolio_photo(uuid, text, text, jsonb, text, boolean) from public, anon;
grant execute on function public.set_portfolio_photo(uuid, text, text, jsonb, text, boolean) to authenticated;

-- Deleting an entry must not leave its cover behind. The app deletes the returned
-- Cloudinary file; this replaces the phase-2 delete with one that reports it.
drop function public.delete_portfolio_item(uuid, uuid);
create function public.delete_portfolio_item(target_tenant uuid, target_item uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare cover uuid; actor uuid; replaced public.media_assets%rowtype;
begin
  perform private.assert_portfolio_editor(target_tenant);
  delete from public.portfolio_items where id = target_item and tenant_id = target_tenant
  returning cover_asset_id into cover;
  if not found then raise exception 'NOT_FOUND' using errcode = '22023'; end if;
  select id into actor from public.users where auth_user_id = auth.uid();
  insert into public.audit_logs (tenant_id, actor_user_id, action, resource_type, resource_id)
  values (target_tenant, actor, 'PORTFOLIO_ITEM_DELETED', 'portfolio_items', target_item);
  if cover is not null and not private.portfolio_asset_in_use(target_tenant, cover) then
    delete from public.media_assets where tenant_id = target_tenant and id = cover returning * into replaced;
    return jsonb_build_object('provider', replaced.storage_provider,
      'storageKey', replaced.storage_key, 'resourceType', replaced.resource_type);
  end if;
  return '{}'::jsonb;
end;
$$;
revoke all on function public.delete_portfolio_item(uuid, uuid) from public, anon;
grant execute on function public.delete_portfolio_item(uuid, uuid) to authenticated;

-- Removing an About part also releases its photo.
drop function public.remove_portfolio_section(uuid, text);
create function public.remove_portfolio_section(target_tenant uuid, target_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare page uuid; actor uuid; photo uuid; replaced public.media_assets%rowtype;
begin
  perform private.assert_portfolio_editor(target_tenant);
  page := private.portfolio_home_page(target_tenant);
  delete from public.content_blocks
  where tenant_id = target_tenant and page_id = page and block_key = target_key and block_type <> 'hero'
  returning nullif(settings #>> '{photo,assetId}', '')::uuid into photo;
  if not found then raise exception 'NOT_FOUND' using errcode = '22023'; end if;
  perform private.sync_layout_settings(target_tenant);
  select id into actor from public.users where auth_user_id = auth.uid();
  insert into public.audit_logs (tenant_id, actor_user_id, action, resource_type, resource_id)
  values (target_tenant, actor, 'PORTFOLIO_SECTION_REMOVED', 'pages', page);
  if photo is not null and not private.portfolio_asset_in_use(target_tenant, photo) then
    delete from public.media_assets where tenant_id = target_tenant and id = photo returning * into replaced;
    return jsonb_build_object('provider', replaced.storage_provider,
      'storageKey', replaced.storage_key, 'resourceType', replaced.resource_type);
  end if;
  return '{}'::jsonb;
end;
$$;
revoke all on function public.remove_portfolio_section(uuid, text) from public, anon;
grant execute on function public.remove_portfolio_section(uuid, text) to authenticated;
