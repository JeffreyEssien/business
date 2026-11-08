-- Portfolio builder, phase 2: three-step guided start (docs/plans/portfolio-templates.md §5.2).
-- Shown once to a new portfolio owner; completing or skipping it records that it is done.

alter table public.tenant_onboarding
  add column portfolio_setup_completed boolean not null default false;

-- Saves the answers in one transaction: look and colours, name and role line, and contact
-- details. Email is required and is the main contact; WhatsApp is optional (owner decision).
create function public.complete_portfolio_setup(target_tenant uuid, payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  display_name text := private.clean_text(payload -> 'name', 160);
  role_line text := private.clean_text(payload -> 'role', 80);
  contact_address text := lower(private.clean_text(payload -> 'email', 254));
  whatsapp_number text := private.clean_text(payload -> 'whatsapp', 24);
  hero public.content_blocks%rowtype;
  actor uuid;
begin
  perform private.assert_portfolio_editor(target_tenant);
  if display_name = '' then raise exception 'INVALID_CONTENT' using errcode = '22023'; end if;
  if contact_address !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'INVALID_EMAIL' using errcode = '22023';
  end if;
  if whatsapp_number <> '' and whatsapp_number !~ '^\+?[0-9 ]{7,20}$' then
    raise exception 'INVALID_PHONE' using errcode = '22023';
  end if;

  -- Reuses the look rules (known style, hex colours, readable text).
  perform public.save_portfolio_look(target_tenant, payload ->> 'style', payload -> 'palette');

  select * into hero from public.content_blocks
  where tenant_id = target_tenant and page_id = private.portfolio_home_page(target_tenant)
    and block_type = 'hero' for update;
  if hero.id is not null then
    -- Only the name and role line change; the rest of the introduction is left as it is.
    update public.content_blocks set content = content || jsonb_build_object(
      'headline', display_name,
      'eyebrow', case when role_line = '' then coalesce(content ->> 'eyebrow', '') else role_line end)
    where id = hero.id;
  end if;

  update public.tenant_business_settings
  set business_name = display_name, contact_email = contact_address, whatsapp = whatsapp_number
  where tenant_id = target_tenant;
  update public.tenants set name = display_name where id = target_tenant;
  update public.tenant_onboarding
  set portfolio_setup_completed = true, business_profile_completed = true
  where tenant_id = target_tenant;

  select id into actor from public.users where auth_user_id = auth.uid();
  insert into public.audit_logs (tenant_id, actor_user_id, action, resource_type, resource_id)
  values (target_tenant, actor, 'PORTFOLIO_SETUP_COMPLETED', 'tenants', target_tenant);
end;
$$;
revoke all on function public.complete_portfolio_setup(uuid, jsonb) from public, anon;
grant execute on function public.complete_portfolio_setup(uuid, jsonb) to authenticated;

create function public.skip_portfolio_setup(target_tenant uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_portfolio_editor(target_tenant);
  update public.tenant_onboarding set portfolio_setup_completed = true where tenant_id = target_tenant;
end;
$$;
revoke all on function public.skip_portfolio_setup(uuid) from public, anon;
grant execute on function public.skip_portfolio_setup(uuid) to authenticated;
