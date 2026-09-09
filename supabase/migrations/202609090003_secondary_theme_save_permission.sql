-- Keep the wrapper invoker-scoped without requiring access to a private validator.
create or replace function public.save_site_draft_with_secondary(
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
 if secondary_color is null or secondary_color!~*'^#[0-9a-f]{6}$' then
  raise exception 'INVALID_COLOR' using errcode='22023';
 end if;
 perform public.save_site_draft(target_tenant,business_name,business_description,business_phone,business_address,
  theme_preset,primary_color,accent_color,background_color,text_color,announcement_text,announcement_enabled,
  hero_eyebrow,hero_headline,hero_subheadline,hero_cta_label,hero_variant,products_heading,products_enabled,footer_description,navigation,
  logo_storage_key,logo_public_url,logo_file_name,logo_mime_type,logo_file_size,logo_alt_text,logo_format,logo_width,logo_height,
  hero_storage_key,hero_public_url,hero_file_name,hero_mime_type,hero_file_size,hero_alt_text,hero_format,hero_width,hero_height);
 update public.tenant_theme_settings
 set tokens=tokens||jsonb_build_object('secondary',lower(secondary_color))
 where tenant_id=target_tenant;
end;
$$;
