-- Complete the sender review lifecycle without changing the applied SMS foundation.
create or replace function public.sync_sms_sender_status(
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
  updated_at=now()
 where tenant_id=target_tenant
   and sender_id_status in ('PENDING_PROVIDER','REQUEST_FAILED','APPROVED');
end;
$$;
revoke all on function public.sync_sms_sender_status(uuid,text,text) from public,anon,authenticated;
grant execute on function public.sync_sms_sender_status(uuid,text,text) to service_role;

create function public.reject_sms_sender_request(target_tenant uuid) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
 if not private.is_super_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 update public.tenant_sms_settings set sender_id_status='REJECTED',approved_sender_id='',enabled=false,
  sender_status_message='BusinessCare could not confirm this sender name. Review the business details and submit again.',
  sender_approved_at=null,updated_at=now()
 where tenant_id=target_tenant and sender_id_status='PENDING_REVIEW';
 if not found then raise exception 'SMS_SENDER_NOT_READY_FOR_REJECTION' using errcode='22023'; end if;
 select id into actor from public.users where auth_user_id=auth.uid();
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id)
 values(target_tenant,actor,'SMS_SENDER_REJECTED','tenant_sms_settings',target_tenant);
end;
$$;
revoke all on function public.reject_sms_sender_request(uuid) from public,anon;
grant execute on function public.reject_sms_sender_request(uuid) to authenticated;
