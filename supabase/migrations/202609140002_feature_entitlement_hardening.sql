-- Additive Phase 9 hardening: attributable audit context and correct handling
-- for archived products, which do not consume the non-archived allowance.

alter table public.audit_logs add column context jsonb not null default '{}'::jsonb
 check(jsonb_typeof(context)='object');

create or replace function public.save_plan_feature(
 target_plan text,target_feature text,new_value jsonb,value_is_unlimited boolean default false
)
returns void language plpgsql security definer set search_path='' as $$
declare plan uuid; feature_type text; actor uuid;
begin
 if not private.is_super_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select id into plan from public.plans where slug=target_plan;
 select value_type into feature_type from public.features where key=target_feature and is_active;
 if value_is_unlimited and feature_type='INTEGER' then new_value='null'::jsonb; end if;
 if plan is null or feature_type is null or not private.feature_value_is_valid(feature_type,new_value) then
  raise exception 'INVALID_FEATURE_VALUE' using errcode='22023';
 end if;
 insert into public.plan_features(plan_id,feature_key,value) values(plan,target_feature,new_value)
 on conflict(plan_id,feature_key) do update set value=excluded.value;
 select id into actor from public.users where auth_user_id=auth.uid();
 insert into public.audit_logs(actor_user_id,action,resource_type,resource_id,context)
 values(actor,'PLAN_FEATURE_UPDATED','plan_features',plan,jsonb_build_object('featureKey',target_feature));
end;
$$;

create or replace function public.save_tenant_feature_override(
 target_tenant uuid,target_feature text,new_value jsonb,override_reason text,
 override_expires_at timestamptz,value_is_unlimited boolean default false
) returns void language plpgsql security definer set search_path='' as $$
declare feature_type text; actor uuid;
begin
 if not private.is_super_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if not exists(select 1 from public.tenants where id=target_tenant) then raise exception 'TENANT_NOT_FOUND' using errcode='22023'; end if;
 select value_type into feature_type from public.features where key=target_feature and is_active;
 if value_is_unlimited and feature_type='INTEGER' then new_value='null'::jsonb; end if;
 if feature_type is null or not private.feature_value_is_valid(feature_type,new_value)
  or length(trim(coalesce(override_reason,''))) not between 3 and 500
  or (override_expires_at is not null and override_expires_at<=now()) then
  raise exception 'INVALID_FEATURE_OVERRIDE' using errcode='22023';
 end if;
 select id into actor from public.users where auth_user_id=auth.uid();
 insert into public.tenant_feature_overrides(
  tenant_id,feature_key,value,reason,expires_at,created_by
 ) values(target_tenant,target_feature,new_value,trim(override_reason),override_expires_at,actor)
 on conflict(tenant_id,feature_key) do update set
  value=excluded.value,reason=excluded.reason,expires_at=excluded.expires_at,
  created_by=excluded.created_by,updated_at=now();
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id,context)
 values(target_tenant,actor,'TENANT_FEATURE_OVERRIDE_SAVED','tenant_feature_overrides',target_tenant,
  jsonb_build_object('featureKey',target_feature));
end;
$$;

create or replace function public.delete_tenant_feature_override(target_tenant uuid,target_feature text)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid; removed_count bigint;
begin
 if not private.is_super_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select id into actor from public.users where auth_user_id=auth.uid();
 delete from public.tenant_feature_overrides where tenant_id=target_tenant and feature_key=target_feature;
 get diagnostics removed_count=row_count;
 if removed_count=0 then raise exception 'FEATURE_OVERRIDE_NOT_FOUND' using errcode='22023'; end if;
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id,context)
 values(target_tenant,actor,'TENANT_FEATURE_OVERRIDE_REMOVED','tenant_feature_overrides',target_tenant,
  jsonb_build_object('featureKey',target_feature));
end;
$$;

create or replace function public.set_feature_global_state(target_feature text,is_enabled boolean,state_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
 if not private.is_super_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if not exists(select 1 from public.features where key=target_feature and value_type='BOOLEAN' and is_active)
  or is_enabled is null or (not is_enabled and length(trim(coalesce(state_reason,''))) not between 3 and 500) then
  raise exception 'INVALID_FEATURE_STATE' using errcode='22023';
 end if;
 select id into actor from public.users where auth_user_id=auth.uid();
 insert into public.feature_global_state(feature_key,enabled,reason,updated_by)
 values(target_feature,is_enabled,case when is_enabled then null else trim(state_reason) end,actor)
 on conflict(feature_key) do update set enabled=excluded.enabled,reason=excluded.reason,
  updated_by=excluded.updated_by,updated_at=now();
 insert into public.audit_logs(actor_user_id,action,resource_type,context)
 values(actor,case when is_enabled then 'FEATURE_GLOBAL_ENABLED' else 'FEATURE_GLOBAL_DISABLED' end,
  'feature_global_state',jsonb_build_object('featureKey',target_feature));
end;
$$;

create or replace function public.save_product(
 target_tenant uuid,target_product uuid,product_name text,product_slug text,product_description text,
 product_short_description text,product_sku text,product_price numeric,product_compare_at_price numeric,
 product_stock_quantity integer,product_track_inventory boolean,product_status text,category_ids uuid[],
 asset_storage_key text default null,asset_public_url text default null,asset_file_name text default null,
 asset_mime_type text default null,asset_file_size bigint default null,asset_alt_text text default null,
 asset_storage_provider text default null,asset_resource_type text default null,asset_format text default null,
 asset_width integer default null,asset_height integer default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare saved uuid; asset uuid; previous_asset uuid; actor uuid; product_count integer; tenant_currency text; previous_status text;
begin
 if not private.can_manage_catalog(target_tenant) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if product_name is null or length(trim(product_name)) not between 1 and 160 or product_slug is null or product_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(product_slug)>160 or product_price is null or product_price<0 or product_stock_quantity is null or product_stock_quantity<0 or product_status not in ('DRAFT','ACTIVE','ARCHIVED') or (product_compare_at_price is not null and product_compare_at_price<product_price) then raise exception 'INVALID_PRODUCT' using errcode='22023'; end if;
 if exists(select 1 from unnest(coalesce(category_ids,'{}'::uuid[])) c where not exists(select 1 from public.categories where id=c and tenant_id=target_tenant)) then raise exception 'INVALID_CATEGORY' using errcode='22023'; end if;
 select id into actor from public.users where auth_user_id=auth.uid();
 select default_currency into tenant_currency from public.tenants where id=target_tenant;
 if target_product is null then
  if product_status<>'ARCHIVED' then
   perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_tenant::text||':product_limit',0));
   select count(*) into product_count from public.products where tenant_id=target_tenant and status<>'ARCHIVED';
   perform private.assert_usage_within_limit(target_tenant,'product_limit',product_count);
  end if;
  insert into public.products(tenant_id,name,slug,description,short_description,sku,price,compare_at_price,currency,stock_quantity,track_inventory,status,published_at)
  values(target_tenant,trim(product_name),product_slug,coalesce(trim(product_description),''),coalesce(trim(product_short_description),''),nullif(trim(product_sku),''),product_price,product_compare_at_price,tenant_currency,product_stock_quantity,product_track_inventory,product_status,case when product_status='ACTIVE' then now() end) returning id into saved;
 else
  select primary_image_asset_id,status into previous_asset,previous_status from public.products where id=target_product and tenant_id=target_tenant;
  if previous_status is null then raise exception 'PRODUCT_NOT_FOUND'; end if;
  if previous_status='ARCHIVED' and product_status<>'ARCHIVED' then
   perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_tenant::text||':product_limit',0));
   select count(*) into product_count from public.products where tenant_id=target_tenant and status<>'ARCHIVED';
   perform private.assert_usage_within_limit(target_tenant,'product_limit',product_count);
  end if;
  update public.products set name=trim(product_name),slug=product_slug,description=coalesce(trim(product_description),''),short_description=coalesce(trim(product_short_description),''),sku=nullif(trim(product_sku),''),price=product_price,compare_at_price=product_compare_at_price,stock_quantity=product_stock_quantity,track_inventory=product_track_inventory,status=product_status,published_at=case when product_status='ACTIVE' then coalesce(published_at,now()) else published_at end where id=target_product and tenant_id=target_tenant returning id into saved;
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
