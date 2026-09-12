-- Preserve provider truth even when a payment cannot be applied to an order,
-- persist signed webhook receipts before processing, and snapshot routing used
-- by each attempt. Existing Phase 6 functions remain the only write boundary.

alter table public.payments
 add column provider_status text not null default 'UNVERIFIED'
  check(provider_status in ('UNVERIFIED','PENDING','SUCCESS','FAILED','ABANDONED','REVERSED')),
 add column order_application_status text not null default 'PENDING'
  check(order_application_status in ('PENDING','APPLIED','SUPERSEDED','DUPLICATE','LATE_CANCELLED','REVIEW_REQUIRED')),
 add column resolution_status text not null default 'NONE'
  check(resolution_status in ('NONE','REVIEW_REQUIRED','REFUND_REQUIRED','REFUND_PENDING','REFUNDED','RESOLVED')),
 add column provider_amount_subunit bigint,
 add column provider_currency text,
 add column provider_fee_subunit bigint,
 add column last_verified_at timestamptz,
 add column settlement_subaccount_code text not null default '',
 add column settlement_fee_bearer text not null default 'SUBACCOUNT'
  check(settlement_fee_bearer in ('ACCOUNT','SUBACCOUNT')),
 add column platform_charge_subunit bigint not null default 0 check(platform_charge_subunit>=0);

update public.payments payment set
 provider_status=case when payment.status='SUCCESS' then 'SUCCESS'
  when payment.status='PENDING' then 'PENDING' else 'UNVERIFIED' end,
 order_application_status=case when payment.status='SUCCESS' then 'APPLIED'
  when payment.status='CANCELLED' and orders.payment_status='PAID' then 'SUPERSEDED'
  else 'PENDING' end,
 settlement_subaccount_code=coalesce(settings.subaccount_code,''),
 settlement_fee_bearer=settings.fee_bearer
from public.orders orders
join public.tenant_payment_settings settings on settings.tenant_id=orders.tenant_id
where orders.id=payment.order_id and orders.tenant_id=payment.tenant_id;

alter table public.payments add constraint payments_provider_amount_check
 check(provider_amount_subunit is null or provider_amount_subunit>0);
alter table public.payments add constraint payments_provider_currency_check
 check(provider_currency is null or provider_currency~'^[A-Z]{3}$');
alter table public.payments add constraint payments_provider_fee_check
 check(provider_fee_subunit is null or provider_fee_subunit>=0);
alter table public.payments add constraint payments_settlement_snapshot_check
 check(settlement_subaccount_code='' or settlement_subaccount_code~'^ACCT_[A-Za-z0-9]+$');

create index payments_resolution_queue_idx
 on public.payments(resolution_status,paid_at desc)
 where resolution_status in ('REVIEW_REQUIRED','REFUND_REQUIRED','REFUND_PENDING');

create function private.snapshot_paystack_routing() returns trigger
language plpgsql security definer set search_path='' as $$
declare settings public.tenant_payment_settings%rowtype;
begin
 if new.provider<>'PAYSTACK' then return new; end if;
 select * into settings from public.tenant_payment_settings
 where tenant_id=new.tenant_id and connection_status='ACTIVE';
 if settings.tenant_id is null then
  raise exception 'PAYSTACK_ACCOUNT_REQUIRED' using errcode='22023';
 end if;
 new.settlement_subaccount_code=settings.subaccount_code;
 new.settlement_fee_bearer=settings.fee_bearer;
 -- Transaction commission is deliberately zero until pricing/entitlements own it.
 new.platform_charge_subunit=0;
 return new;
end;
$$;
revoke all on function private.snapshot_paystack_routing() from public;
create trigger payments_snapshot_paystack_routing before insert on public.payments
for each row execute function private.snapshot_paystack_routing();

create or replace function public.get_paystack_initialization_context(provider_reference text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 select jsonb_build_object('paymentId',payment.id,'tenantId',payment.tenant_id,
  'orderId',orders.id,'orderReference',orders.reference,
  'accessToken',orders.customer_access_token,'storeSlug',tenants.slug,'customerEmail',orders.customer_email_snapshot,
  'amountSubunit',payment.amount_subunit,'currency',payment.currency,
  'subaccountCode',payment.settlement_subaccount_code,
  'platformChargeSubunit',payment.platform_charge_subunit,
  'feeBearer',payment.settlement_fee_bearer,'status',payment.status)
 into result from public.payments payment
 join public.orders orders on orders.tenant_id=payment.tenant_id and orders.id=payment.order_id
 join public.tenants tenants on tenants.id=payment.tenant_id
 where payment.provider='PAYSTACK'
  and payment.provider_reference=get_paystack_initialization_context.provider_reference;
 return result;
end;
$$;

create or replace function public.record_paystack_initialization(
 provider_reference text,succeeded boolean,provider_access_code text,
 provider_authorization_url text,failure text
) returns void language plpgsql security definer set search_path='' as $$
begin
 if succeeded and (length(coalesce(provider_access_code,'')) not between 1 and 200
   or provider_authorization_url not like 'https://checkout.paystack.com/%') then
  raise exception 'INVALID_PROVIDER_RESPONSE' using errcode='22023';
 end if;
 update public.payments set status=case when succeeded then 'PENDING' else 'FAILED' end,
  provider_status=case when succeeded then 'PENDING' else provider_status end,
  access_code=case when succeeded then provider_access_code else null end,
  authorization_url=case when succeeded then provider_authorization_url else null end,
  failure_code=case when succeeded then null else left(coalesce(failure,'PROVIDER_ERROR'),100) end,
  failed_at=case when succeeded then null else now() end
 where provider='PAYSTACK'
  and payments.provider_reference=record_paystack_initialization.provider_reference
  and status='INITIALIZING';
 if not found then raise exception 'PAYMENT_UNAVAILABLE' using errcode='22023'; end if;
 if not succeeded then
  update public.orders set payment_status='FAILED' where id=(select order_id from public.payments
   where payments.provider_reference=record_paystack_initialization.provider_reference)
   and payment_status='PENDING';
 end if;
end;
$$;

create or replace function private.apply_paystack_success(
 provider_reference text,paid_amount_subunit bigint,paid_currency text,
 fee_subunit bigint,paid_timestamp timestamptz
) returns text language plpgsql security definer set search_path='' as $$
declare payment public.payments%rowtype; order_row public.orders%rowtype; outcome text;
begin
 select * into payment from public.payments where provider='PAYSTACK'
  and payments.provider_reference=apply_paystack_success.provider_reference for update;
 if payment.id is null then return 'PAYMENT_NOT_FOUND'; end if;
 select * into order_row from public.orders where tenant_id=payment.tenant_id
  and id=payment.order_id for update;

 -- Record Paystack's confirmed receipt before deciding what it means for the order.
 update public.payments set status='SUCCESS',provider_status='SUCCESS',
  provider_amount_subunit=paid_amount_subunit,
  provider_currency=upper(coalesce(paid_currency,'')),provider_fee_subunit=fee_subunit,
  provider_fee=case when fee_subunit is null then null else fee_subunit::numeric/100 end,
  paid_at=coalesce(paid_timestamp,now()),last_verified_at=now(),failure_code=null
 where id=payment.id;

 if payment.order_application_status='APPLIED' and order_row.payment_status='PAID' then
  return 'ALREADY_PROCESSED';
 end if;
 if payment.order_application_status in ('DUPLICATE','LATE_CANCELLED','REVIEW_REQUIRED') then
  return 'PROVIDER_SUCCESS_ALREADY_RECORDED';
 end if;
 if payment.amount_subunit<>paid_amount_subunit or payment.currency<>upper(coalesce(paid_currency,''))
   or order_row.payment_method<>'PAYSTACK' then
  update public.payments set order_application_status='REVIEW_REQUIRED',
   resolution_status='REVIEW_REQUIRED' where id=payment.id;
  outcome=case when payment.amount_subunit<>paid_amount_subunit then 'AMOUNT_MISMATCH_REVIEW'
   when payment.currency<>upper(coalesce(paid_currency,'')) then 'CURRENCY_MISMATCH_REVIEW'
   else 'PAYMENT_METHOD_MISMATCH_REVIEW' end;
 elsif order_row.payment_status='PAID' then
  update public.payments set order_application_status='DUPLICATE',
   resolution_status='REFUND_REQUIRED' where id=payment.id;
  outcome='DUPLICATE_PAYMENT_RECORDED';
 elsif order_row.payment_status='CANCELLED' or order_row.fulfillment_status='CANCELLED' then
  update public.payments set order_application_status='LATE_CANCELLED',
   resolution_status='REFUND_REQUIRED' where id=payment.id;
  outcome='LATE_PAYMENT_RECORDED';
 else
  update public.payments set order_application_status='APPLIED',resolution_status='NONE'
  where id=payment.id;
  update public.payments set order_application_status='SUPERSEDED'
  where order_id=order_row.id and tenant_id=order_row.tenant_id and id<>payment.id
   and order_application_status='PENDING';
  update public.orders set payment_status='PAID',paid_at=coalesce(paid_timestamp,now())
  where id=order_row.id and payment_status<>'PAID';
  outcome='PROCESSED';
 end if;

 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id)
 select payment.tenant_id,null,
  case outcome when 'PROCESSED' then 'PAYSTACK_PAYMENT_CONFIRMED'
   when 'DUPLICATE_PAYMENT_RECORDED' then 'PAYSTACK_DUPLICATE_PAYMENT_RECORDED'
   when 'LATE_PAYMENT_RECORDED' then 'PAYSTACK_LATE_PAYMENT_RECORDED'
   else 'PAYSTACK_PAYMENT_REVIEW_REQUIRED' end,
  'payments',payment.id
 where not exists(select 1 from public.audit_logs where tenant_id=payment.tenant_id
  and action=case outcome when 'PROCESSED' then 'PAYSTACK_PAYMENT_CONFIRMED'
   when 'DUPLICATE_PAYMENT_RECORDED' then 'PAYSTACK_DUPLICATE_PAYMENT_RECORDED'
   when 'LATE_PAYMENT_RECORDED' then 'PAYSTACK_LATE_PAYMENT_RECORDED'
   else 'PAYSTACK_PAYMENT_REVIEW_REQUIRED' end
  and resource_type='payments' and resource_id=payment.id);
 return outcome;
end;
$$;

create or replace function public.confirm_paystack_payment(
 provider_reference text,paid_amount_subunit bigint,paid_currency text,
 provider_status text,fee_subunit bigint,paid_timestamp timestamptz
) returns text language plpgsql security definer set search_path='' as $$
declare normalized text=lower(coalesce(provider_status,''));
begin
 if normalized<>'success' then
  update public.payments set provider_status=case normalized
    when 'failed' then 'FAILED' when 'abandoned' then 'ABANDONED'
    when 'reversed' then 'REVERSED' else 'PENDING' end,
   last_verified_at=now()
  where provider='PAYSTACK'
   and payments.provider_reference=confirm_paystack_payment.provider_reference;
  return 'NOT_SUCCESSFUL';
 end if;
 return private.apply_paystack_success(provider_reference,paid_amount_subunit,
  paid_currency,fee_subunit,paid_timestamp);
end;
$$;

alter table public.payment_webhook_events
 drop constraint payment_webhook_events_processing_status_check;
alter table public.payment_webhook_events
 alter column processed_at drop not null,
 alter column processed_at drop default,
 add column attempts integer not null default 0 check(attempts between 0 and 100),
 add column last_attempt_at timestamptz,
 add column next_retry_at timestamptz,
 add column paid_amount_subunit bigint,
 add column paid_currency text,
 add column provider_status text not null default '',
 add column fee_subunit bigint,
 add column paid_timestamp timestamptz,
 add constraint payment_webhook_events_processing_status_check
  check(processing_status in ('RECEIVED','PROCESSING','PROCESSED','IGNORED','FAILED','REJECTED')),
 add constraint payment_webhook_events_amount_check
  check(paid_amount_subunit is null or paid_amount_subunit>=0),
 add constraint payment_webhook_events_currency_check
  check(paid_currency is null or paid_currency='' or paid_currency~'^[A-Z]{3}$'),
 add constraint payment_webhook_events_fee_check check(fee_subunit is null or fee_subunit>=0);

update public.payment_webhook_events set attempts=1,last_attempt_at=processed_at;

create function public.receive_paystack_webhook(
 p_event_key text,p_event_type text,p_provider_reference text,p_paid_amount_subunit bigint,
 p_paid_currency text,p_provider_status text,p_fee_subunit bigint,p_paid_timestamp timestamptz,
 p_safe_metadata jsonb
) returns text language plpgsql security definer set search_path='' as $$
declare saved_payment uuid; target uuid; existing_status text;
begin
 if length(coalesce(p_event_key,'')) not between 1 and 200
   or length(coalesce(p_event_type,'')) not between 1 and 100
   or length(coalesce(p_provider_reference,''))>100
   or p_paid_amount_subunit<0 or p_fee_subunit<0
   or length(coalesce(p_paid_currency,''))>3 or length(coalesce(p_provider_status,''))>40
   or jsonb_typeof(coalesce(p_safe_metadata,'{}'::jsonb))<>'object'
   or octet_length(coalesce(p_safe_metadata,'{}'::jsonb)::text)>4096 then
  raise exception 'INVALID_WEBHOOK_EVENT' using errcode='22023';
 end if;
 select id,tenant_id into saved_payment,target from public.payments
  where provider='PAYSTACK' and payments.provider_reference=p_provider_reference;
 insert into public.payment_webhook_events(provider,event_key,event_type,provider_reference,
  tenant_id,payment_id,signature_verified,processing_status,safe_metadata,error_code,
  processed_at,paid_amount_subunit,paid_currency,provider_status,fee_subunit,paid_timestamp)
 values('PAYSTACK',p_event_key,p_event_type,coalesce(p_provider_reference,''),target,saved_payment,
  true,'RECEIVED',coalesce(p_safe_metadata,'{}'::jsonb),null,null,p_paid_amount_subunit,
  upper(coalesce(p_paid_currency,'')),lower(coalesce(p_provider_status,'')),p_fee_subunit,p_paid_timestamp)
 on conflict(provider,event_key) do nothing;
 if found then return 'RECEIVED'; end if;
 select processing_status into existing_status from public.payment_webhook_events
  where provider='PAYSTACK' and event_key=p_event_key;
 return coalesce(existing_status,'ALREADY_RECEIVED');
end;
$$;
revoke all on function public.receive_paystack_webhook(text,text,text,bigint,text,text,bigint,timestamptz,jsonb)
 from public,anon,authenticated;
grant execute on function public.receive_paystack_webhook(text,text,text,bigint,text,text,bigint,timestamptz,jsonb)
 to service_role;

create function public.claim_paystack_webhook(p_event_key text,p_force boolean default false)
returns text language plpgsql security definer set search_path='' as $$
declare event public.payment_webhook_events%rowtype;
begin
 select * into event from public.payment_webhook_events
 where provider='PAYSTACK' and event_key=p_event_key for update;
 if event.id is null then return 'EVENT_NOT_FOUND'; end if;
 if event.processing_status in ('PROCESSED','IGNORED','REJECTED') then return 'ALREADY_PROCESSED'; end if;
 if not p_force and event.processing_status='PROCESSING'
   and event.last_attempt_at>now()-interval '5 minutes' then return 'PROCESSING'; end if;
 if not p_force and event.processing_status='FAILED' and event.next_retry_at>now() then
  return 'RETRY_LATER';
 end if;
 update public.payment_webhook_events set processing_status='PROCESSING',
  attempts=least(attempts+1,100),last_attempt_at=now(),next_retry_at=null,error_code=null
 where id=event.id;
 return 'CLAIMED';
end;
$$;
revoke all on function public.claim_paystack_webhook(text,boolean) from public,anon,authenticated;
grant execute on function public.claim_paystack_webhook(text,boolean) to service_role;

create function public.process_stored_paystack_webhook(p_event_key text)
returns text language plpgsql security definer set search_path='' as $$
declare event public.payment_webhook_events%rowtype; result text; final_status text;
begin
 select * into event from public.payment_webhook_events
 where provider='PAYSTACK' and event_key=p_event_key for update;
 if event.id is null then return 'EVENT_NOT_FOUND'; end if;
 if event.processing_status<>'PROCESSING' then return 'EVENT_NOT_CLAIMED'; end if;
 if event.event_type='charge.success' and event.provider_status='success' then
  result=private.apply_paystack_success(event.provider_reference,event.paid_amount_subunit,
   event.paid_currency,event.fee_subunit,event.paid_timestamp);
 else result='EVENT_IGNORED'; end if;
 final_status=case when result='EVENT_IGNORED' then 'IGNORED'
  when result in ('PAYMENT_NOT_FOUND') then 'REJECTED' else 'PROCESSED' end;
 update public.payment_webhook_events set processing_status=final_status,
  processed_at=now(),next_retry_at=null,
  error_code=case when final_status='REJECTED' then left(result,100) else null end
 where id=event.id;
 return result;
end;
$$;
revoke all on function public.process_stored_paystack_webhook(text) from public,anon,authenticated;
grant execute on function public.process_stored_paystack_webhook(text) to service_role;

create function public.fail_paystack_webhook(p_event_key text,p_error_code text)
returns void language plpgsql security definer set search_path='' as $$
begin
 update public.payment_webhook_events set processing_status='FAILED',
  error_code=left(coalesce(nullif(p_error_code,''),'WEBHOOK_PROCESSING_FAILED'),100),
  next_retry_at=now()+make_interval(mins=>least(60,greatest(1,power(2,least(attempts,6))::integer)))
 where provider='PAYSTACK' and event_key=p_event_key and processing_status='PROCESSING';
end;
$$;
revoke all on function public.fail_paystack_webhook(text,text) from public,anon,authenticated;
grant execute on function public.fail_paystack_webhook(text,text) to service_role;

revoke execute on function public.process_paystack_webhook(text,text,text,bigint,text,text,bigint,timestamptz,jsonb)
 from service_role;
drop function public.process_paystack_webhook(text,text,text,bigint,text,text,bigint,timestamptz,jsonb);

create function public.get_paystack_retry_context(
 store_slug text,order_reference text,access_token uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 select jsonb_build_object('providerReference',payment.provider_reference,'status',payment.status,
  'providerStatus',payment.provider_status,'authorizationUrl',coalesce(payment.authorization_url,''),
  'createdAt',payment.created_at,'lastVerifiedAt',payment.last_verified_at)
 into result from public.tenants tenant
 join public.orders orders on orders.tenant_id=tenant.id
 join public.payments payment on payment.tenant_id=orders.tenant_id and payment.order_id=orders.id
 where tenant.slug=store_slug and tenant.status in ('TRIAL','ACTIVE')
  and orders.reference=order_reference and orders.customer_access_token=access_token
  and orders.payment_method='PAYSTACK' and orders.payment_status not in ('PAID','CANCELLED')
 order by payment.created_at desc limit 1;
 return result;
end;
$$;
revoke all on function public.get_paystack_retry_context(text,text,uuid) from public;
grant execute on function public.get_paystack_retry_context(text,text,uuid) to anon,authenticated;

create or replace function public.prepare_paystack_retry(
 store_slug text,order_reference text,access_token uuid
) returns text language plpgsql security definer set search_path='' as $$
declare target uuid; saved_order public.orders%rowtype; latest public.payments%rowtype;
 payment_reference text; can_retry boolean=false;
begin
 select t.id into target from public.tenants t where t.slug=store_slug and t.status in ('TRIAL','ACTIVE');
 select * into saved_order from public.orders where tenant_id=target and reference=order_reference
  and customer_access_token=access_token and payment_method='PAYSTACK' for update;
 if saved_order.id is null or saved_order.payment_status in ('PAID','CANCELLED') then
  raise exception 'ORDER_NOT_FOUND' using errcode='22023';
 end if;
 select * into latest from public.payments where tenant_id=target and order_id=saved_order.id
 order by created_at desc limit 1 for update;
 if (select count(*) from public.payments where tenant_id=target and order_id=saved_order.id)>=5 then
  raise exception 'PAYMENT_RETRY_UNAVAILABLE' using errcode='22023';
 end if;
 can_retry=(latest.provider_status in ('FAILED','ABANDONED','REVERSED')
   and latest.last_verified_at>now()-interval '5 minutes')
  or (latest.status='FAILED' and latest.created_at<now()-interval '2 minutes')
  or latest.created_at<now()-interval '30 minutes';
 if not can_retry then raise exception 'PAYMENT_RETRY_UNAVAILABLE' using errcode='22023'; end if;
 payment_reference='BCPAY-'||replace(gen_random_uuid()::text,'-','');
 insert into public.payments(tenant_id,order_id,provider,provider_reference,amount,amount_subunit,currency)
 values(target,saved_order.id,'PAYSTACK',payment_reference,saved_order.total,
  round(saved_order.total*100)::bigint,saved_order.currency);
 update public.orders set payment_status='PENDING' where id=saved_order.id;
 return payment_reference;
end;
$$;
