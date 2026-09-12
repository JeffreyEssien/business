-- Reject abusive or duplicate applications before external media work. A short-
-- lived reservation binds the validated payload to one final submission.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table private.business_application_reservations(
 token uuid primary key default gen_random_uuid(),
 application_id uuid not null,
 request_fingerprint text not null check(request_fingerprint ~ '^[0-9a-f]{64}$'),
 owner_email text not null,
 preferred_slug text not null,
 payload_digest text not null check(payload_digest ~ '^[0-9a-f]{64}$'),
 expires_at timestamptz not null,
 consumed_at timestamptz,
 created_at timestamptz not null default now()
);
create index business_application_reservations_expiry_idx
 on private.business_application_reservations(expires_at) where consumed_at is null;
revoke all on private.business_application_reservations from public,anon,authenticated;

create function private.consume_business_application_limit(
 limit_key text,window_length interval,maximum_attempts integer
) returns boolean language plpgsql security definer set search_path='' as $$
declare current_attempts integer; current_window timestamptz;
begin
 if length(coalesce(limit_key,'')) not between 1 and 200
   or window_length<interval '1 minute' or window_length>interval '7 days'
   or maximum_attempts not between 1 and 1000 then return false; end if;
 insert into private.business_application_limits(fingerprint,window_started_at,attempts)
 values(limit_key,now(),1)
 on conflict(fingerprint) do update set
  attempts=case when private.business_application_limits.window_started_at<now()-window_length
   then 1 else private.business_application_limits.attempts+1 end,
  window_started_at=case when private.business_application_limits.window_started_at<now()-window_length
   then now() else private.business_application_limits.window_started_at end
 returning attempts,window_started_at into current_attempts,current_window;
 return current_attempts<=maximum_attempts and current_window>=now()-window_length;
end;
$$;
revoke all on function private.consume_business_application_limit(text,interval,integer) from public;

create function public.preflight_business_application(
 application_id uuid,payload jsonb,request_fingerprint text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare existing_reference text; existing_token uuid; reservation_token uuid;
 normalized_email text:=lower(trim(coalesce(payload->>'ownerEmail','')));
 normalized_slug text:=coalesce(payload->>'preferredSlug','');
 detail text:=trim(coalesce(payload->>'otherBusinessType',''));
 payload_hash text;
begin
 if application_id is null or not private.valid_business_application(payload)
   or request_fingerprint is null or request_fingerprint !~ '^[0-9a-f]{64}$'
   or length(detail)>100 or (payload->>'businessType'='other' and detail='') then
  return jsonb_build_object('ok',false,'code','INVALID_APPLICATION');
 end if;
 perform pg_advisory_xact_lock(hashtextextended(application_id::text,0));
 select reference into existing_reference from public.business_applications where id=application_id;
 if existing_reference is not null then
  return jsonb_build_object('ok',true,'existing',true,'reference',existing_reference);
 end if;
 payload_hash:=encode(extensions.digest((payload-'logo'-'removeLogo')::text,'sha256'),'hex');
 select token into existing_token from private.business_application_reservations
 where business_application_reservations.application_id=preflight_business_application.application_id
  and business_application_reservations.request_fingerprint=preflight_business_application.request_fingerprint
  and business_application_reservations.payload_digest=payload_hash
  and business_application_reservations.consumed_at is null
  and business_application_reservations.expires_at>now()
 order by business_application_reservations.created_at desc limit 1;
 if existing_token is not null then
  return jsonb_build_object('ok',true,'reservationToken',existing_token);
 end if;
 if exists(select 1 from public.business_applications
   where status in ('PENDING','UNDER_REVIEW') and submitted_at>now()-interval '7 days'
    and (owner_email=normalized_email or preferred_slug=normalized_slug)) then
  return jsonb_build_object('ok',false,'code','DUPLICATE_APPLICATION');
 end if;
 if not public.business_application_slug_available(normalized_slug) then
  return jsonb_build_object('ok',false,'code','WEBSITE_NAME_UNAVAILABLE');
 end if;
 -- A broad network ceiling limits upload abuse without treating a shared mobile
 -- address as a single applicant. The lower email limit is the primary signal.
 if not private.consume_business_application_limit('network:'||request_fingerprint,interval '1 hour',30)
   or not private.consume_business_application_limit(
    'email:'||encode(extensions.digest(normalized_email,'sha256'),'hex'),interval '24 hours',3
   ) then return jsonb_build_object('ok',false,'code','RATE_LIMITED'); end if;
 delete from private.business_application_reservations where expires_at<now()-interval '1 day';
 insert into private.business_application_reservations(
  application_id,request_fingerprint,owner_email,preferred_slug,payload_digest,expires_at
 ) values(application_id,request_fingerprint,normalized_email,normalized_slug,payload_hash,now()+interval '10 minutes')
 returning token into reservation_token;
 return jsonb_build_object('ok',true,'reservationToken',reservation_token);
end;
$$;
revoke all on function public.preflight_business_application(uuid,jsonb,text) from public;
grant execute on function public.preflight_business_application(uuid,jsonb,text) to anon,authenticated;

create function public.submit_reserved_business_application(
 application_id uuid,payload jsonb,request_fingerprint text,reservation_token uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare reservation private.business_application_reservations%rowtype; result jsonb;
 expected_hash text;
begin
 if application_id is null or reservation_token is null
   or request_fingerprint is null or request_fingerprint !~ '^[0-9a-f]{64}$' then
  return jsonb_build_object('ok',false,'code','INVALID_RESERVATION');
 end if;
 select * into reservation from private.business_application_reservations
 where token=reservation_token and business_application_reservations.application_id=submit_reserved_business_application.application_id
 for update;
 expected_hash:=encode(extensions.digest((payload-'logo'-'removeLogo')::text,'sha256'),'hex');
 if reservation.token is null or reservation.consumed_at is not null or reservation.expires_at<=now()
   or reservation.request_fingerprint<>request_fingerprint
   or reservation.owner_email<>lower(trim(coalesce(payload->>'ownerEmail','')))
   or reservation.preferred_slug<>coalesce(payload->>'preferredSlug','')
   or reservation.payload_digest<>expected_hash then
  return jsonb_build_object('ok',false,'code','INVALID_RESERVATION');
 end if;
 update private.business_application_reservations set consumed_at=now()
 where business_application_reservations.token=reservation.token;
 -- The legacy function retains the final race-condition and logo validation.
 -- A token-derived key prevents it from charging the network limit a second time.
 result:=public.submit_business_application_complete(application_id,payload,
  encode(extensions.digest(reservation_token::text,'sha256'),'hex'));
 if result->>'ok'='true' and coalesce(result->>'existing','false')<>'true' then
  update public.business_applications
  set source_fingerprint=submit_reserved_business_application.request_fingerprint
  where business_applications.id=submit_reserved_business_application.application_id;
 end if;
 return result;
end;
$$;
revoke all on function public.submit_business_application_complete(uuid,jsonb,text) from anon,authenticated;
revoke all on function public.submit_reserved_business_application(uuid,jsonb,text,uuid) from public;
grant execute on function public.submit_reserved_business_application(uuid,jsonb,text,uuid)
 to anon,authenticated;

-- Repeat authorization at the wrapper boundary instead of depending on a
-- future implementation of save_site_draft to retain that check.
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
 if not private.can_manage_catalog(target_tenant) then
  raise exception 'FORBIDDEN' using errcode='42501';
 end if;
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
