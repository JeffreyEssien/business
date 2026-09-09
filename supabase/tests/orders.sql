create temporary table order_fixture(k text primary key,id uuid not null,email text,value jsonb);
grant all on order_fixture to authenticated,anon;
insert into order_fixture(k,id,email) select k,gen_random_uuid(),gen_random_uuid()::text||'@example.invalid'
from unnest(array['admin','owner-a','owner-b']) k;
insert into auth.users(id,email,email_confirmed_at) select id,email,now() from order_fixture;
update public.users set platform_role='SUPER_ADMIN' where auth_user_id=(select id from order_fixture where k='admin');
select set_config('request.jwt.claim.sub',(select id::text from order_fixture where k='admin'),true);
set local role authenticated;
insert into order_fixture(k,id) select 'tenant-a',public.provision_tenant('Orders A','orders-a-'||substr(gen_random_uuid()::text,1,8),'Owner A',(select email from order_fixture where k='owner-a'),'general','starter','bank_transfer');
insert into order_fixture(k,id) select 'tenant-b',public.provision_tenant('Orders B','orders-b-'||substr(gen_random_uuid()::text,1,8),'Owner B',(select email from order_fixture where k='owner-b'),'general','starter','bank_transfer');
insert into order_fixture(k,id) select 'invite-a',id from public.tenant_invitations where tenant_id=(select id from order_fixture where k='tenant-a');
insert into order_fixture(k,id) select 'invite-b',id from public.tenant_invitations where tenant_id=(select id from order_fixture where k='tenant-b');
reset role;

select set_config('request.jwt.claim.sub',(select id::text from order_fixture where k='owner-a'),true);
set local role authenticated;
select public.accept_tenant_invitation((select id from order_fixture where k='invite-a'));
reset role;
select set_config('request.jwt.claim.sub',(select id::text from order_fixture where k='owner-b'),true);
set local role authenticated;
select public.accept_tenant_invitation((select id from order_fixture where k='invite-b'));
reset role;

insert into order_fixture(k,id) values('customer-a',gen_random_uuid()),('customer-b',gen_random_uuid()),('order-a',gen_random_uuid());
insert into public.customers(id,tenant_id,name,email) values
((select id from order_fixture where k='customer-a'),(select id from order_fixture where k='tenant-a'),'Customer A','a@example.invalid'),
((select id from order_fixture where k='customer-b'),(select id from order_fixture where k='tenant-b'),'Customer B','b@example.invalid');
insert into public.orders(id,tenant_id,customer_id,reference,currency,subtotal,total,customer_name_snapshot,customer_email_snapshot,shipping_address_jsonb)
values((select id from order_fixture where k='order-a'),(select id from order_fixture where k='tenant-a'),(select id from order_fixture where k='customer-a'),'BC-TEST-A','NGN',2500,2500,'Customer A','a@example.invalid','{"city":"Lagos"}'::jsonb);
insert into public.order_items(tenant_id,order_id,product_name_snapshot,unit_price,quantity,line_total)
values((select id from order_fixture where k='tenant-a'),(select id from order_fixture where k='order-a'),'Snapshot product',2500,1,2500);

-- Configure a real published checkout as the platform administrator.
select set_config('request.jwt.claim.sub',(select id::text from order_fixture where k='admin'),true);
set local role authenticated;
select public.save_bank_account((select id from order_fixture where k='tenant-a'),'Test Bank','0123456789','Orders A','Include the order reference.');
insert into order_fixture(k,id) select 'rate-a',public.save_shipping_rate(
 (select id from order_fixture where k='tenant-a'),null,'Lagos','Lagos delivery',1000,array['Lagos'],false
);
select public.save_checkout_settings((select id from order_fixture where k='tenant-a'),true,true,true,true,true,'Order received safely.');
select public.publish_site((select id from order_fixture where k='tenant-a'));
reset role;
insert into order_fixture(k,id) values('product-a',gen_random_uuid());
update order_fixture set value=jsonb_build_object('slug',(select slug from public.tenants where id=order_fixture.id))
where k in ('tenant-a','tenant-b');
insert into public.products(id,tenant_id,name,slug,sku,price,currency,stock_quantity,track_inventory,status,published_at)
values((select id from order_fixture where k='product-a'),(select id from order_fixture where k='tenant-a'),'Locked price product','locked-price-product','LOCK-1',2500,'NGN',3,true,'ACTIVE',now());

set local role anon;
do $$ declare quote jsonb; begin
 quote=public.get_public_checkout_quote(
  (select value->>'slug' from order_fixture where k='tenant-a'),
  jsonb_build_array(jsonb_build_object('productId',(select id from order_fixture where k='product-a'),'quantity',2))
 );
 if quote#>>'{items,0,unitPrice}'<>'2500.00' or quote#>>'{shippingRates,0,name}'<>'Lagos delivery' then
  raise exception 'Public checkout quote is incorrect';
 end if;
end $$;
insert into order_fixture(k,id,value)
select 'checkout-a',(result->>'orderId')::uuid,result from (
 select public.create_storefront_order(
  (select value->>'slug' from order_fixture where k='tenant-a'),
  jsonb_build_array(jsonb_build_object('productId',(select id from order_fixture where k='product-a'),'quantity',2)),
  '{"name":"Checkout Customer","email":"checkout@example.invalid","phone":"08012345678"}'::jsonb,
  '{"addressLine1":"1 Test Street","city":"Ikeja","state":"Lagos","country":"NG"}'::jsonb,
  (select id from order_fixture where k='rate-a'),'BANK_TRANSFER','Call on arrival.'
 ) result
) created;
select public.submit_bank_transfer_notice(
 (select value->>'slug' from order_fixture where k='tenant-a'),
 (select value->>'reference' from order_fixture where k='checkout-a'),
 (select (value->>'accessToken')::uuid from order_fixture where k='checkout-a')
);
reset role;
do $$ begin
 if (select payment_status from public.orders where id=(select id from order_fixture where k='checkout-a'))<>'AWAITING_VERIFICATION' then
  raise exception 'Customer payment notice incorrectly confirmed or was not recorded';
 end if;
 if (select stock_quantity from public.products where id=(select id from order_fixture where k='product-a'))<>1 then
  raise exception 'Checkout did not decrement inventory';
 end if;
 if (select unit_price from public.order_items where order_id=(select id from order_fixture where k='checkout-a'))<>2500 then
  raise exception 'Checkout did not snapshot the authoritative price';
 end if;
end $$;
set local role anon;
do $$ begin
 begin
  perform public.create_storefront_order(
   (select value->>'slug' from order_fixture where k='tenant-a'),
   jsonb_build_array(jsonb_build_object('productId',(select id from order_fixture where k='product-a'),'quantity',2)),
   '{"name":"Second Customer","email":"second@example.invalid","phone":"08012345679"}'::jsonb,
   '{"addressLine1":"2 Test Street","city":"Ikeja","state":"Lagos","country":"NG"}'::jsonb,
   (select id from order_fixture where k='rate-a'),'BANK_TRANSFER',''
  );
  raise exception 'Out-of-stock checkout succeeded';
 exception when sqlstate '22023' then
  if sqlerrm not like '%PRODUCT_OUT_OF_STOCK%' then raise; end if;
 end;
end $$;
reset role;

-- Current catalog edits never change historical order values.
update public.products set price=9000 where id=(select id from order_fixture where k='product-a');
do $$ begin
 if (select unit_price from public.order_items where order_id=(select id from order_fixture where k='checkout-a'))<>2500 then
  raise exception 'Historical order price changed with catalog price';
 end if;
end $$;

select set_config('request.jwt.claim.sub',(select id::text from order_fixture where k='owner-a'),true);
set local role authenticated;
select public.accept_tenant_invitation((select id from order_fixture where k='invite-a'));
do $$ begin
 if (select count(*) from public.orders where tenant_id=(select id from order_fixture where k='tenant-a'))<>2 then raise exception 'Tenant A orders unavailable'; end if;
 if (select product_name_snapshot from public.order_items where order_id=(select id from order_fixture where k='order-a'))<>'Snapshot product' then raise exception 'Order item snapshot unavailable'; end if;
 begin insert into public.orders(tenant_id,reference,currency,subtotal,total,customer_name_snapshot) values((select id from order_fixture where k='tenant-a'),'FORBIDDEN','NGN',0,0,'No');raise exception 'Direct order write allowed';exception when insufficient_privilege then null;end;
end $$;
select public.update_order_status((select id from order_fixture where k='tenant-a'),(select id from order_fixture where k='checkout-a'),'CONFIRM_PAYMENT','Verified against bank statement.');
set constraints customer_order_totals_refresh immediate;
do $$ begin
 if (select total_spent_cached from public.customers where id=(select customer_id from public.orders where id=(select id from order_fixture where k='checkout-a')))<>6000 then
  raise exception 'Customer paid total does not match verified order value';
 end if;
 if (select total_orders_cached from public.customers where id=(select customer_id from public.orders where id=(select id from order_fixture where k='checkout-a')))<>1 then
  raise exception 'Customer order count is incorrect';
 end if;
end $$;
select public.update_order_status((select id from order_fixture where k='tenant-a'),(select id from order_fixture where k='checkout-a'),'CANCEL','Customer requested cancellation.');
select public.save_bank_account((select id from order_fixture where k='tenant-a'),'Replacement Bank','9988776655','Orders A New','New orders only.');
do $$ begin
 if (select payment_status from public.orders where id=(select id from order_fixture where k='checkout-a'))<>'PAID' then
  raise exception 'Cancelling fulfilment incorrectly changed a verified payment';
 end if;
 if (select stock_quantity from public.products where id=(select id from order_fixture where k='product-a'))<>3 then
  raise exception 'Cancellation did not restore inventory exactly once';
 end if;
 if (select payment_instructions_snapshot->>'bankName' from public.orders where id=(select id from order_fixture where k='checkout-a'))<>'Test Bank' then
  raise exception 'Historical bank-transfer instructions changed';
 end if;
 begin
  perform public.update_order_status((select id from order_fixture where k='tenant-a'),(select id from order_fixture where k='checkout-a'),'CANCEL','Again');
  raise exception 'Repeated cancellation was allowed';
 exception when sqlstate '22023' then null;
 end;
end $$;
reset role;

select set_config('request.jwt.claim.sub',(select id::text from order_fixture where k='owner-b'),true);
set local role authenticated;
select public.accept_tenant_invitation((select id from order_fixture where k='invite-b'));
do $$ begin
 if exists(select 1 from public.orders where tenant_id=(select id from order_fixture where k='tenant-a')) then raise exception 'Order leaked to tenant B'; end if;
 if exists(select 1 from public.customers where tenant_id=(select id from order_fixture where k='tenant-a')) then raise exception 'Customer leaked to tenant B'; end if;
 begin
  perform public.update_order_status((select id from order_fixture where k='tenant-a'),(select id from order_fixture where k='checkout-a'),'SAVE_NOTE','Cross-tenant');
  raise exception 'Cross-tenant order mutation allowed';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;

set local role anon;
do $$ begin
 begin perform 1 from public.orders;raise exception 'Anonymous order read allowed';exception when insufficient_privilege then null;end;
 begin perform 1 from public.customers;raise exception 'Anonymous customer read allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
