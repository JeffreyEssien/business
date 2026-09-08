-- Search appearance overrides are tenant-owned drafts published with the storefront snapshot.
alter table public.seo_entries
 add constraint seo_entries_canonical_url_check check(
  canonical_url is null or (
   length(canonical_url)<=2048
   and canonical_url ~ '^https://[^[:space:]]+$'
  )
 );

create function public.save_entity_seo(
 target_tenant uuid,target_entity_type text,target_entity uuid,
 search_title text,search_description text,canonical_address text,
 social_share_title text,social_share_description text,
 allow_search_listing boolean,allow_search_links boolean
) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid; normalized_canonical text;
begin
 if not private.can_manage_catalog(target_tenant) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if target_entity_type not in ('PAGE','PRODUCT','CATEGORY') or target_entity is null
  or length(coalesce(search_title,''))>60 or length(coalesce(search_description,''))>160
  or length(coalesce(social_share_title,''))>60 or length(coalesce(social_share_description,''))>160
  or allow_search_listing is null or allow_search_links is null
 then raise exception 'INVALID_SEARCH_APPEARANCE' using errcode='22023'; end if;
 normalized_canonical:=nullif(trim(coalesce(canonical_address,'')),'');
 if normalized_canonical is not null and (length(normalized_canonical)>2048 or normalized_canonical !~ '^https://[^[:space:]]+$')
 then raise exception 'INVALID_CANONICAL_ADDRESS' using errcode='22023'; end if;
 if (target_entity_type='PAGE' and not exists(select 1 from public.pages where tenant_id=target_tenant and id=target_entity and page_type<>'HOME'))
  or (target_entity_type='PRODUCT' and not exists(select 1 from public.products where tenant_id=target_tenant and id=target_entity))
  or (target_entity_type='CATEGORY' and not exists(select 1 from public.categories where tenant_id=target_tenant and id=target_entity))
 then raise exception 'SEARCH_RECORD_NOT_FOUND' using errcode='P0002'; end if;
 insert into public.seo_entries(
  tenant_id,entity_type,entity_id,seo_title,meta_description,canonical_url,
  social_title,social_description,robots_index,robots_follow
 ) values(
  target_tenant,target_entity_type,target_entity,trim(coalesce(search_title,'')),trim(coalesce(search_description,'')),normalized_canonical,
  trim(coalesce(social_share_title,'')),trim(coalesce(social_share_description,'')),allow_search_listing,allow_search_links
 ) on conflict(tenant_id,entity_type,entity_id) do update set
  seo_title=excluded.seo_title,meta_description=excluded.meta_description,canonical_url=excluded.canonical_url,
  social_title=excluded.social_title,social_description=excluded.social_description,
  robots_index=excluded.robots_index,robots_follow=excluded.robots_follow;
 select id into actor from public.users where auth_user_id=auth.uid();
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id)
 values(target_tenant,actor,'CONTENT_SEARCH_APPEARANCE_UPDATED','seo_entries',target_entity);
end $$;
revoke all on function public.save_entity_seo(uuid,text,uuid,text,text,text,text,text,boolean,boolean) from public,anon;
grant execute on function public.save_entity_seo(uuid,text,uuid,text,text,text,text,text,boolean,boolean) to authenticated;

create function private.remove_entity_seo() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 delete from public.seo_entries
 where tenant_id=old.tenant_id and entity_type=tg_argv[0] and entity_id=old.id;
 return old;
end $$;
revoke all on function private.remove_entity_seo() from public;
create trigger pages_remove_seo after delete on public.pages for each row execute function private.remove_entity_seo('PAGE');
create trigger products_remove_seo after delete on public.products for each row execute function private.remove_entity_seo('PRODUCT');
create trigger categories_remove_seo after delete on public.categories for each row execute function private.remove_entity_seo('CATEGORY');

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
  'seo',jsonb_build_object('title',seo.site_title,'titleTemplate',seo.title_template,'description',seo.description,'twitterHandle',seo.twitter_handle,'allowSearchListing',seo.robots_index_enabled,'allowSearchLinks',seo.robots_follow_enabled,'googleVerification',seo.google_site_verification,'bingVerification',seo.bing_site_verification,'customHostname',case when d.status='ACTIVE' then d.custom_hostname else null end),
  'seoEntries',coalesce((select jsonb_agg(jsonb_build_object(
   'entityType',s.entity_type,'entityId',s.entity_id,'title',s.seo_title,'description',s.meta_description,
   'canonicalUrl',s.canonical_url,'socialTitle',s.social_title,'socialDescription',s.social_description,
   'allowSearchListing',s.robots_index,'allowSearchLinks',s.robots_follow
  ) order by s.entity_type,s.entity_id) from public.seo_entries s where s.tenant_id=target_tenant),'[]'::jsonb),
  'sections',coalesce((select jsonb_agg(jsonb_build_object('key',c.block_key,'type',c.block_type,'variant',c.variant,'enabled',c.is_enabled,'content',c.content,'settings',c.settings) order by c.sort_order) from public.content_blocks c join public.pages p on p.id=c.page_id and p.tenant_id=c.tenant_id where c.tenant_id=target_tenant and p.page_type='HOME'),'[]'::jsonb),
  'pages',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'slug',p.slug,'name',p.name,'pageType',p.page_type,'title',c.content->>'title','introduction',c.content->>'introduction','body',c.content->>'body') order by p.sort_order,p.name) from public.pages p join public.content_blocks c on c.tenant_id=p.tenant_id and c.page_id=p.id and c.block_key='main' where p.tenant_id=target_tenant and p.page_type<>'HOME' and p.is_enabled),'[]'::jsonb),
  'navigation',coalesce((select jsonb_agg(jsonb_build_object('label',n.label,'target',n.target,'location',n.location,'linkType',n.link_type,'enabled',n.is_enabled) order by n.sort_order) from public.navigation_items n where n.tenant_id=target_tenant),'[]'::jsonb)
 ) into snapshot from public.tenant_business_settings b join public.tenant_theme_settings th on th.tenant_id=b.tenant_id join public.tenant_seo_settings seo on seo.tenant_id=b.tenant_id join public.tenant_domains d on d.tenant_id=b.tenant_id
 left join public.media_assets logo on logo.tenant_id=b.tenant_id and logo.id=b.logo_asset_id left join public.media_assets hero on hero.tenant_id=b.tenant_id and hero.id=b.hero_asset_id where b.tenant_id=target_tenant;
 if snapshot is null then raise exception 'SITE_DRAFT_NOT_FOUND'; end if;
 update public.tenant_site_versions set status='ARCHIVED' where tenant_id=target_tenant and status='PUBLISHED';
 insert into public.tenant_site_versions(tenant_id,version_number,status,configuration,published_by) values(target_tenant,next_version,'PUBLISHED',snapshot,actor);
 update public.pages set status='PUBLISHED' where tenant_id=target_tenant and is_enabled;
 update public.tenant_onboarding set store_published=true,seo_configured=true where tenant_id=target_tenant;
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id) values(target_tenant,actor,'SITE_PUBLISHED','tenant_site_versions',target_tenant);
 return next_version;
end $$;

create or replace function public.get_public_storefront(store_slug text) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'tenant',jsonb_build_object('name',t.name,'slug',t.slug),
  'site',(select v.configuration from public.tenant_site_versions v where v.tenant_id=t.id and v.status='PUBLISHED' limit 1),
  'categories',coalesce((select jsonb_agg(jsonb_build_object(
   'id',c.id,'name',c.name,'slug',c.slug,'description',c.description,
   'productIds',coalesce((select jsonb_agg(pc.product_id) from public.product_categories pc join public.products p on p.tenant_id=pc.tenant_id and p.id=pc.product_id where pc.tenant_id=c.tenant_id and pc.category_id=c.id and p.status='ACTIVE'),'[]'::jsonb)
  ) order by c.sort_order,c.name) from public.categories c where c.tenant_id=t.id and c.status='ACTIVE'),'[]'::jsonb),
  'products',coalesce((select jsonb_agg(jsonb_build_object(
   'id',p.id,'name',p.name,'slug',p.slug,'shortDescription',p.short_description,'description',p.description,
   'price',p.price,'currency',p.currency,'stockQuantity',p.stock_quantity,'trackInventory',p.track_inventory,
   'mediaUrl',a.public_url_or_resolvable_key,'mediaType',a.resource_type,'mediaAlt',a.alt_text,
   'categories',coalesce((select jsonb_agg(c.name order by c.sort_order,c.name) from public.product_categories pc join public.categories c on c.tenant_id=pc.tenant_id and c.id=pc.category_id where pc.tenant_id=p.tenant_id and pc.product_id=p.id and c.status='ACTIVE'),'[]'::jsonb)
  ) order by p.created_at desc) from public.products p left join public.media_assets a on a.tenant_id=p.tenant_id and a.id=p.primary_image_asset_id where p.tenant_id=t.id and p.status='ACTIVE'),'[]'::jsonb)
 ) from public.tenants t where t.slug=store_slug and t.status in ('TRIAL','ACTIVE');
$$;

create index seo_entries_publish_idx on public.seo_entries(tenant_id,entity_type,entity_id);
