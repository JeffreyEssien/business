-- Public business applications remain separate from provisioned tenants.

alter table public.tenant_business_settings
 add column whatsapp text not null default '',
 add column instagram text not null default '',
 add column facebook text not null default '',
 add column tiktok text not null default '',
 add column city text not null default '',
 add column state text not null default '',
 add column country text not null default '';

update public.tenant_theme_settings
set tokens=tokens||jsonb_build_object('secondary',coalesce(tokens->>'secondary',tokens->>'accent','#8b7fc7'))
where not (tokens ? 'secondary');

create table public.business_applications (
 id uuid primary key,
 reference text not null unique,
 status text not null default 'PENDING' check(status in ('PENDING','UNDER_REVIEW','REJECTED','PROVISIONED')),
 business_name text not null,
 business_type text not null,
 business_description text not null default '',
 owner_name text not null,
 owner_email text not null,
 business_phone text not null default '',
 whatsapp text not null default '',
 business_email text not null default '',
 instagram text not null default '',
 facebook text not null default '',
 tiktok text not null default '',
 has_physical_location boolean not null default false,
 address_line text not null default '',
 city text not null default '',
 state text not null default '',
 country text not null default '',
 primary_color text not null,
 secondary_color text not null,
 accent_color text not null,
 style_key text not null,
 homepage_headline text not null,
 homepage_message text not null default '',
 primary_action_label text not null,
 primary_action_destination text not null,
 announcement text not null default '',
 requested_pages text[] not null default '{}',
 product_readiness text not null,
 product_quantity_range text not null default '',
 product_categories text[] not null default '{}',
 preferred_slug text not null,
 proposed_plan text not null,
 logo_storage_key text,
 logo_public_url text,
 logo_file_name text,
 logo_mime_type text,
 logo_file_size bigint,
 logo_format text,
 logo_width integer,
 logo_height integer,
 original_submission jsonb not null,
 internal_note text not null default '',
 source_fingerprint text not null,
 submitted_at timestamptz not null default now(),
 reviewed_at timestamptz,
 rejected_at timestamptz,
 provisioned_at timestamptz,
 approved_by uuid references public.users(id),
 provisioned_tenant_id uuid unique references public.tenants(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create unique index business_applications_open_slug_idx
 on public.business_applications(preferred_slug)
 where status in ('PENDING','UNDER_REVIEW','PROVISIONED');
create index business_applications_status_submitted_idx
 on public.business_applications(status,submitted_at desc,id);
create index business_applications_email_submitted_idx
 on public.business_applications(owner_email,submitted_at desc);
create trigger business_applications_updated before update on public.business_applications
 for each row execute function private.touch_updated_at();

create table public.business_application_revisions (
 id uuid primary key default gen_random_uuid(),
 application_id uuid not null references public.business_applications(id) on delete cascade,
 edited_by uuid not null references public.users(id),
 previous_values jsonb not null,
 created_at timestamptz not null default now()
);
create index business_application_revisions_application_idx
 on public.business_application_revisions(application_id,created_at desc);

create table public.business_application_events (
 id uuid primary key default gen_random_uuid(),
 application_id uuid not null references public.business_applications(id) on delete cascade,
 actor_user_id uuid references public.users(id),
 action text not null check(action in ('SUBMITTED','MARKED_UNDER_REVIEW','CHANGES_SAVED','REJECTED','PROVISIONED')),
 created_at timestamptz not null default now()
);
create index business_application_events_application_idx
 on public.business_application_events(application_id,created_at desc);

create table private.business_application_limits (
 fingerprint text primary key,
 window_started_at timestamptz not null,
 attempts integer not null check(attempts>0)
);

alter table public.business_applications enable row level security;
alter table public.business_application_revisions enable row level security;
alter table public.business_application_events enable row level security;
revoke all on public.business_applications,public.business_application_revisions,public.business_application_events from anon,authenticated;
grant select on public.business_applications,public.business_application_revisions,public.business_application_events to authenticated;
create policy business_applications_admin_read on public.business_applications for select to authenticated
 using ((select private.is_super_admin()));
create policy business_application_revisions_admin_read on public.business_application_revisions for select to authenticated
 using ((select private.is_super_admin()));
create policy business_application_events_admin_read on public.business_application_events for select to authenticated
 using ((select private.is_super_admin()));

create function private.valid_business_application(payload jsonb) returns boolean
language sql immutable set search_path='' as $$
 select jsonb_typeof(payload)='object'
  and length(trim(coalesce(payload->>'businessName',''))) between 1 and 160
  and payload->>'businessType' in ('fashion','beauty','hair','food','cakes','jewellery','electronics','home','professional','other')
  and length(coalesce(payload->>'businessDescription',''))<=600
  and length(trim(coalesce(payload->>'ownerName',''))) between 1 and 120
  and length(coalesce(payload->>'ownerEmail',''))<=254
  and lower(payload->>'ownerEmail') ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  and length(coalesce(payload->>'businessPhone',''))<=40
  and length(coalesce(payload->>'whatsapp',''))<=80
  and length(coalesce(payload->>'businessEmail',''))<=254
  and (coalesce(payload->>'businessEmail','')='' or lower(payload->>'businessEmail') ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
  and length(coalesce(payload->>'instagram',''))<=200
  and length(coalesce(payload->>'facebook',''))<=200
  and length(coalesce(payload->>'tiktok',''))<=200
  and coalesce(payload->>'hasPhysicalLocation','') in ('true','false')
  and length(coalesce(payload->>'addressLine',''))<=200
  and length(coalesce(payload->>'city',''))<=100
  and length(coalesce(payload->>'state',''))<=100
  and length(coalesce(payload->>'country',''))<=100
  and (payload->>'hasPhysicalLocation'='false' or (
    length(trim(coalesce(payload->>'addressLine','')))>0 and length(trim(coalesce(payload->>'city','')))>0
    and length(trim(coalesce(payload->>'state','')))>0 and length(trim(coalesce(payload->>'country','')))>0
  ))
  and private.valid_hex_color(payload->>'primaryColor')
  and private.valid_hex_color(payload->>'secondaryColor')
  and private.valid_hex_color(payload->>'accentColor')
  and payload->>'styleKey' in ('clean-minimal','elegant-luxury','bright-bold','soft-friendly','warm-natural','professional-modern')
  and length(trim(coalesce(payload->>'homepageHeadline',''))) between 1 and 160
  and length(coalesce(payload->>'homepageMessage',''))<=320
  and length(trim(coalesce(payload->>'primaryActionLabel',''))) between 1 and 60
  and payload->>'primaryActionDestination' in ('PRODUCTS','ABOUT','CONTACT','DELIVERY')
  and length(coalesce(payload->>'announcement',''))<=160
  and jsonb_typeof(payload->'requestedPages')='array'
  and jsonb_array_length(payload->'requestedPages')<=6
  and not exists(select 1 from jsonb_array_elements_text(payload->'requestedPages') page_key
    where page_key not in ('ABOUT','CONTACT','DELIVERY','RETURNS','PRIVACY','TERMS'))
  and payload->>'productReadiness' in ('READY','NOT_YET','SERVICES')
  and coalesce(payload->>'productQuantityRange','') in ('','1_10','11_50','51_100','OVER_100')
  and jsonb_typeof(payload->'productCategories')='array'
  and jsonb_array_length(payload->'productCategories')<=10
  and not exists(select 1 from jsonb_array_elements_text(payload->'productCategories') category
    where length(trim(category)) not between 1 and 60)
  and length(coalesce(payload->>'preferredSlug','')) between 3 and 63
  and payload->>'preferredSlug' ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  and payload->>'preferredSlug' not in ('www','app','admin','api','auth','login','support','mail','setup','businesses','get-started')
  and payload->>'proposedPlan' in ('starter','growth','pro');
$$;
revoke all on function private.valid_business_application(jsonb) from public;

create function public.business_application_slug_available(candidate text) returns boolean
language sql stable security definer set search_path='' as $$
 select candidate is not null and length(candidate) between 3 and 63
  and candidate ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  and candidate not in ('www','app','admin','api','auth','login','support','mail','setup','businesses','get-started')
  and not exists(select 1 from public.tenants where slug=candidate)
  and not exists(select 1 from public.business_applications where preferred_slug=candidate and status in ('PENDING','UNDER_REVIEW','PROVISIONED'));
$$;
revoke all on function public.business_application_slug_available(text) from public;
grant execute on function public.business_application_slug_available(text) to anon,authenticated;

create function public.submit_business_application(application_id uuid,payload jsonb,request_fingerprint text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare existing_reference text; generated_reference text; current_attempts integer; current_window timestamptz;
 requested text[]; categories text[]; logo jsonb;
begin
 if application_id is null or not private.valid_business_application(payload)
  or request_fingerprint is null or request_fingerprint !~ '^[0-9a-f]{64}$'
 then raise exception 'INVALID_APPLICATION' using errcode='22023'; end if;
 select reference into existing_reference from public.business_applications where id=application_id;
 if existing_reference is not null then return jsonb_build_object('ok',true,'reference',existing_reference,'existing',true); end if;

 insert into private.business_application_limits(fingerprint,window_started_at,attempts)
 values(request_fingerprint,now(),1)
 on conflict(fingerprint) do update set
  attempts=case when private.business_application_limits.window_started_at<now()-interval '1 hour' then 1 else private.business_application_limits.attempts+1 end,
  window_started_at=case when private.business_application_limits.window_started_at<now()-interval '1 hour' then now() else private.business_application_limits.window_started_at end
 returning attempts,window_started_at into current_attempts,current_window;
 if current_attempts>5 and current_window>=now()-interval '1 hour' then
  return jsonb_build_object('ok',false,'code','RATE_LIMITED');
 end if;
 if (select count(*) from public.business_applications
     where owner_email=lower(trim(payload->>'ownerEmail')) and submitted_at>now()-interval '24 hours')>=3 then
  return jsonb_build_object('ok',false,'code','RATE_LIMITED');
 end if;
 if exists(select 1 from public.business_applications
   where status in ('PENDING','UNDER_REVIEW') and submitted_at>now()-interval '7 days'
    and (owner_email=lower(trim(payload->>'ownerEmail')) or preferred_slug=payload->>'preferredSlug')) then
  return jsonb_build_object('ok',false,'code','DUPLICATE_APPLICATION');
 end if;
 if not public.business_application_slug_available(payload->>'preferredSlug') then
  return jsonb_build_object('ok',false,'code','WEBSITE_NAME_UNAVAILABLE');
 end if;

 requested:=array(select distinct value from jsonb_array_elements_text(payload->'requestedPages') value);
 categories:=array(select distinct trim(value) from jsonb_array_elements_text(payload->'productCategories') value);
 logo:=payload->'logo';
 if logo is not null and logo<>'null'::jsonb and (
   logo->>'provider'<>'cloudinary' or logo->>'secureUrl' not like 'https://%'
   or logo->>'storageKey' not like 'businesscare/applications/'||application_id::text||'/%'
   or logo->>'mimeType' not in ('image/jpeg','image/png','image/webp')
   or (logo->>'fileSize')::bigint not between 1 and 5242880
 ) then raise exception 'INVALID_APPLICATION_LOGO' using errcode='22023'; end if;

 loop
  generated_reference:='BCA-'||to_char(now(),'YYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  exit when not exists(select 1 from public.business_applications where reference=generated_reference);
 end loop;
 insert into public.business_applications(
  id,reference,business_name,business_type,business_description,owner_name,owner_email,
  business_phone,whatsapp,business_email,instagram,facebook,tiktok,has_physical_location,
  address_line,city,state,country,primary_color,secondary_color,accent_color,style_key,
  homepage_headline,homepage_message,primary_action_label,primary_action_destination,announcement,
  requested_pages,product_readiness,product_quantity_range,product_categories,preferred_slug,proposed_plan,
  logo_storage_key,logo_public_url,logo_file_name,logo_mime_type,logo_file_size,logo_format,logo_width,logo_height,
  original_submission,source_fingerprint
 ) values(
  application_id,generated_reference,trim(payload->>'businessName'),payload->>'businessType',trim(coalesce(payload->>'businessDescription','')),
  trim(payload->>'ownerName'),lower(trim(payload->>'ownerEmail')),trim(coalesce(payload->>'businessPhone','')),
  trim(coalesce(payload->>'whatsapp','')),lower(trim(coalesce(payload->>'businessEmail',''))),trim(coalesce(payload->>'instagram','')),
  trim(coalesce(payload->>'facebook','')),trim(coalesce(payload->>'tiktok','')),(payload->>'hasPhysicalLocation')::boolean,
  trim(coalesce(payload->>'addressLine','')),trim(coalesce(payload->>'city','')),trim(coalesce(payload->>'state','')),trim(coalesce(payload->>'country','')),
  lower(payload->>'primaryColor'),lower(payload->>'secondaryColor'),lower(payload->>'accentColor'),payload->>'styleKey',
  trim(payload->>'homepageHeadline'),trim(coalesce(payload->>'homepageMessage','')),trim(payload->>'primaryActionLabel'),payload->>'primaryActionDestination',trim(coalesce(payload->>'announcement','')),
  requested,payload->>'productReadiness',coalesce(payload->>'productQuantityRange',''),categories,payload->>'preferredSlug',payload->>'proposedPlan',
  logo->>'storageKey',logo->>'secureUrl',logo->>'fileName',logo->>'mimeType',(logo->>'fileSize')::bigint,logo->>'format',(logo->>'width')::integer,(logo->>'height')::integer,
  payload||jsonb_build_object('logo',logo),request_fingerprint
 );
 insert into public.business_application_events(application_id,action) values(application_id,'SUBMITTED');
 return jsonb_build_object('ok',true,'reference',generated_reference);
exception when unique_violation then
 return jsonb_build_object('ok',false,'code','WEBSITE_NAME_UNAVAILABLE');
end;
$$;
revoke all on function public.submit_business_application(uuid,jsonb,text) from public;
grant execute on function public.submit_business_application(uuid,jsonb,text) to anon,authenticated;

create function public.save_business_application(target_application uuid,payload jsonb,note text) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid; current_application public.business_applications%rowtype; requested text[]; categories text[];
 logo jsonb; remove_logo boolean;
begin
 if not private.is_super_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if not private.valid_business_application(payload) or length(coalesce(note,''))>4000 then
  raise exception 'INVALID_APPLICATION' using errcode='22023'; end if;
 select * into current_application from public.business_applications where id=target_application for update;
 if current_application.id is null or current_application.status='PROVISIONED' then raise exception 'APPLICATION_UNAVAILABLE' using errcode='22023'; end if;
 select id into actor from public.users where auth_user_id=auth.uid();
 requested:=array(select distinct value from jsonb_array_elements_text(payload->'requestedPages') value);
 categories:=array(select distinct trim(value) from jsonb_array_elements_text(payload->'productCategories') value);
 logo:=payload->'logo';
 remove_logo:=coalesce((payload->>'removeLogo')::boolean,false);
 if logo is not null and logo<>'null'::jsonb and (
   logo->>'provider'<>'cloudinary' or logo->>'secureUrl' not like 'https://%'
   or logo->>'storageKey' not like 'businesscare/applications/'||target_application::text||'/%'
   or logo->>'mimeType' not in ('image/jpeg','image/png','image/webp')
   or (logo->>'fileSize')::bigint not between 1 and 5242880
 ) then raise exception 'INVALID_APPLICATION_LOGO' using errcode='22023'; end if;
 insert into public.business_application_revisions(application_id,edited_by,previous_values)
 values(target_application,actor,to_jsonb(current_application)-'source_fingerprint');
 update public.business_applications set
  business_name=trim(payload->>'businessName'),business_type=payload->>'businessType',business_description=trim(coalesce(payload->>'businessDescription','')),
  owner_name=trim(payload->>'ownerName'),owner_email=lower(trim(payload->>'ownerEmail')),business_phone=trim(coalesce(payload->>'businessPhone','')),
  whatsapp=trim(coalesce(payload->>'whatsapp','')),business_email=lower(trim(coalesce(payload->>'businessEmail',''))),instagram=trim(coalesce(payload->>'instagram','')),
  facebook=trim(coalesce(payload->>'facebook','')),tiktok=trim(coalesce(payload->>'tiktok','')),has_physical_location=(payload->>'hasPhysicalLocation')::boolean,
  address_line=trim(coalesce(payload->>'addressLine','')),city=trim(coalesce(payload->>'city','')),state=trim(coalesce(payload->>'state','')),country=trim(coalesce(payload->>'country','')),
  primary_color=lower(payload->>'primaryColor'),secondary_color=lower(payload->>'secondaryColor'),accent_color=lower(payload->>'accentColor'),style_key=payload->>'styleKey',
  homepage_headline=trim(payload->>'homepageHeadline'),homepage_message=trim(coalesce(payload->>'homepageMessage','')),
  primary_action_label=trim(payload->>'primaryActionLabel'),primary_action_destination=payload->>'primaryActionDestination',announcement=trim(coalesce(payload->>'announcement','')),
  requested_pages=requested,product_readiness=payload->>'productReadiness',product_quantity_range=coalesce(payload->>'productQuantityRange',''),
  product_categories=categories,preferred_slug=payload->>'preferredSlug',proposed_plan=payload->>'proposedPlan',internal_note=trim(coalesce(note,'')),
  logo_storage_key=case when remove_logo then null when logo is not null and logo<>'null'::jsonb then logo->>'storageKey' else logo_storage_key end,
  logo_public_url=case when remove_logo then null when logo is not null and logo<>'null'::jsonb then logo->>'secureUrl' else logo_public_url end,
  logo_file_name=case when remove_logo then null when logo is not null and logo<>'null'::jsonb then logo->>'fileName' else logo_file_name end,
  logo_mime_type=case when remove_logo then null when logo is not null and logo<>'null'::jsonb then logo->>'mimeType' else logo_mime_type end,
  logo_file_size=case when remove_logo then null when logo is not null and logo<>'null'::jsonb then (logo->>'fileSize')::bigint else logo_file_size end,
  logo_format=case when remove_logo then null when logo is not null and logo<>'null'::jsonb then logo->>'format' else logo_format end,
  logo_width=case when remove_logo then null when logo is not null and logo<>'null'::jsonb then (logo->>'width')::integer else logo_width end,
  logo_height=case when remove_logo then null when logo is not null and logo<>'null'::jsonb then (logo->>'height')::integer else logo_height end
 where id=target_application;
 insert into public.business_application_events(application_id,actor_user_id,action) values(target_application,actor,'CHANGES_SAVED');
end;
$$;
revoke all on function public.save_business_application(uuid,jsonb,text) from public,anon;
grant execute on function public.save_business_application(uuid,jsonb,text) to authenticated;

create function public.change_business_application_status(target_application uuid,next_status text,note text default '') returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid; current_status text;
begin
 if not private.is_super_admin() or next_status not in ('UNDER_REVIEW','REJECTED') or length(coalesce(note,''))>4000 then
  raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select status into current_status from public.business_applications where id=target_application for update;
 if current_status is null or current_status='PROVISIONED'
  or (next_status='REJECTED' and current_status not in ('PENDING','UNDER_REVIEW'))
  or (next_status='UNDER_REVIEW' and current_status not in ('PENDING','REJECTED'))
 then raise exception 'INVALID_APPLICATION_STATE' using errcode='22023'; end if;
 select id into actor from public.users where auth_user_id=auth.uid();
 update public.business_applications set status=next_status,internal_note=case when trim(coalesce(note,''))='' then internal_note else trim(note) end,
  reviewed_at=case when next_status='UNDER_REVIEW' then now() else reviewed_at end,
  rejected_at=case when next_status='REJECTED' then now() else null end
 where id=target_application;
 insert into public.business_application_events(application_id,actor_user_id,action)
 values(target_application,actor,case when next_status='UNDER_REVIEW' then 'MARKED_UNDER_REVIEW' else 'REJECTED' end);
end;
$$;
revoke all on function public.change_business_application_status(uuid,text,text) from public,anon;
grant execute on function public.change_business_application_status(uuid,text,text) to authenticated;

create function public.provision_business_application(target_application uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare application public.business_applications%rowtype; actor uuid; tenant uuid; home_page uuid; logo uuid;
 preset text; cta_href text; requested_page text; requested_page_id uuid; page_order integer:=1;
begin
 if not private.is_super_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select * into application from public.business_applications where id=target_application for update;
 if application.id is null or application.status not in ('PENDING','UNDER_REVIEW') then
  raise exception 'INVALID_APPLICATION_STATE' using errcode='22023'; end if;
 if exists(select 1 from public.tenants where slug=application.preferred_slug)
  or exists(select 1 from public.business_applications where id<>target_application
    and preferred_slug=application.preferred_slug and status in ('PENDING','UNDER_REVIEW','PROVISIONED')) then
  raise exception 'WEBSITE_NAME_UNAVAILABLE' using errcode='23505'; end if;
 preset:=case application.style_key
  when 'elegant-luxury' then 'fashion' when 'soft-friendly' then 'beauty'
  when 'warm-natural' then 'restaurant' else 'general' end;
 tenant:=public.provision_tenant(application.business_name,application.preferred_slug,application.owner_name,
  application.owner_email,preset,application.proposed_plan,'bank_transfer');
 select id into actor from public.users where auth_user_id=auth.uid();
 update public.tenants set industry_key=application.business_type,template_key=preset where id=tenant;
 update public.tenant_theme_settings set preset_key=preset,tokens=tokens||jsonb_build_object(
  'primary',application.primary_color,'secondary',application.secondary_color,'accent',application.accent_color
 ) where tenant_id=tenant;
 if application.logo_storage_key is not null then
  insert into public.media_assets(tenant_id,storage_provider,storage_key,public_url_or_resolvable_key,file_name,mime_type,file_size,width,height,alt_text,created_by,resource_type,format)
  values(tenant,'cloudinary',application.logo_storage_key,application.logo_public_url,application.logo_file_name,application.logo_mime_type,
   application.logo_file_size,application.logo_width,application.logo_height,application.business_name||' logo',actor,'image',application.logo_format)
  returning id into logo;
 end if;
 update public.tenant_business_settings set business_name=application.business_name,
  contact_email=coalesce(nullif(application.business_email,''),application.owner_email),description=application.business_description,
  phone=application.business_phone,address=case when application.has_physical_location then concat_ws(', ',nullif(application.address_line,''),nullif(application.city,''),nullif(application.state,''),nullif(application.country,'')) else '' end,
  whatsapp=application.whatsapp,instagram=application.instagram,facebook=application.facebook,tiktok=application.tiktok,
  city=application.city,state=application.state,country=application.country,logo_asset_id=logo
 where tenant_id=tenant;
 select id into home_page from public.pages where tenant_id=tenant and page_type='HOME';
 cta_href:=case application.primary_action_destination when 'ABOUT' then '/about-us' when 'CONTACT' then '/contact-us'
  when 'DELIVERY' then '/delivery-information' else '#products' end;
 update public.content_blocks set block_type='hero',variant=case when preset='fashion' then 'split' when preset='restaurant' then 'image-overlay' else 'centered' end,
  content=jsonb_build_object('eyebrow','Welcome','headline',application.homepage_headline,'subheadline',application.homepage_message,
   'primaryCta',jsonb_build_object('label',application.primary_action_label,'href',cta_href))
 where tenant_id=tenant and page_id=home_page and block_key='hero';
 insert into public.content_blocks(tenant_id,page_id,block_key,block_type,variant,sort_order,is_enabled,content)
 values(tenant,home_page,'announcement','announcement','bar',0,application.announcement<>'',jsonb_build_object('text',application.announcement)),
       (tenant,home_page,'products','products','grid',2,true,jsonb_build_object('heading','Our products'))
 on conflict(tenant_id,page_id,block_key) do update set content=excluded.content,is_enabled=excluded.is_enabled;
 update public.content_blocks set sort_order=1 where tenant_id=tenant and page_id=home_page and block_key='hero';
 update public.tenant_layout_settings set sections=(select jsonb_agg(jsonb_build_object('key',block_key,'enabled',is_enabled,'variant',variant,'sortOrder',sort_order) order by sort_order)
  from public.content_blocks where tenant_id=tenant and page_id=home_page) where tenant_id=tenant;

 foreach requested_page in array application.requested_pages loop
  insert into public.pages(tenant_id,slug,name,status,page_type,show_in_navigation,sort_order,is_enabled)
  values(tenant,
   case requested_page when 'ABOUT' then 'about-us' when 'CONTACT' then 'contact-us' when 'DELIVERY' then 'delivery-information'
    when 'RETURNS' then 'returns-refunds' when 'PRIVACY' then 'privacy-policy' else 'terms-conditions' end,
   case requested_page when 'ABOUT' then 'About Us' when 'CONTACT' then 'Contact Us' when 'DELIVERY' then 'Delivery Information'
    when 'RETURNS' then 'Return and Refund Policy' when 'PRIVACY' then 'Privacy Policy' else 'Terms and Conditions' end,
   'DRAFT',case when requested_page='ABOUT' then 'ABOUT' when requested_page='CONTACT' then 'CONTACT' when requested_page in ('DELIVERY','RETURNS','PRIVACY','TERMS') then 'POLICY' else 'CUSTOM' end,
   false,page_order,false) returning id into requested_page_id;
  insert into public.content_blocks(tenant_id,page_id,block_key,block_type,variant,sort_order,is_enabled,content)
  values(tenant,requested_page_id,'main','rich-text','plain',0,true,jsonb_build_object(
   'title',case requested_page when 'ABOUT' then 'About '||application.business_name when 'CONTACT' then 'Contact us'
    when 'DELIVERY' then 'Delivery information' when 'RETURNS' then 'Returns and refunds' when 'PRIVACY' then 'Privacy policy' else 'Terms and conditions' end,
   'introduction','This page is prepared as an unpublished draft. Review it before making it visible to customers.',
   'body',case when requested_page='ABOUT' and application.business_description<>'' then application.business_description
    else 'Add the final information for this page before publishing your website.' end));
  page_order:=page_order+1;
 end loop;
 update public.tenant_onboarding set theme_selected=true,homepage_configured=true where tenant_id=tenant;
 update public.navigation_items n set link_type='PAGE',page_id=home_page,target='/'
  where n.tenant_id=tenant and n.label='Home';
 update public.business_applications set status='PROVISIONED',approved_by=actor,provisioned_tenant_id=tenant,provisioned_at=now() where id=target_application;
 insert into public.business_application_events(application_id,actor_user_id,action) values(target_application,actor,'PROVISIONED');
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id)
 values(tenant,actor,'BUSINESS_APPLICATION_PROVISIONED','business_applications',target_application);
 return tenant;
end;
$$;
revoke all on function public.provision_business_application(uuid) from public,anon;
grant execute on function public.provision_business_application(uuid) to authenticated;

create function public.save_site_draft_with_secondary(
 target_tenant uuid,business_name text,business_description text,business_phone text,business_address text,
 theme_preset text,primary_color text,secondary_color text,accent_color text,background_color text,text_color text,
 announcement_text text,announcement_enabled boolean,hero_eyebrow text,hero_headline text,hero_subheadline text,
 hero_cta_label text,hero_variant text,products_heading text,products_enabled boolean,footer_description text,navigation jsonb,
 logo_storage_key text default null,logo_public_url text default null,logo_file_name text default null,logo_mime_type text default null,
 logo_file_size bigint default null,logo_alt_text text default null,logo_format text default null,logo_width integer default null,logo_height integer default null,
 hero_storage_key text default null,hero_public_url text default null,hero_file_name text default null,hero_mime_type text default null,
 hero_file_size bigint default null,hero_alt_text text default null,hero_format text default null,hero_width integer default null,hero_height integer default null
) returns void language plpgsql security invoker set search_path='' as $$
begin
 if not private.valid_hex_color(secondary_color) then raise exception 'INVALID_COLOR' using errcode='22023'; end if;
 perform public.save_site_draft(target_tenant,business_name,business_description,business_phone,business_address,
  theme_preset,primary_color,accent_color,background_color,text_color,announcement_text,announcement_enabled,
  hero_eyebrow,hero_headline,hero_subheadline,hero_cta_label,hero_variant,products_heading,products_enabled,footer_description,navigation,
  logo_storage_key,logo_public_url,logo_file_name,logo_mime_type,logo_file_size,logo_alt_text,logo_format,logo_width,logo_height,
  hero_storage_key,hero_public_url,hero_file_name,hero_mime_type,hero_file_size,hero_alt_text,hero_format,hero_width,hero_height);
 update public.tenant_theme_settings set tokens=tokens||jsonb_build_object('secondary',lower(secondary_color)) where tenant_id=target_tenant;
end;
$$;
revoke all on function public.save_site_draft_with_secondary(uuid,text,text,text,text,text,text,text,text,text,text,text,boolean,text,text,text,text,text,text,boolean,text,jsonb,text,text,text,text,bigint,text,text,integer,integer,text,text,text,text,bigint,text,text,integer,integer) from public,anon;
grant execute on function public.save_site_draft_with_secondary(uuid,text,text,text,text,text,text,text,text,text,text,text,boolean,text,text,text,text,text,text,boolean,text,jsonb,text,text,text,text,bigint,text,text,integer,integer,text,text,text,text,bigint,text,text,integer,integer) to authenticated;

create function private.publish_business_application_contacts() returns trigger
language plpgsql security definer set search_path='' as $$
declare settings public.tenant_business_settings%rowtype;
begin
 select * into settings from public.tenant_business_settings where tenant_id=new.tenant_id;
 if settings.tenant_id is not null then
  new.configuration:=jsonb_set(new.configuration,'{business}',coalesce(new.configuration->'business','{}'::jsonb)||jsonb_build_object(
   'contactEmail',settings.contact_email,'whatsapp',settings.whatsapp,'instagram',settings.instagram,
   'facebook',settings.facebook,'tiktok',settings.tiktok,'city',settings.city,'state',settings.state,'country',settings.country
  ),true);
 end if;
 return new;
end;
$$;
revoke all on function private.publish_business_application_contacts() from public;
create trigger tenant_versions_publish_application_contacts before insert on public.tenant_site_versions
for each row execute function private.publish_business_application_contacts();
