-- Bounded catalog read models prevent page work from growing with a tenant's full catalog.
create index products_tenant_active_cursor_idx
 on public.products(tenant_id,status,created_at desc,id desc);
create index products_tenant_name_idx on public.products(tenant_id,name,id);
create index categories_tenant_name_idx on public.categories(tenant_id,name,id);

create or replace function public.get_public_storefront(store_slug text) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'tenant',jsonb_build_object('name',t.name,'slug',t.slug),
  'site',(select v.configuration from public.tenant_site_versions v where v.tenant_id=t.id and v.status='PUBLISHED' limit 1),
  'categories','[]'::jsonb,
  'products',coalesce((select jsonb_agg(item.value order by item.created_at desc,item.id desc) from (
   select p.created_at,p.id,jsonb_build_object(
    'id',p.id,'name',p.name,'slug',p.slug,'shortDescription',p.short_description,'description',p.description,
    'price',p.price,'currency',p.currency,'stockQuantity',p.stock_quantity,'trackInventory',p.track_inventory,
    'mediaUrl',a.public_url_or_resolvable_key,'mediaType',a.resource_type,'mediaAlt',a.alt_text,
    'categories',coalesce((select jsonb_agg(c.name order by c.sort_order,c.name) from public.product_categories pc
      join public.categories c on c.tenant_id=pc.tenant_id and c.id=pc.category_id
      where pc.tenant_id=p.tenant_id and pc.product_id=p.id and c.status='ACTIVE'),'[]'::jsonb)
   ) value from public.products p left join public.media_assets a
    on a.tenant_id=p.tenant_id and a.id=p.primary_image_asset_id
   where p.tenant_id=t.id and p.status='ACTIVE'
   order by p.created_at desc,p.id desc limit 8
  ) item),'[]'::jsonb)
 ) from public.tenants t where t.slug=store_slug and t.status in ('TRIAL','ACTIVE');
$$;

create function public.get_public_product(store_slug text,product_slug text) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'tenant',jsonb_build_object('name',t.name,'slug',t.slug),
  'site',(select v.configuration from public.tenant_site_versions v where v.tenant_id=t.id and v.status='PUBLISHED' limit 1),
  'product',jsonb_build_object(
   'id',p.id,'name',p.name,'slug',p.slug,'shortDescription',p.short_description,'description',p.description,
   'price',p.price,'currency',p.currency,'stockQuantity',p.stock_quantity,'trackInventory',p.track_inventory,
   'mediaUrl',a.public_url_or_resolvable_key,'mediaType',a.resource_type,'mediaAlt',a.alt_text,
   'categories',coalesce((select jsonb_agg(c.name order by c.sort_order,c.name) from public.product_categories pc
     join public.categories c on c.tenant_id=pc.tenant_id and c.id=pc.category_id
     where pc.tenant_id=p.tenant_id and pc.product_id=p.id and c.status='ACTIVE'),'[]'::jsonb)
  )
 ) from public.tenants t join public.products p on p.tenant_id=t.id and p.slug=product_slug and p.status='ACTIVE'
 left join public.media_assets a on a.tenant_id=p.tenant_id and a.id=p.primary_image_asset_id
 where t.slug=store_slug and t.status in ('TRIAL','ACTIVE') limit 1;
$$;
revoke all on function public.get_public_product(text,text) from public;
grant execute on function public.get_public_product(text,text) to anon,authenticated;

create function public.get_public_products(
 store_slug text,search_term text default '',category_slug text default '',
 cursor_created_at timestamptz default null,cursor_id uuid default null,result_limit integer default 24
) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare bounded_limit integer:=least(greatest(coalesce(result_limit,24),1),48); result jsonb;
begin
 select jsonb_build_object(
  'tenant',jsonb_build_object('name',t.name,'slug',t.slug),
  'site',(select v.configuration from public.tenant_site_versions v where v.tenant_id=t.id and v.status='PUBLISHED' limit 1),
  'category',case when selected.id is null then null else jsonb_build_object('id',selected.id,'name',selected.name,'slug',selected.slug,'description',selected.description) end,
  'products',coalesce((select jsonb_agg(row.value order by row.created_at desc,row.id desc) from (
   select p.created_at,p.id,jsonb_build_object(
    'id',p.id,'name',p.name,'slug',p.slug,'shortDescription',p.short_description,'description',p.description,
    'price',p.price,'currency',p.currency,'stockQuantity',p.stock_quantity,'trackInventory',p.track_inventory,
    'mediaUrl',a.public_url_or_resolvable_key,'mediaType',a.resource_type,'mediaAlt',a.alt_text,
    'createdAt',p.created_at,
    'categories',coalesce((select jsonb_agg(c.name order by c.sort_order,c.name) from public.product_categories pc2
      join public.categories c on c.tenant_id=pc2.tenant_id and c.id=pc2.category_id
      where pc2.tenant_id=p.tenant_id and pc2.product_id=p.id and c.status='ACTIVE'),'[]'::jsonb)
   ) value from public.products p left join public.media_assets a on a.tenant_id=p.tenant_id and a.id=p.primary_image_asset_id
   where p.tenant_id=t.id and p.status='ACTIVE'
    and (trim(coalesce(search_term,''))='' or p.name ilike '%'||replace(replace(replace(trim(search_term),'\\',''),'%', ''),'_','')||'%')
    and (selected.id is null or exists(select 1 from public.product_categories pc where pc.tenant_id=p.tenant_id and pc.product_id=p.id and pc.category_id=selected.id))
    and (cursor_created_at is null or (p.created_at,p.id)<(cursor_created_at,cursor_id))
   order by p.created_at desc,p.id desc limit bounded_limit+1
  ) row),'[]'::jsonb)
 ) into result from public.tenants t
 left join public.categories selected on selected.tenant_id=t.id and selected.slug=nullif(trim(coalesce(category_slug,'')),'') and selected.status='ACTIVE'
 where t.slug=store_slug and t.status in ('TRIAL','ACTIVE');
 return result;
end $$;
revoke all on function public.get_public_products(text,text,text,timestamptz,uuid,integer) from public;
grant execute on function public.get_public_products(text,text,text,timestamptz,uuid,integer) to anon,authenticated;

create function public.get_public_sitemap_records(store_slug text) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'tenant',jsonb_build_object('name',t.name,'slug',t.slug),
  'site',(select v.configuration from public.tenant_site_versions v where v.tenant_id=t.id and v.status='PUBLISHED' limit 1),
  'productSlugs',coalesce((select jsonb_agg(p.slug order by p.created_at desc,p.id desc) from (
    select item.slug,item.created_at,item.id from public.products item where item.tenant_id=t.id and item.status='ACTIVE' order by item.created_at desc,item.id desc limit 50000
  ) p),'[]'::jsonb),
  'categorySlugs',coalesce((select jsonb_agg(c.slug order by c.sort_order,c.id) from (
    select item.slug,item.sort_order,item.id from public.categories item where item.tenant_id=t.id and item.status='ACTIVE' order by item.sort_order,item.id limit 50000
  ) c),'[]'::jsonb)
 ) from public.tenants t where t.slug=store_slug and t.status in ('TRIAL','ACTIVE');
$$;
revoke all on function public.get_public_sitemap_records(text) from public;
grant execute on function public.get_public_sitemap_records(text) to anon,authenticated;

create function public.healthcheck() returns integer
language sql stable security definer set search_path='' as $$ select 1 $$;
revoke all on function public.healthcheck() from public;
grant execute on function public.healthcheck() to anon,authenticated;
