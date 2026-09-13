create temporary table email_fixture(k text primary key,id uuid not null,email text);
grant all on email_fixture to authenticated,anon,service_role;
insert into email_fixture(k,id,email) select k,gen_random_uuid(),gen_random_uuid()::text||'@example.invalid'
from unnest(array['admin','owner','outsider']) k;
insert into auth.users(id,email,email_confirmed_at)
select id,email,now() from email_fixture;
update public.users set platform_role='SUPER_ADMIN'
where auth_user_id=(select id from email_fixture where k='admin');

select set_config('request.jwt.claim.sub',(select id::text from email_fixture where k='admin'),true);
set local role authenticated;
insert into email_fixture(k,id,email)
select 'tenant',public.provision_tenant(
 'Email Test Store','email-test-'||substr(gen_random_uuid()::text,1,8),'Email Owner',
 (select email from email_fixture where k='owner'),'general','starter','bank_transfer'
),'';
insert into email_fixture(k,id,email)
select 'invitation',id,email from public.tenant_invitations
where tenant_id=(select id from email_fixture where k='tenant');
reset role;

select set_config('request.jwt.claim.sub',(select id::text from email_fixture where k='owner'),true);
set local role authenticated;
select public.accept_tenant_invitation((select id from email_fixture where k='invitation'));
select public.save_tenant_email_settings(
 (select id from email_fixture where k='tenant'),true,'Email Test Store'::text,'help@example.invalid'::text,
 true,true,true,true,true
);
reset role;

insert into email_fixture(k,id,email) values
 ('customer',gen_random_uuid(),'customer@example.invalid'),
 ('order',gen_random_uuid(),'');
insert into public.customers(id,tenant_id,name,email) values(
 (select id from email_fixture where k='customer'),(select id from email_fixture where k='tenant'),
 'Email Customer',(select email from email_fixture where k='customer')
);
insert into public.orders(
 id,tenant_id,customer_id,reference,currency,subtotal,delivery_fee,total,
 customer_name_snapshot,customer_email_snapshot,delivery_method_snapshot,shipping_address_jsonb
) values(
 (select id from email_fixture where k='order'),(select id from email_fixture where k='tenant'),
 (select id from email_fixture where k='customer'),'BC-EMAIL-1001','NGN',2500,500,3000,
 'Email Customer',(select email from email_fixture where k='customer'),'Lagos delivery','{}'::jsonb
);
insert into public.order_items(tenant_id,order_id,product_name_snapshot,unit_price,quantity,line_total)
values((select id from email_fixture where k='tenant'),(select id from email_fixture where k='order'),
 'Branded product',2500,1,2500);
update public.orders set payment_status='PAID',paid_at=now()
where id=(select id from email_fixture where k='order');
update public.orders set fulfillment_status='READY'
where id=(select id from email_fixture where k='order');
update public.orders set fulfillment_status='SHIPPED'
where id=(select id from email_fixture where k='order');
update public.orders set fulfillment_status='DELIVERED',fulfilled_at=now()
where id=(select id from email_fixture where k='order');
-- Repeating the same state cannot duplicate its notification.
update public.orders set fulfillment_status='DELIVERED'
where id=(select id from email_fixture where k='order');

do $$ begin
 if (select count(*) from private.email_notifications
   where order_id=(select id from email_fixture where k='order'))<>5 then
  raise exception 'Order lifecycle email events were not queued exactly once';
 end if;
 if exists(select 1 from private.email_notifications
   where order_id=(select id from email_fixture where k='order')
    and (template_data->>'businessName'<>'Email Test Store'
      or template_data->>'primaryColor' is null or recipient_email<>'customer@example.invalid')) then
  raise exception 'Email branding or recipient snapshot is incorrect';
 end if;
end $$;

select set_config('request.jwt.claim.sub',(select id::text from email_fixture where k='owner'),true);
set local role authenticated;
do $$ declare logs jsonb; begin
 logs:=public.get_tenant_email_logs((select id from email_fixture where k='tenant'),30);
 if jsonb_array_length(logs)<>5 or logs::text like '%customer@example.invalid%' then
  raise exception 'Tenant logs are missing or expose the full recipient';
 end if;
 begin perform 1 from private.email_notifications; raise exception 'Private email queue was readable';
 exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claim.sub',(select id::text from email_fixture where k='outsider'),true);
set local role authenticated;
do $$ begin
 begin perform public.get_tenant_email_logs((select id from email_fixture where k='tenant'),30);
  raise exception 'Outsider read tenant email logs'; exception when insufficient_privilege then null; end;
 begin perform public.save_tenant_email_settings(
  (select id from email_fixture where k='tenant'),false,''::text,''::text,true,true,true,true,true);
  raise exception 'Outsider changed tenant email settings'; exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;
insert into email_fixture(k,id,email)
select 'claimed',notification_id,'' from public.claim_email_notifications(
 1,(select id from email_fixture where k='tenant')) limit 1;
do $$ declare context jsonb; begin
 context:=public.get_email_notification_context((select id from email_fixture where k='claimed'));
 if context->>'status'<>'SENDING' or context#>>'{items,0,name}'<>'Branded product' then
  raise exception 'Claimed email context is incomplete';
 end if;
end $$;
select public.complete_email_notification((select id from email_fixture where k='claimed'),'resend-email-1');
select public.record_resend_webhook('webhook-delivered','email.delivered','resend-email-1',now(),'');
select public.record_resend_webhook('webhook-sent-late','email.sent','resend-email-1',now()-interval '1 minute','');

insert into email_fixture(k,id,email)
select 'stale_claim',notification_id,'' from public.claim_email_notifications(
 1,(select id from email_fixture where k='tenant')) limit 1;
reset role;
update private.email_notifications set last_attempt_at=now()-interval '16 minutes'
where id=(select id from email_fixture where k='stale_claim');
select * from public.claim_email_notifications(
 25,(select id from email_fixture where k='tenant'));
do $$ begin
 if (select row(status,attempt_count,last_error_code) from private.email_notifications
   where id=(select id from email_fixture where k='stale_claim'))
   <>row('SENDING'::text,2,'EMAIL_STALE_CLAIM_RECOVERED'::text) then
  raise exception 'Stale email claim was not safely reclaimed with its idempotency key';
 end if;
end $$;
reset role;
do $$ begin
 if (select status from private.email_notifications where id=(select id from email_fixture where k='claimed'))<>'DELIVERED' then
  raise exception 'Out-of-order webhook regressed delivered email state';
 end if;
 if public.record_resend_webhook('webhook-delivered','email.delivered','resend-email-1',now(),'')<>'ALREADY_PROCESSED' then
  raise exception 'Duplicate webhook was not idempotent';
 end if;
end $$;

select set_config('request.jwt.claim.sub',(select id::text from email_fixture where k='admin'),true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
do $$ declare logs jsonb; begin
 logs:=public.get_platform_email_logs(75);
 if jsonb_array_length(logs)<>5 or logs::text like '%customer@example.invalid%' then
  raise exception 'Platform logs are missing or expose the full recipient';
 end if;
end $$;
reset role;

set local role anon;
do $$ begin
 begin perform public.get_tenant_email_logs((select id from email_fixture where k='tenant'),30);
  raise exception 'Anonymous user read email logs'; exception when insufficient_privilege then null; end;
 begin perform public.claim_email_notifications(1,null);
  raise exception 'Anonymous user claimed email queue'; exception when insufficient_privilege then null; end;
end $$;
reset role;
