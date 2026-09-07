-- Draft theme/content editing with atomic, versioned storefront publishing.
alter table public.tenant_business_settings
 add column description text not null default '',
 add column phone text not null default '',
 add column address text not null default '',
 add column logo_asset_id uuid,
 add column hero_asset_id uuid,
 add foreign key(tenant_id,logo_asset_id) references public.media_assets(tenant_id,id),
 add foreign key(tenant_id,hero_asset_id) references public.media_assets(tenant_id,id);

alter table public.content_blocks
 add column block_type text not null default 'hero',
 add column variant text not null default 'centered',
 add column sort_order integer not null default 0 check(sort_order>=0),
 add column is_enabled boolean not null default true,
 add column settings jsonb not null default '{}'::jsonb;

alter table public.navigation_items
 add column location text not null default 'HEADER' check(location in ('HEADER','FOOTER')),
 add column link_type text not null default 'URL' check(link_type in ('PAGE','URL','CATEGORY')),
 add column is_enabled boolean not null default true;

create table public.tenant_site_versions(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id),
 version_number integer not null check(version_number>0),
 status text not null check(status in ('PUBLISHED','ARCHIVED')),
 configuration jsonb not null,
 published_at timestamptz not null default now(),
 published_by uuid not null references public.users(id),
 created_at timestamptz not null default now(),
 unique(tenant_id,version_number),
 unique(tenant_id,id)
);
create unique index tenant_site_one_published_idx on public.tenant_site_versions(tenant_id) where status='PUBLISHED';
alter table public.tenant_site_versions enable row level security;
revoke all on public.tenant_site_versions from anon,authenticated;
grant select on public.tenant_site_versions to authenticated;
create policy tenant_read on public.tenant_site_versions for select to authenticated
 using ((select private.is_super_admin()) or private.is_tenant_member(tenant_id));

create function private.valid_hex_color(value text) returns boolean
language sql immutable set search_path='' as $$
 select value is not null and value ~ '^#[0-9a-fA-F]{6}$';
$$;
revoke all on function private.valid_hex_color(text) from public;

create function public.save_site_draft(
 target_tenant uuid,
 business_name text,
 business_description text,
 business_phone text,
 business_address text,
 theme_preset text,
 primary_color text,
 accent_color text,
 background_color text,
 text_color text,
 announcement_text text,
 announcement_enabled boolean,
 hero_eyebrow text,
 hero_headline text,
 hero_subheadline text,
 hero_cta_label text,
 hero_variant text,
 products_heading text,
 products_enabled boolean,
 footer_description text,
 navigation jsonb,
 logo_storage_key text default null,
 logo_public_url text default null,
 logo_file_name text default null,
 logo_mime_type text default null,
 logo_file_size bigint default null,
 logo_alt_text text default null,
 logo_format text default null,
 logo_width integer default null,
 logo_height integer default null,
 hero_storage_key text default null,
 hero_public_url text default null,
 hero_file_name text default null,
 hero_mime_type text default null,
 hero_file_size bigint default null,
 hero_alt_text text default null,
 hero_format text default null,
 hero_width integer default null,
 hero_height integer default null
) returns void
language plpgsql security definer set search_path='' as $$
declare
 page uuid;
 actor uuid;
 logo uuid;
 hero uuid;
 old_logo uuid;
 old_hero uuid;
 nav jsonb;
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
  or length(coalesce(footer_description,''))>500 or navigation is null
  or jsonb_typeof(navigation)<>'array' or jsonb_array_length(navigation)>8
 then raise exception 'INVALID_SITE_DRAFT' using errcode='22023'; end if;
 for nav in select value from jsonb_array_elements(navigation) loop
  if jsonb_typeof(nav)<>'object' or length(trim(coalesce(nav->>'label',''))) not between 1 and 60
   or length(trim(coalesce(nav->>'target',''))) not between 1 and 300
   or coalesce(nav->>'location','') not in ('HEADER','FOOTER')
   or coalesce(nav->>'linkType','') not in ('PAGE','URL','CATEGORY')
  then raise exception 'INVALID_NAVIGATION' using errcode='22023'; end if;
 end loop;
 select id into actor from public.users where auth_user_id=auth.uid();
 select b.logo_asset_id,b.hero_asset_id into old_logo,old_hero
  from public.tenant_business_settings b where b.tenant_id=target_tenant for update;
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
 update public.tenant_layout_settings set sections=jsonb_build_array(
  jsonb_build_object('key','announcement','enabled',announcement_enabled,'variant','minimal','sortOrder',0),
  jsonb_build_object('key','hero','enabled',true,'variant',hero_variant,'sortOrder',1),
  jsonb_build_object('key','products','enabled',products_enabled,'variant','grid','sortOrder',2)
 ) where tenant_id=target_tenant;
 select id into page from public.pages where tenant_id=target_tenant and slug='home';
 insert into public.content_blocks(tenant_id,page_id,block_key,block_type,variant,sort_order,is_enabled,content)
 values(target_tenant,page,'announcement','announcement','minimal',0,announcement_enabled,jsonb_build_object('text',trim(coalesce(announcement_text,''))))
 on conflict(tenant_id,page_id,block_key) do update set variant=excluded.variant,sort_order=excluded.sort_order,is_enabled=excluded.is_enabled,content=excluded.content;
 insert into public.content_blocks(tenant_id,page_id,block_key,block_type,variant,sort_order,is_enabled,content)
 values(target_tenant,page,'hero','hero',hero_variant,1,true,jsonb_build_object('eyebrow',trim(coalesce(hero_eyebrow,'')),'headline',trim(hero_headline),'subheadline',trim(coalesce(hero_subheadline,'')),'primaryCta',jsonb_build_object('label',trim(coalesce(hero_cta_label,'')),'href','#products')))
 on conflict(tenant_id,page_id,block_key) do update set block_type=excluded.block_type,variant=excluded.variant,sort_order=excluded.sort_order,is_enabled=excluded.is_enabled,content=excluded.content;
 insert into public.content_blocks(tenant_id,page_id,block_key,block_type,variant,sort_order,is_enabled,content)
 values(target_tenant,page,'products','products','grid',2,products_enabled,jsonb_build_object('heading',trim(products_heading)))
 on conflict(tenant_id,page_id,block_key) do update set block_type=excluded.block_type,variant=excluded.variant,sort_order=excluded.sort_order,is_enabled=excluded.is_enabled,content=excluded.content;
 insert into public.content_blocks(tenant_id,page_id,block_key,block_type,variant,sort_order,is_enabled,content)
 values(target_tenant,page,'footer','footer','minimal',3,true,jsonb_build_object('description',trim(coalesce(footer_description,''))))
 on conflict(tenant_id,page_id,block_key) do update set block_type=excluded.block_type,variant=excluded.variant,sort_order=excluded.sort_order,is_enabled=excluded.is_enabled,content=excluded.content;
 delete from public.navigation_items where tenant_id=target_tenant;
 insert into public.navigation_items(tenant_id,label,target,sort_order,location,link_type,is_enabled)
 select target_tenant,trim(value->>'label'),trim(value->>'target'),ordinality-1,value->>'location',value->>'linkType',coalesce((value->>'enabled')::boolean,true)
 from jsonb_array_elements(navigation) with ordinality;
 update public.tenant_onboarding set theme_selected=true,homepage_configured=true where tenant_id=target_tenant;
 delete from public.media_assets m where m.tenant_id=target_tenant and m.id in (old_logo,old_hero) and m.id not in (logo,hero)
  and not exists(select 1 from public.product_media pm where pm.tenant_id=target_tenant and pm.asset_id=m.id)
  and not exists(select 1 from public.products p where p.tenant_id=target_tenant and p.primary_image_asset_id=m.id);
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id) values(target_tenant,actor,'SITE_DRAFT_UPDATED','pages',page);
end $$;
revoke all on function public.save_site_draft(uuid,text,text,text,text,text,text,text,text,text,text,boolean,text,text,text,text,text,text,boolean,text,jsonb,text,text,text,text,bigint,text,text,integer,integer,text,text,text,text,bigint,text,text,integer,integer) from public,anon;
grant execute on function public.save_site_draft(uuid,text,text,text,text,text,text,text,text,text,text,boolean,text,text,text,text,text,text,boolean,text,jsonb,text,text,text,text,bigint,text,text,integer,integer,text,text,text,text,bigint,text,text,integer,integer) to authenticated;

create function public.publish_site(target_tenant uuid) returns integer
language plpgsql security definer set search_path='' as $$
declare actor uuid; next_version integer; snapshot jsonb;
begin
 if not private.can_manage_catalog(target_tenant) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select id into actor from public.users where auth_user_id=auth.uid();
 select coalesce(max(version_number),0)+1 into next_version from public.tenant_site_versions where tenant_id=target_tenant;
 select jsonb_build_object(
  'business',jsonb_build_object('name',b.business_name,'description',b.description,'phone',b.phone,'address',b.address,
   'logo',case when logo.id is null then null else jsonb_build_object('url',logo.public_url_or_resolvable_key,'alt',logo.alt_text) end,
   'heroMedia',case when hero.id is null then null else jsonb_build_object('url',hero.public_url_or_resolvable_key,'alt',hero.alt_text) end),
  'theme',jsonb_build_object('presetKey',th.preset_key,'tokens',th.tokens),
  'sections',coalesce((select jsonb_agg(jsonb_build_object('key',c.block_key,'type',c.block_type,'variant',c.variant,'enabled',c.is_enabled,'content',c.content,'settings',c.settings) order by c.sort_order) from public.content_blocks c join public.pages p on p.id=c.page_id and p.tenant_id=c.tenant_id where c.tenant_id=target_tenant and p.slug='home'),'[]'::jsonb),
  'navigation',coalesce((select jsonb_agg(jsonb_build_object('label',n.label,'target',n.target,'location',n.location,'linkType',n.link_type,'enabled',n.is_enabled) order by n.sort_order) from public.navigation_items n where n.tenant_id=target_tenant),'[]'::jsonb)
 ) into snapshot from public.tenant_business_settings b join public.tenant_theme_settings th on th.tenant_id=b.tenant_id
 left join public.media_assets logo on logo.tenant_id=b.tenant_id and logo.id=b.logo_asset_id
 left join public.media_assets hero on hero.tenant_id=b.tenant_id and hero.id=b.hero_asset_id where b.tenant_id=target_tenant;
 if snapshot is null then raise exception 'SITE_DRAFT_NOT_FOUND'; end if;
 update public.tenant_site_versions set status='ARCHIVED' where tenant_id=target_tenant and status='PUBLISHED';
 insert into public.tenant_site_versions(tenant_id,version_number,status,configuration,published_by) values(target_tenant,next_version,'PUBLISHED',snapshot,actor);
 update public.pages set status='PUBLISHED' where tenant_id=target_tenant and slug='home';
 update public.tenant_onboarding set store_published=true where tenant_id=target_tenant;
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id) values(target_tenant,actor,'SITE_PUBLISHED','tenant_site_versions',target_tenant);
 return next_version;
end $$;
revoke all on function public.publish_site(uuid) from public,anon;
grant execute on function public.publish_site(uuid) to authenticated;

create or replace function public.get_public_storefront(store_slug text) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'tenant',jsonb_build_object('name',t.name,'slug',t.slug),
  'site',(select v.configuration from public.tenant_site_versions v where v.tenant_id=t.id and v.status='PUBLISHED' limit 1),
  'products',coalesce((select jsonb_agg(jsonb_build_object(
   'id',p.id,'name',p.name,'slug',p.slug,'shortDescription',p.short_description,'description',p.description,
   'price',p.price,'currency',p.currency,'stockQuantity',p.stock_quantity,'trackInventory',p.track_inventory,
   'mediaUrl',a.public_url_or_resolvable_key,'mediaType',a.resource_type,'mediaAlt',a.alt_text,
   'categories',coalesce((select jsonb_agg(c.name order by c.sort_order,c.name) from public.product_categories pc join public.categories c on c.tenant_id=pc.tenant_id and c.id=pc.category_id where pc.tenant_id=p.tenant_id and pc.product_id=p.id and c.status='ACTIVE'),'[]'::jsonb)
  ) order by p.created_at desc) from public.products p left join public.media_assets a on a.tenant_id=p.tenant_id and a.id=p.primary_image_asset_id where p.tenant_id=t.id and p.status='ACTIVE'),'[]'::jsonb)
 ) from public.tenants t where t.slug=store_slug and t.status in ('TRIAL','ACTIVE');
$$;

create index content_blocks_order_idx on public.content_blocks(tenant_id,page_id,sort_order);
