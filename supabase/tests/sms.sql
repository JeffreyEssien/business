create temporary table sms_fixture(k text primary key,id uuid not null,value text);
grant all on sms_fixture to authenticated,anon,service_role;
insert into sms_fixture(k,id,value) select k,gen_random_uuid(),gen_random_uuid()::text||'@example.invalid'
from unnest(array['admin','growth_owner','starter_owner','outsider']) k;
insert into auth.users(id,email,email_confirmed_at)
select id,value,now() from sms_fixture;
update public.users set platform_role='SUPER_ADMIN'
where auth_user_id=(select id from sms_fixture where k='admin');

select set_config('request.jwt.claim.sub',(select id::text from sms_fixture where k='admin'),true);
set local role authenticated;
insert into sms_fixture(k,id,value)
select 'growth_tenant',public.provision_tenant(
 'SMS Growth Store','sms-growth-'||substr(gen_random_uuid()::text,1,8),'Growth Owner',
 (select value from sms_fixture where k='growth_owner'),'general','growth','bank_transfer'
),'';
insert into sms_fixture(k,id,value)
select 'starter_tenant',public.provision_tenant(
 'SMS Starter Store','sms-starter-'||substr(gen_random_uuid()::text,1,8),'Starter Owner',
 (select value from sms_fixture where k='starter_owner'),'general','starter','bank_transfer'
),'';
insert into sms_fixture(k,id,value)
select 'growth_invitation',id,email from public.tenant_invitations
where tenant_id=(select id from sms_fixture where k='growth_tenant');
insert into sms_fixture(k,id,value)
select 'starter_invitation',id,email from public.tenant_invitations
where tenant_id=(select id from sms_fixture where k='starter_tenant');
reset role;

select set_config('request.jwt.claim.sub',(select id::text from sms_fixture where k='starter_owner'),true);
set local role authenticated;
select public.accept_tenant_invitation((select id from sms_fixture where k='starter_invitation'));
do $$ begin
 begin perform public.request_tenant_sms_sender(
  (select id from sms_fixture where k='starter_tenant'),'STARTERSMS','SMS Starter Store',
  'Transactional order updates only');
  raise exception 'Starter requested an SMS sender through the API';
 exception when insufficient_privilege then null; end;
 begin perform public.save_tenant_sms_settings(
  (select id from sms_fixture where k='starter_tenant'),true,true,true,true,true,true);
  raise exception 'Starter enabled SMS through the API';
 exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claim.sub',(select id::text from sms_fixture where k='growth_owner'),true);
set local role authenticated;
select public.accept_tenant_invitation((select id from sms_fixture where k='growth_invitation'));
select public.request_tenant_sms_sender(
 (select id from sms_fixture where k='growth_tenant'),'GROWTHSMS','SMS Growth Store',
 'Transactional order and verified payment updates only'
);
do $$ begin
 if (select sender_id_status from public.tenant_sms_settings
   where tenant_id=(select id from sms_fixture where k='growth_tenant'))<>'PENDING_REVIEW' then
  raise exception 'Tenant sender request skipped platform review'; end if;
 begin perform public.submit_sms_sender_request((select id from sms_fixture where k='growth_tenant'));
  raise exception 'Tenant submitted its own sender request to the provider';
 exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claim.sub',(select id::text from sms_fixture where k='admin'),true);
set local role authenticated;
select public.reject_sms_sender_request((select id from sms_fixture where k='growth_tenant'));
reset role;

select set_config('request.jwt.claim.sub',(select id::text from sms_fixture where k='growth_owner'),true);
set local role authenticated;
select public.request_tenant_sms_sender(
 (select id from sms_fixture where k='growth_tenant'),'GROWTHSMS','SMS Growth Store',
 'Transactional order and verified payment updates only'
);
reset role;

select set_config('request.jwt.claim.sub',(select id::text from sms_fixture where k='admin'),true);
set local role authenticated;
do $$ declare submission jsonb; begin
 submission:=public.submit_sms_sender_request((select id from sms_fixture where k='growth_tenant'));
 if submission->>'senderId'<>'GROWTHSMS' or submission->>'companyName'<>'SMS Growth Store' then
  raise exception 'Platform sender submission context is incomplete'; end if;
end $$;
reset role;

select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;
select public.sync_sms_sender_status((select id from sms_fixture where k='growth_tenant'),'APPROVED','');
reset role;

select set_config('request.jwt.claim.sub',(select id::text from sms_fixture where k='growth_owner'),true);
set local role authenticated;
select public.save_tenant_sms_settings(
 (select id from sms_fixture where k='growth_tenant'),true,true,true,true,true,true
);
reset role;

insert into sms_fixture(k,id,value) values
 ('customer',gen_random_uuid(),'customer@example.invalid'),
 ('order',gen_random_uuid(),'');
insert into public.customers(id,tenant_id,name,email,phone) values(
 (select id from sms_fixture where k='customer'),(select id from sms_fixture where k='growth_tenant'),
 'SMS Customer',(select value from sms_fixture where k='customer'),'08012345678'
);
insert into public.orders(
 id,tenant_id,customer_id,reference,currency,subtotal,delivery_fee,total,
 customer_name_snapshot,customer_email_snapshot,customer_phone_snapshot,
 delivery_method_snapshot,shipping_address_jsonb
) values(
 (select id from sms_fixture where k='order'),(select id from sms_fixture where k='growth_tenant'),
 (select id from sms_fixture where k='customer'),'BC-SMS-1001','NGN',2500,500,3000,
 'SMS Customer',(select value from sms_fixture where k='customer'),'08012345678',
 'Lagos delivery','{}'::jsonb
);
insert into public.order_items(tenant_id,order_id,product_name_snapshot,unit_price,quantity,line_total)
values((select id from sms_fixture where k='growth_tenant'),(select id from sms_fixture where k='order'),
 'SMS product',2500,1,2500);
update public.orders set payment_status='PAID',paid_at=now()
where id=(select id from sms_fixture where k='order');
update public.orders set fulfillment_status='READY'
where id=(select id from sms_fixture where k='order');
update public.orders set fulfillment_status='SHIPPED'
where id=(select id from sms_fixture where k='order');
update public.orders set fulfillment_status='DELIVERED',fulfilled_at=now()
where id=(select id from sms_fixture where k='order');
update public.orders set fulfillment_status='DELIVERED'
where id=(select id from sms_fixture where k='order');

do $$ begin
 if (select count(*) from private.sms_notifications
   where order_id=(select id from sms_fixture where k='order'))<>5 then
  raise exception 'Order lifecycle SMS events were not queued exactly once'; end if;
 if exists(select 1 from private.sms_notifications
   where order_id=(select id from sms_fixture where k='order')
    and (sender_id<>'GROWTHSMS' or recipient_phone<>'2348012345678'
      or message_text not like 'SMS Growth Store:%' or segment_count<1)) then
  raise exception 'SMS sender, recipient, content, or usage snapshot is incorrect'; end if;
end $$;

select set_config('request.jwt.claim.sub',(select id::text from sms_fixture where k='growth_owner'),true);
set local role authenticated;
do $$ declare logs jsonb; begin
 logs:=public.get_tenant_sms_logs((select id from sms_fixture where k='growth_tenant'),30);
 if jsonb_array_length(logs)<>5 or logs::text like '%2348012345678%' then
  raise exception 'Tenant SMS logs are missing or expose the full recipient'; end if;
 begin perform 1 from private.sms_notifications; raise exception 'Private SMS queue was readable';
 exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claim.sub',(select id::text from sms_fixture where k='outsider'),true);
set local role authenticated;
do $$ begin
 begin perform public.get_tenant_sms_logs((select id from sms_fixture where k='growth_tenant'),30);
  raise exception 'Outsider read tenant SMS logs'; exception when insufficient_privilege then null; end;
 begin perform public.save_tenant_sms_settings(
  (select id from sms_fixture where k='growth_tenant'),false,true,true,true,true,true);
  raise exception 'Outsider changed tenant SMS settings'; exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;
insert into sms_fixture(k,id,value)
select 'claimed',notification_id,'' from public.claim_sms_notifications(
 1,(select id from sms_fixture where k='growth_tenant')) limit 1;
do $$ declare context jsonb; begin
 context:=public.get_sms_notification_context((select id from sms_fixture where k='claimed'));
 if context->>'status'<>'SENDING' or context->>'senderId'<>'GROWTHSMS'
   or context->>'recipientPhone'<>'2348012345678' then
  raise exception 'Claimed SMS context is incomplete'; end if;
end $$;
select public.complete_sms_notification((select id from sms_fixture where k='claimed'),'termii-sms-1');
select public.record_termii_sms_webhook(
 'termii-delivered','termii-sms-1','DELIVERED',now(),2.5,'generic'
);
select public.record_termii_sms_webhook(
 'termii-sent-late','termii-sms-1','MESSAGE SENT',now()-interval '1 minute',null,'generic'
);
insert into sms_fixture(k,id,value)
select 'stale_claim',notification_id,'' from public.claim_sms_notifications(
 1,(select id from sms_fixture where k='growth_tenant')) limit 1;
reset role;
update private.sms_notifications set last_attempt_at=now()-interval '16 minutes'
where id=(select id from sms_fixture where k='stale_claim');
select * from public.claim_sms_notifications(
 25,(select id from sms_fixture where k='growth_tenant'));
do $$ begin
 if public.record_termii_sms_webhook(
  'termii-delivered','termii-sms-1','DELIVERED',now(),2.5,'generic')<>'ALREADY_PROCESSED' then
  raise exception 'Duplicate SMS webhook was not idempotent'; end if;
 if (select row(status,attempt_count,last_error_code) from private.sms_notifications
   where id=(select id from sms_fixture where k='stale_claim'))
   <>row('DELIVERY_UNKNOWN'::text,1,'SMS_STALE_CLAIM_DELIVERY_UNKNOWN'::text) then
  raise exception 'Stale SMS claim was automatically resent instead of quarantined'; end if;
end $$;
reset role;
do $$ begin
 if (select status from private.sms_notifications where id=(select id from sms_fixture where k='claimed'))<>'DELIVERED' then
  raise exception 'Out-of-order webhook regressed delivered SMS state'; end if;
end $$;

select set_config('request.jwt.claim.sub',(select id::text from sms_fixture where k='admin'),true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
do $$ declare logs jsonb; requests jsonb; begin
 logs:=public.get_platform_sms_logs(75);
 requests:=public.get_platform_sms_sender_requests(75);
 if jsonb_array_length(logs)<>5 or logs::text like '%2348012345678%' then
  raise exception 'Platform SMS logs are missing or expose the full recipient'; end if;
 if jsonb_array_length(requests)<>1 or requests#>>'{0,sender_id_status}'<>'APPROVED' then
  raise exception 'Platform sender request view is incomplete'; end if;
end $$;
reset role;

set local role anon;
do $$ begin
 begin perform public.get_tenant_sms_logs((select id from sms_fixture where k='growth_tenant'),30);
  raise exception 'Anonymous user read SMS logs'; exception when insufficient_privilege then null; end;
 begin perform public.claim_sms_notifications(1,null);
  raise exception 'Anonymous user claimed SMS queue'; exception when insufficient_privilege then null; end;
end $$;
reset role;
