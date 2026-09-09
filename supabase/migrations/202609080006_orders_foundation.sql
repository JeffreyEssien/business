-- Phase 5 foundation: tenant-isolated commerce records with immutable order snapshots.
alter table public.tenant_checkout_settings
 add column guest_checkout_enabled boolean not null default true,
 add column collect_phone boolean not null default true,
 add column collect_email boolean not null default true,
 add column collect_delivery_address boolean not null default true,
 add column order_notes_enabled boolean not null default true,
 add column bank_transfer_enabled boolean not null default true,
 add column paystack_enabled boolean not null default false,
 add column success_message text not null default 'Thank you. Your order has been received.',
 add column updated_at timestamptz not null default now();
create trigger tenant_checkout_settings_updated before update on public.tenant_checkout_settings
for each row execute function private.touch_updated_at();

create table public.customers(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id),
 name text not null check(length(trim(name)) between 1 and 160),
 email text,
 phone text,
 marketing_email_consent boolean not null default false,
 marketing_sms_consent boolean not null default false,
 total_orders_cached integer not null default 0 check(total_orders_cached>=0),
 total_spent_cached numeric(14,2) not null default 0 check(total_spent_cached>=0),
 last_order_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(tenant_id,id)
);
create table public.customer_addresses(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id),
 customer_id uuid not null,
 label text not null default 'Delivery address',
 recipient_name text not null,
 phone text not null default '',
 address_line_1 text not null,
 address_line_2 text not null default '',
 city text not null,
 state text not null,
 postal_code text not null default '',
 country text not null default 'NG',
 is_default boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(tenant_id,customer_id) references public.customers(tenant_id,id) on delete cascade
);
create table public.shipping_zones(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),
 name text not null,status text not null default 'ACTIVE' check(status in ('ACTIVE','INACTIVE')),
 created_at timestamptz not null default now(),unique(tenant_id,id),unique(tenant_id,name)
);
create table public.shipping_rates(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),
 shipping_zone_id uuid not null,name text not null,amount numeric(14,2) not null check(amount>=0),
 rule_jsonb jsonb not null default '{}'::jsonb,status text not null default 'ACTIVE' check(status in ('ACTIVE','INACTIVE')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(tenant_id,shipping_zone_id) references public.shipping_zones(tenant_id,id) on delete cascade
);
create table public.orders(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),
 customer_id uuid,reference text not null,currency text not null check(currency ~ '^[A-Z]{3}$'),
 subtotal numeric(14,2) not null check(subtotal>=0),discount_total numeric(14,2) not null default 0 check(discount_total>=0),
 delivery_fee numeric(14,2) not null default 0 check(delivery_fee>=0),tax_total numeric(14,2) not null default 0 check(tax_total>=0),
 total numeric(14,2) not null check(total>=0),
 payment_status text not null default 'PENDING' check(payment_status in ('PENDING','AUTHORIZED','PAID','FAILED','PARTIALLY_REFUNDED','REFUNDED','CANCELLED')),
 fulfillment_status text not null default 'NEW' check(fulfillment_status in ('NEW','PROCESSING','READY','SHIPPED','DELIVERED','CANCELLED')),
 customer_name_snapshot text not null,customer_email_snapshot text not null default '',customer_phone_snapshot text not null default '',
 shipping_address_jsonb jsonb not null default '{}'::jsonb,customer_note text not null default '',internal_note text not null default '',
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),paid_at timestamptz,fulfilled_at timestamptz,
 unique(tenant_id,id),unique(tenant_id,reference),
 foreign key(tenant_id,customer_id) references public.customers(tenant_id,id)
);
create table public.order_items(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),
 order_id uuid not null,product_id uuid,product_name_snapshot text not null,sku_snapshot text,
 unit_price numeric(14,2) not null check(unit_price>=0),quantity integer not null check(quantity>0),line_total numeric(14,2) not null check(line_total>=0),
 created_at timestamptz not null default now(),
 foreign key(tenant_id,order_id) references public.orders(tenant_id,id) on delete cascade,
 foreign key(tenant_id,product_id) references public.products(tenant_id,id)
);

create trigger customers_updated before update on public.customers for each row execute function private.touch_updated_at();
create trigger customer_addresses_updated before update on public.customer_addresses for each row execute function private.touch_updated_at();
create trigger shipping_rates_updated before update on public.shipping_rates for each row execute function private.touch_updated_at();
create trigger orders_updated before update on public.orders for each row execute function private.touch_updated_at();
create index customers_tenant_created_idx on public.customers(tenant_id,created_at desc,id desc);
create index orders_tenant_created_idx on public.orders(tenant_id,created_at desc,id desc);
create index orders_tenant_payment_idx on public.orders(tenant_id,payment_status,created_at desc);
create index orders_tenant_fulfillment_idx on public.orders(tenant_id,fulfillment_status,created_at desc);
create index order_items_order_idx on public.order_items(tenant_id,order_id);
create index shipping_rates_zone_idx on public.shipping_rates(tenant_id,shipping_zone_id,status);

do $$ declare table_name text; begin
 foreach table_name in array array['customers','customer_addresses','shipping_zones','shipping_rates','orders','order_items'] loop
  execute format('alter table public.%I enable row level security',table_name);
  execute format('revoke all on public.%I from anon,authenticated',table_name);
  execute format('grant select on public.%I to authenticated',table_name);
  execute format('create policy tenant_read on public.%I for select to authenticated using ((select private.is_super_admin()) or private.is_tenant_member(tenant_id))',table_name);
 end loop;
end $$;
