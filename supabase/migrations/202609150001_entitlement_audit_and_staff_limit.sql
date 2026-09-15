-- Complete Phase 9 entitlement semantics without changing already-applied migrations:
-- audit before/after values, keep emergency shutdowns Boolean-only, and enforce
-- the staff allowance at the membership-growth boundary that currently exists.

comment on table public.feature_global_state is
 'Boolean feature emergency shutdowns. Numeric, string, and JSON entitlements are not global-state values.';

create or replace function private.get_effective_feature(target_tenant uuid,target_feature text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare resolved jsonb; default_value jsonb; feature_type text; globally_enabled boolean;
begin
 select f.default_value,f.value_type,g.enabled
 into default_value,feature_type,globally_enabled
 from public.features f
 left join public.feature_global_state g on g.feature_key=f.key
 where f.key=target_feature and f.is_active;
 if default_value is null or feature_type is null then return null; end if;
 if feature_type='BOOLEAN' and globally_enabled is false then return 'false'::jsonb; end if;
 select o.value into resolved from public.tenant_feature_overrides o
 where o.tenant_id=target_tenant and o.feature_key=target_feature
  and (o.expires_at is null or o.expires_at>now());
 if found then return resolved; end if;
 select pf.value into resolved
 from public.subscriptions s join public.plan_features pf on pf.plan_id=s.plan_id
 where s.tenant_id=target_tenant and pf.feature_key=target_feature;
 return case when found then resolved else default_value end;
end;
$$;

create or replace function public.save_plan_feature(
 target_plan text,target_feature text,new_value jsonb,value_is_unlimited boolean default false
)
returns void language plpgsql security definer set search_path='' as $$
declare plan uuid; feature_type text; actor uuid; old_value jsonb;
begin
 if not private.is_super_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select id into plan from public.plans where slug=target_plan for update;
 select value_type into feature_type from public.features where key=target_feature and is_active;
 if value_is_unlimited and feature_type='INTEGER' then new_value='null'::jsonb; end if;
 if plan is null or feature_type is null or not private.feature_value_is_valid(feature_type,new_value) then
  raise exception 'INVALID_FEATURE_VALUE' using errcode='22023';
 end if;
 select value into old_value from public.plan_features
 where plan_id=plan and feature_key=target_feature;
 insert into public.plan_features(plan_id,feature_key,value) values(plan,target_feature,new_value)
 on conflict(plan_id,feature_key) do update set value=excluded.value;
 select id into actor from public.users where auth_user_id=auth.uid();
 insert into public.audit_logs(actor_user_id,action,resource_type,resource_id,context)
 values(actor,'PLAN_FEATURE_UPDATED','plan_features',plan,jsonb_build_object(
  'planSlug',target_plan,'featureKey',target_feature,'oldValue',old_value,'newValue',new_value
 ));
end;
$$;

create or replace function public.save_tenant_feature_override(
 target_tenant uuid,target_feature text,new_value jsonb,override_reason text,
 override_expires_at timestamptz,value_is_unlimited boolean default false
) returns void language plpgsql security definer set search_path='' as $$
declare feature_type text; actor uuid; locked_tenant uuid; old_value jsonb; old_expires_at timestamptz;
begin
 if not private.is_super_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select id into locked_tenant from public.tenants where id=target_tenant for update;
 if locked_tenant is null then
  raise exception 'TENANT_NOT_FOUND' using errcode='22023';
 end if;
 select value_type into feature_type from public.features where key=target_feature and is_active;
 if value_is_unlimited and feature_type='INTEGER' then new_value='null'::jsonb; end if;
 if feature_type is null or not private.feature_value_is_valid(feature_type,new_value)
  or length(trim(coalesce(override_reason,''))) not between 3 and 500
  or (override_expires_at is not null and override_expires_at<=now()) then
  raise exception 'INVALID_FEATURE_OVERRIDE' using errcode='22023';
 end if;
 select value,expires_at into old_value,old_expires_at
 from public.tenant_feature_overrides
 where tenant_id=target_tenant and feature_key=target_feature;
 select id into actor from public.users where auth_user_id=auth.uid();
 insert into public.tenant_feature_overrides(
  tenant_id,feature_key,value,reason,expires_at,created_by
 ) values(target_tenant,target_feature,new_value,trim(override_reason),override_expires_at,actor)
 on conflict(tenant_id,feature_key) do update set
  value=excluded.value,reason=excluded.reason,expires_at=excluded.expires_at,
  created_by=excluded.created_by,updated_at=now();
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id,context)
 values(target_tenant,actor,'TENANT_FEATURE_OVERRIDE_SAVED','tenant_feature_overrides',target_tenant,
  jsonb_build_object(
   'tenantId',target_tenant,'featureKey',target_feature,
   'oldValue',old_value,'newValue',new_value,
   'oldExpiresAt',old_expires_at,'newExpiresAt',override_expires_at
  ));
end;
$$;

create or replace function public.delete_tenant_feature_override(target_tenant uuid,target_feature text)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid; old_value jsonb; old_expires_at timestamptz;
begin
 if not private.is_super_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select value,expires_at into old_value,old_expires_at
 from public.tenant_feature_overrides
 where tenant_id=target_tenant and feature_key=target_feature
 for update;
 if not found then raise exception 'FEATURE_OVERRIDE_NOT_FOUND' using errcode='22023'; end if;
 delete from public.tenant_feature_overrides
 where tenant_id=target_tenant and feature_key=target_feature;
 select id into actor from public.users where auth_user_id=auth.uid();
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id,context)
 values(target_tenant,actor,'TENANT_FEATURE_OVERRIDE_REMOVED','tenant_feature_overrides',target_tenant,
  jsonb_build_object(
   'tenantId',target_tenant,'featureKey',target_feature,
   'oldValue',old_value,'newValue',null,
   'oldExpiresAt',old_expires_at,'newExpiresAt',null
  ));
end;
$$;

create or replace function public.set_feature_global_state(target_feature text,is_enabled boolean,state_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid; feature_type text; old_enabled boolean;
begin
 if not private.is_super_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select value_type into feature_type from public.features
 where key=target_feature and is_active for update;
 if feature_type is distinct from 'BOOLEAN' or is_enabled is null
  or (not is_enabled and length(trim(coalesce(state_reason,''))) not between 3 and 500) then
  raise exception 'INVALID_FEATURE_STATE' using errcode='22023';
 end if;
 select enabled into old_enabled from public.feature_global_state
 where feature_key=target_feature;
 select id into actor from public.users where auth_user_id=auth.uid();
 insert into public.feature_global_state(feature_key,enabled,reason,updated_by)
 values(target_feature,is_enabled,case when is_enabled then null else trim(state_reason) end,actor)
 on conflict(feature_key) do update set enabled=excluded.enabled,reason=excluded.reason,
  updated_by=excluded.updated_by,updated_at=now();
 insert into public.audit_logs(actor_user_id,action,resource_type,context)
 values(actor,case when is_enabled then 'FEATURE_GLOBAL_ENABLED' else 'FEATURE_GLOBAL_DISABLED' end,
  'feature_global_state',jsonb_build_object(
   'featureKey',target_feature,'oldEnabled',old_enabled,'newEnabled',is_enabled
  ));
end;
$$;

create or replace function public.accept_tenant_invitation(invitation_id uuid) returns text
language plpgsql security definer set search_path='' as $$
declare invitation public.tenant_invitations; actor uuid; verified_email text; tenant_slug text; active_staff integer;
begin
 select u.id,lower(a.email) into actor,verified_email
 from public.users u join auth.users a on a.id=u.auth_user_id
 where a.id=auth.uid() and a.email_confirmed_at is not null and u.status='ACTIVE';
 if actor is null then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select * into invitation from public.tenant_invitations where id=invitation_id for update;
 if invitation.id is null or invitation.email<>verified_email then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select slug into tenant_slug from public.tenants
 where id=invitation.tenant_id and status in ('PROVISIONING','TRIAL','ACTIVE') for update;
 if tenant_slug is null then raise exception 'TENANT_UNAVAILABLE' using errcode='42501'; end if;
 if invitation.status='ACCEPTED' then
  if invitation.accepted_by<>actor or not private.is_tenant_member(invitation.tenant_id) then
   raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  return tenant_slug;
 end if;
 perform pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(invitation.tenant_id::text||':staff_limit',0)
 );
 select count(*) into active_staff from public.tenant_memberships
 where tenant_id=invitation.tenant_id and status='ACTIVE';
 perform private.assert_usage_within_limit(invitation.tenant_id,'staff_limit',active_staff);
 insert into public.tenant_memberships(tenant_id,user_id,role)
 values(invitation.tenant_id,actor,'TENANT_OWNER');
 update public.tenant_invitations
 set status='ACCEPTED',accepted_by=actor,accepted_at=now() where id=invitation.id;
 update public.tenant_onboarding set owner_accepted=true where tenant_id=invitation.tenant_id;
 update public.tenants set status='TRIAL'
 where id=invitation.tenant_id and status='PROVISIONING';
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id)
 values(invitation.tenant_id,actor,'OWNER_INVITATION_ACCEPTED','tenant_invitations',invitation.id);
 return tenant_slug;
end;
$$;
