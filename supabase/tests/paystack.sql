create temporary table paystack_fixture(k text primary key,id uuid,email text,value jsonb);
grant all on paystack_fixture to authenticated,anon;
insert into paystack_fixture(k,id,email) select k,gen_random_uuid(),gen_random_uuid()::text||'@example.invalid'
from unnest(array['admin','owner-a','owner-b']) k;
insert into auth.users(id,email,email_confirmed_at)
select id,email,now() from paystack_fixture where email is not null;
update public.users set platform_role='SUPER_ADMIN'
where auth_user_id=(select id from paystack_fixture where k='admin');

select set_config('request.jwt.claim.sub',(select id::text from paystack_fixture where k='admin'),true);
set local role authenticated;
insert into paystack_fixture(k,id) select 'tenant-a',public.provision_tenant(
 'Paystack A','paystack-a-'||substr(gen_random_uuid()::text,1,8),'Owner A',
 (select email from paystack_fixture where k='owner-a'),'general','starter','paystack');
insert into paystack_fixture(k,id) select 'tenant-b',public.provision_tenant(
 'Paystack B','paystack-b-'||substr(gen_random_uuid()::text,1,8),'Owner B',
 (select email from paystack_fixture where k='owner-b'),'general','starter','paystack');
insert into paystack_fixture(k,id) select 'invite-a',id from public.tenant_invitations
where tenant_id=(select id from paystack_fixture where k='tenant-a');
insert into paystack_fixture(k,id) select 'invite-b',id from public.tenant_invitations
where tenant_id=(select id from paystack_fixture where k='tenant-b');
select public.publish_site((select id from paystack_fixture where k='tenant-a'));
reset role;
update paystack_fixture fixture set value=jsonb_build_object('slug',tenants.slug)
from public.tenants tenants where fixture.id=tenants.id and fixture.k in ('tenant-a','tenant-b');

select set_config('request.jwt.claim.sub',(select id::text from paystack_fixture where k='owner-a'),true);
set local role authenticated;
select public.accept_tenant_invitation((select id from paystack_fixture where k='invite-a'));
reset role;
select set_config('request.jwt.claim.sub',(select id::text from paystack_fixture where k='owner-b'),true);
set local role authenticated;
select public.accept_tenant_invitation((select id from paystack_fixture where k='invite-b'));
reset role;

-- Simulate the already-verified provider result; browser roles cannot perform this write.
update public.tenant_payment_settings set connection_status='ACTIVE',subaccount_code='ACCT_paystacktesta',
 settlement_bank_code='058',settlement_bank_name='Test Bank',settlement_account_last4='6047',
 settlement_account_name='PAYSTACK A'
where tenant_id=(select id from paystack_fixture where k='tenant-a');
insert into paystack_fixture(k,id) values('product-a',gen_random_uuid());
insert into public.products(id,tenant_id,name,slug,price,currency,stock_quantity,track_inventory,status,published_at)
values((select id from paystack_fixture where k='product-a'),
 (select id from paystack_fixture where k='tenant-a'),'Online payment product','online-payment-product',
 3750,'NGN',5,true,'ACTIVE',now());

select set_config('request.jwt.claim.sub',(select id::text from paystack_fixture where k='owner-a'),true);
set local role authenticated;
select public.save_checkout_settings_complete((select id from paystack_fixture where k='tenant-a'),
 false,true,false,false,false,true,'Your secure payment is being confirmed.');
reset role;

set local role anon;
do $$ declare quote jsonb; begin
 quote=public.get_public_checkout_quote(
  (select value->>'slug' from paystack_fixture where k='tenant-a'),
  jsonb_build_array(jsonb_build_object('productId',(select id from paystack_fixture where k='product-a'),'quantity',1)));
 if quote#>>'{settings,paystackEnabled}'<>'true' or quote#>>'{settings,bankTransferEnabled}'<>'false' then
  raise exception 'Paystack checkout availability is incorrect';
 end if;
end $$;
insert into paystack_fixture(k,id,value)
select 'checkout-a',(created->>'orderId')::uuid,created from (
 select public.create_storefront_order(
  (select value->>'slug' from paystack_fixture where k='tenant-a'),
  jsonb_build_array(jsonb_build_object('productId',(select id from paystack_fixture where k='product-a'),'quantity',1)),
  '{"name":"Online Customer","email":"online@example.invalid"}'::jsonb,'{}'::jsonb,
  null,'PAYSTACK','') created) result;
do $$ begin
 if public.get_public_paystack_order(
  (select value->>'slug' from paystack_fixture where k='tenant-a'),
  (select value->>'reference' from paystack_fixture where k='checkout-a'),gen_random_uuid()) is not null then
  raise exception 'An invalid customer token exposed an order';
 end if;
 begin
  perform public.confirm_paystack_payment('BCPAY-not-available',1,'NGN','success',null,now());
  raise exception 'Anonymous provider confirmation was allowed';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;

-- Provider initialization and verification are service-only operations.
do $$ declare payment_reference text; result text; begin
 select provider_reference into payment_reference from public.payments
 where order_id=(select id from paystack_fixture where k='checkout-a');
 perform public.record_paystack_initialization(payment_reference,true,'access_test',
  'https://checkout.paystack.com/test-access','');
 result=public.confirm_paystack_payment(payment_reference,374999,'NGN','success',100,now());
 if result<>'AMOUNT_MISMATCH' then raise exception 'Wrong amount was accepted: %',result; end if;
 result=public.confirm_paystack_payment(payment_reference,375000,'USD','success',100,now());
 if result<>'CURRENCY_MISMATCH' then raise exception 'Wrong currency was accepted: %',result; end if;
 update public.payments set created_at=now()-interval '1 minute' where provider_reference=payment_reference;
 update paystack_fixture set value=value||jsonb_build_object('firstPaymentReference',payment_reference)
 where k='checkout-a';
end $$;

set local role anon;
update paystack_fixture set value=value||jsonb_build_object('retryPaymentReference',
 public.prepare_paystack_retry(
  (select value->>'slug' from paystack_fixture where k='tenant-a'),
  value->>'reference',(value->>'accessToken')::uuid)) where k='checkout-a';
reset role;

do $$ declare result text; retry_reference text=(select value->>'retryPaymentReference'
 from paystack_fixture where k='checkout-a'); begin
 perform public.record_paystack_initialization(retry_reference,true,'access_retry',
  'https://checkout.paystack.com/test-retry','');
 result=public.process_paystack_webhook('charge.success:900001','charge.success',retry_reference,
  375000,'NGN','success',100,now(),'{"channel":"card","transactionId":"900001"}'::jsonb);
 if result<>'PROCESSED' then raise exception 'Exact payment was not processed: %',result; end if;
 result=public.process_paystack_webhook('charge.success:900001','charge.success',retry_reference,
  375000,'NGN','success',100,now(),'{"channel":"card","transactionId":"900001"}'::jsonb);
 if result<>'ALREADY_RECEIVED' then raise exception 'Webhook was not idempotent: %',result; end if;
 result=public.confirm_paystack_payment((select value->>'firstPaymentReference' from paystack_fixture
  where k='checkout-a'),375000,'NGN','success',100,now());
 if result<>'ORDER_ALREADY_PAID' then raise exception 'A second payment succeeded: %',result; end if;
 set constraints customer_order_totals_refresh immediate;
 if (select payment_status from public.orders where id=(select id from paystack_fixture where k='checkout-a'))<>'PAID'
   or (select stock_quantity from public.products where id=(select id from paystack_fixture where k='product-a'))<>4
   or (select count(*) from public.audit_logs where resource_id=(select id from public.payments
    where provider_reference=retry_reference) and action='PAYSTACK_PAYMENT_CONFIRMED')<>1
   or (select count(*) from public.payment_webhook_events where event_key='charge.success:900001')<>1 then
  raise exception 'Verified payment effects are incorrect';
 end if;
end $$;

select set_config('request.jwt.claim.sub',(select id::text from paystack_fixture where k='admin'),true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.payment_webhook_events
   where event_key='charge.success:900001')<>1 then
  raise exception 'Super admin cannot inspect sanitized webhook operations';
 end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub',(select id::text from paystack_fixture where k='owner-a'),true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.payments where tenant_id=(select id from paystack_fixture where k='tenant-a'))<>2
  then raise exception 'Tenant A payment attempts are unavailable'; end if;
 begin
  perform public.update_order_status((select id from paystack_fixture where k='tenant-a'),
   (select id from paystack_fixture where k='checkout-a'),'CONFIRM_PAYMENT','');
  raise exception 'Merchant manually confirmed a Paystack payment';
 exception when sqlstate '22023' then null;
 end;
 begin
  update public.payments set status='SUCCESS' where tenant_id=(select id from paystack_fixture where k='tenant-a');
  raise exception 'Tenant directly changed a payment';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;

select set_config('request.jwt.claim.sub',(select id::text from paystack_fixture where k='owner-b'),true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.payments where tenant_id=(select id from paystack_fixture where k='tenant-a'))
  then raise exception 'Payment leaked across tenants'; end if;
 if exists(select 1 from public.tenant_payment_settings
  where tenant_id=(select id from paystack_fixture where k='tenant-a'))
  then raise exception 'Settlement settings leaked across tenants'; end if;
end $$;
reset role;

set local role anon;
do $$ begin
 begin perform 1 from public.payments; raise exception 'Anonymous payment read allowed';
 exception when insufficient_privilege then null; end;
 begin perform 1 from public.payment_webhook_events; raise exception 'Anonymous webhook read allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
