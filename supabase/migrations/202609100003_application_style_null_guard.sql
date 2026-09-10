-- A missing style must not fall through SQL's three-valued NOT IN result.
create or replace function private.complete_application_style_tokens() returns trigger
language plpgsql set search_path='' as $$
declare style text:=new.tokens->>'styleKey'; text_color text;
begin
 if style is null or style not in
   ('clean-minimal','elegant-luxury','bright-bold','soft-friendly','warm-natural','professional-modern')
   or new.tokens?'text' then return new; end if;
 text_color:=case style
  when 'elegant-luxury' then '#25222a'
  when 'soft-friendly' then '#392832'
  when 'warm-natural' then '#f8f2e9'
  when 'professional-modern' then '#1f2f3a'
  else '#242630' end;
 new.tokens:=new.tokens||jsonb_build_object('text',text_color);
 return new;
end;
$$;

-- Correct only application-created profiles that received the former fallback.
update public.tenant_theme_settings settings
set tokens=settings.tokens||jsonb_build_object('text',case settings.tokens->>'styleKey'
 when 'elegant-luxury' then '#25222a' when 'soft-friendly' then '#392832'
 when 'warm-natural' then '#f8f2e9' when 'professional-modern' then '#1f2f3a'
 else '#242630' end)
from public.business_applications application
where application.provisioned_tenant_id=settings.tenant_id
 and settings.tokens->>'styleKey' in
  ('clean-minimal','elegant-luxury','bright-bold','soft-friendly','warm-natural','professional-modern')
 and settings.tokens->>'text'='#242630';
