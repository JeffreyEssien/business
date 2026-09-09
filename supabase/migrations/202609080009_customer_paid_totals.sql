-- Keep customer commerce summaries derived from authoritative order state.
-- The trigger is deferred so it runs after multi-statement checkout/status RPCs finish.

create or replace function private.refresh_customer_order_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_customer uuid;
begin
  for target_customer in
    select distinct customer_id
    from (
      values
        (case when tg_op <> 'DELETE' then new.customer_id end),
        (case when tg_op <> 'INSERT' then old.customer_id end)
    ) changed(customer_id)
    where customer_id is not null
  loop
    update public.customers customer
    set
      total_orders_cached = summary.total_orders,
      total_spent_cached = summary.total_spent,
      last_order_at = summary.last_order_at,
      updated_at = now()
    from (
      select
        count(*)::integer as total_orders,
        coalesce(sum(total) filter (where payment_status = 'PAID'), 0) as total_spent,
        max(created_at) as last_order_at
      from public.orders
      where customer_id = target_customer
    ) summary
    where customer.id = target_customer;
  end loop;

  return null;
end;
$$;

drop trigger if exists customer_order_totals_refresh on public.orders;
create constraint trigger customer_order_totals_refresh
after insert or delete or update of customer_id, payment_status, total on public.orders
deferrable initially deferred
for each row
execute function private.refresh_customer_order_totals();

-- Correct any summaries created before this invariant was introduced.
update public.customers customer
set
  total_orders_cached = summary.total_orders,
  total_spent_cached = summary.total_spent,
  last_order_at = summary.last_order_at,
  updated_at = now()
from (
  select
    customer.id,
    count(orders.id)::integer as total_orders,
    coalesce(sum(orders.total) filter (where orders.payment_status = 'PAID'), 0) as total_spent,
    max(orders.created_at) as last_order_at
  from public.customers customer
  left join public.orders orders on orders.customer_id = customer.id
  group by customer.id
) summary
where customer.id = summary.id;

comment on function private.refresh_customer_order_totals() is
  'Derives customer order count and verified paid spend from authoritative orders at transaction completion.';
