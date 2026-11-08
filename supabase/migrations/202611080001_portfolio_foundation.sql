-- Portfolio builder, phase 1 (ADR 004).
-- A portfolio is a tenant with site_kind='PORTFOLIO'. It reuses the existing tenant,
-- content, theme, publishing, SEO, and entitlement machinery. Store-only commerce data
-- is rejected at the database boundary so hiding a screen is never the only control.

-- 1. Site kind -----------------------------------------------------------------------

alter table public.tenants
  add column site_kind text not null default 'STORE'
  check (site_kind in ('STORE', 'PORTFOLIO'));

-- Plans belong to one site kind so a portfolio can never inherit store limits (and a
-- store can never be placed on the free portfolio plan).
alter table public.plans
  add column site_kind text not null default 'STORE'
  check (site_kind in ('STORE', 'PORTFOLIO'));

-- The kind is chosen once at provisioning. Changing it later would strand commerce
-- records or portfolio sections, so it is immutable until an audited conversion exists.
create function private.preserve_tenant_site_kind() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.site_kind is distinct from old.site_kind then
    raise exception 'SITE_KIND_IMMUTABLE' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function private.preserve_tenant_site_kind() from public;
create trigger tenants_preserve_site_kind before update of site_kind on public.tenants
for each row execute function private.preserve_tenant_site_kind();

create function private.enforce_tenant_plan_kind() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.plan_id is not null and not exists (
    select 1 from public.plans p where p.id = new.plan_id and p.site_kind = new.site_kind
  ) then
    raise exception 'INVALID_PLAN' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_tenant_plan_kind() from public;
create trigger tenants_enforce_plan_kind before insert or update of plan_id on public.tenants
for each row execute function private.enforce_tenant_plan_kind();

-- 2. Template catalog ----------------------------------------------------------------

-- Database-owned so provisioning validates and seeds a template in one transaction, and
-- so templates can be switched on/off without a deployment.
create table public.site_templates (
  key text primary key check (key ~ '^[a-z][a-z0-9-]{1,47}$'),
  site_kind text not null check (site_kind in ('STORE', 'PORTFOLIO')),
  name text not null check (length(name) between 1 and 80),
  description text not null check (length(description) <= 300),
  audience text not null check (length(audience) <= 80),
  default_preset text not null check (default_preset in ('general', 'fashion', 'beauty', 'restaurant')),
  default_tokens jsonb not null default '{}'::jsonb check (jsonb_typeof(default_tokens) = 'object'),
  default_sections jsonb not null default '[]'::jsonb check (jsonb_typeof(default_sections) = 'array'),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger site_templates_updated before update on public.site_templates
for each row execute function private.touch_updated_at();
alter table public.site_templates enable row level security;
revoke all on public.site_templates from anon, authenticated;
grant select on public.site_templates to authenticated;
-- Template content is marketing copy, not tenant data: any signed-in user may read it.
create policy authenticated_read on public.site_templates for select to authenticated using (true);

-- Store templates keep their existing palette logic inside provisioning; their rows make
-- the catalog complete for listing and future on/off control.
insert into public.site_templates (key, site_kind, name, description, audience, default_preset, sort_order) values
  ('general', 'STORE', 'General store', 'A modern, flexible storefront for most products.', 'Any business', 'general', 0),
  ('fashion', 'STORE', 'Fashion', 'Editorial, luxury presentation for clothing and accessories.', 'Fashion brands', 'fashion', 1),
  ('beauty', 'STORE', 'Beauty', 'Soft, welcoming storefront for beauty and wellness.', 'Beauty brands', 'beauty', 2),
  ('restaurant', 'STORE', 'Restaurant', 'Warm, dark storefront for food businesses.', 'Restaurants', 'restaurant', 3);

insert into public.site_templates
  (key, site_kind, name, description, audience, default_preset, default_tokens, default_sections, sort_order)
values
(
  'developer', 'PORTFOLIO', 'Developer',
  'A dark, structured portfolio that leads with skills and shipped projects.',
  'Developers & engineers', 'general',
  '{"primary":"#4f8cff","secondary":"#8b9bb4","accent":"#2dd4bf","background":"#0e1116","text":"#e6edf3","styleKey":"professional-modern"}',
  '[
    {"key":"hero","type":"hero","variant":"centered","content":{"eyebrow":"Software engineer","subheadline":"I design, build, and ship reliable software. Replace this line with a one-sentence summary of what you do best.","primaryCta":{"label":"Get in touch","href":"#contact"}}},
    {"key":"about","type":"about","variant":"text","content":{"heading":"About me","body":"Introduce yourself here: what you work on, the problems you enjoy solving, and what you are looking for next."}},
    {"key":"skills","type":"skills","variant":"tags","content":{"heading":"Skills & tools"}},
    {"key":"projects","type":"projects","variant":"grid","content":{"heading":"Selected projects"}},
    {"key":"experience","type":"experience","variant":"timeline","content":{"heading":"Experience"}},
    {"key":"contact","type":"contact","variant":"details","content":{"heading":"Let''s work together","body":"Tell visitors how to reach you and what kinds of work or roles you are open to."}}
  ]',
  10
),
(
  'designer', 'PORTFOLIO', 'Designer',
  'A bright, airy portfolio that puts featured case studies first.',
  'Product & UI designers', 'general',
  '{"primary":"#1f1f24","secondary":"#6b6b76","accent":"#ff6b4a","background":"#fafaf8","text":"#1f1f24","styleKey":"clean-minimal"}',
  '[
    {"key":"hero","type":"hero","variant":"split","content":{"eyebrow":"Product designer","subheadline":"I turn complex problems into clear, friendly products. Replace this with your own introduction.","primaryCta":{"label":"Work with me","href":"#contact"}}},
    {"key":"projects","type":"projects","variant":"featured","content":{"heading":"Case studies"}},
    {"key":"about","type":"about","variant":"text","content":{"heading":"How I work","body":"Describe your design process, the teams you have worked with, and the kind of products you love to make."}},
    {"key":"skills","type":"skills","variant":"tags","content":{"heading":"What I do"}},
    {"key":"contact","type":"contact","variant":"details","content":{"heading":"Start a project","body":"Share how clients or hiring teams can reach you."}}
  ]',
  11
),
(
  'photographer', 'PORTFOLIO', 'Photographer',
  'A dark, image-led portfolio with a full-bleed opening and a masonry collection.',
  'Photographers', 'fashion',
  '{"primary":"#c9a46a","secondary":"#8f8577","accent":"#c9a46a","background":"#141312","text":"#f2eee8","styleKey":"elegant-luxury"}',
  '[
    {"key":"hero","type":"hero","variant":"image-overlay","content":{"eyebrow":"Photography","subheadline":"Portraits, events, and stories told in light. Replace this with a line about your style.","primaryCta":{"label":"Book a session","href":"#contact"}}},
    {"key":"projects","type":"projects","variant":"masonry","content":{"heading":"Portfolio"}},
    {"key":"about","type":"about","variant":"text","content":{"heading":"Behind the lens","body":"Tell visitors who you are, where you shoot, and what it is like to work with you."}},
    {"key":"contact","type":"contact","variant":"details","content":{"heading":"Bookings","body":"Explain how to book you and which locations you cover."}}
  ]',
  12
),
(
  'resume', 'PORTFOLIO', 'Résumé',
  'A clean one-page résumé site for job seekers.',
  'Job seekers', 'general',
  '{"primary":"#2b4c7e","secondary":"#5b6b82","accent":"#c08a2e","background":"#ffffff","text":"#1d2733","styleKey":"clean-minimal"}',
  '[
    {"key":"hero","type":"hero","variant":"centered","content":{"eyebrow":"Open to new opportunities","subheadline":"Write a short professional summary: your role, years of experience, and what you are best at.","primaryCta":{"label":"Contact me","href":"#contact"}}},
    {"key":"about","type":"about","variant":"text","content":{"heading":"Profile","body":"Summarise your background, strengths, and the kind of role you want next."}},
    {"key":"experience","type":"experience","variant":"timeline","content":{"heading":"Work experience"}},
    {"key":"education","type":"education","variant":"timeline","content":{"heading":"Education"}},
    {"key":"skills","type":"skills","variant":"tags","content":{"heading":"Skills"}},
    {"key":"contact","type":"contact","variant":"details","content":{"heading":"Get in touch","body":"Let recruiters know the best way to reach you."}}
  ]',
  13
);

-- 3. Portfolio plan and entitlement ---------------------------------------------------

insert into public.plans (slug, name, description, price, currency, billing_interval, is_public, sort_order, site_kind)
values ('portfolio', 'Portfolio', 'Free personal and studio portfolio websites.', 0, 'NGN', 'MONTHLY', false, 3, 'PORTFOLIO');

insert into public.features (key, default_value, name, description, value_type, category)
values (
  'portfolio_sites', 'true', 'Portfolio websites',
  'Create and publish portfolio websites. Turning this off blocks new portfolios and publishing; already-published portfolios stay online.',
  'BOOLEAN', 'Portfolio'
);

-- Portfolios carry no commerce, SMS, or custom-domain capability in this phase.
insert into public.plan_features (plan_id, feature_key, value)
select p.id, f.key, case f.key
  when 'custom_domain' then 'false'::jsonb
  when 'sms_notifications' then 'false'::jsonb
  when 'product_limit' then '0'::jsonb
  when 'staff_limit' then '1'::jsonb
  else f.default_value
end
from public.plans p cross join public.features f
where p.slug = 'portfolio'
on conflict (plan_id, feature_key) do nothing;

-- Free for now: every plan carries the portfolio feature as on.
insert into public.plan_features (plan_id, feature_key, value)
select p.id, 'portfolio_sites', 'true'::jsonb from public.plans p
on conflict (plan_id, feature_key) do nothing;

-- 4. Provisioning --------------------------------------------------------------------

-- Shared tenant provisioning. Callers perform their own authorization; this function is
-- private and never browser-callable. Behaviour for STORE is unchanged from 202609050002.
create function private.provision_tenant_core(
  business_name text, business_slug text, owner_name text, owner_email text,
  template text, plan_slug text, payment_mode text, kind text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare tenant uuid; plan uuid; page uuid; actor uuid; palette jsonb;
begin
  if business_name is null or length(trim(business_name)) not between 1 and 160
    or business_slug is null or length(business_slug) not between 3 and 63
    or business_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or business_slug in ('www','app','admin','api','auth','login','support','mail','setup','businesses') then
    raise exception 'INVALID_BUSINESS' using errcode = '22023';
  end if;
  if owner_name is null or length(trim(owner_name)) not between 1 and 120
    or owner_email is null or length(owner_email) > 254
    or owner_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'INVALID_OWNER' using errcode = '22023';
  end if;
  if kind = 'STORE' then
    if template is null or template not in ('fashion','beauty','restaurant','general') then
      raise exception 'INVALID_SETTINGS' using errcode = '22023';
    end if;
  elsif kind = 'PORTFOLIO' then
    if not exists (
      select 1 from public.site_templates
      where key = template and site_kind = 'PORTFOLIO' and is_active
    ) then
      raise exception 'INVALID_TEMPLATE' using errcode = '22023';
    end if;
  else
    raise exception 'INVALID_SETTINGS' using errcode = '22023';
  end if;
  if payment_mode is null or payment_mode not in ('bank_transfer','paystack') then
    raise exception 'INVALID_SETTINGS' using errcode = '22023';
  end if;
  select id into plan from public.plans where slug = plan_slug and is_active and site_kind = kind;
  if plan is null then raise exception 'INVALID_PLAN' using errcode = '22023'; end if;
  select id into actor from public.users where auth_user_id = auth.uid();
  palette := case template
    when 'fashion' then '{"primary":"#242630","background":"#faf9f6"}'::jsonb
    when 'beauty' then '{"primary":"#b86885","background":"#fff7fa"}'::jsonb
    when 'restaurant' then '{"primary":"#ad6839","background":"#211e1b"}'::jsonb
    else '{"primary":"#6655d7","background":"#ffffff"}'::jsonb
  end;
  insert into public.tenants (name, slug, status, plan_id, template_key, industry_key, site_kind)
  values (trim(business_name), business_slug, 'PROVISIONING', plan, template,
    case when kind = 'PORTFOLIO' then 'portfolio' else template end, kind)
  returning id into tenant;
  insert into public.tenant_invitations (tenant_id, owner_name, email) values (tenant, trim(owner_name), lower(trim(owner_email)));
  insert into public.tenant_business_settings values (tenant, trim(business_name), lower(trim(owner_email)));
  insert into public.tenant_theme_settings values (tenant, case when kind = 'STORE' then template else 'general' end, palette);
  insert into public.tenant_layout_settings (tenant_id) values (tenant);
  insert into public.pages (tenant_id, slug, name) values (tenant, 'home', 'Home') returning id into page;
  insert into public.content_blocks (tenant_id, page_id, block_key, content)
  values (tenant, page, 'hero', jsonb_build_object('headline', trim(business_name), 'description', 'Welcome to our store.'));
  insert into public.navigation_items (tenant_id, label, target, sort_order) values (tenant, 'Home', '/', 0);
  insert into public.tenant_seo_settings (tenant_id, site_title) values (tenant, trim(business_name));
  insert into public.tenant_email_settings (tenant_id) values (tenant);
  insert into public.tenant_sms_settings (tenant_id) values (tenant);
  insert into public.tenant_checkout_settings (tenant_id, payment_setup_mode) values (tenant, payment_mode);
  insert into public.subscriptions (tenant_id, plan_id) values (tenant, plan);
  insert into public.tenant_domains (tenant_id, platform_slug) values (tenant, business_slug);
  insert into public.tenant_onboarding (tenant_id) values (tenant);
  insert into public.audit_logs (tenant_id, actor_user_id, action, resource_type, resource_id)
  values (tenant, actor, 'TENANT_CREATED', 'tenants', tenant);
  return tenant;
end;
$$;
revoke all on function private.provision_tenant_core(text,text,text,text,text,text,text,text) from public;

-- Same signature, authorization, and behaviour as before; it now delegates to the core.
create or replace function public.provision_tenant(
  business_name text, business_slug text, owner_name text, owner_email text,
  template text, plan_slug text, payment_mode text
) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_super_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return private.provision_tenant_core(business_name, business_slug, owner_name, owner_email,
    template, plan_slug, payment_mode, 'STORE');
end;
$$;

-- Creates a portfolio from a template in one transaction: tenant, theme, and the
-- template's homepage sections. Store-only payment setup stays at its inert default.
create function public.provision_portfolio_tenant(
  business_name text, business_slug text, owner_name text, owner_email text, template text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare tenant uuid; page uuid; chosen public.site_templates%rowtype; section jsonb; section_order integer := 0;
begin
  if not private.is_super_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  tenant := private.provision_tenant_core(business_name, business_slug, owner_name, owner_email,
    template, 'portfolio', 'bank_transfer', 'PORTFOLIO');
  -- Resolves global pause and the portfolio plan value through the shared entitlement path.
  perform private.assert_feature(tenant, 'portfolio_sites');
  select * into chosen from public.site_templates where key = template;
  update public.tenant_theme_settings
  set preset_key = chosen.default_preset, tokens = chosen.default_tokens
  where tenant_id = tenant;
  select id into page from public.pages where tenant_id = tenant and slug = 'home';
  update public.pages set page_type = 'HOME' where id = page and page_type is distinct from 'HOME';
  delete from public.content_blocks where tenant_id = tenant and page_id = page;
  for section in select value from jsonb_array_elements(chosen.default_sections) loop
    insert into public.content_blocks (tenant_id, page_id, block_key, block_type, variant, sort_order, is_enabled, content)
    values (
      tenant, page, section->>'key', section->>'type', section->>'variant', section_order, true,
      case when section->>'type' = 'hero'
        then coalesce(section->'content', '{}'::jsonb) || jsonb_build_object('headline', trim(business_name))
        else coalesce(section->'content', '{}'::jsonb)
      end
    );
    section_order := section_order + 1;
  end loop;
  update public.tenant_layout_settings set sections = coalesce((
    select jsonb_agg(jsonb_build_object('key', c.block_key, 'enabled', c.is_enabled, 'variant', c.variant, 'sortOrder', c.sort_order) order by c.sort_order)
    from public.content_blocks c where c.tenant_id = tenant and c.page_id = page
  ), '[]'::jsonb) where tenant_id = tenant;
  update public.navigation_items set link_type = 'PAGE', page_id = page, target = '/'
  where tenant_id = tenant and label = 'Home';
  update public.tenant_onboarding set theme_selected = true where tenant_id = tenant;
  return tenant;
end;
$$;
revoke all on function public.provision_portfolio_tenant(text,text,text,text,text) from public, anon;
grant execute on function public.provision_portfolio_tenant(text,text,text,text,text) to authenticated;

-- 5. Site-kind boundaries ------------------------------------------------------------

create function private.tenant_site_kind(target_tenant uuid) returns text
language sql stable security definer set search_path = '' as $$
  select site_kind from public.tenants where id = target_tenant;
$$;
revoke all on function private.tenant_site_kind(uuid) from public;

-- Commerce records are store-only. This catches every RPC that writes them, current and
-- future, without each one repeating the check.
create function private.reject_portfolio_commerce() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if private.tenant_site_kind(new.tenant_id) = 'PORTFOLIO' then
    raise exception 'STORE_ONLY_FEATURE' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.reject_portfolio_commerce() from public;

do $$ declare table_name text; begin
  foreach table_name in array array['products','categories','orders','shipping_zones','shipping_rates','tenant_bank_accounts'] loop
    execute format(
      'create trigger %I before insert on public.%I for each row execute function private.reject_portfolio_commerce()',
      table_name || '_store_only', table_name
    );
  end loop;
end $$;

-- Homepage section types are scoped to a site kind. Shared types (hero, footer,
-- announcement, rich-text page bodies) remain valid for both.
create function private.enforce_block_site_kind() returns trigger
language plpgsql security definer set search_path = '' as $$
declare kind text := private.tenant_site_kind(new.tenant_id);
begin
  if kind = 'PORTFOLIO' and new.block_type = 'products' then
    raise exception 'STORE_ONLY_FEATURE' using errcode = '42501';
  end if;
  if kind = 'STORE' and new.block_type in ('about','skills','projects','experience','education','contact') then
    raise exception 'PORTFOLIO_ONLY_FEATURE' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_block_site_kind() from public;
create trigger content_blocks_enforce_site_kind before insert or update of block_type on public.content_blocks
for each row execute function private.enforce_block_site_kind();

-- Published snapshots carry their site kind so the public renderer never needs a second
-- query. Portfolio publishing also re-checks the entitlement at the database boundary.
create function private.stamp_site_version_kind() returns trigger
language plpgsql security definer set search_path = '' as $$
declare kind text := private.tenant_site_kind(new.tenant_id);
begin
  if kind = 'PORTFOLIO' then
    perform private.assert_feature(new.tenant_id, 'portfolio_sites');
  end if;
  new.configuration := new.configuration || jsonb_build_object('siteKind', coalesce(kind, 'STORE'));
  return new;
end;
$$;
revoke all on function private.stamp_site_version_kind() from public;
create trigger tenant_versions_stamp_site_kind before insert on public.tenant_site_versions
for each row execute function private.stamp_site_version_kind();

-- 6. Public read --------------------------------------------------------------------

-- Same result as 202609080003 plus tenant.siteKind, so public commerce routes can
-- refuse portfolios even before their first publish. Portfolios never carry products.
create or replace function public.get_public_storefront(store_slug text) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'tenant',jsonb_build_object('name',t.name,'slug',t.slug,'siteKind',t.site_kind),
  'site',(select v.configuration from public.tenant_site_versions v where v.tenant_id=t.id and v.status='PUBLISHED' limit 1),
  'categories','[]'::jsonb,
  'products',coalesce((select jsonb_agg(item.value order by item.created_at desc,item.id desc) from (
   select p.created_at,p.id,jsonb_build_object(
    'id',p.id,'name',p.name,'slug',p.slug,'shortDescription',p.short_description,'description',p.description,
    'price',p.price,'currency',p.currency,'stockQuantity',p.stock_quantity,'trackInventory',p.track_inventory,
    'mediaUrl',a.public_url_or_resolvable_key,'mediaType',a.resource_type,'mediaAlt',a.alt_text,
    'categories',coalesce((select jsonb_agg(c.name order by c.sort_order,c.name) from public.product_categories pc
      join public.categories c on c.tenant_id=pc.tenant_id and c.id=pc.category_id
      where pc.tenant_id=p.tenant_id and pc.product_id=p.id and c.status='ACTIVE'),'[]'::jsonb)
   ) value from public.products p left join public.media_assets a
    on a.tenant_id=p.tenant_id and a.id=p.primary_image_asset_id
   where p.tenant_id=t.id and p.status='ACTIVE'
   order by p.created_at desc,p.id desc limit 8
  ) item),'[]'::jsonb)
 ) from public.tenants t where t.slug=store_slug and t.status in ('TRIAL','ACTIVE');
$$;
