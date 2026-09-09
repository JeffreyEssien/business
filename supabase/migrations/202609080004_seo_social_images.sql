-- Social sharing images use tenant-owned Cloudinary asset records and immutable published URLs.
alter table public.tenant_seo_settings add column social_asset_id uuid;
alter table public.tenant_seo_settings add foreign key(tenant_id,social_asset_id)
 references public.media_assets(tenant_id,id);
alter table public.seo_entries add column social_asset_id uuid;
alter table public.seo_entries add foreign key(tenant_id,social_asset_id)
 references public.media_assets(tenant_id,id);

create function public.save_seo_social_image(
 target_tenant uuid,target_entity_type text,target_entity uuid,
 asset_storage_key text,asset_public_url text,asset_file_name text,asset_mime_type text,
 asset_file_size bigint,asset_format text,asset_width integer,asset_height integer
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; saved uuid; previous uuid; removed_key text; removed_type text;
begin
 if not private.can_manage_catalog(target_tenant) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if target_entity_type not in ('GLOBAL','PAGE','PRODUCT','CATEGORY')
  or asset_storage_key is null or length(asset_storage_key) not between 1 and 500
  or asset_public_url !~ '^https://[^[:space:]]+$'
  or asset_mime_type not in ('image/jpeg','image/png','image/webp')
  or asset_file_size not between 1 and 5242880
 then raise exception 'INVALID_SOCIAL_IMAGE' using errcode='22023'; end if;
 select u.id into actor from public.users u where u.auth_user_id=auth.uid();
 insert into public.media_assets(
  tenant_id,storage_provider,storage_key,public_url_or_resolvable_key,file_name,mime_type,
  file_size,width,height,alt_text,created_by,resource_type,format
 ) values(
  target_tenant,'cloudinary',asset_storage_key,asset_public_url,asset_file_name,asset_mime_type,
  asset_file_size,asset_width,asset_height,'Social sharing image',actor,'image',asset_format
 ) returning id into saved;
 if target_entity_type='GLOBAL' then
  select s.social_asset_id into previous from public.tenant_seo_settings s where s.tenant_id=target_tenant for update;
  update public.tenant_seo_settings s set social_asset_id=saved where s.tenant_id=target_tenant;
 else
  select s.social_asset_id into previous from public.seo_entries s
   where s.tenant_id=target_tenant and s.entity_type=target_entity_type and s.entity_id=target_entity for update;
  if not found then raise exception 'SEARCH_RECORD_NOT_FOUND' using errcode='P0002'; end if;
  update public.seo_entries s set social_asset_id=saved
   where s.tenant_id=target_tenant and s.entity_type=target_entity_type and s.entity_id=target_entity;
 end if;
 if previous is not null then
  delete from public.media_assets m where m.tenant_id=target_tenant and m.id=previous
   and not exists(select 1 from public.tenant_seo_settings s where s.tenant_id=target_tenant and s.social_asset_id=m.id)
   and not exists(select 1 from public.seo_entries s where s.tenant_id=target_tenant and s.social_asset_id=m.id)
   and not exists(select 1 from public.products p where p.tenant_id=target_tenant and p.primary_image_asset_id=m.id)
   returning m.storage_key,m.resource_type into removed_key,removed_type;
 end if;
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id)
 values(target_tenant,actor,'SOCIAL_IMAGE_UPDATED',case when target_entity_type='GLOBAL' then 'tenant_seo_settings' else 'seo_entries' end,coalesce(target_entity,target_tenant));
 return case when removed_key is null then null else jsonb_build_object('storageKey',removed_key,'resourceType',removed_type) end;
end $$;
revoke all on function public.save_seo_social_image(uuid,text,uuid,text,text,text,text,bigint,text,integer,integer) from public,anon;
grant execute on function public.save_seo_social_image(uuid,text,uuid,text,text,text,text,bigint,text,integer,integer) to authenticated;

create function private.publish_seo_social_images() returns trigger
language plpgsql security definer set search_path='' as $$
declare global_url text;
begin
 select m.public_url_or_resolvable_key into global_url
 from public.tenant_seo_settings s left join public.media_assets m
  on m.tenant_id=s.tenant_id and m.id=s.social_asset_id
 where s.tenant_id=new.tenant_id;
 new.configuration:=jsonb_set(new.configuration,'{seo,socialImage}',coalesce(to_jsonb(global_url),'null'::jsonb),true);
 new.configuration:=jsonb_set(new.configuration,'{seoEntries}',coalesce((
  select jsonb_agg(entry.item || jsonb_build_object('socialImage',m.public_url_or_resolvable_key) order by entry.ordinality)
  from jsonb_array_elements(coalesce(new.configuration->'seoEntries','[]'::jsonb)) with ordinality entry(item,ordinality)
  left join public.seo_entries s on s.tenant_id=new.tenant_id
   and s.entity_type=entry.item->>'entityType' and s.entity_id=(entry.item->>'entityId')::uuid
  left join public.media_assets m on m.tenant_id=s.tenant_id and m.id=s.social_asset_id
 ),'[]'::jsonb),true);
 return new;
end $$;
revoke all on function private.publish_seo_social_images() from public;
create trigger tenant_versions_publish_social_images before insert on public.tenant_site_versions
for each row execute function private.publish_seo_social_images();
