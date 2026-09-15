-- Recover abandoned communication claims without risking duplicate SMS sends.
-- Email is safe to retry with Resend's provider-side idempotency key. Termii's
-- SMS endpoint has no equivalent, so an abandoned send is quarantined for review.

create or replace function public.claim_email_notifications(
 batch_size integer default 10,target_tenant uuid default null
)
returns table(notification_id uuid) language plpgsql security definer set search_path='' as $$
begin
 if (select auth.role())<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if batch_size not between 1 and 25 then raise exception 'INVALID_BATCH' using errcode='22023'; end if;

 update private.email_notifications messages set status='FAILED',
  next_attempt_at=now(),last_error_code='EMAIL_STALE_CLAIM_RECOVERED',updated_at=now()
 where messages.status='SENDING' and messages.last_attempt_at<now()-interval '15 minutes'
  and (claim_email_notifications.target_tenant is null
   or messages.tenant_id=claim_email_notifications.target_tenant);

 return query with candidates as (
  select messages.id from private.email_notifications messages
  where messages.status in ('QUEUED','FAILED') and messages.attempt_count<5
   and messages.next_attempt_at<=now()
   and (claim_email_notifications.target_tenant is null
    or messages.tenant_id=claim_email_notifications.target_tenant)
  order by messages.next_attempt_at,messages.created_at
  for update skip locked limit batch_size
 ), claimed as (
  update private.email_notifications messages set status='SENDING',attempt_count=attempt_count+1,
   last_attempt_at=now(),updated_at=now()
  from candidates where messages.id=candidates.id returning messages.id
 ) select claimed.id from claimed;
end;
$$;

create or replace function public.claim_sms_notifications(
 batch_size integer default 10,target_tenant uuid default null
)
returns table(notification_id uuid) language plpgsql security definer set search_path='' as $$
begin
 if (select auth.role())<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if batch_size not between 1 and 25 then raise exception 'INVALID_BATCH' using errcode='22023'; end if;

 update private.sms_notifications messages set status='DELIVERY_UNKNOWN',
  next_attempt_at='infinity',last_error_code='SMS_STALE_CLAIM_DELIVERY_UNKNOWN',updated_at=now()
 where messages.status='SENDING' and messages.last_attempt_at<now()-interval '15 minutes'
  and (claim_sms_notifications.target_tenant is null
   or messages.tenant_id=claim_sms_notifications.target_tenant);

 return query with candidates as (
  select messages.id from private.sms_notifications messages
  where messages.status in ('QUEUED','FAILED') and messages.attempt_count<5
   and messages.next_attempt_at<=now()
   and (claim_sms_notifications.target_tenant is null
    or messages.tenant_id=claim_sms_notifications.target_tenant)
  order by messages.next_attempt_at,messages.created_at for update skip locked limit batch_size
 ), claimed as (
  update private.sms_notifications messages set status='SENDING',attempt_count=attempt_count+1,
   last_attempt_at=now(),updated_at=now() from candidates
  where messages.id=candidates.id returning messages.id
 ) select claimed.id from claimed;
end;
$$;

create or replace function public.fail_email_notification(target_notification uuid,failure_code text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if (select auth.role())<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 update private.email_notifications set status='FAILED',last_error_code=left(coalesce(failure_code,'UNKNOWN'),100),
  next_attempt_at=case when attempt_count>=5 then 'infinity'::timestamptz
   else now()+make_interval(mins=>least(360,cast(power(2,greatest(0,attempt_count-1)) as integer))) end,
  updated_at=now() where id=target_notification and status='SENDING';
 if not found then raise exception 'EMAIL_NOT_CLAIMED' using errcode='22023'; end if;
end;
$$;

create or replace function public.fail_sms_notification(
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
 if not found then raise exception 'SMS_NOT_CLAIMED' using errcode='22023'; end if;
end;
$$;
