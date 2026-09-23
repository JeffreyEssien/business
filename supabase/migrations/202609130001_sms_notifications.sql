-- Tenant-branded transactional SMS, sender approval, delivery state, and usage.
alter table public.tenant_sms_settings
 add column requested_sender_id text not null default '',
 add column approved_sender_id text not null default '',
 add column sender_id_status text not null default 'NOT_REQUESTED'
   check(sender_id_status in ('NOT_REQUESTED','PENDING_REVIEW','PENDING_PROVIDER','APPROVED','REJECTED','REQUEST_FAILED')),
 add column sender_company_name text not null default '',
 add column sender_use_case text not null default '',
 add column sender_status_message text not null default '',
 add column order_created_enabled boolean not null default true,
 add column payment_success_enabled boolean not null default true,
 add column order_ready_enabled boolean not null default true,
 add column order_shipped_enabled boolean not null default true,
 add column order_delivered_enabled boolean not null default true,
 add column marketing_enabled boolean not null default false,
 add column sender_requested_at timestamptz,
 add column sender_approved_at timestamptz,
 add column updated_at timestamptz not null default now();

create unique index tenant_sms_sender_id_unique
 on public.tenant_sms_settings(upper(requested_sender_id)) where requested_sender_id<>'';

create table private.sms_notifications (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 order_id uuid not null,
 event_type text not null check(event_type in (
   'ORDER_RECEIVED','PAYMENT_RECEIVED','ORDER_READY','ORDER_SHIPPED','ORDER_DELIVERED'
 )),
 recipient_phone text not null check(recipient_phone~'^[1-9][0-9]{7,14}$'),
 sender_id text not null check(length(sender_id) between 3 and 11),
 message_text text not null check(length(message_text) between 1 and 320),
 idempotency_key text not null unique check(length(idempotency_key) between 1 and 256),
 provider text not null default 'termii' check(provider='termii'),
 provider_message_id text unique,
 status text not null default 'QUEUED' check(status in (
   'QUEUED','SENDING','SENT','DELIVERED','FAILED','DELIVERY_UNKNOWN','DND_BLOCKED','REJECTED','EXPIRED','CANCELLED'
 )),
 attempt_count integer not null default 0 check(attempt_count between 0 and 10),
 segment_count integer not null default 1 check(segment_count between 1 and 5),
 provider_cost numeric(14,4),
 provider_channel text not null default '',
 next_attempt_at timestamptz not null default now(),
 last_error_code text not null default '' check(length(last_error_code)<=100),
 last_attempt_at timestamptz,
 sent_at timestamptz,
 delivered_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(tenant_id,order_id) references public.orders(tenant_id,id) on delete cascade,
 unique(order_id,event_type)
);
create index sms_notifications_queue_idx
 on private.sms_notifications(status,next_attempt_at,created_at)
 where status in ('QUEUED','FAILED');
create index sms_notifications_tenant_idx
 on private.sms_notifications(tenant_id,created_at desc);

create table private.sms_webhook_events (
 event_key text primary key check(length(event_key) between 1 and 300),
 message_id text not null check(length(message_id) between 1 and 200),
 delivery_status text not null check(length(delivery_status) between 1 and 100),
 provider_sent_at timestamptz,
 received_at timestamptz not null default now()
);
create index sms_webhook_events_message_idx
 on private.sms_webhook_events(message_id,received_at desc);

revoke all on private.sms_notifications,private.sms_webhook_events from public,anon,authenticated;

create function private.tenant_has_sms_entitlement(target_tenant uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((features.value #>> '{}')::boolean,false)
 from public.tenants tenants
 join public.plan_features features on features.plan_id=tenants.plan_id
 where tenants.id=target_tenant and features.feature_key='sms_notifications'
   and jsonb_typeof(features.value)='boolean';
$$;
revoke all on function private.tenant_has_sms_entitlement(uuid) from public;

create function private.normalize_sms_phone(value text) returns text
language plpgsql immutable set search_path='' as $$
declare normalized text:=regexp_replace(coalesce(value,''),'[^0-9+]','','g');
begin
 if normalized like '+%' then normalized:=substr(normalized,2); end if;
 if normalized~'^0[789][01][0-9]{8}$' then normalized:='234'||substr(normalized,2); end if;
 if normalized!~'^[1-9][0-9]{7,14}$' then return ''; end if;
 return normalized;
end;
$$;
revoke all on function private.normalize_sms_phone(text) from public;

create function private.sms_message_for_order(selected_event text,target_order public.orders)
returns text language plpgsql stable set search_path='' as $$
declare business_label text;
begin
 select settings.business_name into business_label from public.tenant_business_settings settings
 where tenant_id=target_order.tenant_id;
 return case selected_event
  when 'ORDER_RECEIVED' then business_label||': We received order '||target_order.reference||'. We will keep you updated.'
  when 'PAYMENT_RECEIVED' then business_label||': Payment received for order '||target_order.reference||'. Thank you.'
  when 'ORDER_READY' then business_label||': Order '||target_order.reference||' is ready for '||target_order.delivery_method_snapshot||'.'
  when 'ORDER_SHIPPED' then business_label||': Order '||target_order.reference||' is on the way.'
  when 'ORDER_DELIVERED' then business_label||': Order '||target_order.reference||' has been delivered. Thank you for choosing us.'
 end;
end;
$$;
revoke all on function private.sms_message_for_order(text,public.orders) from public;

create function private.queue_order_sms() returns trigger
language plpgsql security definer set search_path='' as $$
declare settings public.tenant_sms_settings%rowtype; selected_event text;
 selected_enabled boolean; normalized_phone text; message_body text; segments integer;
begin
 if tg_op='INSERT' then selected_event:='ORDER_RECEIVED';
 elsif new.payment_status='PAID' and old.payment_status<>'PAID' then selected_event:='PAYMENT_RECEIVED';
 elsif new.fulfillment_status='READY' and old.fulfillment_status<>'READY' then selected_event:='ORDER_READY';
 elsif new.fulfillment_status='SHIPPED' and old.fulfillment_status<>'SHIPPED' then selected_event:='ORDER_SHIPPED';
 elsif new.fulfillment_status='DELIVERED' and old.fulfillment_status<>'DELIVERED' then selected_event:='ORDER_DELIVERED';
 else return new;
 end if;
 select * into settings from public.tenant_sms_settings where tenant_id=new.tenant_id;
 selected_enabled:=case selected_event
  when 'ORDER_RECEIVED' then settings.order_created_enabled
  when 'PAYMENT_RECEIVED' then settings.payment_success_enabled
  when 'ORDER_READY' then settings.order_ready_enabled
  when 'ORDER_SHIPPED' then settings.order_shipped_enabled
  when 'ORDER_DELIVERED' then settings.order_delivered_enabled else false end;
 normalized_phone:=private.normalize_sms_phone(new.customer_phone_snapshot);
 if not coalesce(settings.enabled,false) or not coalesce(selected_enabled,false)
   or settings.sender_id_status<>'APPROVED' or settings.approved_sender_id=''
   or not coalesce(private.tenant_has_sms_entitlement(new.tenant_id),false)
   or normalized_phone='' then return new; end if;
 message_body:=private.sms_message_for_order(selected_event,new);
 segments:=case when message_body~'^[ -~]*$' then
   case when length(message_body)<=160 then 1 else ceil(length(message_body)/153.0)::integer end
  else case when length(message_body)<=70 then 1 else ceil(length(message_body)/67.0)::integer end end;
 insert into private.sms_notifications(
  tenant_id,order_id,event_type,recipient_phone,sender_id,message_text,idempotency_key,segment_count
 ) values(
  new.tenant_id,new.id,selected_event,normalized_phone,settings.approved_sender_id,
  left(message_body,320),lower(selected_event)||'/'||new.id::text,least(segments,5)
 ) on conflict(order_id,event_type) do nothing;
 return new;
end;
$$;
revoke all on function private.queue_order_sms() from public;
create trigger orders_queue_transactional_sms
after insert or update of payment_status,fulfillment_status on public.orders
for each row execute function private.queue_order_sms();

create function public.request_tenant_sms_sender(
 target_tenant uuid,sender_id text,company_name text,use_case text
) returns void language plpgsql security definer set search_path='' as $$
declare normalized_sender text:=upper(trim(coalesce(sender_id,''))); actor uuid;
begin
 if not private.can_manage_orders(target_tenant) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if not coalesce(private.tenant_has_sms_entitlement(target_tenant),false) then
  raise exception 'SMS_NOT_INCLUDED' using errcode='42501'; end if;
 if length(normalized_sender) not between 3 and 11 or normalized_sender!~'^[A-Z0-9 ]+$'
   or normalized_sender!~'[A-Z]' or length(trim(coalesce(company_name,''))) not between 2 and 160
   or length(trim(coalesce(use_case,''))) not between 10 and 320 then
  raise exception 'INVALID_SMS_SENDER_REQUEST' using errcode='22023'; end if;
 update public.tenant_sms_settings set requested_sender_id=normalized_sender,
  approved_sender_id='',sender_id_status='PENDING_REVIEW',sender_company_name=trim(company_name),
  sender_use_case=trim(use_case),sender_status_message='',enabled=false,
  sender_requested_at=now(),sender_approved_at=null,updated_at=now()
 where tenant_id=target_tenant and sender_id_status in ('NOT_REQUESTED','REJECTED','REQUEST_FAILED');
 if not found then raise exception 'SMS_SENDER_REQUEST_UNAVAILABLE' using errcode='22023'; end if;
 select id into actor from public.users where auth_user_id=auth.uid();
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id)
 values(target_tenant,actor,'SMS_SENDER_REQUESTED','tenant_sms_settings',target_tenant);
exception when unique_violation then
 raise exception 'SMS_SENDER_ALREADY_USED' using errcode='23505';
end;
$$;
revoke all on function public.request_tenant_sms_sender(uuid,text,text,text) from public,anon;
grant execute on function public.request_tenant_sms_sender(uuid,text,text,text) to authenticated;

create function public.submit_sms_sender_request(target_tenant uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare settings public.tenant_sms_settings%rowtype; actor uuid;
begin
 if not private.is_super_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select * into settings from public.tenant_sms_settings where tenant_id=target_tenant for update;
 if settings.sender_id_status<>'PENDING_REVIEW' then
  raise exception 'SMS_SENDER_NOT_READY_FOR_SUBMISSION' using errcode='22023'; end if;
 update public.tenant_sms_settings set sender_id_status='PENDING_PROVIDER',
  sender_status_message='',updated_at=now() where tenant_id=target_tenant;
 select id into actor from public.users where auth_user_id=auth.uid();
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id)
 values(target_tenant,actor,'SMS_SENDER_SUBMITTED','tenant_sms_settings',target_tenant);
 return jsonb_build_object('tenantId',target_tenant,'senderId',settings.requested_sender_id,
  'companyName',settings.sender_company_name,'useCase',settings.sender_use_case);
end;
$$;
revoke all on function public.submit_sms_sender_request(uuid) from public,anon;
grant execute on function public.submit_sms_sender_request(uuid) to authenticated;

create function public.record_sms_sender_request_failure(target_tenant uuid,failure_code text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if (select auth.role())<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 update public.tenant_sms_settings set sender_id_status='REQUEST_FAILED',enabled=false,
  sender_status_message=left(coalesce(failure_code,'REQUEST_FAILED'),160),updated_at=now()
 where tenant_id=target_tenant and sender_id_status='PENDING_PROVIDER';
end;
$$;
revoke all on function public.record_sms_sender_request_failure(uuid,text) from public,anon,authenticated;
grant execute on function public.record_sms_sender_request_failure(uuid,text) to service_role;

create function public.sync_sms_sender_status(
 target_tenant uuid,provider_status text,status_message text default ''
) returns void language plpgsql security definer set search_path='' as $$
declare normalized_status text:=upper(trim(coalesce(provider_status,'')));
begin
 if (select auth.role())<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if normalized_status not in ('PENDING','APPROVED','REJECTED') then
  raise exception 'INVALID_SMS_SENDER_STATUS' using errcode='22023'; end if;
 update public.tenant_sms_settings set sender_id_status=normalized_status,
  approved_sender_id=case when normalized_status='APPROVED' then requested_sender_id else '' end,
  enabled=case when normalized_status='APPROVED' then enabled else false end,
  sender_status_message=left(coalesce(status_message,''),160),
  sender_approved_at=case when normalized_status='APPROVED' then coalesce(sender_approved_at,now()) else null end,
  updated_at=now() where tenant_id=target_tenant and sender_id_status in ('PENDING_PROVIDER','APPROVED');
end;
$$;
revoke all on function public.sync_sms_sender_status(uuid,text,text) from public,anon,authenticated;
grant execute on function public.sync_sms_sender_status(uuid,text,text) to service_role;

create function public.save_tenant_sms_settings(
 target_tenant uuid,sms_enabled boolean,order_created boolean,payment_success boolean,
 order_ready boolean,order_shipped boolean,order_delivered boolean
) returns void language plpgsql security definer set search_path='' as $$
declare settings public.tenant_sms_settings%rowtype; actor uuid;
begin
 if not private.can_manage_orders(target_tenant) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if sms_enabled is null or order_created is null or payment_success is null or order_ready is null
   or order_shipped is null or order_delivered is null then
  raise exception 'INVALID_SMS_SETTINGS' using errcode='22023'; end if;
 select * into settings from public.tenant_sms_settings where tenant_id=target_tenant for update;
 if sms_enabled and not coalesce(private.tenant_has_sms_entitlement(target_tenant),false) then
  raise exception 'SMS_NOT_INCLUDED' using errcode='42501'; end if;
 if sms_enabled and (settings.sender_id_status<>'APPROVED' or settings.approved_sender_id='') then
  raise exception 'SMS_SENDER_NOT_APPROVED' using errcode='22023'; end if;
 update public.tenant_sms_settings set enabled=sms_enabled,
  order_created_enabled=order_created,payment_success_enabled=payment_success,
  order_ready_enabled=order_ready,order_shipped_enabled=order_shipped,
  order_delivered_enabled=order_delivered,updated_at=now() where tenant_id=target_tenant;
 select id into actor from public.users where auth_user_id=auth.uid();
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id)
 values(target_tenant,actor,'SMS_SETTINGS_UPDATED','tenant_sms_settings',target_tenant);
end;
$$;
revoke all on function public.save_tenant_sms_settings(uuid,boolean,boolean,boolean,boolean,boolean,boolean) from public,anon;
grant execute on function public.save_tenant_sms_settings(uuid,boolean,boolean,boolean,boolean,boolean,boolean) to authenticated;

create function public.claim_sms_notifications(batch_size integer default 10,target_tenant uuid default null)
returns table(notification_id uuid) language plpgsql security definer set search_path='' as $$
begin
 if (select auth.role())<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if batch_size not between 1 and 25 then raise exception 'INVALID_BATCH' using errcode='22023'; end if;
 return query with candidates as (
  select messages.id from private.sms_notifications messages
  where messages.status in ('QUEUED','FAILED') and messages.attempt_count<5
   and messages.next_attempt_at<=now()
   and (claim_sms_notifications.target_tenant is null or messages.tenant_id=claim_sms_notifications.target_tenant)
  order by messages.next_attempt_at,messages.created_at for update skip locked limit batch_size
 ), claimed as (
  update private.sms_notifications messages set status='SENDING',attempt_count=attempt_count+1,
   last_attempt_at=now(),updated_at=now() from candidates
  where messages.id=candidates.id returning messages.id
 ) select claimed.id from claimed;
end;
$$;
revoke all on function public.claim_sms_notifications(integer,uuid) from public,anon,authenticated;
grant execute on function public.claim_sms_notifications(integer,uuid) to service_role;

create function public.get_sms_notification_context(target_notification uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if (select auth.role())<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select jsonb_build_object(
  'id',messages.id,'tenantId',messages.tenant_id,'orderId',messages.order_id,
  'eventType',messages.event_type,'recipientPhone',messages.recipient_phone,
  'senderId',messages.sender_id,'message',messages.message_text,
  'idempotencyKey',messages.idempotency_key,'status',messages.status,
  'attemptCount',messages.attempt_count,'segmentCount',messages.segment_count
 ) into result from private.sms_notifications messages
 where messages.id=target_notification and messages.status='SENDING';
 return result;
end;
$$;
revoke all on function public.get_sms_notification_context(uuid) from public,anon,authenticated;
grant execute on function public.get_sms_notification_context(uuid) to service_role;

create function public.complete_sms_notification(target_notification uuid,provider_id text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if (select auth.role())<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if provider_id is null or length(provider_id) not between 1 and 200 then
  raise exception 'INVALID_PROVIDER_ID' using errcode='22023'; end if;
 update private.sms_notifications set status='SENT',provider_message_id=provider_id,
  sent_at=coalesce(sent_at,now()),next_attempt_at='infinity',last_error_code='',updated_at=now()
 where id=target_notification and status='SENDING';
 if not found then raise exception 'SMS_NOT_CLAIMED' using errcode='22023'; end if;
end;
$$;
revoke all on function public.complete_sms_notification(uuid,text) from public,anon,authenticated;
grant execute on function public.complete_sms_notification(uuid,text) to service_role;

create function public.fail_sms_notification(
 target_notification uuid,failure_code text,retryable boolean,delivery_unknown boolean
)
returns void language plpgsql security definer set search_path='' as $$
begin
 if (select auth.role())<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 update private.sms_notifications set
  status=case when coalesce(retryable,false) then 'FAILED'
   when coalesce(delivery_unknown,false) then 'DELIVERY_UNKNOWN' else 'REJECTED' end,
  last_error_code=left(coalesce(failure_code,'UNKNOWN'),100),
  next_attempt_at=case when coalesce(retryable,false) and attempt_count<5
   then now()+make_interval(mins=>least(360,cast(power(2,greatest(0,attempt_count-1)) as integer)))
   else 'infinity'::timestamptz end,updated_at=now()
 where id=target_notification and status='SENDING';
end;
$$;
revoke all on function public.fail_sms_notification(uuid,text,boolean,boolean) from public,anon,authenticated;
grant execute on function public.fail_sms_notification(uuid,text,boolean,boolean) to service_role;

create function public.record_termii_sms_webhook(
 webhook_event_key text,provider_id text,delivery_state text,event_timestamp timestamptz,
 delivery_cost numeric default null,delivery_channel text default ''
) returns text language plpgsql security definer set search_path='' as $$
declare normalized_status text:=upper(trim(coalesce(delivery_state,''))); mapped_status text;
begin
 if (select auth.role())<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if length(webhook_event_key) not between 1 and 300 or length(provider_id) not between 1 and 200
   or length(normalized_status) not between 1 and 100 or delivery_cost<0 then
  raise exception 'INVALID_WEBHOOK' using errcode='22023'; end if;
 insert into private.sms_webhook_events(event_key,message_id,delivery_status,provider_sent_at)
 values(webhook_event_key,provider_id,normalized_status,event_timestamp)
 on conflict(event_key) do nothing;
 if not found then return 'ALREADY_PROCESSED'; end if;
 mapped_status:=case
  when normalized_status in ('DELIVERED','DELIVERY SUCCESSFUL') then 'DELIVERED'
  when normalized_status in ('DND ACTIVE ON PHONE NUMBER','REJECTED') then 'DND_BLOCKED'
  when normalized_status in ('EXPIRED') then 'EXPIRED'
  when normalized_status in ('MESSAGE FAILED','FAILED') then 'FAILED'
  when normalized_status in ('MESSAGE SENT','SENT') then 'SENT'
  else null end;
 update private.sms_notifications set
  status=case when status='DELIVERED' then status else coalesce(mapped_status,status) end,
  provider_cost=coalesce(delivery_cost,provider_cost),
  provider_channel=left(coalesce(delivery_channel,''),40),
  delivered_at=case when mapped_status='DELIVERED' then coalesce(event_timestamp,now()) else delivered_at end,
  last_error_code=case when mapped_status in ('FAILED','DND_BLOCKED','EXPIRED') then normalized_status else last_error_code end,
  next_attempt_at=case when mapped_status in ('FAILED','DND_BLOCKED','EXPIRED') then 'infinity'::timestamptz else next_attempt_at end,
  updated_at=now() where provider_message_id=provider_id;
 return case when found then 'PROCESSED' else 'UNKNOWN_SMS' end;
end;
$$;
revoke all on function public.record_termii_sms_webhook(text,text,text,timestamptz,numeric,text) from public,anon,authenticated;
grant execute on function public.record_termii_sms_webhook(text,text,text,timestamptz,numeric,text) to service_role;

create function public.get_tenant_sms_logs(target_tenant uuid,result_limit integer default 30) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not private.can_manage_orders(target_tenant) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(row_to_json(logs) order by logs.created_at desc) from (
  select messages.id,messages.event_type,messages.status,messages.sender_id,
   left(messages.recipient_phone,4)||repeat('*',greatest(length(messages.recipient_phone)-7,3))||right(messages.recipient_phone,3) recipient,
   messages.segment_count,messages.provider_cost,messages.attempt_count,messages.last_error_code,
   messages.sent_at,messages.delivered_at,messages.created_at
  from private.sms_notifications messages where messages.tenant_id=target_tenant
  order by messages.created_at desc limit least(greatest(result_limit,1),50)
 ) logs),'[]'::jsonb);
end;
$$;
revoke all on function public.get_tenant_sms_logs(uuid,integer) from public,anon;
grant execute on function public.get_tenant_sms_logs(uuid,integer) to authenticated;

create function public.get_platform_sms_logs(result_limit integer default 75) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not private.is_super_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(row_to_json(logs) order by logs.created_at desc) from (
  select messages.id,messages.tenant_id,tenants.name business_name,messages.event_type,
   messages.status,messages.sender_id,
   left(messages.recipient_phone,4)||repeat('*',greatest(length(messages.recipient_phone)-7,3))||right(messages.recipient_phone,3) recipient,
   messages.segment_count,messages.provider_cost,messages.attempt_count,messages.last_error_code,
   messages.sent_at,messages.delivered_at,messages.created_at
  from private.sms_notifications messages join public.tenants tenants on tenants.id=messages.tenant_id
  order by messages.created_at desc limit least(greatest(result_limit,1),100)
 ) logs),'[]'::jsonb);
end;
$$;
revoke all on function public.get_platform_sms_logs(integer) from public,anon;
grant execute on function public.get_platform_sms_logs(integer) to authenticated;

create function public.get_platform_sms_sender_requests(result_limit integer default 75) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not private.is_super_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(row_to_json(requests) order by requests.updated_at desc) from (
  select settings.tenant_id,tenants.name business_name,settings.requested_sender_id,
   settings.sender_id_status,settings.sender_company_name,settings.sender_use_case,
   settings.sender_status_message,settings.sender_requested_at,settings.sender_approved_at,
   settings.updated_at from public.tenant_sms_settings settings
  join public.tenants tenants on tenants.id=settings.tenant_id
  where settings.sender_id_status<>'NOT_REQUESTED'
  order by settings.updated_at desc limit least(greatest(result_limit,1),100)
 ) requests),'[]'::jsonb);
end;
$$;
revoke all on function public.get_platform_sms_sender_requests(integer) from public,anon;
grant execute on function public.get_platform_sms_sender_requests(integer) to authenticated;

create function public.retry_sms_notification(target_notification uuid) returns void
language plpgsql security definer set search_path='' as $$
declare target_tenant uuid;
begin
 if not private.is_super_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select tenant_id into target_tenant from private.sms_notifications where id=target_notification
  and status='FAILED';
 if target_tenant is null then raise exception 'SMS_NOT_RETRYABLE' using errcode='22023'; end if;
 update private.sms_notifications set status='QUEUED',attempt_count=0,next_attempt_at=now(),
  last_error_code='',updated_at=now() where id=target_notification;
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id)
 select target_tenant,users.id,'SMS_RETRY_REQUESTED','sms_notifications',target_notification
 from public.users users where users.auth_user_id=auth.uid();
end;
$$;
revoke all on function public.retry_sms_notification(uuid) from public,anon;
grant execute on function public.retry_sms_notification(uuid) to authenticated;
