-- Durable, tenant-branded transactional email foundation.

alter table public.tenant_email_settings
 add column from_name text not null default '' check(length(from_name)<=100),
 add column from_email text not null default '' check(length(from_email)<=254),
 add column reply_to text not null default '' check(length(reply_to)<=254),
 add column custom_domain_status text not null default 'NOT_CONFIGURED'
   check(custom_domain_status in ('NOT_CONFIGURED','PENDING','VERIFIED','FAILED')),
 add column order_created_enabled boolean not null default true,
 add column payment_success_enabled boolean not null default true,
 add column order_ready_enabled boolean not null default true,
 add column order_shipped_enabled boolean not null default true,
 add column order_delivered_enabled boolean not null default true,
 add column marketing_enabled boolean not null default false,
 add column updated_at timestamptz not null default now();

create table private.email_notifications (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 order_id uuid references public.orders(id) on delete cascade,
 invitation_id uuid references public.tenant_invitations(id) on delete cascade,
 event_type text not null check(event_type in (
   'OWNER_INVITATION','ORDER_RECEIVED','PAYMENT_RECEIVED','ORDER_READY','ORDER_SHIPPED','ORDER_DELIVERED'
 )),
 recipient_email text not null check(length(recipient_email)<=254),
 recipient_name text not null default '' check(length(recipient_name)<=160),
 subject text not null check(length(subject) between 1 and 200),
 template_data jsonb not null default '{}'::jsonb,
 idempotency_key text not null unique check(length(idempotency_key) between 1 and 256),
 provider text not null default 'resend' check(provider='resend'),
 provider_message_id text unique,
 status text not null default 'QUEUED' check(status in (
   'QUEUED','SENDING','SENT','DELIVERED','FAILED','BOUNCED','COMPLAINED','CANCELLED'
 )),
 attempt_count integer not null default 0 check(attempt_count between 0 and 10),
 next_attempt_at timestamptz not null default now(),
 last_error_code text not null default '' check(length(last_error_code)<=100),
 last_attempt_at timestamptz,
 sent_at timestamptz,
 delivered_at timestamptz,
 bounced_at timestamptz,
 complained_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check((order_id is not null)::integer+(invitation_id is not null)::integer=1)
);
create unique index email_notifications_order_event_idx
 on private.email_notifications(order_id,event_type) where order_id is not null;
create index email_notifications_queue_idx
 on private.email_notifications(status,next_attempt_at,created_at)
 where status in ('QUEUED','FAILED');
create index email_notifications_tenant_idx
 on private.email_notifications(tenant_id,created_at desc);

create table private.email_webhook_events (
 event_id text primary key check(length(event_id) between 1 and 200),
 event_type text not null check(length(event_type) between 1 and 100),
 provider_message_id text not null check(length(provider_message_id) between 1 and 200),
 provider_created_at timestamptz,
 error_code text not null default '' check(length(error_code)<=100),
 received_at timestamptz not null default now()
);
create index email_webhook_events_message_idx
 on private.email_webhook_events(provider_message_id,received_at desc);

revoke all on private.email_notifications,private.email_webhook_events from public,anon,authenticated;

create function private.email_brand_snapshot(target_tenant uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'businessName',settings.business_name,
  'businessEmail',settings.contact_email,
  'storeSlug',tenants.slug,
  'logoUrl',coalesce(media.public_url_or_resolvable_key,''),
  'primaryColor',coalesce(theme.tokens->>'primary','#6655d7'),
  'backgroundColor',coalesce(theme.tokens->>'background','#ffffff'),
  'senderName',coalesce(nullif(email_settings.from_name,''),'Jeff from BusinessCare'),
  'replyTo',coalesce(nullif(email_settings.reply_to,''),settings.contact_email)
 )
 from public.tenants tenants
 join public.tenant_business_settings settings on settings.tenant_id=tenants.id
 join public.tenant_theme_settings theme on theme.tenant_id=tenants.id
 join public.tenant_email_settings email_settings on email_settings.tenant_id=tenants.id
 left join public.media_assets media
   on media.tenant_id=settings.tenant_id and media.id=settings.logo_asset_id
 where tenants.id=target_tenant;
$$;
revoke all on function private.email_brand_snapshot(uuid) from public;

create function private.queue_order_email() returns trigger
language plpgsql security definer set search_path='' as $$
declare settings public.tenant_email_settings%rowtype; selected_event text; selected_subject text;
 selected_enabled boolean; brand jsonb;
begin
 if tg_op='INSERT' then
  selected_event:='ORDER_RECEIVED';
 elsif new.payment_status='PAID' and old.payment_status<>'PAID' then
  selected_event:='PAYMENT_RECEIVED';
 elsif new.fulfillment_status='READY' and old.fulfillment_status<>'READY' then
  selected_event:='ORDER_READY';
 elsif new.fulfillment_status='SHIPPED' and old.fulfillment_status<>'SHIPPED' then
  selected_event:='ORDER_SHIPPED';
 elsif new.fulfillment_status='DELIVERED' and old.fulfillment_status<>'DELIVERED' then
  selected_event:='ORDER_DELIVERED';
 else return new;
 end if;
 select * into settings from public.tenant_email_settings where tenant_id=new.tenant_id;
 selected_enabled:=case selected_event
  when 'ORDER_RECEIVED' then settings.order_created_enabled
  when 'PAYMENT_RECEIVED' then settings.payment_success_enabled
  when 'ORDER_READY' then settings.order_ready_enabled
  when 'ORDER_SHIPPED' then settings.order_shipped_enabled
  when 'ORDER_DELIVERED' then settings.order_delivered_enabled else false end;
 if not coalesce(settings.enabled,false) or not coalesce(selected_enabled,false)
   or coalesce(trim(new.customer_email_snapshot),'')='' then return new; end if;
 brand:=private.email_brand_snapshot(new.tenant_id);
 selected_subject:=case selected_event
  when 'ORDER_RECEIVED' then 'We received order '||new.reference
  when 'PAYMENT_RECEIVED' then 'Payment received for '||new.reference
  when 'ORDER_READY' then 'Your order '||new.reference||' is ready'
  when 'ORDER_SHIPPED' then 'Your order '||new.reference||' is on its way'
  when 'ORDER_DELIVERED' then 'Order '||new.reference||' has been delivered' end;
 insert into private.email_notifications(
  tenant_id,order_id,event_type,recipient_email,recipient_name,subject,template_data,idempotency_key
 ) values(
  new.tenant_id,new.id,selected_event,lower(trim(new.customer_email_snapshot)),
  trim(new.customer_name_snapshot),selected_subject,brand,
  lower(selected_event)||'/'||new.id::text
 ) on conflict(order_id,event_type) where order_id is not null do nothing;
 return new;
end;
$$;
revoke all on function private.queue_order_email() from public;
create trigger orders_queue_transactional_email
after insert or update of payment_status,fulfillment_status on public.orders
for each row execute function private.queue_order_email();

create function public.save_tenant_email_settings(
 target_tenant uuid,email_enabled boolean,sender_name text,reply_address text,
 order_created boolean,payment_success boolean,order_ready boolean,order_shipped boolean,order_delivered boolean
) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid; normalized_reply text:=lower(trim(coalesce(reply_address,'')));
begin
 if not private.can_manage_orders(target_tenant) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if email_enabled is null or length(trim(coalesce(sender_name,'')))>100
   or length(normalized_reply)>254
   or (normalized_reply<>'' and normalized_reply!~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
   or order_created is null or payment_success is null or order_ready is null
   or order_shipped is null or order_delivered is null then
  raise exception 'INVALID_EMAIL_SETTINGS' using errcode='22023';
 end if;
 update public.tenant_email_settings set
  enabled=email_enabled,from_name=trim(coalesce(sender_name,'')),reply_to=normalized_reply,
  order_created_enabled=order_created,payment_success_enabled=payment_success,
  order_ready_enabled=order_ready,order_shipped_enabled=order_shipped,
  order_delivered_enabled=order_delivered,updated_at=now()
 where tenant_id=target_tenant;
 select id into actor from public.users where auth_user_id=auth.uid();
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id)
 values(target_tenant,actor,'EMAIL_SETTINGS_UPDATED','tenant_email_settings',target_tenant);
end;
$$;
revoke all on function public.save_tenant_email_settings(uuid,boolean,text,text,boolean,boolean,boolean,boolean,boolean) from public,anon;
grant execute on function public.save_tenant_email_settings(uuid,boolean,text,text,boolean,boolean,boolean,boolean,boolean) to authenticated;

create function public.queue_owner_invitation_email(target_invitation uuid,invitation_url text)
returns uuid language plpgsql security definer set search_path='' as $$
declare invitation public.tenant_invitations%rowtype; notification uuid; brand jsonb; digest text;
begin
 if (select auth.role())<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select * into invitation from public.tenant_invitations where id=target_invitation and status='PENDING';
 if invitation.id is null or length(invitation_url)>2000
   or invitation_url!~ '^https?://[^[:space:]]+$' then
  raise exception 'INVALID_INVITATION_EMAIL' using errcode='22023';
 end if;
 brand:=private.email_brand_snapshot(invitation.tenant_id)||jsonb_build_object('invitationUrl',invitation_url);
 digest:=left(encode(extensions.digest(invitation_url,'sha256'),'hex'),16);
 insert into private.email_notifications(
  tenant_id,invitation_id,event_type,recipient_email,recipient_name,subject,template_data,idempotency_key
 ) values(
  invitation.tenant_id,invitation.id,'OWNER_INVITATION',lower(trim(invitation.email)),
  trim(invitation.owner_name),'You are invited to manage '||(brand->>'businessName'),brand,
  'owner-invitation/'||invitation.id::text||'/'||digest
 ) returning id into notification;
 return notification;
end;
$$;
revoke all on function public.queue_owner_invitation_email(uuid,text) from public,anon,authenticated;
grant execute on function public.queue_owner_invitation_email(uuid,text) to service_role;

create function public.claim_email_notifications(batch_size integer default 10,target_tenant uuid default null)
returns table(notification_id uuid) language plpgsql security definer set search_path='' as $$
begin
 if (select auth.role())<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if batch_size not between 1 and 25 then raise exception 'INVALID_BATCH' using errcode='22023'; end if;
 return query with candidates as (
  select messages.id from private.email_notifications messages
  where messages.status in ('QUEUED','FAILED') and messages.attempt_count<5
   and messages.next_attempt_at<=now()
   and (claim_email_notifications.target_tenant is null or messages.tenant_id=claim_email_notifications.target_tenant)
  order by messages.next_attempt_at,messages.created_at
  for update skip locked limit batch_size
 ), claimed as (
  update private.email_notifications messages set status='SENDING',attempt_count=attempt_count+1,
   last_attempt_at=now(),updated_at=now()
  from candidates where messages.id=candidates.id returning messages.id
 ) select claimed.id from claimed;
end;
$$;
revoke all on function public.claim_email_notifications(integer,uuid) from public,anon,authenticated;
grant execute on function public.claim_email_notifications(integer,uuid) to service_role;

create function public.get_email_notification_context(target_notification uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if (select auth.role())<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select jsonb_build_object(
  'id',messages.id,'tenantId',messages.tenant_id,'orderId',messages.order_id,
  'eventType',messages.event_type,'recipientEmail',messages.recipient_email,
  'recipientName',messages.recipient_name,'subject',messages.subject,
  'templateData',messages.template_data,'idempotencyKey',messages.idempotency_key,
  'status',messages.status,'attemptCount',messages.attempt_count,
  'order',case when orders.id is null then null else jsonb_build_object(
    'reference',orders.reference,'subtotal',orders.subtotal,'deliveryFee',orders.delivery_fee,
    'total',orders.total,'currency',orders.currency,'deliveryMethod',orders.delivery_method_snapshot,
    'deliveryInstructions',orders.delivery_instructions_snapshot,
    'paymentMethod',orders.payment_method,'createdAt',orders.created_at
   ) end,
  'items',coalesce((select jsonb_agg(jsonb_build_object(
    'name',items.product_name_snapshot,'quantity',items.quantity,'unitPrice',items.unit_price,'lineTotal',items.line_total
   ) order by items.created_at) from public.order_items items
   where items.tenant_id=messages.tenant_id and items.order_id=messages.order_id),'[]'::jsonb)
 ) into result
 from private.email_notifications messages
 left join public.orders orders on orders.id=messages.order_id and orders.tenant_id=messages.tenant_id
 where messages.id=target_notification and messages.status='SENDING';
 return result;
end;
$$;
revoke all on function public.get_email_notification_context(uuid) from public,anon,authenticated;
grant execute on function public.get_email_notification_context(uuid) to service_role;

create function public.complete_email_notification(target_notification uuid,provider_id text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if (select auth.role())<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if provider_id is null or length(provider_id) not between 1 and 200 then
  raise exception 'INVALID_PROVIDER_ID' using errcode='22023'; end if;
 update private.email_notifications set status='SENT',provider_message_id=provider_id,
  sent_at=coalesce(sent_at,now()),next_attempt_at='infinity',last_error_code='',updated_at=now()
 where id=target_notification and status='SENDING';
 if not found then raise exception 'EMAIL_NOT_CLAIMED' using errcode='22023'; end if;
end;
$$;
revoke all on function public.complete_email_notification(uuid,text) from public,anon,authenticated;
grant execute on function public.complete_email_notification(uuid,text) to service_role;

create function public.fail_email_notification(target_notification uuid,failure_code text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if (select auth.role())<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 update private.email_notifications set status='FAILED',last_error_code=left(coalesce(failure_code,'UNKNOWN'),100),
  next_attempt_at=case when attempt_count>=5 then 'infinity'::timestamptz
   else now()+make_interval(mins=>least(360,cast(power(2,greatest(0,attempt_count-1)) as integer))) end,
  updated_at=now() where id=target_notification and status='SENDING';
end;
$$;
revoke all on function public.fail_email_notification(uuid,text) from public,anon,authenticated;
grant execute on function public.fail_email_notification(uuid,text) to service_role;

create function public.record_resend_webhook(
 webhook_event_id text,webhook_event_type text,provider_id text,event_timestamp timestamptz,error_reason text default ''
) returns text language plpgsql security definer set search_path='' as $$
begin
 if (select auth.role())<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if length(webhook_event_id) not between 1 and 200 or length(webhook_event_type) not between 1 and 100
   or length(provider_id) not between 1 and 200 then raise exception 'INVALID_WEBHOOK' using errcode='22023'; end if;
 insert into private.email_webhook_events(event_id,event_type,provider_message_id,provider_created_at,error_code)
 values(webhook_event_id,webhook_event_type,provider_id,event_timestamp,left(coalesce(error_reason,''),100))
 on conflict(event_id) do nothing;
 if not found then return 'ALREADY_PROCESSED'; end if;
 update private.email_notifications set
  status=case webhook_event_type
   when 'email.delivered' then 'DELIVERED'
   when 'email.bounced' then 'BOUNCED'
   when 'email.suppressed' then 'BOUNCED'
   when 'email.complained' then 'COMPLAINED'
   when 'email.failed' then 'FAILED'
   when 'email.sent' then case when status in ('DELIVERED','BOUNCED','COMPLAINED') then status else 'SENT' end
   else status end,
  delivered_at=case when webhook_event_type='email.delivered' then coalesce(event_timestamp,now()) else delivered_at end,
  bounced_at=case when webhook_event_type in ('email.bounced','email.suppressed') then coalesce(event_timestamp,now()) else bounced_at end,
  complained_at=case when webhook_event_type='email.complained' then coalesce(event_timestamp,now()) else complained_at end,
  last_error_code=case when webhook_event_type in ('email.failed','email.bounced','email.suppressed','email.delivery_delayed')
   then left(coalesce(error_reason,webhook_event_type),100) else last_error_code end,
  next_attempt_at=case when webhook_event_type='email.failed' then 'infinity'::timestamptz else next_attempt_at end,
  updated_at=now()
 where provider_message_id=provider_id;
 return case when found then 'PROCESSED' else 'UNKNOWN_EMAIL' end;
end;
$$;
revoke all on function public.record_resend_webhook(text,text,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.record_resend_webhook(text,text,text,timestamptz,text) to service_role;

create function public.get_tenant_email_logs(target_tenant uuid,result_limit integer default 30) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not private.can_manage_orders(target_tenant) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(row_to_json(logs) order by logs.created_at desc) from (
  select messages.id,messages.event_type,messages.status,messages.subject,
   left(split_part(messages.recipient_email,'@',1),1)||'***@'||split_part(messages.recipient_email,'@',2) recipient,
   messages.attempt_count,messages.last_error_code,messages.sent_at,messages.delivered_at,messages.created_at
  from private.email_notifications messages where messages.tenant_id=target_tenant
  order by messages.created_at desc limit least(greatest(result_limit,1),50)
 ) logs),'[]'::jsonb);
end;
$$;
revoke all on function public.get_tenant_email_logs(uuid,integer) from public,anon;
grant execute on function public.get_tenant_email_logs(uuid,integer) to authenticated;

create function public.get_platform_email_logs(result_limit integer default 75) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not private.is_super_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(row_to_json(logs) order by logs.created_at desc) from (
  select messages.id,messages.tenant_id,tenants.name business_name,messages.event_type,messages.status,
   messages.subject,left(split_part(messages.recipient_email,'@',1),1)||'***@'||split_part(messages.recipient_email,'@',2) recipient,
   messages.attempt_count,messages.last_error_code,messages.sent_at,messages.delivered_at,messages.created_at
  from private.email_notifications messages join public.tenants tenants on tenants.id=messages.tenant_id
  order by messages.created_at desc limit least(greatest(result_limit,1),100)
 ) logs),'[]'::jsonb);
end;
$$;
revoke all on function public.get_platform_email_logs(integer) from public,anon;
grant execute on function public.get_platform_email_logs(integer) to authenticated;

create function public.retry_email_notification(target_notification uuid) returns void
language plpgsql security definer set search_path='' as $$
declare target_tenant uuid;
begin
 if not private.is_super_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select tenant_id into target_tenant from private.email_notifications where id=target_notification
  and status='FAILED';
 if target_tenant is null then raise exception 'EMAIL_NOT_RETRYABLE' using errcode='22023'; end if;
 update private.email_notifications set status='QUEUED',attempt_count=0,next_attempt_at=now(),
  last_error_code='',updated_at=now() where id=target_notification;
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id)
 select target_tenant,users.id,'EMAIL_RETRY_REQUESTED','email_notifications',target_notification
 from public.users users where users.auth_user_id=auth.uid();
end;
$$;
revoke all on function public.retry_email_notification(uuid) from public,anon;
grant execute on function public.retry_email_notification(uuid) to authenticated;
