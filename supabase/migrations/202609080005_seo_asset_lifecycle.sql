-- Remove database media metadata when its source SEO record is deleted.
create or replace function private.remove_entity_seo() returns trigger
language plpgsql security definer set search_path='' as $$
declare asset uuid;
begin
 select s.social_asset_id into asset from public.seo_entries s
 where s.tenant_id=old.tenant_id and s.entity_type=tg_argv[0] and s.entity_id=old.id;
 delete from public.seo_entries s
 where s.tenant_id=old.tenant_id and s.entity_type=tg_argv[0] and s.entity_id=old.id;
 if asset is not null then
  delete from public.media_assets m where m.tenant_id=old.tenant_id and m.id=asset
   and not exists(select 1 from public.tenant_seo_settings s where s.tenant_id=old.tenant_id and s.social_asset_id=m.id)
   and not exists(select 1 from public.seo_entries s where s.tenant_id=old.tenant_id and s.social_asset_id=m.id)
   and not exists(select 1 from public.products p where p.tenant_id=old.tenant_id and p.primary_image_asset_id=m.id);
 end if;
 return old;
end $$;
revoke all on function private.remove_entity_seo() from public;
