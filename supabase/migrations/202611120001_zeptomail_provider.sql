-- ZeptoMail (Zoho) as a second transactional email provider beside Resend.
-- The queue, retries, and webhook state machine are provider-neutral; this
-- records which provider accepted each message and adds a neutral webhook RPC.
--
-- Retry note: Resend deduplicates on our idempotency key. ZeptoMail has no
-- equivalent, so an email reclaimed after a worker crash between "accepted by
-- ZeptoMail" and "marked SENT" can be delivered twice. That window is a single
-- crashed request; a duplicate receipt is accepted rather than quarantining
-- every stale claim for manual review (which SMS does because texts cost money).

alter table private.email_notifications
 drop constraint if exists email_notifications_provider_check;
alter table private.email_notifications
 add constraint email_notifications_provider_check check(provider in ('resend','zeptomail'));

drop function if exists public.complete_email_notification(uuid,text);
create function public.complete_email_notification(
 target_notification uuid,provider_id text,provider_name text default 'resend'
)
returns void language plpgsql security definer set search_path='' as $$
begin
 if (select auth.role())<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if provider_id is null or length(provider_id) not between 1 and 200 then
  raise exception 'INVALID_PROVIDER_ID' using errcode='22023'; end if;
 if provider_name is null or provider_name not in ('resend','zeptomail') then
  raise exception 'INVALID_PROVIDER' using errcode='22023'; end if;
 update private.email_notifications set status='SENT',provider=provider_name,provider_message_id=provider_id,
  sent_at=coalesce(sent_at,now()),next_attempt_at='infinity',last_error_code='',updated_at=now()
 where id=target_notification and status='SENDING';
 if not found then raise exception 'EMAIL_NOT_CLAIMED' using errcode='22023'; end if;
end;
$$;
revoke all on function public.complete_email_notification(uuid,text,text) from public,anon,authenticated;
grant execute on function public.complete_email_notification(uuid,text,text) to service_role;

-- Provider-neutral name for webhook processing. Callers normalise provider
-- events to the email.* names that record_resend_webhook already understands.
create or replace function public.record_email_webhook(
 webhook_event_id text,webhook_event_type text,provider_id text,event_timestamp timestamptz,error_reason text default ''
) returns text language plpgsql security definer set search_path='' as $$
begin
 if (select auth.role())<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 return public.record_resend_webhook(webhook_event_id,webhook_event_type,provider_id,event_timestamp,error_reason);
end;
$$;
revoke all on function public.record_email_webhook(text,text,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.record_email_webhook(text,text,text,timestamptz,text) to service_role;
