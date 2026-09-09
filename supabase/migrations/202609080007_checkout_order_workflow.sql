-- Phase 5 checkout and order workflow. Browser totals remain untrusted; PostgreSQL
-- resolves the tenant, locks products, computes money, and snapshots the order.
alter table public.orders
  drop constraint if exists orders_payment_status_check;
alter table public.orders
  add constraint orders_payment_status_check check (payment_status in (
    'PENDING','AWAITING_VERIFICATION','AUTHORIZED','PAID','FAILED',
    'PARTIALLY_REFUNDED','REFUNDED','CANCELLED'
  )),
  add column payment_method text not null default 'BANK_TRANSFER'
    check (payment_method in ('BANK_TRANSFER')),
  add column delivery_method_snapshot text not null default '',
  add column delivery_instructions_snapshot text not null default '',
  add column customer_access_token uuid not null default gen_random_uuid(),
  add column inventory_restored boolean not null default false;
alter table public.order_items
  drop constraint if exists order_items_tenant_id_product_id_fkey;
alter table public.order_items
  add constraint order_items_tenant_id_product_id_fkey
  foreign key(tenant_id,product_id) references public.products(tenant_id,id)
  on delete set null (product_id);

create unique index orders_customer_access_token_idx
  on public.orders(customer_access_token);
create index customers_tenant_email_idx
  on public.customers(tenant_id,lower(email)) where email is not null and email<>'';
create index customers_tenant_phone_idx
  on public.customers(tenant_id,phone) where phone is not null and phone<>'';

create table public.tenant_bank_accounts(
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  bank_name text not null check(length(trim(bank_name)) between 2 and 100),
  account_number text not null check(account_number ~ '^[0-9]{6,20}$'),
  account_name text not null check(length(trim(account_name)) between 2 and 160),
  instructions text not null default '' check(length(instructions)<=1000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id,id)
);
create unique index tenant_bank_accounts_one_active_idx
  on public.tenant_bank_accounts(tenant_id) where is_active;
create trigger tenant_bank_accounts_updated before update on public.tenant_bank_accounts
for each row execute function private.touch_updated_at();
alter table public.tenant_bank_accounts enable row level security;
revoke all on public.tenant_bank_accounts from anon,authenticated;
grant select on public.tenant_bank_accounts to authenticated;
create policy tenant_read on public.tenant_bank_accounts for select to authenticated
using ((select private.is_super_admin()) or private.is_tenant_member(tenant_id));

create function private.can_manage_orders(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select (select private.is_super_admin()) or exists(
  select 1 from public.tenant_memberships m
  join public.users u on u.id=m.user_id
  join public.tenants t on t.id=m.tenant_id
  where m.tenant_id=target and u.auth_user_id=(select auth.uid())
   and u.status='ACTIVE' and m.status='ACTIVE'
   and m.role in ('TENANT_OWNER','TENANT_ADMIN','TENANT_MANAGER')
   and t.status in ('PROVISIONING','TRIAL','ACTIVE')
 );
$$;
revoke all on function private.can_manage_orders(uuid) from public;
grant execute on function private.can_manage_orders(uuid) to authenticated;

create function private.validated_cart(cart jsonb)
returns table(product_id uuid,quantity integer)
language plpgsql immutable set search_path='' as $$
declare item jsonb; selected_id uuid; selected_quantity integer; seen uuid[]='{}';
begin
 if jsonb_typeof(cart)<>'array' or jsonb_array_length(cart) not between 1 and 50 then
  raise exception 'INVALID_CART' using errcode='22023';
 end if;
 for item in select value from jsonb_array_elements(cart) loop
  if jsonb_typeof(item)<>'object'
    or coalesce(item->>'productId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or coalesce(item->>'quantity','') !~ '^[1-9][0-9]?$' then
   raise exception 'INVALID_CART' using errcode='22023';
  end if;
  selected_id=(item->>'productId')::uuid;
  selected_quantity=(item->>'quantity')::integer;
  if selected_id=any(seen) then raise exception 'DUPLICATE_CART_ITEM' using errcode='22023'; end if;
  seen=array_append(seen,selected_id);
  product_id=selected_id; quantity=selected_quantity;
  return next;
 end loop;
end $$;
revoke all on function private.validated_cart(jsonb) from public;

create function public.get_public_checkout_quote(store_slug text,cart_items jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid; store_name text; site jsonb; settings public.tenant_checkout_settings%rowtype; result jsonb;
begin
 select t.id,t.name into target,store_name from public.tenants t
 where t.slug=store_slug and t.status in ('TRIAL','ACTIVE');
 if target is null then return null; end if;
 select v.configuration into site from public.tenant_site_versions v
 where v.tenant_id=target and v.status='PUBLISHED' limit 1;
 if site is null then return null; end if;
 select * into settings from public.tenant_checkout_settings where tenant_id=target;
 perform 1 from private.validated_cart(cart_items);
 select jsonb_build_object(
  'tenant',jsonb_build_object('name',store_name,'slug',store_slug),
  'site',site,
  'settings',jsonb_build_object(
   'collectPhone',settings.collect_phone,'collectEmail',settings.collect_email,
   'collectDeliveryAddress',settings.collect_delivery_address,
   'orderNotesEnabled',settings.order_notes_enabled,
   'bankTransferEnabled',settings.bank_transfer_enabled,
   'successMessage',settings.success_message
  ),
  'items',coalesce(jsonb_agg(jsonb_build_object(
   'productId',cart.product_id,'quantity',cart.quantity,
   'name',case when p.status='ACTIVE' then p.name end,
   'slug',case when p.status='ACTIVE' then p.slug end,
   'unitPrice',case when p.status='ACTIVE' then p.price end,
   'currency',case when p.status='ACTIVE' then p.currency end,
   'mediaUrl',case when p.status='ACTIVE' then media.public_url_or_resolvable_key end,
   'available',coalesce(p.status='ACTIVE' and (not p.track_inventory or p.stock_quantity>=cart.quantity),false),
   'maximumQuantity',case when p.status='ACTIVE' and p.track_inventory then p.stock_quantity else 99 end
  ) order by p.name nulls last),'[]'::jsonb),
  'shippingRates',coalesce((select jsonb_agg(jsonb_build_object(
    'id',r.id,'name',r.name,'zoneName',z.name,'amount',r.amount,
    'isPickup',coalesce((r.rule_jsonb->>'pickup')::boolean,false),
    'states',coalesce(r.rule_jsonb->'states','[]'::jsonb)
   ) order by r.amount,r.name)
   from public.shipping_rates r join public.shipping_zones z
    on z.tenant_id=r.tenant_id and z.id=r.shipping_zone_id
   where r.tenant_id=target and r.status='ACTIVE' and z.status='ACTIVE'),'[]'::jsonb)
 ) into result
 from private.validated_cart(cart_items) cart
 left join public.products p on p.tenant_id=target and p.id=cart.product_id
 left join public.media_assets media on media.tenant_id=p.tenant_id and media.id=p.primary_image_asset_id;
 return result;
end $$;
revoke all on function public.get_public_checkout_quote(text,jsonb) from public;
grant execute on function public.get_public_checkout_quote(text,jsonb) to anon,authenticated;

create function public.create_storefront_order(
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
 pickup boolean=false; actor uuid;
begin
 select t.id,t.name,t.default_currency into target,store_name,currency_code
 from public.tenants t where t.slug=store_slug and t.status in ('TRIAL','ACTIVE');
 if target is null or not exists(select 1 from public.tenant_site_versions v where v.tenant_id=target and v.status='PUBLISHED') then
  raise exception 'STORE_UNAVAILABLE' using errcode='22023';
 end if;
 select * into settings from public.tenant_checkout_settings where tenant_id=target;
 if not settings.guest_checkout_enabled then raise exception 'CHECKOUT_UNAVAILABLE' using errcode='22023'; end if;
 if payment_choice<>'BANK_TRANSFER' or not settings.bank_transfer_enabled
   or not exists(select 1 from public.tenant_bank_accounts b where b.tenant_id=target and b.is_active) then
  raise exception 'PAYMENT_METHOD_UNAVAILABLE' using errcode='22023';
 end if;
 if length(customer_name) not between 1 and 160
   or length(customer_email)>254 or length(customer_phone)>40
   or (settings.collect_email and customer_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
   or (settings.collect_phone and length(customer_phone) not between 7 and 40)
   or length(coalesce(customer_note,''))>1000 then
  raise exception 'INVALID_CUSTOMER_DETAILS' using errcode='22023';
 end if;

 if selected_shipping_rate is not null then
  select r.* into selected_rate
  from public.shipping_rates r join public.shipping_zones z
   on z.tenant_id=r.tenant_id and z.id=r.shipping_zone_id
  where r.tenant_id=target and r.id=selected_shipping_rate
   and r.status='ACTIVE' and z.status='ACTIVE';
  if selected_rate.id is null then raise exception 'DELIVERY_METHOD_UNAVAILABLE' using errcode='22023'; end if;
  select z.* into selected_zone from public.shipping_zones z
  where z.tenant_id=target and z.id=selected_rate.shipping_zone_id;
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
   or length(address_line_2)>240 or length(address_postal)>30
  ) then raise exception 'INVALID_DELIVERY_ADDRESS' using errcode='22023'; end if;
 if selected_rate.id is not null and jsonb_array_length(coalesce(selected_rate.rule_jsonb->'states','[]'::jsonb))>0
   and not exists(select 1 from jsonb_array_elements_text(selected_rate.rule_jsonb->'states') state
    where lower(trim(state))=lower(address_state)) then
  raise exception 'DELIVERY_METHOD_UNAVAILABLE' using errcode='22023';
 end if;

 perform p.id from public.products p join private.validated_cart(cart_items) cart on cart.product_id=p.id
 where p.tenant_id=target for update of p;
 select count(*),sum(p.price*cart.quantity),min(p.currency) into item_count,subtotal_value,currency_code
 from private.validated_cart(cart_items) cart join public.products p
  on p.tenant_id=target and p.id=cart.product_id
 where p.status='ACTIVE';
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
  select c.id into customer from public.customers c where c.tenant_id=target and lower(c.email)=customer_email order by c.created_at limit 1 for update;
 elsif customer_phone<>'' then
  select c.id into customer from public.customers c where c.tenant_id=target and c.phone=customer_phone order by c.created_at limit 1 for update;
 end if;
 if customer is null then
  insert into public.customers(tenant_id,name,email,phone)
  values(target,customer_name,nullif(customer_email,''),nullif(customer_phone,'')) returning id into customer;
 else
  update public.customers set name=customer_name,email=nullif(customer_email,''),phone=nullif(customer_phone,'') where id=customer and tenant_id=target;
 end if;
 if settings.collect_delivery_address and not pickup then
  insert into public.customer_addresses(tenant_id,customer_id,recipient_name,phone,address_line_1,address_line_2,city,state,postal_code,country,is_default)
  values(target,customer,customer_name,customer_phone,address_line_1,address_line_2,address_city,address_state,address_postal,address_country,
   not exists(select 1 from public.customer_addresses a where a.tenant_id=target and a.customer_id=customer));
 end if;

 order_reference='BC-'||to_char(now(),'YYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
 access_token=gen_random_uuid();
 insert into public.orders(
  tenant_id,customer_id,reference,currency,subtotal,delivery_fee,total,payment_method,
  customer_name_snapshot,customer_email_snapshot,customer_phone_snapshot,shipping_address_jsonb,
  delivery_method_snapshot,delivery_instructions_snapshot,customer_note,customer_access_token
 ) values(
  target,customer,order_reference,currency_code,subtotal_value,delivery_value,subtotal_value+delivery_value,'BANK_TRANSFER',
  customer_name,customer_email,customer_phone,
  case when settings.collect_delivery_address and not pickup then jsonb_build_object(
   'recipientName',customer_name,'phone',customer_phone,'addressLine1',address_line_1,'addressLine2',address_line_2,
   'city',address_city,'state',address_state,'postalCode',address_postal,'country',address_country
  ) else '{}'::jsonb end,
  coalesce(selected_rate.name,'No delivery required'),coalesce(selected_zone.name,''),coalesce(trim(customer_note),''),access_token
 ) returning id into saved_order;
 insert into public.order_items(tenant_id,order_id,product_id,product_name_snapshot,sku_snapshot,unit_price,quantity,line_total)
 select target,saved_order,p.id,p.name,p.sku,p.price,cart.quantity,p.price*cart.quantity
 from private.validated_cart(cart_items) cart join public.products p on p.tenant_id=target and p.id=cart.product_id;
 update public.products p set stock_quantity=p.stock_quantity-cart.quantity
 from private.validated_cart(cart_items) cart
 where p.tenant_id=target and p.id=cart.product_id and p.track_inventory;
 update public.customers set total_orders_cached=total_orders_cached+1,
  total_spent_cached=total_spent_cached+subtotal_value+delivery_value,last_order_at=now()
 where id=customer and tenant_id=target;
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id)
 values(target,null,'ORDER_CREATED','orders',saved_order);
 return jsonb_build_object(
  'orderId',saved_order,'reference',order_reference,'accessToken',access_token,
  'storeName',store_name,'currency',currency_code,'subtotal',subtotal_value,
  'deliveryFee',delivery_value,'total',subtotal_value+delivery_value,
  'successMessage',settings.success_message,
  'bankAccount',(select jsonb_build_object('bankName',b.bank_name,'accountNumber',b.account_number,
    'accountName',b.account_name,'instructions',b.instructions)
   from public.tenant_bank_accounts b where b.tenant_id=target and b.is_active limit 1)
 );
end $$;
revoke all on function public.create_storefront_order(text,jsonb,jsonb,jsonb,uuid,text,text) from public;
grant execute on function public.create_storefront_order(text,jsonb,jsonb,jsonb,uuid,text,text) to anon,authenticated;

create function public.submit_bank_transfer_notice(store_slug text,order_reference text,access_token uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 update public.orders o set payment_status='AWAITING_VERIFICATION'
 from public.tenants t where o.tenant_id=t.id and t.slug=store_slug
  and o.reference=order_reference and o.customer_access_token=access_token
  and o.payment_method='BANK_TRANSFER' and o.payment_status='PENDING';
 if not found and not exists(select 1 from public.orders o join public.tenants t on t.id=o.tenant_id
   where t.slug=store_slug and o.reference=order_reference and o.customer_access_token=access_token
   and o.payment_status='AWAITING_VERIFICATION') then
  raise exception 'ORDER_NOT_FOUND' using errcode='22023';
 end if;
end $$;
revoke all on function public.submit_bank_transfer_notice(text,text,uuid) from public;
grant execute on function public.submit_bank_transfer_notice(text,text,uuid) to anon,authenticated;

create function public.save_checkout_settings(
 target_tenant uuid,phone_required boolean,email_required boolean,address_required boolean,
 notes_enabled boolean,transfer_enabled boolean,confirmation_message text
) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
 if not private.can_manage_orders(target_tenant) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if confirmation_message is null or length(trim(confirmation_message)) not between 1 and 500 then
  raise exception 'INVALID_CHECKOUT_SETTINGS' using errcode='22023';
 end if;
 if transfer_enabled and not exists(select 1 from public.tenant_bank_accounts where tenant_id=target_tenant and is_active) then
  raise exception 'BANK_ACCOUNT_REQUIRED' using errcode='22023';
 end if;
 update public.tenant_checkout_settings set collect_phone=phone_required,collect_email=email_required,
  collect_delivery_address=address_required,order_notes_enabled=notes_enabled,
  bank_transfer_enabled=transfer_enabled,success_message=trim(confirmation_message)
 where tenant_id=target_tenant;
 select id into actor from public.users where auth_user_id=auth.uid();
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id)
 values(target_tenant,actor,'CHECKOUT_SETTINGS_UPDATED','tenant_checkout_settings',target_tenant);
end $$;
revoke all on function public.save_checkout_settings(uuid,boolean,boolean,boolean,boolean,boolean,text) from public;
grant execute on function public.save_checkout_settings(uuid,boolean,boolean,boolean,boolean,boolean,text) to authenticated;

create function public.save_bank_account(
 target_tenant uuid,bank_name text,account_number text,account_name text,instructions text
) returns uuid language plpgsql security definer set search_path='' as $$
declare saved uuid; actor uuid;
begin
 if not private.can_manage_orders(target_tenant) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if length(trim(coalesce(bank_name,''))) not between 2 and 100 or coalesce(account_number,'') !~ '^[0-9]{6,20}$'
  or length(trim(coalesce(account_name,''))) not between 2 and 160 or length(coalesce(instructions,''))>1000 then
  raise exception 'INVALID_BANK_ACCOUNT' using errcode='22023';
 end if;
 update public.tenant_bank_accounts set is_active=false where tenant_id=target_tenant and is_active;
 insert into public.tenant_bank_accounts(tenant_id,bank_name,account_number,account_name,instructions)
 values(target_tenant,trim(bank_name),account_number,trim(account_name),trim(coalesce(instructions,''))) returning id into saved;
 select id into actor from public.users where auth_user_id=auth.uid();
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id)
 values(target_tenant,actor,'BANK_ACCOUNT_UPDATED','tenant_bank_accounts',saved);
 return saved;
end $$;
revoke all on function public.save_bank_account(uuid,text,text,text,text) from public;
grant execute on function public.save_bank_account(uuid,text,text,text,text) to authenticated;

create function public.save_shipping_rate(
 target_tenant uuid,target_rate uuid,zone_name text,rate_name text,rate_amount numeric,
 delivery_states text[],pickup boolean
) returns uuid language plpgsql security definer set search_path='' as $$
declare zone uuid; saved uuid; actor uuid; normalized_states text[];
begin
 if not private.can_manage_orders(target_tenant) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if length(trim(coalesce(zone_name,''))) not between 2 and 100 or length(trim(coalesce(rate_name,''))) not between 2 and 100
  or rate_amount is null or rate_amount<0 or rate_amount>999999999999.99 then
  raise exception 'INVALID_DELIVERY_METHOD' using errcode='22023';
 end if;
 select coalesce(array_agg(distinct trim(value)) filter(where trim(value)<>''),'{}') into normalized_states
 from unnest(coalesce(delivery_states,'{}')) value;
 if cardinality(normalized_states)>50 or exists(select 1 from unnest(normalized_states) value where length(value)>100) then
  raise exception 'INVALID_DELIVERY_METHOD' using errcode='22023';
 end if;
 select id into zone from public.shipping_zones where tenant_id=target_tenant and lower(name)=lower(trim(zone_name)) limit 1;
 if zone is null then insert into public.shipping_zones(tenant_id,name) values(target_tenant,trim(zone_name)) returning id into zone; end if;
 if target_rate is null then
  insert into public.shipping_rates(tenant_id,shipping_zone_id,name,amount,rule_jsonb)
  values(target_tenant,zone,trim(rate_name),rate_amount,jsonb_build_object('states',to_jsonb(normalized_states),'pickup',pickup)) returning id into saved;
 else
  update public.shipping_rates set shipping_zone_id=zone,name=trim(rate_name),amount=rate_amount,
   rule_jsonb=jsonb_build_object('states',to_jsonb(normalized_states),'pickup',pickup)
  where tenant_id=target_tenant and id=target_rate returning id into saved;
  if saved is null then raise exception 'DELIVERY_METHOD_NOT_FOUND' using errcode='22023'; end if;
 end if;
 select id into actor from public.users where auth_user_id=auth.uid();
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id)
 values(target_tenant,actor,case when target_rate is null then 'DELIVERY_METHOD_CREATED' else 'DELIVERY_METHOD_UPDATED' end,'shipping_rates',saved);
 return saved;
end $$;
revoke all on function public.save_shipping_rate(uuid,uuid,text,text,numeric,text[],boolean) from public;
grant execute on function public.save_shipping_rate(uuid,uuid,text,text,numeric,text[],boolean) to authenticated;

create function public.delete_shipping_rate(target_tenant uuid,target_rate uuid) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid; old_zone uuid;
begin
 if not private.can_manage_orders(target_tenant) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 delete from public.shipping_rates where tenant_id=target_tenant and id=target_rate returning shipping_zone_id into old_zone;
 if old_zone is null then raise exception 'DELIVERY_METHOD_NOT_FOUND' using errcode='22023'; end if;
 delete from public.shipping_zones where tenant_id=target_tenant and id=old_zone
  and not exists(select 1 from public.shipping_rates where tenant_id=target_tenant and shipping_zone_id=old_zone);
 select id into actor from public.users where auth_user_id=auth.uid();
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id)
 values(target_tenant,actor,'DELIVERY_METHOD_DELETED','shipping_rates',target_rate);
end $$;
revoke all on function public.delete_shipping_rate(uuid,uuid) from public;
grant execute on function public.delete_shipping_rate(uuid,uuid) to authenticated;

create function public.update_order_status(target_tenant uuid,target_order uuid,order_action text,note text) returns void
language plpgsql security definer set search_path='' as $$
declare saved public.orders%rowtype; actor uuid;
begin
 if not private.can_manage_orders(target_tenant) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select * into saved from public.orders where tenant_id=target_tenant and id=target_order for update;
 if saved.id is null then raise exception 'ORDER_NOT_FOUND' using errcode='22023'; end if;
 if length(coalesce(note,''))>2000 then raise exception 'INVALID_ORDER_NOTE' using errcode='22023'; end if;
 if order_action='SAVE_NOTE' then
  update public.orders set internal_note=trim(coalesce(note,'')) where id=saved.id;
 elsif order_action='CONFIRM_PAYMENT' and saved.payment_status in ('PENDING','AWAITING_VERIFICATION') then
  update public.orders set payment_status='PAID',paid_at=now(),internal_note=trim(coalesce(note,internal_note)) where id=saved.id;
 elsif order_action='CANCEL_PAYMENT' and saved.payment_status in ('PENDING','AWAITING_VERIFICATION','FAILED') then
  update public.orders set payment_status='CANCELLED',internal_note=trim(coalesce(note,internal_note)) where id=saved.id;
 elsif order_action='PROCESS' and saved.fulfillment_status='NEW' then
  update public.orders set fulfillment_status='PROCESSING' where id=saved.id;
 elsif order_action='READY' and saved.fulfillment_status='PROCESSING' then
  update public.orders set fulfillment_status='READY' where id=saved.id;
 elsif order_action='SHIP' and saved.fulfillment_status='READY' then
  update public.orders set fulfillment_status='SHIPPED' where id=saved.id;
 elsif order_action='DELIVER' and saved.fulfillment_status in ('READY','SHIPPED') then
  update public.orders set fulfillment_status='DELIVERED',fulfilled_at=now() where id=saved.id;
 elsif order_action='CANCEL' and saved.fulfillment_status not in ('DELIVERED','CANCELLED') then
  update public.products p set stock_quantity=p.stock_quantity+i.quantity
  from public.order_items i where i.tenant_id=target_tenant and i.order_id=saved.id
   and i.product_id=p.id and p.tenant_id=target_tenant and p.track_inventory and not saved.inventory_restored;
  update public.orders set fulfillment_status='CANCELLED',inventory_restored=true,
   payment_status=case when payment_status in ('PENDING','AWAITING_VERIFICATION','FAILED') then 'CANCELLED' else payment_status end
  where id=saved.id;
 else
  raise exception 'INVALID_ORDER_TRANSITION' using errcode='22023';
 end if;
 select id into actor from public.users where auth_user_id=auth.uid();
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id)
 values(target_tenant,actor,'ORDER_'||order_action,'orders',saved.id);
end $$;
revoke all on function public.update_order_status(uuid,uuid,text,text) from public;
grant execute on function public.update_order_status(uuid,uuid,text,text) to authenticated;
