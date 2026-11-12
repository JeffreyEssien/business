-- Portfolio phase 3 follow-ups:
-- 1. Owners can take a live portfolio offline (and make it live again by publishing).
-- 2. Photos kept only because the live page still showed them are cleaned up once the
--    live page no longer does (after the next publish, or after going offline).

-- Portfolio uploads (and seeded sample rows) that nothing points to any more: not the
-- draft, not an album, not the live snapshot. Uploads are inserted and attached inside one
-- database call, so a committed row with no reference is genuinely unused. Only files in
-- the tenant's portfolio folder are considered, never store, site, or SEO media.
create function private.unused_portfolio_assets(target_tenant uuid) returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(a.id), '{}')
  from public.media_assets a
  where a.tenant_id = target_tenant
    and (a.storage_provider = 'sample'
      or a.storage_key like 'businesscare/tenants/' || target_tenant::text || '/portfolio/%')
    and not private.portfolio_asset_in_use(target_tenant, a.id);
$$;
revoke all on function private.unused_portfolio_assets(uuid) from public;

-- Deletes unused portfolio assets and returns them as [{provider, storageKey, resourceType}]
-- so the app can delete the Cloudinary files. A row something else still references (a
-- foreign key this check does not know about) is skipped, never forced.
create function private.clean_up_portfolio_assets(target_tenant uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare candidate uuid; released jsonb := '[]'::jsonb; gone public.media_assets%rowtype;
begin
  foreach candidate in array private.unused_portfolio_assets(target_tenant) loop
    begin
      delete from public.media_assets where tenant_id = target_tenant and id = candidate
      returning * into gone;
      if gone.id is not null then
        released := released || jsonb_build_object('provider', gone.storage_provider,
          'storageKey', gone.storage_key, 'resourceType', gone.resource_type);
      end if;
    exception when foreign_key_violation then
      null;
    end;
  end loop;
  return released;
end;
$$;
revoke all on function private.clean_up_portfolio_assets(uuid) from public;

-- Called by the app right after a portfolio is published.
create function public.clean_up_portfolio_photos(target_tenant uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_portfolio_editor(target_tenant);
  return private.clean_up_portfolio_assets(target_tenant);
end;
$$;
revoke all on function public.clean_up_portfolio_photos(uuid) from public, anon;
grant execute on function public.clean_up_portfolio_photos(uuid) to authenticated;

-- Archives the live version, so visitors see the "not live yet" page. The draft and every
-- earlier version are kept; publishing again makes a new live version.
create function public.take_portfolio_offline(target_tenant uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid;
begin
  perform private.assert_portfolio_editor(target_tenant);
  update public.tenant_site_versions set status = 'ARCHIVED'
  where tenant_id = target_tenant and status = 'PUBLISHED';
  if not found then raise exception 'NOT_LIVE' using errcode = '22023'; end if;
  update public.tenant_onboarding set store_published = false where tenant_id = target_tenant;
  select id into actor from public.users where auth_user_id = auth.uid();
  insert into public.audit_logs (tenant_id, actor_user_id, action, resource_type, resource_id)
  values (target_tenant, actor, 'SITE_UNPUBLISHED', 'tenant_site_versions', target_tenant);
  -- Photos the live page was holding on to are no longer needed.
  return private.clean_up_portfolio_assets(target_tenant);
end;
$$;
revoke all on function public.take_portfolio_offline(uuid) from public, anon;
grant execute on function public.take_portfolio_offline(uuid) to authenticated;
