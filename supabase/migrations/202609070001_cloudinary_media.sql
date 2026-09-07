-- Move new catalog media to Cloudinary while preserving provider-neutral legacy records.
alter table public.media_assets alter column storage_provider set default 'cloudinary';
alter table public.media_assets drop constraint if exists media_assets_mime_type_check;
alter table public.media_assets add constraint media_assets_mime_type_check check (
 mime_type in ('image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm')
);
alter table public.media_assets add column resource_type text not null default 'image' check(resource_type in ('image','video'));
alter table public.media_assets add column format text;

drop function public.save_product(uuid,uuid,text,text,text,text,text,numeric,numeric,integer,boolean,text,uuid[],text,text,text,text,bigint,text);
create function public.save_product(
 target_tenant uuid,target_product uuid,product_name text,product_slug text,product_description text,
 product_short_description text,product_sku text,product_price numeric,product_compare_at_price numeric,
 product_stock_quantity integer,product_track_inventory boolean,product_status text,category_ids uuid[],
 asset_storage_key text default null,asset_public_url text default null,asset_file_name text default null,
 asset_mime_type text default null,asset_file_size bigint default null,asset_alt_text text default null,
 asset_storage_provider text default null,asset_resource_type text default null,asset_format text default null,
 asset_width integer default null,asset_height integer default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare saved uuid; asset uuid; previous_asset uuid; actor uuid; product_count integer; product_limit integer; tenant_currency text;
begin
 if not private.can_manage_catalog(target_tenant) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if product_name is null or length(trim(product_name)) not between 1 and 160 or product_slug is null or product_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(product_slug)>160 or product_price is null or product_price<0 or product_stock_quantity is null or product_stock_quantity<0 or product_status not in ('DRAFT','ACTIVE','ARCHIVED') or (product_compare_at_price is not null and product_compare_at_price<product_price) then raise exception 'INVALID_PRODUCT' using errcode='22023'; end if;
 if exists(select 1 from unnest(coalesce(category_ids,'{}'::uuid[])) c where not exists(select 1 from public.categories where id=c and tenant_id=target_tenant)) then raise exception 'INVALID_CATEGORY' using errcode='22023'; end if;
 select id into actor from public.users where auth_user_id=auth.uid();
 select default_currency into tenant_currency from public.tenants where id=target_tenant;
 if target_product is null then
  select count(*) into product_count from public.products where tenant_id=target_tenant and status<>'ARCHIVED';
  select (pf.value #>> '{}')::integer into product_limit from public.tenants t join public.plan_features pf on pf.plan_id=t.plan_id and pf.feature_key='product_limit' where t.id=target_tenant and jsonb_typeof(pf.value)='number';
  if product_limit is not null and product_count>=product_limit then raise exception 'PRODUCT_LIMIT_REACHED' using errcode='23514'; end if;
  insert into public.products(tenant_id,name,slug,description,short_description,sku,price,compare_at_price,currency,stock_quantity,track_inventory,status,published_at)
  values(target_tenant,trim(product_name),product_slug,coalesce(trim(product_description),''),coalesce(trim(product_short_description),''),nullif(trim(product_sku),''),product_price,product_compare_at_price,tenant_currency,product_stock_quantity,product_track_inventory,product_status,case when product_status='ACTIVE' then now() end) returning id into saved;
 else
  select primary_image_asset_id into previous_asset from public.products where id=target_product and tenant_id=target_tenant;
  update public.products set name=trim(product_name),slug=product_slug,description=coalesce(trim(product_description),''),short_description=coalesce(trim(product_short_description),''),sku=nullif(trim(product_sku),''),price=product_price,compare_at_price=product_compare_at_price,stock_quantity=product_stock_quantity,track_inventory=product_track_inventory,status=product_status,published_at=case when product_status='ACTIVE' then coalesce(published_at,now()) else published_at end where id=target_product and tenant_id=target_tenant returning id into saved;
  if saved is null then raise exception 'PRODUCT_NOT_FOUND'; end if;
  delete from public.product_categories where tenant_id=target_tenant and product_id=saved;
 end if;
 insert into public.product_categories(tenant_id,product_id,category_id) select target_tenant,saved,c from unnest(coalesce(category_ids,'{}'::uuid[])) c;
 if asset_storage_key is not null then
  if asset_storage_provider<>'cloudinary' or asset_public_url is null or asset_public_url not like 'https://%' or asset_file_name is null or asset_resource_type not in ('image','video') or asset_mime_type not in ('image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm') or asset_file_size not between 1 and 5242880 or asset_storage_key not like 'businesscare/tenants/'||target_tenant::text||'/%' or (asset_resource_type='image' and asset_mime_type not like 'image/%') or (asset_resource_type='video' and asset_mime_type not like 'video/%') then raise exception 'INVALID_MEDIA' using errcode='22023'; end if;
  insert into public.media_assets(tenant_id,storage_provider,storage_key,public_url_or_resolvable_key,file_name,mime_type,file_size,width,height,alt_text,created_by,resource_type,format)
  values(target_tenant,'cloudinary',asset_storage_key,asset_public_url,asset_file_name,asset_mime_type,asset_file_size,asset_width,asset_height,nullif(trim(asset_alt_text),''),actor,asset_resource_type,nullif(asset_format,'')) returning id into asset;
  insert into public.product_media(tenant_id,product_id,asset_id,alt_text) values(target_tenant,saved,asset,coalesce(trim(asset_alt_text),''));
  update public.products set primary_image_asset_id=asset where id=saved;
  if previous_asset is not null and previous_asset<>asset then
   delete from public.product_media where tenant_id=target_tenant and product_id=saved and asset_id=previous_asset;
   delete from public.media_assets where tenant_id=target_tenant and id=previous_asset
    and not exists(select 1 from public.products where tenant_id=target_tenant and primary_image_asset_id=previous_asset)
    and not exists(select 1 from public.categories where tenant_id=target_tenant and image_asset_id=previous_asset)
    and not exists(select 1 from public.product_media where tenant_id=target_tenant and asset_id=previous_asset);
  end if;
 end if;
 update public.tenant_onboarding set products_added=exists(select 1 from public.products where tenant_id=target_tenant and status<>'ARCHIVED') where tenant_id=target_tenant;
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id) values(target_tenant,actor,case when target_product is null then 'PRODUCT_CREATED' else 'PRODUCT_UPDATED' end,'products',saved);
 return saved;
end $$;
revoke all on function public.save_product(uuid,uuid,text,text,text,text,text,numeric,numeric,integer,boolean,text,uuid[],text,text,text,text,bigint,text,text,text,text,integer,integer) from public,anon;
grant execute on function public.save_product(uuid,uuid,text,text,text,text,text,numeric,numeric,integer,boolean,text,uuid[],text,text,text,text,bigint,text,text,text,text,integer,integer) to authenticated;

create function public.delete_media_asset(target_tenant uuid,target_asset uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not private.can_manage_catalog(target_tenant) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if exists(select 1 from public.products where tenant_id=target_tenant and primary_image_asset_id=target_asset)
  or exists(select 1 from public.categories where tenant_id=target_tenant and image_asset_id=target_asset)
  or exists(select 1 from public.product_media where tenant_id=target_tenant and asset_id=target_asset)
 then raise exception 'MEDIA_IN_USE' using errcode='23503'; end if;
 delete from public.media_assets where tenant_id=target_tenant and id=target_asset;
end $$;
revoke all on function public.delete_media_asset(uuid,uuid) from public,anon;
grant execute on function public.delete_media_asset(uuid,uuid) to authenticated;

drop function public.delete_product(uuid,uuid);
create function public.delete_product(target_tenant uuid,target_product uuid) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid; assets uuid[];
begin
 if not private.can_manage_catalog(target_tenant) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if not exists(select 1 from public.products where id=target_product and tenant_id=target_tenant) then raise exception 'PRODUCT_NOT_FOUND'; end if;
 select id into actor from public.users where auth_user_id=auth.uid();
 select coalesce(array_agg(asset_id),'{}'::uuid[]) into assets from public.product_media where tenant_id=target_tenant and product_id=target_product;
 delete from public.product_media where tenant_id=target_tenant and product_id=target_product;
 delete from public.product_categories where tenant_id=target_tenant and product_id=target_product;
 delete from public.products where tenant_id=target_tenant and id=target_product;
 delete from public.media_assets m where m.tenant_id=target_tenant and m.id=any(assets)
  and not exists(select 1 from public.products where tenant_id=target_tenant and primary_image_asset_id=m.id)
  and not exists(select 1 from public.categories where tenant_id=target_tenant and image_asset_id=m.id)
  and not exists(select 1 from public.product_media where tenant_id=target_tenant and asset_id=m.id);
 update public.tenant_onboarding set products_added=exists(select 1 from public.products where tenant_id=target_tenant and status<>'ARCHIVED') where tenant_id=target_tenant;
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id) values(target_tenant,actor,'PRODUCT_DELETED','products',target_product);
end $$;
revoke all on function public.delete_product(uuid,uuid) from public,anon;
grant execute on function public.delete_product(uuid,uuid) to authenticated;

create or replace function public.get_public_storefront(store_slug text) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'tenant',jsonb_build_object('name',t.name,'slug',t.slug),
  'products',coalesce((
   select jsonb_agg(jsonb_build_object(
    'id',p.id,'name',p.name,'slug',p.slug,'shortDescription',p.short_description,
    'description',p.description,'price',p.price,'currency',p.currency,
    'stockQuantity',p.stock_quantity,'trackInventory',p.track_inventory,
    'mediaUrl',a.public_url_or_resolvable_key,'mediaType',a.resource_type,'mediaAlt',a.alt_text,
    'categories',coalesce((select jsonb_agg(c.name order by c.sort_order,c.name)
      from public.product_categories pc join public.categories c on c.tenant_id=pc.tenant_id and c.id=pc.category_id
      where pc.tenant_id=p.tenant_id and pc.product_id=p.id and c.status='ACTIVE'),'[]'::jsonb)
   ) order by p.created_at desc)
   from public.products p left join public.media_assets a on a.tenant_id=p.tenant_id and a.id=p.primary_image_asset_id
   where p.tenant_id=t.id and p.status='ACTIVE'
  ),'[]'::jsonb)
 ) from public.tenants t where t.slug=store_slug and t.status in ('TRIAL','ACTIVE');
$$;
