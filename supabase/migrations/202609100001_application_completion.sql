-- Complete application context, real style profiles, catalog suggestions, and safe publication.
alter table public.business_applications
 add column other_business_type text not null default '' check(length(other_business_type)<=100);
alter table public.tenant_business_settings
 add column business_type_detail text not null default '' check(length(business_type_detail)<=100);
alter table public.tenant_onboarding
 add column application_product_readiness text not null default ''
   check(application_product_readiness in ('','READY','NOT_YET','SERVICES')),
 add column expected_product_range text not null default ''
   check(expected_product_range in ('','1_10','11_50','51_100','OVER_100')),
 add column suggested_categories text[] not null default '{}';

create function public.submit_business_application_complete(
 application_id uuid,payload jsonb,request_fingerprint text
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; detail text:=trim(coalesce(payload->>'otherBusinessType',''));
begin
 if length(detail)>100 or (payload->>'businessType'='other' and detail='') then
  return jsonb_build_object('ok',false,'code','INVALID_APPLICATION');
 end if;
 result:=public.submit_business_application(application_id,payload,request_fingerprint);
 if result->>'ok'='true' and coalesce(result->>'existing','false')<>'true' then
  update public.business_applications set other_business_type=detail where id=application_id;
 end if;
 return result;
end;
$$;
revoke all on function public.submit_business_application(uuid,jsonb,text) from anon,authenticated;
revoke all on function public.submit_business_application_complete(uuid,jsonb,text) from public;
grant execute on function public.submit_business_application_complete(uuid,jsonb,text) to anon,authenticated;

create function public.save_business_application_complete(
 target_application uuid,payload jsonb,note text
) returns void
language plpgsql security definer set search_path='' as $$
declare detail text:=trim(coalesce(payload->>'otherBusinessType',''));
begin
 if length(detail)>100 or (payload->>'businessType'='other' and detail='') then
  raise exception 'INVALID_APPLICATION' using errcode='22023';
 end if;
 perform public.save_business_application(target_application,payload,note);
 update public.business_applications set other_business_type=detail where id=target_application;
end;
$$;
revoke all on function public.save_business_application(uuid,jsonb,text) from authenticated;
revoke all on function public.save_business_application_complete(uuid,jsonb,text) from public,anon;
grant execute on function public.save_business_application_complete(uuid,jsonb,text) to authenticated;

create function public.provision_business_application_complete(target_application uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare tenant uuid; application public.business_applications%rowtype; category_name text;
 base_slug text; category_slug text; suffix integer; category_order integer:=0;
begin
 if not private.is_super_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 tenant:=public.provision_business_application(target_application);
 select * into application from public.business_applications where id=target_application;
 update public.tenant_theme_settings set tokens=tokens||jsonb_build_object('styleKey',application.style_key)
 where tenant_id=tenant;
 update public.tenant_business_settings set business_type_detail=application.other_business_type
 where tenant_id=tenant;
 update public.tenant_onboarding set
  application_product_readiness=application.product_readiness,
  expected_product_range=application.product_quantity_range,
  suggested_categories=application.product_categories
 where tenant_id=tenant;
 foreach category_name in array application.product_categories loop
  base_slug:=trim(both '-' from lower(regexp_replace(category_name,'[^a-zA-Z0-9]+','-','g')));
  if base_slug='' then base_slug:='suggested-category-'||(category_order+1)::text; end if;
  base_slug:=left(base_slug,80);
  category_slug:=base_slug;
  suffix:=1;
  while exists(select 1 from public.categories where tenant_id=tenant and slug=category_slug) loop
   suffix:=suffix+1;
   category_slug:=left(base_slug,75)||'-'||suffix::text;
  end loop;
  insert into public.categories(tenant_id,name,slug,description,status,sort_order)
  values(tenant,category_name,category_slug,'Suggested from the approved business application.','DRAFT',category_order);
  category_order:=category_order+1;
 end loop;
 return tenant;
end;
$$;
revoke all on function public.provision_business_application(uuid) from authenticated;
revoke all on function public.provision_business_application_complete(uuid) from public,anon;
grant execute on function public.provision_business_application_complete(uuid) to authenticated;

-- Preserve an application personality while ordinary design saves keep the same
-- base preset. Deliberately changing the base preset selects its matching profile.
create or replace function public.save_site_draft_with_secondary(
 target_tenant uuid,business_name text,business_description text,business_phone text,business_address text,
 theme_preset text,primary_color text,secondary_color text,accent_color text,background_color text,text_color text,
 announcement_text text,announcement_enabled boolean,hero_eyebrow text,hero_headline text,hero_subheadline text,
 hero_cta_label text,hero_variant text,products_heading text,products_enabled boolean,footer_description text,navigation jsonb,
 logo_storage_key text default null,logo_public_url text default null,logo_file_name text default null,logo_mime_type text default null,
 logo_file_size bigint default null,logo_alt_text text default null,logo_format text default null,logo_width integer default null,logo_height integer default null,
 hero_storage_key text default null,hero_public_url text default null,hero_file_name text default null,hero_mime_type text default null,
 hero_file_size bigint default null,hero_alt_text text default null,hero_format text default null,hero_width integer default null,hero_height integer default null
) returns void language plpgsql security definer set search_path='' as $$
declare old_preset text; old_style text; selected_style text;
begin
 if secondary_color is null or secondary_color!~*'^#[0-9a-f]{6}$' then
  raise exception 'INVALID_COLOR' using errcode='22023';
 end if;
 select preset_key,tokens->>'styleKey' into old_preset,old_style
 from public.tenant_theme_settings where tenant_id=target_tenant;
 perform public.save_site_draft(target_tenant,business_name,business_description,business_phone,business_address,
  theme_preset,primary_color,accent_color,background_color,text_color,announcement_text,announcement_enabled,
  hero_eyebrow,hero_headline,hero_subheadline,hero_cta_label,hero_variant,products_heading,products_enabled,footer_description,navigation,
  logo_storage_key,logo_public_url,logo_file_name,logo_mime_type,logo_file_size,logo_alt_text,logo_format,logo_width,logo_height,
  hero_storage_key,hero_public_url,hero_file_name,hero_mime_type,hero_file_size,hero_alt_text,hero_format,hero_width,hero_height);
 selected_style:=case when old_preset=theme_preset and old_style in
  ('clean-minimal','elegant-luxury','bright-bold','soft-friendly','warm-natural','professional-modern') then old_style
  when theme_preset='fashion' then 'elegant-luxury' when theme_preset='beauty' then 'soft-friendly'
  when theme_preset='restaurant' then 'warm-natural' else 'clean-minimal' end;
 update public.tenant_theme_settings
 set tokens=tokens||jsonb_build_object('secondary',lower(secondary_color),'styleKey',selected_style)
 where tenant_id=target_tenant;
end;
$$;

create function private.public_internal_target_exists(target_tenant uuid,target text) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare clean_target text:=split_part(split_part(target,'?',1),'#',1); target_slug text;
begin
 if target is null or target='' or target not like '/%' then return true; end if;
 if clean_target in ('/','/products','/cart','/checkout') then return true; end if;
 target_slug:=trim(both '/' from clean_target);
 if target_slug not like '%/%' and exists(
  select 1 from public.pages where tenant_id=target_tenant and slug=target_slug and is_enabled
 ) then return true; end if;
 if target_slug like 'categories/%' and exists(
  select 1 from public.categories where tenant_id=target_tenant
   and slug=substring(target_slug from 12) and status='ACTIVE'
 ) then return true; end if;
 if target_slug like 'products/%' and exists(
  select 1 from public.products where tenant_id=target_tenant
   and slug=substring(target_slug from 10) and status='ACTIVE'
 ) then return true; end if;
 return false;
end;
$$;
revoke all on function private.public_internal_target_exists(uuid,text) from public;

create function private.reject_broken_published_links() returns trigger
language plpgsql security definer set search_path='' as $$
declare destination text;
begin
 for destination in
  select section#>>'{content,primaryCta,href}'
  from jsonb_array_elements(coalesce(new.configuration->'sections','[]'::jsonb)) section
  where section->>'enabled'='true' and section#>>'{content,primaryCta,label}'<>''
  union all
  select item->>'target'
  from jsonb_array_elements(coalesce(new.configuration->'navigation','[]'::jsonb)) item
  where item->>'enabled'='true'
 loop
  if not private.public_internal_target_exists(new.tenant_id,destination) then
   raise exception 'UNPUBLISHED_INTERNAL_LINK' using errcode='22023',detail=left(destination,300);
  end if;
 end loop;
 return new;
end;
$$;
revoke all on function private.reject_broken_published_links() from public;
create trigger tenant_versions_reject_broken_links
before insert on public.tenant_site_versions
for each row execute function private.reject_broken_published_links();
