-- Portfolio builder, phase 2: change look (template style) and colours without losing
-- any content. Readability is enforced here, not only in the colour picker.

-- WCAG relative luminance and contrast ratio for #rrggbb colours.
create function private.color_luminance(hex text) returns double precision
language sql immutable set search_path = '' as $$
  select 0.2126 * c[1] + 0.7152 * c[2] + 0.0722 * c[3]
  from (
    select array(
      select case when v <= 0.04045 then v / 12.92 else power((v + 0.055) / 1.055, 2.4) end
      from (
        select ('x' || substr(hex, 2 + offs, 2))::bit(8)::integer / 255.0 as v, offs
        from unnest(array[0, 2, 4]) offs
      ) channels
      order by offs
    ) c
  ) linear;
$$;
revoke all on function private.color_luminance(text) from public;

create function private.color_contrast(first_color text, second_color text)
returns double precision language sql immutable set search_path = '' as $$
  select (greatest(a, b) + 0.05) / (least(a, b) + 0.05)
  from (select private.color_luminance(first_color) a, private.color_luminance(second_color) b) l;
$$;
revoke all on function private.color_contrast(text, text) from public;

-- Switches the look and/or colours. `target_style` must be one of the active portfolio
-- templates' styles; its preset and base style come with it. Content, section order, and
-- layouts are untouched, so switching never loses work.
create function public.save_portfolio_look(target_tenant uuid, target_style text, palette jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare template public.site_templates%rowtype; key text; actor uuid;
begin
  perform private.assert_portfolio_editor(target_tenant);
  select * into template from public.site_templates
  where site_kind = 'PORTFOLIO' and is_active and default_tokens ->> 'templateStyle' = target_style
  order by sort_order limit 1;
  if template.key is null then raise exception 'INVALID_CONTENT' using errcode = '22023'; end if;
  if jsonb_typeof(palette) is distinct from 'object' then
    raise exception 'INVALID_COLOR' using errcode = '22023';
  end if;
  foreach key in array array['background', 'text', 'primary', 'accent', 'secondary'] loop
    if coalesce(palette ->> key, '') !~* '^#[0-9a-f]{6}$' then
      raise exception 'INVALID_COLOR' using errcode = '22023';
    end if;
  end loop;
  -- WCAG AA for body text; the picker warns first, this makes it binding.
  if private.color_contrast(palette ->> 'text', palette ->> 'background') < 4.5 then
    raise exception 'LOW_CONTRAST' using errcode = '22023';
  end if;
  update public.tenant_theme_settings set
    preset_key = template.default_preset,
    tokens = jsonb_build_object(
      'background', lower(palette ->> 'background'), 'text', lower(palette ->> 'text'),
      'primary', lower(palette ->> 'primary'), 'accent', lower(palette ->> 'accent'),
      'secondary', lower(palette ->> 'secondary'),
      'styleKey', template.default_tokens ->> 'styleKey', 'templateStyle', target_style)
  where tenant_id = target_tenant;
  update public.tenants set template_key = template.key where id = target_tenant;
  select id into actor from public.users where auth_user_id = auth.uid();
  insert into public.audit_logs (tenant_id, actor_user_id, action, resource_type, resource_id)
  values (target_tenant, actor, 'PORTFOLIO_LOOK_UPDATED', 'tenant_theme_settings', target_tenant);
end;
$$;
revoke all on function public.save_portfolio_look(uuid, text, jsonb) from public, anon;
grant execute on function public.save_portfolio_look(uuid, text, jsonb) to authenticated;
