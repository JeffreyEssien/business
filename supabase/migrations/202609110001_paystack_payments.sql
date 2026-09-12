-- Phase 6 payment attempts remain separate from orders. Provider callbacks and
-- webhooks can only apply an exact, idempotent success through service-only RPCs.

alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
 check(payment_method in ('BANK_TRANSFER','PAYSTACK'));

create table public.tenant_payment_settings(
 tenant_id uuid primary key references public.tenants(id),
 provider text not null default 'PAYSTACK' check(provider='PAYSTACK'),
 connection_status text not null default 'NOT_CONNECTED'
  check(connection_status in ('NOT_CONNECTED','ACTIVE','ERROR')),
 subaccount_code text unique,
 settlement_bank_code text not null default '',
 settlement_bank_name text not null default '',
 settlement_account_last4 text not null default '',
 settlement_account_name text not null default '',
 platform_percentage numeric(5,2) not null default 0 check(platform_percentage between 0 and 100),
 fee_bearer text not null default 'SUBACCOUNT' check(fee_bearer in ('ACCOUNT','SUBACCOUNT')),
 connected_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(
  (connection_status='ACTIVE' and subaccount_code ~ '^ACCT_[A-Za-z0-9]+$'
   and settlement_bank_code<>'' and settlement_bank_name<>''
   and settlement_account_last4 ~ '^[0-9]{4}$' and settlement_account_name<>'')
  or connection_status<>'ACTIVE'
 )
);

insert into public.tenant_payment_settings(tenant_id)
select id from public.tenants on conflict(tenant_id) do nothing;

create function private.prepare_tenant_payment_settings() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.tenant_payment_settings(tenant_id) values(new.id) on conflict do nothing;
 return new;
end;
$$;
revoke all on function private.prepare_tenant_payment_settings() from public;
create trigger tenants_prepare_payment_settings
after insert on public.tenants for each row execute function private.prepare_tenant_payment_settings();

create table public.payments(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null,
 order_id uuid not null,
 provider text not null check(provider='PAYSTACK'),
 provider_reference text not null unique check(provider_reference ~ '^[A-Za-z0-9._=-]{6,100}$'),
 amount numeric(14,2) not null check(amount>0),
 amount_subunit bigint not null check(amount_subunit>0),
 currency text not null check(currency ~ '^[A-Z]{3}$'),
 status text not null default 'INITIALIZING'
  check(status in ('INITIALIZING','PENDING','SUCCESS','FAILED','CANCELLED')),
 access_code text,
 authorization_url text,
 provider_fee numeric(14,2),
 platform_fee numeric(14,2),
 failure_code text,
 initiated_at timestamptz not null default now(),
 paid_at timestamptz,
 failed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(tenant_id,order_id) references public.orders(tenant_id,id),
 check(access_code is null or length(access_code) between 1 and 200),
 check(authorization_url is null or authorization_url like 'https://checkout.paystack.com/%'),
 check(failure_code is null or length(failure_code)<=100)
);

create table public.payment_webhook_events(
 id uuid primary key default gen_random_uuid(),
 provider text not null check(provider='PAYSTACK'),
 event_key text not null,
 event_type text not null,
 provider_reference text not null default '',
 tenant_id uuid references public.tenants(id),
 payment_id uuid references public.payments(id),
 signature_verified boolean not null check(signature_verified),
 processing_status text not null
  check(processing_status in ('PROCESSED','IGNORED','REJECTED')),
 safe_metadata jsonb not null default '{}'::jsonb,
 error_code text,
 received_at timestamptz not null default now(),
 processed_at timestamptz not null default now(),
 unique(provider,event_key),
 check(length(event_key) between 1 and 200),
 check(length(event_type) between 1 and 100),
 check(error_code is null or length(error_code)<=100)
);

create trigger tenant_payment_settings_updated before update on public.tenant_payment_settings
for each row execute function private.touch_updated_at();
create trigger payments_updated before update on public.payments
for each row execute function private.touch_updated_at();

create index payments_tenant_order_idx on public.payments(tenant_id,order_id,created_at desc);
create index payments_pending_idx on public.payments(status,initiated_at)
 where status in ('INITIALIZING','PENDING');
create index payment_webhook_events_status_idx
 on public.payment_webhook_events(processing_status,received_at desc);

alter table public.tenant_payment_settings enable row level security;
alter table public.payments enable row level security;
alter table public.payment_webhook_events enable row level security;
revoke all on public.tenant_payment_settings,public.payments,public.payment_webhook_events
 from anon,authenticated;
grant select on public.tenant_payment_settings,public.payments to authenticated;
create policy tenant_payment_settings_read on public.tenant_payment_settings for select to authenticated
 using((select private.is_super_admin()) or private.is_tenant_member(tenant_id));
create policy payments_read on public.payments for select to authenticated
 using((select private.is_super_admin()) or private.is_tenant_member(tenant_id));
create policy payment_webhook_events_admin_read on public.payment_webhook_events for select to authenticated
 using((select private.is_super_admin()));

-- The provider response is written only by trusted server code after verifying
-- that the named actor is still allowed to manage this tenant.
create function public.record_paystack_connection(
 target_tenant uuid,actor_user uuid,provider_payload jsonb
) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid; code text=provider_payload->>'subaccountCode';
 bank_code text=provider_payload->>'bankCode'; bank_name text=trim(provider_payload->>'bankName');
 last_four text=provider_payload->>'accountLast4'; account_name text=trim(provider_payload->>'accountName');
begin
 select id into actor from public.users where id=actor_user and status='ACTIVE';
 if actor is null or not exists(select 1 from public.tenant_memberships
   where tenant_id=target_tenant and user_id=actor and status='ACTIVE'
    and role in ('TENANT_OWNER','TENANT_ADMIN','TENANT_MANAGER')) then
  raise exception 'FORBIDDEN' using errcode='42501';
 end if;
 if code !~ '^ACCT_[A-Za-z0-9]+$' or bank_code !~ '^[0-9A-Za-z_-]{2,30}$'
   or length(bank_name) not between 2 and 120 or last_four !~ '^[0-9]{4}$'
   or length(account_name) not between 2 and 160 then
  raise exception 'INVALID_PAYSTACK_ACCOUNT' using errcode='22023';
 end if;
 update public.tenant_payment_settings set connection_status='ACTIVE',subaccount_code=code,
  settlement_bank_code=bank_code,settlement_bank_name=bank_name,
  settlement_account_last4=last_four,settlement_account_name=account_name,
  connected_at=now()
 where tenant_id=target_tenant;
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id)
 values(target_tenant,actor,'PAYSTACK_SETTLEMENT_CONNECTED','tenant_payment_settings',target_tenant);
end;
$$;
revoke all on function public.record_paystack_connection(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.record_paystack_connection(uuid,uuid,jsonb) to service_role;

create function public.save_checkout_settings_complete(
 target_tenant uuid,phone_required boolean,email_required boolean,address_required boolean,
 notes_enabled boolean,transfer_enabled boolean,paystack_payment_enabled boolean,
 confirmation_message text
) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
 if not private.can_manage_orders(target_tenant) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if confirmation_message is null or length(trim(confirmation_message)) not between 1 and 500
   or (not transfer_enabled and not paystack_payment_enabled) then
  raise exception 'INVALID_CHECKOUT_SETTINGS' using errcode='22023';
 end if;
 if transfer_enabled and not exists(select 1 from public.tenant_bank_accounts
   where tenant_id=target_tenant and is_active) then
  raise exception 'BANK_ACCOUNT_REQUIRED' using errcode='22023';
 end if;
 if paystack_payment_enabled and not exists(select 1 from public.tenant_payment_settings
   where tenant_id=target_tenant and connection_status='ACTIVE') then
  raise exception 'PAYSTACK_ACCOUNT_REQUIRED' using errcode='22023';
 end if;
 update public.tenant_checkout_settings set collect_phone=phone_required,
  collect_email=email_required,collect_delivery_address=address_required,
  order_notes_enabled=notes_enabled,bank_transfer_enabled=transfer_enabled,
  paystack_enabled=paystack_payment_enabled,success_message=trim(confirmation_message)
 where tenant_id=target_tenant;
 update public.tenant_onboarding set payment_configured=transfer_enabled or paystack_payment_enabled
 where tenant_id=target_tenant;
 select id into actor from public.users where auth_user_id=auth.uid();
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id)
 values(target_tenant,actor,'CHECKOUT_SETTINGS_UPDATED','tenant_checkout_settings',target_tenant);
end;
$$;
revoke all on function public.save_checkout_settings_complete(uuid,boolean,boolean,boolean,boolean,boolean,boolean,text)
 from public,anon;
grant execute on function public.save_checkout_settings_complete(uuid,boolean,boolean,boolean,boolean,boolean,boolean,text)
 to authenticated;
revoke execute on function public.save_checkout_settings(uuid,boolean,boolean,boolean,boolean,boolean,text)
 from authenticated;

create or replace function public.get_public_checkout_quote(store_slug text,cart_items jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid; result jsonb;
begin
 select t.id into target from public.tenants t
 where t.slug=store_slug and t.status in ('TRIAL','ACTIVE');
 if target is null or not exists(select 1 from public.tenant_site_versions v
   where v.tenant_id=target and v.status='PUBLISHED') then return null; end if;
 select jsonb_build_object(
  'tenant',jsonb_build_object('name',t.name,'slug',t.slug),
  'site',(select v.configuration from public.tenant_site_versions v
   where v.tenant_id=t.id and v.status='PUBLISHED' limit 1),
  'settings',jsonb_build_object(
   'collectPhone',settings.collect_phone,'collectEmail',settings.collect_email,
   'collectDeliveryAddress',settings.collect_delivery_address,
   'orderNotesEnabled',settings.order_notes_enabled,
   'bankTransferEnabled',settings.bank_transfer_enabled and exists(
    select 1 from public.tenant_bank_accounts b where b.tenant_id=t.id and b.is_active),
   'paystackEnabled',settings.paystack_enabled and exists(
    select 1 from public.tenant_payment_settings payment_settings
    where payment_settings.tenant_id=t.id and payment_settings.connection_status='ACTIVE'),
   'successMessage',settings.success_message),
  'items',coalesce(jsonb_agg(jsonb_build_object(
    'productId',cart.product_id,'quantity',cart.quantity,
    'name',case when p.status='ACTIVE' then p.name end,
    'slug',case when p.status='ACTIVE' then p.slug end,
    'unitPrice',case when p.status='ACTIVE' then p.price end,
    'currency',case when p.status='ACTIVE' then p.currency end,
    'mediaUrl',case when p.status='ACTIVE' then media.public_url_or_resolvable_key end,
    'available',coalesce(p.status='ACTIVE' and
      (not p.track_inventory or p.stock_quantity>=cart.quantity),false),
    'maximumQuantity',case when p.status='ACTIVE' and p.track_inventory
     then least(p.stock_quantity,99) else 99 end
   ) order by p.name nulls last),'[]'::jsonb),
  'shippingRates',(select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'name',r.name,'zoneName',z.name,'amount',r.amount,
    'isPickup',coalesce((r.rule_jsonb->>'pickup')::boolean,false),
    'states',coalesce(r.rule_jsonb->'states','[]'::jsonb)) order by r.amount,r.id),'[]'::jsonb)
   from public.shipping_rates r join public.shipping_zones z
    on z.tenant_id=r.tenant_id and z.id=r.shipping_zone_id
   where r.tenant_id=target and r.status='ACTIVE' and z.status='ACTIVE')
 ) into result
 from private.validated_cart(cart_items) cart
 join public.tenants t on t.id=target
 join public.tenant_checkout_settings settings on settings.tenant_id=t.id
 left join public.products p on p.tenant_id=target and p.id=cart.product_id
 left join public.media_assets media on media.tenant_id=p.tenant_id and media.id=p.primary_image_asset_id
 group by t.id,t.name,t.slug,settings.tenant_id;
 return result;
end;
$$;

create or replace function public.create_storefront_order(
 store_slug text,cart_items jsonb,customer_details jsonb,shipping_address jsonb,
 selected_shipping_rate uuid,payment_choice text,customer_note text
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 target uuid; store_name text; currency_code text; settings public.tenant_checkout_settings%rowtype;
 selected_rate public.shipping_rates%rowtype; selected_zone public.shipping_zones%rowtype;
 customer uuid; saved_order uuid; order_reference text; access_token uuid;
 customer_name text=trim(coalesce(customer_details->>'name',''));
 customer_email text=lower(trim(coalesce(customer_details->>'email','')));
 customer_phone text=trim(coalesce(customer_details->>'phone',''));
 address_line_1 text=trim(coalesce(shipping_address->>'addressLine1',''));
 address_line_2 text=trim(coalesce(shipping_address->>'addressLine2',''));
 address_city text=trim(coalesce(shipping_address->>'city',''));
 address_state text=trim(coalesce(shipping_address->>'state',''));
 address_postal text=trim(coalesce(shipping_address->>'postalCode',''));
 address_country text=upper(trim(coalesce(shipping_address->>'country','NG')));
 subtotal_value numeric(14,2); delivery_value numeric(14,2)=0; item_count integer;
 pickup boolean=false; payment_reference text; chosen_method text=upper(coalesce(payment_choice,''));
begin
 select t.id,t.name,t.default_currency into target,store_name,currency_code
 from public.tenants t where t.slug=store_slug and t.status in ('TRIAL','ACTIVE');
 if target is null or not exists(select 1 from public.tenant_site_versions v
   where v.tenant_id=target and v.status='PUBLISHED') then
  raise exception 'STORE_UNAVAILABLE' using errcode='22023';
 end if;
 select * into settings from public.tenant_checkout_settings where tenant_id=target;
 if not settings.guest_checkout_enabled then raise exception 'CHECKOUT_UNAVAILABLE' using errcode='22023'; end if;
 if chosen_method='BANK_TRANSFER' and (not settings.bank_transfer_enabled or not exists(
   select 1 from public.tenant_bank_accounts b where b.tenant_id=target and b.is_active)) then
  raise exception 'PAYMENT_METHOD_UNAVAILABLE' using errcode='22023';
 elsif chosen_method='PAYSTACK' and (not settings.paystack_enabled or not exists(
   select 1 from public.tenant_payment_settings p where p.tenant_id=target and p.connection_status='ACTIVE')) then
  raise exception 'PAYMENT_METHOD_UNAVAILABLE' using errcode='22023';
 elsif chosen_method not in ('BANK_TRANSFER','PAYSTACK') then
  raise exception 'PAYMENT_METHOD_UNAVAILABLE' using errcode='22023';
 end if;
 if length(customer_name) not between 1 and 160 or length(customer_email)>254
   or length(customer_phone)>40
   or ((settings.collect_email or chosen_method='PAYSTACK') and
    customer_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
   or (settings.collect_phone and length(customer_phone) not between 7 and 40)
   or length(coalesce(customer_note,''))>1000 then
  raise exception 'INVALID_CUSTOMER_DETAILS' using errcode='22023';
 end if;
 if selected_shipping_rate is not null then
  select r.* into selected_rate from public.shipping_rates r join public.shipping_zones z
   on z.tenant_id=r.tenant_id and z.id=r.shipping_zone_id
  where r.tenant_id=target and r.id=selected_shipping_rate
   and r.status='ACTIVE' and z.status='ACTIVE';
  if selected_rate.id is null then raise exception 'DELIVERY_METHOD_UNAVAILABLE' using errcode='22023'; end if;
  select * into selected_zone from public.shipping_zones
   where tenant_id=target and id=selected_rate.shipping_zone_id;
  pickup=coalesce((selected_rate.rule_jsonb->>'pickup')::boolean,false);
  delivery_value=selected_rate.amount;
 elsif exists(select 1 from public.shipping_rates r join public.shipping_zones z
   on z.tenant_id=r.tenant_id and z.id=r.shipping_zone_id
   where r.tenant_id=target and r.status='ACTIVE' and z.status='ACTIVE') then
  raise exception 'DELIVERY_METHOD_REQUIRED' using errcode='22023';
 end if;
 if settings.collect_delivery_address and not pickup and (
   length(address_line_1) not between 3 and 240 or length(address_city) not between 2 and 100
   or length(address_state) not between 2 and 100 or address_country !~ '^[A-Z]{2}$'
   or length(address_line_2)>240 or length(address_postal)>30) then
  raise exception 'INVALID_DELIVERY_ADDRESS' using errcode='22023';
 end if;
 if selected_rate.id is not null and jsonb_array_length(coalesce(selected_rate.rule_jsonb->'states','[]'::jsonb))>0
   and not exists(select 1 from jsonb_array_elements_text(selected_rate.rule_jsonb->'states') state
    where lower(trim(state))=lower(address_state)) then
  raise exception 'DELIVERY_METHOD_UNAVAILABLE' using errcode='22023';
 end if;
 perform p.id from public.products p join private.validated_cart(cart_items) cart
  on cart.product_id=p.id where p.tenant_id=target for update of p;
 select count(*),sum(p.price*cart.quantity),min(p.currency)
 into item_count,subtotal_value,currency_code
 from private.validated_cart(cart_items) cart join public.products p
  on p.tenant_id=target and p.id=cart.product_id where p.status='ACTIVE';
 if item_count<>jsonb_array_length(cart_items) then raise exception 'PRODUCT_UNAVAILABLE' using errcode='22023'; end if;
 if exists(select 1 from private.validated_cart(cart_items) cart join public.products p
   on p.tenant_id=target and p.id=cart.product_id
   where p.track_inventory and p.stock_quantity<cart.quantity) then
  raise exception 'PRODUCT_OUT_OF_STOCK' using errcode='22023';
 end if;
 if exists(select 1 from private.validated_cart(cart_items) cart join public.products p
   on p.tenant_id=target and p.id=cart.product_id where p.currency<>currency_code) then
  raise exception 'MIXED_CURRENCY_CART' using errcode='22023';
 end if;
 if customer_email<>'' then
  select id into customer from public.customers where tenant_id=target
   and lower(email)=customer_email order by created_at limit 1 for update;
 elsif customer_phone<>'' then
  select id into customer from public.customers where tenant_id=target
   and phone=customer_phone order by created_at limit 1 for update;
 end if;
 if customer is null then
  insert into public.customers(tenant_id,name,email,phone)
  values(target,customer_name,nullif(customer_email,''),nullif(customer_phone,'')) returning id into customer;
 else
  update public.customers set name=customer_name,email=nullif(customer_email,''),phone=nullif(customer_phone,'')
  where id=customer and tenant_id=target;
 end if;
 if settings.collect_delivery_address and not pickup then
  insert into public.customer_addresses(tenant_id,customer_id,recipient_name,phone,address_line_1,
   address_line_2,city,state,postal_code,country,is_default)
  values(target,customer,customer_name,customer_phone,address_line_1,address_line_2,address_city,
   address_state,address_postal,address_country,not exists(select 1 from public.customer_addresses
    where tenant_id=target and customer_id=customer));
 end if;
 order_reference='BC-'||to_char(now(),'YYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
 access_token=gen_random_uuid();
 insert into public.orders(tenant_id,customer_id,reference,currency,subtotal,delivery_fee,total,
  payment_method,customer_name_snapshot,customer_email_snapshot,customer_phone_snapshot,
  shipping_address_jsonb,delivery_method_snapshot,delivery_instructions_snapshot,customer_note,
  customer_access_token)
 values(target,customer,order_reference,currency_code,subtotal_value,delivery_value,
  subtotal_value+delivery_value,chosen_method,customer_name,customer_email,customer_phone,
  case when settings.collect_delivery_address and not pickup then jsonb_build_object(
   'recipientName',customer_name,'phone',customer_phone,'addressLine1',address_line_1,
   'addressLine2',address_line_2,'city',address_city,'state',address_state,
   'postalCode',address_postal,'country',address_country) else '{}'::jsonb end,
  coalesce(selected_rate.name,'No delivery required'),coalesce(selected_zone.name,''),
  coalesce(trim(customer_note),''),access_token) returning id into saved_order;
 insert into public.order_items(tenant_id,order_id,product_id,product_name_snapshot,sku_snapshot,
  unit_price,quantity,line_total)
 select target,saved_order,p.id,p.name,p.sku,p.price,cart.quantity,p.price*cart.quantity
 from private.validated_cart(cart_items) cart join public.products p
  on p.tenant_id=target and p.id=cart.product_id;
 update public.products p set stock_quantity=p.stock_quantity-cart.quantity
 from private.validated_cart(cart_items) cart
 where p.tenant_id=target and p.id=cart.product_id and p.track_inventory;
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id)
 values(target,null,'ORDER_CREATED','orders',saved_order);
 if chosen_method='PAYSTACK' then
  payment_reference='BCPAY-'||replace(gen_random_uuid()::text,'-','');
  insert into public.payments(tenant_id,order_id,provider,provider_reference,amount,amount_subunit,currency)
  values(target,saved_order,'PAYSTACK',payment_reference,subtotal_value+delivery_value,
   round((subtotal_value+delivery_value)*100)::bigint,currency_code);
 end if;
 return jsonb_build_object(
  'orderId',saved_order,'reference',order_reference,'accessToken',access_token,
  'storeName',store_name,'currency',currency_code,'subtotal',subtotal_value,
  'deliveryFee',delivery_value,'total',subtotal_value+delivery_value,
  'successMessage',settings.success_message,'paymentMethod',chosen_method,
  'paymentReference',payment_reference,
  'bankAccount',case when chosen_method='BANK_TRANSFER' then (select jsonb_build_object(
    'bankName',b.bank_name,'accountNumber',b.account_number,'accountName',b.account_name,
    'instructions',b.instructions) from public.tenant_bank_accounts b
   where b.tenant_id=target and b.is_active limit 1) else null end);
end;
$$;

create function public.get_paystack_initialization_context(provider_reference text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 select jsonb_build_object('paymentId',payment.id,'tenantId',payment.tenant_id,
  'orderId',orders.id,'orderReference',orders.reference,
  'accessToken',orders.customer_access_token,'storeSlug',tenants.slug,'customerEmail',orders.customer_email_snapshot,
  'amountSubunit',payment.amount_subunit,'currency',payment.currency,
  'subaccountCode',settings.subaccount_code,'platformPercentage',settings.platform_percentage,
  'feeBearer',settings.fee_bearer,'status',payment.status)
 into result from public.payments payment
 join public.orders orders on orders.tenant_id=payment.tenant_id and orders.id=payment.order_id
 join public.tenants tenants on tenants.id=payment.tenant_id
 join public.tenant_payment_settings settings on settings.tenant_id=payment.tenant_id
 where payment.provider='PAYSTACK' and payment.provider_reference=get_paystack_initialization_context.provider_reference;
 return result;
end;
$$;
revoke all on function public.get_paystack_initialization_context(text) from public,anon,authenticated;
grant execute on function public.get_paystack_initialization_context(text) to service_role;

create function public.record_paystack_initialization(
 provider_reference text,succeeded boolean,provider_access_code text,
 provider_authorization_url text,failure text
) returns void language plpgsql security definer set search_path='' as $$
begin
 if succeeded and (length(coalesce(provider_access_code,'')) not between 1 and 200
   or provider_authorization_url not like 'https://checkout.paystack.com/%') then
  raise exception 'INVALID_PROVIDER_RESPONSE' using errcode='22023';
 end if;
 update public.payments set status=case when succeeded then 'PENDING' else 'FAILED' end,
  access_code=case when succeeded then provider_access_code else null end,
  authorization_url=case when succeeded then provider_authorization_url else null end,
  failure_code=case when succeeded then null else left(coalesce(failure,'PROVIDER_ERROR'),100) end,
  failed_at=case when succeeded then null else now() end
 where provider='PAYSTACK' and payments.provider_reference=record_paystack_initialization.provider_reference
  and status='INITIALIZING';
 if not found then raise exception 'PAYMENT_UNAVAILABLE' using errcode='22023'; end if;
 if not succeeded then
  update public.orders set payment_status='FAILED' where id=(select order_id from public.payments
   where payments.provider_reference=record_paystack_initialization.provider_reference)
   and payment_status='PENDING';
 end if;
end;
$$;
revoke all on function public.record_paystack_initialization(text,boolean,text,text,text)
 from public,anon,authenticated;
grant execute on function public.record_paystack_initialization(text,boolean,text,text,text) to service_role;

create function private.apply_paystack_success(
 provider_reference text,paid_amount_subunit bigint,paid_currency text,
 fee_subunit bigint,paid_timestamp timestamptz
) returns text language plpgsql security definer set search_path='' as $$
declare payment public.payments%rowtype; order_row public.orders%rowtype;
begin
 select * into payment from public.payments where provider='PAYSTACK'
  and payments.provider_reference=apply_paystack_success.provider_reference for update;
 if payment.id is null then return 'PAYMENT_NOT_FOUND'; end if;
 select * into order_row from public.orders where tenant_id=payment.tenant_id
  and id=payment.order_id for update;
 if payment.amount_subunit<>paid_amount_subunit then return 'AMOUNT_MISMATCH'; end if;
 if payment.currency<>upper(coalesce(paid_currency,'')) then return 'CURRENCY_MISMATCH'; end if;
 if order_row.payment_method<>'PAYSTACK' then return 'PAYMENT_METHOD_MISMATCH'; end if;
 if payment.status='SUCCESS' and order_row.payment_status='PAID' then return 'ALREADY_PROCESSED'; end if;
 if order_row.payment_status='PAID' then return 'ORDER_ALREADY_PAID'; end if;
 if payment.status='CANCELLED' or order_row.payment_status='CANCELLED' then return 'PAYMENT_CANCELLED'; end if;
 update public.payments set status='SUCCESS',provider_fee=case when fee_subunit is null then null
   else fee_subunit::numeric/100 end,paid_at=coalesce(paid_timestamp,now()),failure_code=null
 where id=payment.id;
 update public.payments set status='CANCELLED'
 where order_id=order_row.id and tenant_id=order_row.tenant_id and id<>payment.id
  and status in ('INITIALIZING','PENDING','FAILED');
 update public.orders set payment_status='PAID',paid_at=coalesce(paid_timestamp,now())
 where id=order_row.id and payment_status<>'PAID';
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id)
 select payment.tenant_id,null,'PAYSTACK_PAYMENT_CONFIRMED','payments',payment.id
 where not exists(select 1 from public.audit_logs where tenant_id=payment.tenant_id
  and action='PAYSTACK_PAYMENT_CONFIRMED' and resource_type='payments' and resource_id=payment.id);
 return 'PROCESSED';
end;
$$;
revoke all on function private.apply_paystack_success(text,bigint,text,bigint,timestamptz) from public;

create function public.confirm_paystack_payment(
 provider_reference text,paid_amount_subunit bigint,paid_currency text,
 provider_status text,fee_subunit bigint,paid_timestamp timestamptz
) returns text language plpgsql security definer set search_path='' as $$
begin
 if lower(coalesce(provider_status,''))<>'success' then return 'NOT_SUCCESSFUL'; end if;
 return private.apply_paystack_success(provider_reference,paid_amount_subunit,
  paid_currency,fee_subunit,paid_timestamp);
end;
$$;
revoke all on function public.confirm_paystack_payment(text,bigint,text,text,bigint,timestamptz)
 from public,anon,authenticated;
grant execute on function public.confirm_paystack_payment(text,bigint,text,text,bigint,timestamptz)
 to service_role;

create function public.process_paystack_webhook(
 p_event_key text,p_event_type text,p_provider_reference text,p_paid_amount_subunit bigint,
 p_paid_currency text,p_provider_status text,p_fee_subunit bigint,p_paid_timestamp timestamptz,
 p_safe_metadata jsonb
) returns text language plpgsql security definer set search_path='' as $$
declare result text; payment_id uuid; target uuid;
begin
 if length(coalesce(p_event_key,'')) not between 1 and 200
   or length(coalesce(p_event_type,'')) not between 1 and 100
   or length(coalesce(p_provider_reference,''))>100
   or jsonb_typeof(coalesce(p_safe_metadata,'{}'::jsonb))<>'object'
   or octet_length(coalesce(p_safe_metadata,'{}'::jsonb)::text)>4096 then
  raise exception 'INVALID_WEBHOOK_EVENT' using errcode='22023';
 end if;
 select id,tenant_id into payment_id,target from public.payments
  where provider='PAYSTACK' and payments.provider_reference=p_provider_reference;
 if p_event_type='charge.success' and lower(coalesce(p_provider_status,''))='success' then
  result=private.apply_paystack_success(p_provider_reference,p_paid_amount_subunit,
   p_paid_currency,p_fee_subunit,p_paid_timestamp);
 else result='EVENT_IGNORED'; end if;
 insert into public.payment_webhook_events(provider,event_key,event_type,provider_reference,
  tenant_id,payment_id,signature_verified,processing_status,safe_metadata,error_code)
 values('PAYSTACK',p_event_key,p_event_type,coalesce(p_provider_reference,''),target,payment_id,true,
  case when result in ('PROCESSED','ALREADY_PROCESSED') then 'PROCESSED'
   when result='EVENT_IGNORED' then 'IGNORED' else 'REJECTED' end,
  coalesce(p_safe_metadata,'{}'::jsonb),case when result in ('PROCESSED','ALREADY_PROCESSED','EVENT_IGNORED')
   then null else result end)
 on conflict(provider,event_key) do nothing;
 if not found then return 'ALREADY_RECEIVED'; end if;
 return result;
end;
$$;
revoke all on function public.process_paystack_webhook(text,text,text,bigint,text,text,bigint,timestamptz,jsonb)
 from public,anon,authenticated;
grant execute on function public.process_paystack_webhook(text,text,text,bigint,text,text,bigint,timestamptz,jsonb)
 to service_role;

create function public.prepare_paystack_retry(
 store_slug text,order_reference text,access_token uuid
) returns text language plpgsql security definer set search_path='' as $$
declare target uuid; saved_order public.orders%rowtype; payment_reference text;
begin
 select t.id into target from public.tenants t where t.slug=store_slug and t.status in ('TRIAL','ACTIVE');
 select * into saved_order from public.orders where tenant_id=target and reference=order_reference
  and customer_access_token=access_token and payment_method='PAYSTACK' for update;
 if saved_order.id is null or saved_order.payment_status in ('PAID','CANCELLED') then
  raise exception 'ORDER_NOT_FOUND' using errcode='22023';
 end if;
 if (select count(*) from public.payments where tenant_id=target and order_id=saved_order.id)>=5
   or exists(select 1 from public.payments where tenant_id=target and order_id=saved_order.id
    and created_at>now()-interval '15 seconds') then
  raise exception 'PAYMENT_RETRY_UNAVAILABLE' using errcode='22023';
 end if;
 payment_reference='BCPAY-'||replace(gen_random_uuid()::text,'-','');
 insert into public.payments(tenant_id,order_id,provider,provider_reference,amount,amount_subunit,currency)
 values(target,saved_order.id,'PAYSTACK',payment_reference,saved_order.total,
  round(saved_order.total*100)::bigint,saved_order.currency);
 update public.orders set payment_status='PENDING' where id=saved_order.id;
 return payment_reference;
end;
$$;
revoke all on function public.prepare_paystack_retry(text,text,uuid) from public;
grant execute on function public.prepare_paystack_retry(text,text,uuid) to anon,authenticated;

create function public.get_public_paystack_order(
 store_slug text,order_reference text,access_token uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 select jsonb_build_object('reference',orders.reference,'storeName',tenants.name,
  'currency',orders.currency,'total',orders.total,'paymentStatus',orders.payment_status,
  'fulfillmentStatus',orders.fulfillment_status,'successMessage',settings.success_message)
 into result from public.orders orders join public.tenants tenants on tenants.id=orders.tenant_id
 join public.tenant_checkout_settings settings on settings.tenant_id=orders.tenant_id
 where tenants.slug=store_slug and tenants.status in ('TRIAL','ACTIVE')
  and orders.reference=order_reference and orders.customer_access_token=access_token
  and orders.payment_method='PAYSTACK';
 return result;
end;
$$;
revoke all on function public.get_public_paystack_order(text,text,uuid) from public;
grant execute on function public.get_public_paystack_order(text,text,uuid) to anon,authenticated;

-- Manual payment confirmation is bank-transfer-only. Paystack orders can become
-- paid exclusively through the service-only verified provider functions above.
create or replace function public.update_order_status(
 target_tenant uuid,target_order uuid,order_action text,note text
) returns void language plpgsql security definer set search_path='' as $$
declare saved public.orders%rowtype; actor uuid;
begin
 if not private.can_manage_orders(target_tenant) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select * into saved from public.orders where tenant_id=target_tenant and id=target_order for update;
 if saved.id is null then raise exception 'ORDER_NOT_FOUND' using errcode='22023'; end if;
 if length(coalesce(note,''))>2000 then raise exception 'INVALID_ORDER_NOTE' using errcode='22023'; end if;
 if order_action='SAVE_NOTE' then
  update public.orders set internal_note=trim(coalesce(note,'')) where id=saved.id;
 elsif order_action='CONFIRM_PAYMENT' and saved.payment_method='BANK_TRANSFER'
   and saved.payment_status in ('PENDING','AWAITING_VERIFICATION') then
  update public.orders set payment_status='PAID',paid_at=now(),
   internal_note=trim(coalesce(note,internal_note)) where id=saved.id;
 elsif order_action='CANCEL_PAYMENT' and saved.payment_method='BANK_TRANSFER'
   and saved.payment_status in ('PENDING','AWAITING_VERIFICATION','FAILED') then
  update public.orders set payment_status='CANCELLED',
   internal_note=trim(coalesce(note,internal_note)) where id=saved.id;
 elsif order_action='PROCESS' and saved.fulfillment_status='NEW' then
  update public.orders set fulfillment_status='PROCESSING' where id=saved.id;
 elsif order_action='READY' and saved.fulfillment_status='PROCESSING' then
  update public.orders set fulfillment_status='READY' where id=saved.id;
 elsif order_action='SHIP' and saved.fulfillment_status='READY' then
  update public.orders set fulfillment_status='SHIPPED' where id=saved.id;
 elsif order_action='DELIVER' and saved.fulfillment_status in ('READY','SHIPPED') then
  update public.orders set fulfillment_status='DELIVERED',fulfilled_at=now() where id=saved.id;
 elsif order_action='CANCEL' and saved.fulfillment_status not in ('DELIVERED','CANCELLED') then
  update public.products products set stock_quantity=products.stock_quantity+items.quantity
  from public.order_items items where items.tenant_id=target_tenant and items.order_id=saved.id
   and items.product_id=products.id and products.tenant_id=target_tenant
   and products.track_inventory and not saved.inventory_restored;
  update public.orders set fulfillment_status='CANCELLED',inventory_restored=true,
   payment_status=case when payment_status in ('PENDING','AWAITING_VERIFICATION','FAILED')
    then 'CANCELLED' else payment_status end where id=saved.id;
  update public.payments set status='CANCELLED' where tenant_id=target_tenant
   and order_id=saved.id and status in ('INITIALIZING','PENDING','FAILED');
 else raise exception 'INVALID_ORDER_TRANSITION' using errcode='22023';
 end if;
 select id into actor from public.users where auth_user_id=auth.uid();
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id)
 values(target_tenant,actor,'ORDER_'||order_action,'orders',saved.id);
end;
$$;
