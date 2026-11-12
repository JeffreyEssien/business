-- Phase 10 (billing) foundation: give plans the pricing shape from spec §31 so the
-- platform owner can set price, billing cycle, and public visibility without a deploy.
-- Additive only. No recurring charge is collected here; merchant payments stay separate.

alter table public.plans
  add column description text not null default '',
  add column price numeric(14, 2) not null default 0 check (price >= 0),
  add column currency text not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
  add column billing_interval text not null default 'MONTHLY'
    check (billing_interval in ('MONTHLY', 'YEARLY')),
  add column is_public boolean not null default false,
  add column sort_order integer not null default 0,
  add column created_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now();

-- Preserve the established Starter/Growth/Pro ordering for the management screen.
update public.plans
set sort_order = case slug when 'starter' then 0 when 'growth' then 1 when 'pro' then 2 else 0 end;

create trigger plans_updated before update on public.plans
for each row execute function private.touch_updated_at();

-- Super-admin-only plan editor. Prices stay owner-entered data; the function never
-- charges anyone. Every change is audited with the previous and new values.
create function public.save_plan(
  target_plan text,
  plan_name text,
  plan_description text,
  plan_price numeric,
  plan_currency text,
  plan_billing_interval text,
  plan_is_public boolean,
  plan_sort_order integer
) returns void language plpgsql security definer set search_path = '' as $$
declare
  plan uuid;
  actor uuid;
  rounded_price numeric(14, 2);
  normalized_currency text;
  old_values jsonb;
begin
  if not private.is_super_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select id into plan from public.plans where slug = target_plan for update;
  if plan is null then
    raise exception 'PLAN_NOT_FOUND' using errcode = '22023';
  end if;
  rounded_price = round(coalesce(plan_price, 0), 2);
  normalized_currency = upper(trim(coalesce(plan_currency, '')));
  if length(trim(coalesce(plan_name, ''))) not between 1 and 80
    or length(coalesce(plan_description, '')) > 500
    or rounded_price < 0 or rounded_price > 100000000
    or normalized_currency !~ '^[A-Z]{3}$'
    or coalesce(plan_billing_interval, '') not in ('MONTHLY', 'YEARLY')
    or coalesce(plan_sort_order, -1) not between 0 and 1000 then
    raise exception 'INVALID_PLAN' using errcode = '22023';
  end if;
  select jsonb_build_object(
    'name', name, 'description', description, 'price', price, 'currency', currency,
    'billingInterval', billing_interval, 'isPublic', is_public, 'sortOrder', sort_order
  ) into old_values from public.plans where id = plan;
  update public.plans set
    name = trim(plan_name),
    description = trim(plan_description),
    price = rounded_price,
    currency = normalized_currency,
    billing_interval = plan_billing_interval,
    is_public = plan_is_public,
    sort_order = plan_sort_order
  where id = plan;
  select id into actor from public.users where auth_user_id = auth.uid();
  insert into public.audit_logs(actor_user_id, action, resource_type, resource_id, context)
  values(actor, 'PLAN_UPDATED', 'plans', plan, jsonb_build_object(
    'planSlug', target_plan,
    'oldValue', old_values,
    'newValue', jsonb_build_object(
      'name', trim(plan_name), 'description', trim(plan_description), 'price', rounded_price,
      'currency', normalized_currency, 'billingInterval', plan_billing_interval,
      'isPublic', plan_is_public, 'sortOrder', plan_sort_order
    )
  ));
end;
$$;
revoke all on function public.save_plan(text, text, text, numeric, text, text, boolean, integer) from public, anon;
grant execute on function public.save_plan(text, text, text, numeric, text, text, boolean, integer) to authenticated;
