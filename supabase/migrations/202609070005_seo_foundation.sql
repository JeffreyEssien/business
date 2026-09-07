-- Tenant SEO drafts join the existing atomic storefront publish snapshot.
alter table public.tenant_seo_settings
 add column title_template text not null default '%s',
 add column twitter_handle text not null default '',
 add column robots_follow_enabled boolean not null default true,
 add column google_site_verification text not null default '',
 add column bing_site_verification text not null default '',
 add column updated_at timestamptz not null default now();
create trigger tenant_seo_settings_updated before update on public.tenant_seo_settings for each row execute function private.touch_updated_at();
alter table public.tenant_onboarding add column seo_configured boolean not null default false;

alter table public.tenant_domains add column custom_hostname text;
create unique index tenant_domains_custom_hostname_idx on public.tenant_domains(lower(custom_hostname)) where custom_hostname is not null;

create table public.seo_entries(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id),
 entity_type text not null check(entity_type in ('PAGE','PRODUCT','CATEGORY')),
 entity_id uuid not null,
 seo_title text not null default '',
 meta_description text not null default '',
 canonical_url text,
 social_title text not null default '',
 social_description text not null default '',
 robots_index boolean not null default true,
 robots_follow boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(tenant_id,entity_type,entity_id)
);
create trigger seo_entries_updated before update on public.seo_entries for each row execute function private.touch_updated_at();
alter table public.seo_entries enable row level security;
revoke all on public.seo_entries from anon,authenticated;
grant select on public.seo_entries to authenticated;
create policy tenant_read on public.seo_entries for select to authenticated using ((select private.is_super_admin()) or private.is_tenant_member(tenant_id));

create function public.save_global_seo(
 target_tenant uuid,search_title text,search_title_template text,search_description text,
 social_account text,allow_search_listing boolean,allow_search_links boolean,
 google_verification text,bing_verification text
) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
 if not private.can_manage_catalog(target_tenant) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if search_title is null or length(trim(search_title)) not between 1 and 60
  or search_title_template is null or length(trim(search_title_template)) not between 2 and 100 or position('%s' in search_title_template)=0
  or length(coalesce(search_description,''))>160 or length(coalesce(social_account,''))>50
  or length(coalesce(google_verification,''))>200 or length(coalesce(bing_verification,''))>200
  or allow_search_listing is null or allow_search_links is null
 then raise exception 'INVALID_SEO_SETTINGS' using errcode='22023'; end if;
 update public.tenant_seo_settings set site_title=trim(search_title),title_template=trim(search_title_template),description=trim(coalesce(search_description,'')),twitter_handle=trim(coalesce(social_account,'')),robots_index_enabled=allow_search_listing,robots_follow_enabled=allow_search_links,google_site_verification=trim(coalesce(google_verification,'')),bing_site_verification=trim(coalesce(bing_verification,'')) where tenant_id=target_tenant;
 select id into actor from public.users where auth_user_id=auth.uid();
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id) values(target_tenant,actor,'SEARCH_APPEARANCE_UPDATED','tenant_seo_settings',target_tenant);
end $$;
revoke all on function public.save_global_seo(uuid,text,text,text,text,boolean,boolean,text,text) from public,anon;
grant execute on function public.save_global_seo(uuid,text,text,text,text,boolean,boolean,text,text) to authenticated;

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
  'sections',coalesce((select jsonb_agg(jsonb_build_object('key',c.block_key,'type',c.block_type,'variant',c.variant,'enabled',c.is_enabled,'content',c.content,'settings',c.settings) order by c.sort_order) from public.content_blocks c join public.pages p on p.id=c.page_id and p.tenant_id=c.tenant_id where c.tenant_id=target_tenant and p.page_type='HOME'),'[]'::jsonb),
  'pages',coalesce((select jsonb_agg(jsonb_build_object('slug',p.slug,'name',p.name,'pageType',p.page_type,'title',c.content->>'title','introduction',c.content->>'introduction','body',c.content->>'body') order by p.sort_order,p.name) from public.pages p join public.content_blocks c on c.tenant_id=p.tenant_id and c.page_id=p.id and c.block_key='main' where p.tenant_id=target_tenant and p.page_type<>'HOME' and p.is_enabled),'[]'::jsonb),
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
