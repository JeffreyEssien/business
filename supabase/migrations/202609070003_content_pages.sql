-- Controlled homepage ordering and tenant-managed informational pages.
alter table public.pages
 add column page_type text not null default 'CUSTOM' check(page_type in ('HOME','ABOUT','CONTACT','POLICY','CUSTOM')),
 add column show_in_navigation boolean not null default false,
 add column sort_order integer not null default 0 check(sort_order>=0),
 add column is_enabled boolean not null default true,
 add column updated_at timestamptz not null default now();
update public.pages set page_type='HOME',is_enabled=true where slug='home';
create trigger pages_updated before update on public.pages for each row execute function private.touch_updated_at();

create function private.preserve_content_block_order() returns trigger
language plpgsql set search_path='' as $$
begin
 if coalesce(current_setting('businesscare.reordering_sections',true),'false')<>'true' then
  new.sort_order:=old.sort_order;
 end if;
 return new;
end $$;
revoke all on function private.preserve_content_block_order() from public;
create trigger content_blocks_preserve_order before update on public.content_blocks for each row execute function private.preserve_content_block_order();

create function public.reorder_homepage_sections(target_tenant uuid,section_keys text[]) returns void
language plpgsql security definer set search_path='' as $$
declare page uuid; expected integer; actor uuid;
begin
 if not private.can_manage_catalog(target_tenant) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select id into page from public.pages where tenant_id=target_tenant and slug='home';
 select count(*) into expected from public.content_blocks where tenant_id=target_tenant and page_id=page;
 if section_keys is null or array_length(section_keys,1)<>expected
  or (select count(distinct key) from unnest(section_keys) key)<>expected
  or exists(select 1 from unnest(section_keys) key where not exists(select 1 from public.content_blocks c where c.tenant_id=target_tenant and c.page_id=page and c.block_key=key))
 then raise exception 'INVALID_SECTION_ORDER' using errcode='22023'; end if;
 perform set_config('businesscare.reordering_sections','true',true);
 update public.content_blocks c set sort_order=ordered.position-1
 from unnest(section_keys) with ordinality ordered(key,position)
 where c.tenant_id=target_tenant and c.page_id=page and c.block_key=ordered.key;
 update public.tenant_layout_settings set sections=coalesce((select jsonb_agg(jsonb_build_object('key',c.block_key,'enabled',c.is_enabled,'variant',c.variant,'sortOrder',c.sort_order) order by c.sort_order) from public.content_blocks c where c.tenant_id=target_tenant and c.page_id=page),'[]'::jsonb) where tenant_id=target_tenant;
 select id into actor from public.users where auth_user_id=auth.uid();
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id) values(target_tenant,actor,'HOMEPAGE_SECTIONS_REORDERED','pages',page);
end $$;
revoke all on function public.reorder_homepage_sections(uuid,text[]) from public,anon;
grant execute on function public.reorder_homepage_sections(uuid,text[]) to authenticated;

create function public.save_content_page(
 target_tenant uuid,target_page uuid,page_type text,page_name text,page_slug text,
 page_title text,page_introduction text,page_body text,show_in_navigation boolean,page_enabled boolean
) returns uuid
language plpgsql security definer set search_path='' as $$
declare saved uuid; old_slug text; actor uuid; next_order integer;
begin
 if not private.can_manage_catalog(target_tenant) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if page_type not in ('ABOUT','CONTACT','POLICY','CUSTOM') or page_name is null or length(trim(page_name)) not between 1 and 80
  or page_slug is null or length(page_slug) not between 1 and 100 or page_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or page_slug in ('home','products')
  or page_title is null or length(trim(page_title)) not between 1 and 160 or length(coalesce(page_introduction,''))>500
  or length(coalesce(page_body,'')) not between 1 and 20000 or show_in_navigation is null or page_enabled is null
 then raise exception 'INVALID_CONTENT_PAGE' using errcode='22023'; end if;
 select id into actor from public.users where auth_user_id=auth.uid();
 if target_page is null then
  select coalesce(max(sort_order),0)+1 into next_order from public.pages where tenant_id=target_tenant;
  insert into public.pages(tenant_id,slug,name,status,page_type,show_in_navigation,sort_order,is_enabled)
  values(target_tenant,page_slug,trim(page_name),'DRAFT',page_type,show_in_navigation,next_order,page_enabled) returning id into saved;
 else
  select slug into old_slug from public.pages where tenant_id=target_tenant and id=target_page and page_type<>'HOME' for update;
  if old_slug is null then raise exception 'CONTENT_PAGE_NOT_FOUND'; end if;
  update public.pages set slug=page_slug,name=trim(page_name),page_type=save_content_page.page_type,show_in_navigation=save_content_page.show_in_navigation,is_enabled=page_enabled where tenant_id=target_tenant and id=target_page returning id into saved;
  delete from public.navigation_items where tenant_id=target_tenant and link_type='PAGE' and target='/'||old_slug;
 end if;
 insert into public.content_blocks(tenant_id,page_id,block_key,block_type,variant,sort_order,is_enabled,content)
 values(target_tenant,saved,'main','rich-text','plain',0,true,jsonb_build_object('title',trim(page_title),'introduction',trim(coalesce(page_introduction,'')),'body',trim(page_body)))
 on conflict(tenant_id,page_id,block_key) do update set content=excluded.content,is_enabled=true;
 if show_in_navigation and page_enabled then
  select coalesce(max(sort_order),-1)+1 into next_order from public.navigation_items where tenant_id=target_tenant and location='HEADER';
  insert into public.navigation_items(tenant_id,label,target,sort_order,location,link_type,is_enabled) values(target_tenant,trim(page_name),'/'||page_slug,next_order,'HEADER','PAGE',true);
 end if;
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id) values(target_tenant,actor,case when target_page is null then 'CONTENT_PAGE_CREATED' else 'CONTENT_PAGE_UPDATED' end,'pages',saved);
 return saved;
end $$;
revoke all on function public.save_content_page(uuid,uuid,text,text,text,text,text,text,boolean,boolean) from public,anon;
grant execute on function public.save_content_page(uuid,uuid,text,text,text,text,text,text,boolean,boolean) to authenticated;

create function public.delete_content_page(target_tenant uuid,target_page uuid) returns void
language plpgsql security definer set search_path='' as $$
declare page_slug text; actor uuid;
begin
 if not private.can_manage_catalog(target_tenant) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select slug into page_slug from public.pages where tenant_id=target_tenant and id=target_page and page_type<>'HOME' for update;
 if page_slug is null then raise exception 'CONTENT_PAGE_NOT_FOUND'; end if;
 select id into actor from public.users where auth_user_id=auth.uid();
 delete from public.navigation_items where tenant_id=target_tenant and link_type='PAGE' and target='/'||page_slug;
 delete from public.content_blocks where tenant_id=target_tenant and page_id=target_page;
 delete from public.pages where tenant_id=target_tenant and id=target_page;
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id) values(target_tenant,actor,'CONTENT_PAGE_DELETED','pages',target_page);
end $$;
revoke all on function public.delete_content_page(uuid,uuid) from public,anon;
grant execute on function public.delete_content_page(uuid,uuid) to authenticated;

create or replace function public.publish_site(target_tenant uuid) returns integer
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
  'sections',coalesce((select jsonb_agg(jsonb_build_object('key',c.block_key,'type',c.block_type,'variant',c.variant,'enabled',c.is_enabled,'content',c.content,'settings',c.settings) order by c.sort_order) from public.content_blocks c join public.pages p on p.id=c.page_id and p.tenant_id=c.tenant_id where c.tenant_id=target_tenant and p.page_type='HOME'),'[]'::jsonb),
  'pages',coalesce((select jsonb_agg(jsonb_build_object('slug',p.slug,'name',p.name,'pageType',p.page_type,'title',c.content->>'title','introduction',c.content->>'introduction','body',c.content->>'body') order by p.sort_order,p.name) from public.pages p join public.content_blocks c on c.tenant_id=p.tenant_id and c.page_id=p.id and c.block_key='main' where p.tenant_id=target_tenant and p.page_type<>'HOME' and p.is_enabled),'[]'::jsonb),
  'navigation',coalesce((select jsonb_agg(jsonb_build_object('label',n.label,'target',n.target,'location',n.location,'linkType',n.link_type,'enabled',n.is_enabled) order by n.sort_order) from public.navigation_items n where n.tenant_id=target_tenant),'[]'::jsonb)
 ) into snapshot from public.tenant_business_settings b join public.tenant_theme_settings th on th.tenant_id=b.tenant_id
 left join public.media_assets logo on logo.tenant_id=b.tenant_id and logo.id=b.logo_asset_id
 left join public.media_assets hero on hero.tenant_id=b.tenant_id and hero.id=b.hero_asset_id where b.tenant_id=target_tenant;
 if snapshot is null then raise exception 'SITE_DRAFT_NOT_FOUND'; end if;
 update public.tenant_site_versions set status='ARCHIVED' where tenant_id=target_tenant and status='PUBLISHED';
 insert into public.tenant_site_versions(tenant_id,version_number,status,configuration,published_by) values(target_tenant,next_version,'PUBLISHED',snapshot,actor);
 update public.pages set status='PUBLISHED' where tenant_id=target_tenant and is_enabled;
 update public.tenant_onboarding set store_published=true where tenant_id=target_tenant;
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id) values(target_tenant,actor,'SITE_PUBLISHED','tenant_site_versions',target_tenant);
 return next_version;
end $$;

create index pages_tenant_type_order_idx on public.pages(tenant_id,page_type,sort_order);
