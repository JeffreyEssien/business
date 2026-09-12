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
do $$ declare payment_reference text; context jsonb; begin
 select provider_reference into payment_reference from public.payments
 where order_id=(select id from paystack_fixture where k='checkout-a');
 if (select settlement_subaccount_code from public.payments where provider_reference=payment_reference)
   <>'ACCT_paystacktesta' then raise exception 'Payment did not snapshot its settlement account'; end if;
 update public.tenant_payment_settings set subaccount_code='ACCT_paystackreplacement'
 where tenant_id=(select id from paystack_fixture where k='tenant-a');
 context=public.get_paystack_initialization_context(payment_reference);
 if context->>'subaccountCode'<>'ACCT_paystacktesta' or (context->>'platformChargeSubunit')::bigint<>0 then
  raise exception 'Initialization did not retain the payment routing snapshot';
 end if;
 perform public.record_paystack_initialization(payment_reference,true,'access_test',
  'https://checkout.paystack.com/test-access','');
 update public.payments set created_at=now()-interval '1 minute',provider_status='ABANDONED',
  last_verified_at=now() where provider_reference=payment_reference;
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
 result=public.receive_paystack_webhook('charge.success:900001','charge.success',retry_reference,
  375000,'NGN','success',100,now(),'{"channel":"card","transactionId":"900001"}'::jsonb);
 if result<>'RECEIVED' or (select processing_status from public.payment_webhook_events
   where event_key='charge.success:900001')<>'RECEIVED' then
  raise exception 'Signed webhook was not durably received before processing';
 end if;
 if public.claim_paystack_webhook('charge.success:900001',false)<>'CLAIMED' then
  raise exception 'Stored webhook could not be claimed';
 end if;
 result=public.process_stored_paystack_webhook('charge.success:900001');
 if result<>'PROCESSED' then raise exception 'Exact payment was not processed: %',result; end if;
 result=public.receive_paystack_webhook('charge.success:900001','charge.success',retry_reference,
  375000,'NGN','success',100,now(),'{"channel":"card","transactionId":"900001"}'::jsonb);
 if result<>'PROCESSED' or public.claim_paystack_webhook('charge.success:900001',false)<>'ALREADY_PROCESSED'
  then raise exception 'Webhook was not idempotent: %',result; end if;
 result=public.confirm_paystack_payment((select value->>'firstPaymentReference' from paystack_fixture
  where k='checkout-a'),375000,'NGN','success',100,now());
 if result<>'DUPLICATE_PAYMENT_RECORDED' then
  raise exception 'A second provider receipt was not preserved: %',result;
 end if;
 set constraints customer_order_totals_refresh immediate;
 if (select payment_status from public.orders where id=(select id from paystack_fixture where k='checkout-a'))<>'PAID'
   or (select stock_quantity from public.products where id=(select id from paystack_fixture where k='product-a'))<>4
   or (select count(*) from public.audit_logs where resource_id=(select id from public.payments
    where provider_reference=retry_reference) and action='PAYSTACK_PAYMENT_CONFIRMED')<>1
   or (select count(*) from public.payment_webhook_events where event_key='charge.success:900001')<>1
   or (select row(provider_status,order_application_status,resolution_status)
      from public.payments where provider_reference=(select value->>'firstPaymentReference'
       from paystack_fixture where k='checkout-a'))
      <>row('SUCCESS'::text,'DUPLICATE'::text,'REFUND_REQUIRED'::text) then
  raise exception 'Verified payment effects are incorrect';
 end if;
end $$;

-- Amount and currency mismatches preserve provider success but never pay or
-- re-apply the order automatically.
do $$ declare amount_reference text='BCPAY-mismatch-amount'; currency_reference text='BCPAY-mismatch-currency';
 result text; begin
 insert into public.payments(tenant_id,order_id,provider,provider_reference,amount,amount_subunit,currency)
 select tenant_id,id,'PAYSTACK',amount_reference,total,round(total*100)::bigint,currency
 from public.orders where id=(select id from paystack_fixture where k='checkout-a');
 insert into public.payments(tenant_id,order_id,provider,provider_reference,amount,amount_subunit,currency)
 select tenant_id,id,'PAYSTACK',currency_reference,total,round(total*100)::bigint,currency
 from public.orders where id=(select id from paystack_fixture where k='checkout-a');
 result=public.confirm_paystack_payment(amount_reference,374999,'NGN','success',100,now());
 if result<>'AMOUNT_MISMATCH_REVIEW' then raise exception 'Wrong amount was not isolated: %',result; end if;
 result=public.confirm_paystack_payment(currency_reference,375000,'USD','success',100,now());
 if result<>'CURRENCY_MISMATCH_REVIEW' then raise exception 'Wrong currency was not isolated: %',result; end if;
 if (select count(*) from public.payments where provider_reference in (amount_reference,currency_reference)
    and provider_status='SUCCESS' and order_application_status='REVIEW_REQUIRED'
    and resolution_status='REVIEW_REQUIRED')<>2 then
  raise exception 'Mismatched provider receipts were not retained for review';
 end if;
end $$;

-- A provider success after the merchant cancels remains a real receipt while
-- the order stays cancelled and stock stays restored.
set local role anon;
insert into paystack_fixture(k,id,value)
select 'checkout-late',(created->>'orderId')::uuid,created from (
 select public.create_storefront_order(
  (select value->>'slug' from paystack_fixture where k='tenant-a'),
  jsonb_build_array(jsonb_build_object('productId',(select id from paystack_fixture where k='product-a'),'quantity',1)),
  '{"name":"Late Customer","email":"late@example.invalid"}'::jsonb,'{}'::jsonb,
  null,'PAYSTACK','') created) result;
reset role;
do $$ begin
 perform public.record_paystack_initialization(
  (select provider_reference from public.payments where order_id=(select id from paystack_fixture where k='checkout-late')),
  true,'access_late','https://checkout.paystack.com/test-late','');
end $$;
select set_config('request.jwt.claim.sub',(select id::text from paystack_fixture where k='owner-a'),true);
set local role authenticated;
select public.update_order_status((select id from paystack_fixture where k='tenant-a'),
 (select id from paystack_fixture where k='checkout-late'),'CANCEL','Customer requested cancellation.');
reset role;
do $$ declare result text; late_reference text; begin
 select provider_reference into late_reference from public.payments
 where order_id=(select id from paystack_fixture where k='checkout-late');
 result=public.confirm_paystack_payment(late_reference,375000,'NGN','success',100,now());
 if result<>'LATE_PAYMENT_RECORDED' then raise exception 'Late receipt was lost: %',result; end if;
 if (select row(payment_status,fulfillment_status) from public.orders
    where id=(select id from paystack_fixture where k='checkout-late'))
     <>row('CANCELLED'::text,'CANCELLED'::text)
   or (select row(provider_status,order_application_status,resolution_status) from public.payments
    where provider_reference=late_reference)
     <>row('SUCCESS'::text,'LATE_CANCELLED'::text,'REFUND_REQUIRED'::text) then
  raise exception 'Late payment changed the cancelled order or was not queued for refund';
 end if;
end $$;

-- Webhook receipt and claim survive a processing failure and can be replayed.
set local role anon;
insert into paystack_fixture(k,id,value)
select 'checkout-webhook-failure',(created->>'orderId')::uuid,created from (
 select public.create_storefront_order(
  (select value->>'slug' from paystack_fixture where k='tenant-a'),
  jsonb_build_array(jsonb_build_object('productId',(select id from paystack_fixture where k='product-a'),'quantity',1)),
  '{"name":"Retry Customer","email":"retry@example.invalid"}'::jsonb,'{}'::jsonb,
  null,'PAYSTACK','') created) result;
reset role;
create function pg_temp.reject_test_payment_update() returns trigger language plpgsql as $$
begin
 if old.order_id=(select id from paystack_fixture where k='checkout-webhook-failure') then
  raise exception 'TEST_PAYMENT_WRITE_FAILURE';
 end if;
 return new;
end $$;
create trigger reject_test_payment_update before update on public.payments
for each row execute function pg_temp.reject_test_payment_update();
do $$ declare target_event_key text='charge.success:900002'; payment_reference text; begin
 select provider_reference into payment_reference from public.payments
 where order_id=(select id from paystack_fixture where k='checkout-webhook-failure');
 perform public.receive_paystack_webhook(target_event_key,'charge.success',payment_reference,
  375000,'NGN','success',100,now(),'{"transactionId":"900002"}'::jsonb);
 perform public.claim_paystack_webhook(target_event_key,false);
 begin
  perform public.process_stored_paystack_webhook(target_event_key);
 exception when raise_exception then
  perform public.fail_paystack_webhook(target_event_key,'TEST_PAYMENT_WRITE_FAILURE');
 end;
 if (select processing_status from public.payment_webhook_events
    where payment_webhook_events.event_key=target_event_key)<>'FAILED'
   or (select attempts from public.payment_webhook_events
    where payment_webhook_events.event_key=target_event_key)<>1 then
  raise exception 'Failed processing did not preserve its durable receipt';
 end if;
end $$;
drop trigger reject_test_payment_update on public.payments;
do $$ declare result text; begin
 if public.claim_paystack_webhook('charge.success:900002',true)<>'CLAIMED' then
  raise exception 'Failed webhook could not be reclaimed';
 end if;
 result=public.process_stored_paystack_webhook('charge.success:900002');
 if result<>'PROCESSED' or (select processing_status from public.payment_webhook_events
   where event_key='charge.success:900002')<>'PROCESSED' then
  raise exception 'Stored webhook replay did not complete: %',result;
 end if;
 if to_regprocedure('public.process_paystack_webhook(text,text,text,bigint,text,text,bigint,timestamp with time zone,jsonb)') is not null then
  raise exception 'Legacy process-before-persist webhook RPC still exists';
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
 if (select count(*) from public.payments where tenant_id=(select id from paystack_fixture where k='tenant-a'))<>6
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
