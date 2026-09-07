-- Tenant-scoped catalog, product media metadata, and public storefront projections.
create table public.media_assets (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id),
 storage_provider text not null default 'supabase',
 storage_key text not null unique,
 public_url_or_resolvable_key text not null,
 file_name text not null,
 mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','image/gif')),
 file_size bigint not null check (file_size between 1 and 5242880),
 width integer check (width is null or width > 0),
 height integer check (height is null or height > 0),
 alt_text text,
 created_by uuid references public.users(id),
 created_at timestamptz not null default now(),
 unique(tenant_id,id)
);

create table public.categories (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id),
 name text not null check (length(trim(name)) between 1 and 100),
 slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 description text not null default '',
 image_asset_id uuid,
 status text not null default 'ACTIVE' check (status in ('DRAFT','ACTIVE','ARCHIVED')),
 sort_order integer not null default 0 check (sort_order >= 0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(tenant_id,slug),
 unique(tenant_id,id),
 foreign key(tenant_id,image_asset_id) references public.media_assets(tenant_id,id)
);

create table public.products (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id),
 name text not null check (length(trim(name)) between 1 and 160),
 slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 description text not null default '',
 short_description text not null default '',
 sku text,
 price numeric(14,2) not null check (price >= 0),
 compare_at_price numeric(14,2) check (compare_at_price is null or compare_at_price >= price),
 currency text not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
 stock_quantity integer not null default 0 check (stock_quantity >= 0),
 track_inventory boolean not null default true,
 status text not null default 'DRAFT' check (status in ('DRAFT','ACTIVE','ARCHIVED')),
 primary_image_asset_id uuid,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 published_at timestamptz,
 unique(tenant_id,slug),
 unique(tenant_id,id),
 foreign key(tenant_id,primary_image_asset_id) references public.media_assets(tenant_id,id)
);

create table public.product_categories (
 tenant_id uuid not null references public.tenants(id),
 product_id uuid not null,
 category_id uuid not null,
 primary key(product_id,category_id),
 foreign key(tenant_id,product_id) references public.products(tenant_id,id) on delete cascade,
 foreign key(tenant_id,category_id) references public.categories(tenant_id,id) on delete cascade
);

create table public.product_media (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id),
 product_id uuid not null,
 asset_id uuid not null,
 sort_order integer not null default 0 check (sort_order >= 0),
 alt_text text not null default '',
 created_at timestamptz not null default now(),
 foreign key(tenant_id,product_id) references public.products(tenant_id,id) on delete cascade,
 foreign key(tenant_id,asset_id) references public.media_assets(tenant_id,id),
 unique(product_id,asset_id)
);

create index products_tenant_status_idx on public.products(tenant_id,status);
create index categories_tenant_status_idx on public.categories(tenant_id,status);
create index product_media_product_idx on public.product_media(tenant_id,product_id,sort_order);
create index product_categories_category_idx on public.product_categories(tenant_id,category_id);

create trigger categories_updated before update on public.categories for each row execute function private.touch_updated_at();
create trigger products_updated before update on public.products for each row execute function private.touch_updated_at();

create function private.can_manage_catalog(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select (select private.is_super_admin()) or exists(
  select 1 from public.tenant_memberships m join public.users u on u.id=m.user_id
  join public.tenants t on t.id=m.tenant_id
  where m.tenant_id=target and u.auth_user_id=(select auth.uid()) and u.status='ACTIVE'
   and m.status='ACTIVE' and m.role in ('TENANT_OWNER','TENANT_ADMIN','TENANT_MANAGER')
   and t.status in ('PROVISIONING','TRIAL','ACTIVE')
 );
$$;
revoke all on function private.can_manage_catalog(uuid) from public;
grant execute on function private.can_manage_catalog(uuid) to authenticated;

alter table public.media_assets enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_categories enable row level security;
alter table public.product_media enable row level security;
revoke all on public.media_assets,public.categories,public.products,public.product_categories,public.product_media from anon,authenticated;
grant select on public.media_assets,public.categories,public.products,public.product_categories,public.product_media to authenticated;
create policy tenant_read on public.media_assets for select to authenticated using ((select private.is_super_admin()) or private.is_tenant_member(tenant_id));
create policy tenant_read on public.categories for select to authenticated using ((select private.is_super_admin()) or private.is_tenant_member(tenant_id));
create policy tenant_read on public.products for select to authenticated using ((select private.is_super_admin()) or private.is_tenant_member(tenant_id));
create policy tenant_read on public.product_categories for select to authenticated using ((select private.is_super_admin()) or private.is_tenant_member(tenant_id));
create policy tenant_read on public.product_media for select to authenticated using ((select private.is_super_admin()) or private.is_tenant_member(tenant_id));

create function public.save_category(target_tenant uuid,target_category uuid,category_name text,category_slug text,category_description text,category_status text) returns uuid
language plpgsql security definer set search_path='' as $$
declare saved uuid; actor uuid;
begin
 if not private.can_manage_catalog(target_tenant) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if category_name is null or length(trim(category_name)) not between 1 and 100 or category_slug is null or category_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(category_slug)>100 or category_status not in ('DRAFT','ACTIVE','ARCHIVED') then raise exception 'INVALID_CATEGORY' using errcode='22023'; end if;
 select id into actor from public.users where auth_user_id=auth.uid();
 if target_category is null then
  insert into public.categories(tenant_id,name,slug,description,status) values(target_tenant,trim(category_name),category_slug,coalesce(trim(category_description),''),category_status) returning id into saved;
 else
  update public.categories set name=trim(category_name),slug=category_slug,description=coalesce(trim(category_description),''),status=category_status where id=target_category and tenant_id=target_tenant returning id into saved;
  if saved is null then raise exception 'CATEGORY_NOT_FOUND'; end if;
 end if;
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id) values(target_tenant,actor,case when target_category is null then 'CATEGORY_CREATED' else 'CATEGORY_UPDATED' end,'categories',saved);
 return saved;
end $$;
revoke all on function public.save_category(uuid,uuid,text,text,text,text) from public,anon;
grant execute on function public.save_category(uuid,uuid,text,text,text,text) to authenticated;

create function public.delete_category(target_tenant uuid,target_category uuid) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
 if not private.can_manage_catalog(target_tenant) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if not exists(select 1 from public.categories where id=target_category and tenant_id=target_tenant) then raise exception 'CATEGORY_NOT_FOUND'; end if;
 select id into actor from public.users where auth_user_id=auth.uid();
 delete from public.categories where id=target_category and tenant_id=target_tenant;
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id) values(target_tenant,actor,'CATEGORY_DELETED','categories',target_category);
end $$;
revoke all on function public.delete_category(uuid,uuid) from public,anon;
grant execute on function public.delete_category(uuid,uuid) to authenticated;

create function public.save_product(
 target_tenant uuid,target_product uuid,product_name text,product_slug text,product_description text,
 product_short_description text,product_sku text,product_price numeric,product_compare_at_price numeric,
 product_stock_quantity integer,product_track_inventory boolean,product_status text,category_ids uuid[],
 asset_storage_key text default null,asset_public_url text default null,asset_file_name text default null,
 asset_mime_type text default null,asset_file_size bigint default null,asset_alt_text text default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare saved uuid; asset uuid; actor uuid; product_count integer; product_limit integer; tenant_currency text;
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
  update public.products set name=trim(product_name),slug=product_slug,description=coalesce(trim(product_description),''),short_description=coalesce(trim(product_short_description),''),sku=nullif(trim(product_sku),''),price=product_price,compare_at_price=product_compare_at_price,stock_quantity=product_stock_quantity,track_inventory=product_track_inventory,status=product_status,published_at=case when product_status='ACTIVE' then coalesce(published_at,now()) else published_at end where id=target_product and tenant_id=target_tenant returning id into saved;
  if saved is null then raise exception 'PRODUCT_NOT_FOUND'; end if;
  delete from public.product_categories where tenant_id=target_tenant and product_id=saved;
 end if;
 insert into public.product_categories(tenant_id,product_id,category_id) select target_tenant,saved,c from unnest(coalesce(category_ids,'{}'::uuid[])) c;
 if asset_storage_key is not null then
  if asset_public_url is null or asset_file_name is null or asset_mime_type not in ('image/jpeg','image/png','image/webp','image/gif') or asset_file_size not between 1 and 5242880 or asset_storage_key not like 'tenants/'||target_tenant::text||'/%' then raise exception 'INVALID_MEDIA' using errcode='22023'; end if;
  insert into public.media_assets(tenant_id,storage_key,public_url_or_resolvable_key,file_name,mime_type,file_size,alt_text,created_by) values(target_tenant,asset_storage_key,asset_public_url,asset_file_name,asset_mime_type,asset_file_size,nullif(trim(asset_alt_text),''),actor) returning id into asset;
  insert into public.product_media(tenant_id,product_id,asset_id,alt_text) values(target_tenant,saved,asset,coalesce(trim(asset_alt_text),''));
  update public.products set primary_image_asset_id=asset where id=saved;
 end if;
 update public.tenant_onboarding set products_added=exists(select 1 from public.products where tenant_id=target_tenant and status<>'ARCHIVED') where tenant_id=target_tenant;
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id) values(target_tenant,actor,case when target_product is null then 'PRODUCT_CREATED' else 'PRODUCT_UPDATED' end,'products',saved);
 return saved;
end $$;
revoke all on function public.save_product(uuid,uuid,text,text,text,text,text,numeric,numeric,integer,boolean,text,uuid[],text,text,text,text,bigint,text) from public,anon;
grant execute on function public.save_product(uuid,uuid,text,text,text,text,text,numeric,numeric,integer,boolean,text,uuid[],text,text,text,text,bigint,text) to authenticated;

create function public.delete_product(target_tenant uuid,target_product uuid) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
 if not private.can_manage_catalog(target_tenant) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if not exists(select 1 from public.products where id=target_product and tenant_id=target_tenant) then raise exception 'PRODUCT_NOT_FOUND'; end if;
 select id into actor from public.users where auth_user_id=auth.uid();
 delete from public.product_media where tenant_id=target_tenant and product_id=target_product;
 delete from public.product_categories where tenant_id=target_tenant and product_id=target_product;
 delete from public.products where tenant_id=target_tenant and id=target_product;
 update public.tenant_onboarding set products_added=exists(select 1 from public.products where tenant_id=target_tenant and status<>'ARCHIVED') where tenant_id=target_tenant;
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id) values(target_tenant,actor,'PRODUCT_DELETED','products',target_product);
end $$;
revoke all on function public.delete_product(uuid,uuid) from public,anon;
grant execute on function public.delete_product(uuid,uuid) to authenticated;

create function public.get_public_storefront(store_slug text) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'tenant',jsonb_build_object('name',t.name,'slug',t.slug),
  'products',coalesce((
   select jsonb_agg(jsonb_build_object(
    'id',p.id,'name',p.name,'slug',p.slug,'shortDescription',p.short_description,
    'description',p.description,'price',p.price,'currency',p.currency,
    'stockQuantity',p.stock_quantity,'trackInventory',p.track_inventory,
    'imageUrl',a.public_url_or_resolvable_key,'imageAlt',a.alt_text,
    'categories',coalesce((select jsonb_agg(c.name order by c.sort_order,c.name)
      from public.product_categories pc join public.categories c on c.tenant_id=pc.tenant_id and c.id=pc.category_id
      where pc.tenant_id=p.tenant_id and pc.product_id=p.id and c.status='ACTIVE'),'[]'::jsonb)
   ) order by p.created_at desc)
   from public.products p left join public.media_assets a on a.tenant_id=p.tenant_id and a.id=p.primary_image_asset_id
   where p.tenant_id=t.id and p.status='ACTIVE'
  ),'[]'::jsonb)
 ) from public.tenants t where t.slug=store_slug and t.status in ('TRIAL','ACTIVE');
$$;
revoke all on function public.get_public_storefront(text) from public;
grant execute on function public.get_public_storefront(text) to anon,authenticated;

-- Storage objects are tenant-prefixed. The conditional block keeps plain PostgreSQL CI compatible.
do $$ begin
 if to_regclass('storage.buckets') is not null and to_regclass('storage.objects') is not null then
  insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('catalog-media','catalog-media',true,5242880,array['image/jpeg','image/png','image/webp','image/gif']) on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
  execute 'create policy "catalog tenant uploads" on storage.objects for insert to authenticated with check (bucket_id=''catalog-media'' and (storage.foldername(name))[1]=''tenants'' and private.can_manage_catalog(((storage.foldername(name))[2])::uuid))';
  execute 'create policy "catalog tenant deletes" on storage.objects for delete to authenticated using (bucket_id=''catalog-media'' and (storage.foldername(name))[1]=''tenants'' and private.can_manage_catalog(((storage.foldername(name))[2])::uuid))';
 end if;
end $$;
