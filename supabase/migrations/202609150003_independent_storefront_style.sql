-- Website personality and color palette are independent design choices. Keep the
-- full draft update atomic and retire browser access to older save entry points
-- that could infer or erase styleKey.

create function public.save_site_design(
 target_tenant uuid,business_name text,business_description text,business_phone text,business_address text,
 theme_preset text,website_style text,primary_color text,secondary_color text,accent_color text,background_color text,text_color text,
 announcement_text text,announcement_enabled boolean,hero_eyebrow text,hero_headline text,hero_subheadline text,
 hero_cta_label text,hero_variant text,products_heading text,products_enabled boolean,footer_description text,navigation jsonb,
 logo_storage_key text default null,logo_public_url text default null,logo_file_name text default null,logo_mime_type text default null,
 logo_file_size bigint default null,logo_alt_text text default null,logo_format text default null,logo_width integer default null,logo_height integer default null,
 hero_storage_key text default null,hero_public_url text default null,hero_file_name text default null,hero_mime_type text default null,
 hero_file_size bigint default null,hero_alt_text text default null,hero_format text default null,hero_width integer default null,hero_height integer default null
) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.can_manage_catalog(target_tenant) then
  raise exception 'FORBIDDEN' using errcode='42501';
 end if;
 if website_style not in (
  'clean-minimal','elegant-luxury','bright-bold','soft-friendly','warm-natural','professional-modern'
 ) then
  raise exception 'INVALID_WEBSITE_STYLE' using errcode='22023';
 end if;
 perform public.save_site_draft_with_secondary(
  target_tenant=>target_tenant,business_name=>business_name,business_description=>business_description,
  business_phone=>business_phone,business_address=>business_address,theme_preset=>theme_preset,
  primary_color=>primary_color,secondary_color=>secondary_color,accent_color=>accent_color,
  background_color=>background_color,text_color=>text_color,announcement_text=>announcement_text,
  announcement_enabled=>announcement_enabled,hero_eyebrow=>hero_eyebrow,hero_headline=>hero_headline,
  hero_subheadline=>hero_subheadline,hero_cta_label=>hero_cta_label,hero_variant=>hero_variant,
  products_heading=>products_heading,products_enabled=>products_enabled,footer_description=>footer_description,
  navigation=>navigation,logo_storage_key=>logo_storage_key,logo_public_url=>logo_public_url,
  logo_file_name=>logo_file_name,logo_mime_type=>logo_mime_type,logo_file_size=>logo_file_size,
  logo_alt_text=>logo_alt_text,logo_format=>logo_format,logo_width=>logo_width,logo_height=>logo_height,
  hero_storage_key=>hero_storage_key,hero_public_url=>hero_public_url,hero_file_name=>hero_file_name,
  hero_mime_type=>hero_mime_type,hero_file_size=>hero_file_size,hero_alt_text=>hero_alt_text,
  hero_format=>hero_format,hero_width=>hero_width,hero_height=>hero_height
 );
 update public.tenant_theme_settings
 set tokens=tokens||jsonb_build_object('styleKey',website_style)
 where tenant_id=target_tenant;
end;
$$;

revoke all on function public.save_site_draft(
 uuid,text,text,text,text,text,text,text,text,text,text,boolean,text,text,text,text,text,text,boolean,text,jsonb,
 text,text,text,text,bigint,text,text,integer,integer,text,text,text,text,bigint,text,text,integer,integer
) from authenticated;
revoke all on function public.save_site_draft_with_secondary(
 uuid,text,text,text,text,text,text,text,text,text,text,text,boolean,text,text,text,text,text,text,boolean,text,jsonb,
 text,text,text,text,bigint,text,text,integer,integer,text,text,text,text,bigint,text,text,integer,integer
) from authenticated;
revoke all on function public.save_site_design(
 uuid,text,text,text,text,text,text,text,text,text,text,text,text,boolean,text,text,text,text,text,text,boolean,text,jsonb,
 text,text,text,text,bigint,text,text,integer,integer,text,text,text,text,bigint,text,text,integer,integer
) from public,anon;
grant execute on function public.save_site_design(
 uuid,text,text,text,text,text,text,text,text,text,text,text,text,boolean,text,text,text,text,text,text,boolean,text,jsonb,
 text,text,text,text,bigint,text,text,integer,integer,text,text,text,text,bigint,text,text,integer,integer
) to authenticated;
