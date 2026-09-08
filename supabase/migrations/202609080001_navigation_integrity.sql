-- Navigation is managed independently from storefront design and retains typed tenant relationships.
alter table public.navigation_items
 add column page_id uuid,
 add column category_id uuid,
 add column created_at timestamptz not null default now(),
 add column updated_at timestamptz not null default now();

-- Restore exact internal links that earlier design saves degraded to URL records.
update public.navigation_items n set link_type='PAGE',page_id=p.id
from public.pages p
where n.tenant_id=p.tenant_id and n.link_type in ('PAGE','URL')
 and n.target=case when p.page_type='HOME' then '/' else '/'||p.slug end;
update public.navigation_items n set link_type='CATEGORY',category_id=c.id
from public.categories c
where n.tenant_id=c.tenant_id and n.link_type in ('CATEGORY','URL')
 and n.target='/categories/'||c.slug;
update public.navigation_items set link_type='URL',page_id=null,category_id=null
where (link_type='PAGE' and page_id is null) or (link_type='CATEGORY' and category_id is null);

-- Keep the earliest copy when a degraded URL and its typed record both existed.
delete from public.navigation_items duplicate
using public.navigation_items retained
where duplicate.tenant_id=retained.tenant_id and duplicate.location=retained.location
 and duplicate.link_type=retained.link_type and duplicate.id<>retained.id
 and (duplicate.sort_order>retained.sort_order
   or (duplicate.sort_order=retained.sort_order and duplicate.id::text>retained.id::text))
 and ((duplicate.link_type='PAGE' and duplicate.page_id=retained.page_id)
   or (duplicate.link_type='CATEGORY' and duplicate.category_id=retained.category_id));

alter table public.navigation_items
 add foreign key(tenant_id,page_id) references public.pages(tenant_id,id) on delete cascade,
 add foreign key(tenant_id,category_id) references public.categories(tenant_id,id) on delete cascade,
 add constraint navigation_target_matches_type check(
  (link_type='PAGE' and page_id is not null and category_id is null)
  or (link_type='CATEGORY' and category_id is not null and page_id is null)
  or (link_type='URL' and page_id is null and category_id is null)
 );
create unique index navigation_page_location_idx on public.navigation_items(tenant_id,location,page_id) where page_id is not null;
create unique index navigation_category_location_idx on public.navigation_items(tenant_id,location,category_id) where category_id is not null;
create trigger navigation_items_updated before update on public.navigation_items for each row execute function private.touch_updated_at();

create function private.resolve_navigation_target() returns trigger
language plpgsql security definer set search_path='' as $$
declare destination_slug text; destination_type text;
begin
 if new.link_type='PAGE' then
  if new.page_id is null then
   select p.id into new.page_id from public.pages p
   where p.tenant_id=new.tenant_id and new.target=case when p.page_type='HOME' then '/' else '/'||p.slug end;
  end if;
  select p.slug,p.page_type into destination_slug,destination_type from public.pages p where p.tenant_id=new.tenant_id and p.id=new.page_id;
  if destination_slug is null then raise exception 'NAVIGATION_PAGE_NOT_FOUND' using errcode='22023'; end if;
  new.target:=case when destination_type='HOME' then '/' else '/'||destination_slug end;
  new.category_id:=null;
 elsif new.link_type='CATEGORY' then
  if new.category_id is null then
   select c.id into new.category_id from public.categories c where c.tenant_id=new.tenant_id and new.target='/categories/'||c.slug;
  end if;
  select c.slug into destination_slug from public.categories c where c.tenant_id=new.tenant_id and c.id=new.category_id;
  if destination_slug is null then raise exception 'NAVIGATION_CATEGORY_NOT_FOUND' using errcode='22023'; end if;
  new.target:='/categories/'||destination_slug;
  new.page_id:=null;
 else
  new.page_id:=null;
  new.category_id:=null;
  if new.target is null or length(trim(new.target)) not between 1 and 300
   or not (new.target ~ '^/[A-Za-z0-9/#?&._=%+-]*$' or new.target ~ '^https://[^[:space:]]+$')
  then raise exception 'INVALID_NAVIGATION_URL' using errcode='22023'; end if;
  new.target:=trim(new.target);
 end if;
 return new;
end $$;
revoke all on function private.resolve_navigation_target() from public;
create trigger navigation_resolve_target before insert or update of tenant_id,link_type,page_id,category_id,target on public.navigation_items for each row execute function private.resolve_navigation_target();

create function private.refresh_category_navigation() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.slug is distinct from old.slug then
  update public.navigation_items set target='/categories/'||new.slug
  where tenant_id=new.tenant_id and link_type='CATEGORY' and category_id=new.id;
 end if;
 return new;
end $$;
revoke all on function private.refresh_category_navigation() from public;
create trigger categories_refresh_navigation after update of slug on public.categories for each row execute function private.refresh_category_navigation();

create function public.save_navigation(target_tenant uuid,navigation jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid; item jsonb; item_type text; item_target text; item_page uuid; item_category uuid;
begin
 if not private.can_manage_catalog(target_tenant) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if navigation is null or jsonb_typeof(navigation)<>'array' or jsonb_array_length(navigation)>8
 then raise exception 'INVALID_NAVIGATION' using errcode='22023'; end if;
 for item in select value from jsonb_array_elements(navigation) loop
  item_type:=item->>'linkType';
  item_target:=trim(coalesce(item->>'target',''));
  item_page:=nullif(item->>'pageId','')::uuid;
  item_category:=nullif(item->>'categoryId','')::uuid;
  if jsonb_typeof(item)<>'object' or length(trim(coalesce(item->>'label',''))) not between 1 and 60
   or coalesce(item->>'location','') not in ('HEADER','FOOTER') or item_type not in ('PAGE','URL','CATEGORY')
   or (item_type='PAGE' and not exists(select 1 from public.pages p where p.tenant_id=target_tenant and p.id=item_page))
   or (item_type='CATEGORY' and not exists(select 1 from public.categories c where c.tenant_id=target_tenant and c.id=item_category))
   or (item_type='URL' and not (item_target ~ '^/[A-Za-z0-9/#?&._=%+-]*$' or item_target ~ '^https://[^[:space:]]+$'))
  then raise exception 'INVALID_NAVIGATION' using errcode='22023'; end if;
 end loop;
 delete from public.navigation_items where tenant_id=target_tenant;
 insert into public.navigation_items(tenant_id,label,target,sort_order,location,link_type,is_enabled,page_id,category_id)
 select target_tenant,trim(value->>'label'),trim(coalesce(value->>'target','')),ordinality-1,value->>'location',value->>'linkType',coalesce((value->>'enabled')::boolean,true),nullif(value->>'pageId','')::uuid,nullif(value->>'categoryId','')::uuid
 from jsonb_array_elements(navigation) with ordinality;
 select id into actor from public.users where auth_user_id=auth.uid();
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id)
 values(target_tenant,actor,'STORE_NAVIGATION_UPDATED','navigation_items',target_tenant);
end $$;
revoke all on function public.save_navigation(uuid,jsonb) from public,anon;
grant execute on function public.save_navigation(uuid,jsonb) to authenticated;

create or replace function public.save_site_draft(
 target_tenant uuid,business_name text,business_description text,business_phone text,business_address text,
 theme_preset text,primary_color text,accent_color text,background_color text,text_color text,
 announcement_text text,announcement_enabled boolean,hero_eyebrow text,hero_headline text,hero_subheadline text,
 hero_cta_label text,hero_variant text,products_heading text,products_enabled boolean,footer_description text,navigation jsonb,
 logo_storage_key text default null,logo_public_url text default null,logo_file_name text default null,logo_mime_type text default null,
 logo_file_size bigint default null,logo_alt_text text default null,logo_format text default null,logo_width integer default null,logo_height integer default null,
 hero_storage_key text default null,hero_public_url text default null,hero_file_name text default null,hero_mime_type text default null,
 hero_file_size bigint default null,hero_alt_text text default null,hero_format text default null,hero_width integer default null,hero_height integer default null
) returns void
language plpgsql security definer set search_path='' as $$
declare page uuid; actor uuid; logo uuid; hero uuid; old_logo uuid; old_hero uuid;
begin
 if not private.can_manage_catalog(target_tenant) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if business_name is null or length(trim(business_name)) not between 1 and 160
  or length(coalesce(business_description,''))>600 or length(coalesce(business_phone,''))>40
  or length(coalesce(business_address,''))>300 or theme_preset not in ('fashion','beauty','restaurant','general')
  or not private.valid_hex_color(primary_color) or not private.valid_hex_color(accent_color)
  or not private.valid_hex_color(background_color) or not private.valid_hex_color(text_color)
  or length(coalesce(announcement_text,''))>160 or length(coalesce(hero_eyebrow,''))>80
  or hero_headline is null or length(trim(hero_headline)) not between 1 and 160
  or length(coalesce(hero_subheadline,''))>320 or length(coalesce(hero_cta_label,''))>60
  or hero_variant not in ('centered','split','image-overlay')
  or products_heading is null or length(trim(products_heading)) not between 1 and 120
  or length(coalesce(footer_description,''))>500 or navigation is null or jsonb_typeof(navigation)<>'array'
 then raise exception 'INVALID_SITE_DRAFT' using errcode='22023'; end if;
 select id into actor from public.users where auth_user_id=auth.uid();
 select b.logo_asset_id,b.hero_asset_id into old_logo,old_hero from public.tenant_business_settings b where b.tenant_id=target_tenant for update;
 if logo_storage_key is not null then
  insert into public.media_assets(tenant_id,storage_provider,storage_key,public_url_or_resolvable_key,file_name,mime_type,file_size,width,height,alt_text,created_by,resource_type,format)
  values(target_tenant,'cloudinary',logo_storage_key,logo_public_url,logo_file_name,logo_mime_type,logo_file_size,logo_width,logo_height,nullif(trim(logo_alt_text),''),actor,'image',logo_format) returning id into logo;
 else logo:=old_logo; end if;
 if hero_storage_key is not null then
  insert into public.media_assets(tenant_id,storage_provider,storage_key,public_url_or_resolvable_key,file_name,mime_type,file_size,width,height,alt_text,created_by,resource_type,format)
  values(target_tenant,'cloudinary',hero_storage_key,hero_public_url,hero_file_name,hero_mime_type,hero_file_size,hero_width,hero_height,nullif(trim(hero_alt_text),''),actor,'image',hero_format) returning id into hero;
 else hero:=old_hero; end if;
 update public.tenant_business_settings set business_name=trim(save_site_draft.business_name),description=trim(coalesce(business_description,'')),phone=trim(coalesce(business_phone,'')),address=trim(coalesce(business_address,'')),logo_asset_id=logo,hero_asset_id=hero where tenant_id=target_tenant;
 update public.tenants set name=trim(save_site_draft.business_name),template_key=theme_preset where id=target_tenant;
 update public.tenant_theme_settings set preset_key=theme_preset,tokens=jsonb_build_object('primary',lower(primary_color),'accent',lower(accent_color),'background',lower(background_color),'text',lower(text_color)) where tenant_id=target_tenant;
 select id into page from public.pages where tenant_id=target_tenant and page_type='HOME';
 insert into public.content_blocks(tenant_id,page_id,block_key,block_type,variant,sort_order,is_enabled,content) values
 (target_tenant,page,'announcement','announcement','minimal',0,announcement_enabled,jsonb_build_object('text',trim(coalesce(announcement_text,'')))),
 (target_tenant,page,'hero','hero',hero_variant,1,true,jsonb_build_object('eyebrow',trim(coalesce(hero_eyebrow,'')),'headline',trim(hero_headline),'subheadline',trim(coalesce(hero_subheadline,'')),'primaryCta',jsonb_build_object('label',trim(coalesce(hero_cta_label,'')),'href','#products'))),
 (target_tenant,page,'products','products','grid',2,products_enabled,jsonb_build_object('heading',trim(products_heading))),
 (target_tenant,page,'footer','footer','minimal',3,true,jsonb_build_object('description',trim(coalesce(footer_description,''))))
 on conflict(tenant_id,page_id,block_key) do update set block_type=excluded.block_type,variant=excluded.variant,is_enabled=excluded.is_enabled,content=excluded.content;
 update public.tenant_onboarding set theme_selected=true,homepage_configured=true where tenant_id=target_tenant;
 delete from public.media_assets m where m.tenant_id=target_tenant and m.id in (old_logo,old_hero) and m.id not in (logo,hero)
  and not exists(select 1 from public.product_media pm where pm.tenant_id=target_tenant and pm.asset_id=m.id)
  and not exists(select 1 from public.products p where p.tenant_id=target_tenant and p.primary_image_asset_id=m.id);
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id) values(target_tenant,actor,'SITE_DRAFT_UPDATED','pages',page);
end $$;
