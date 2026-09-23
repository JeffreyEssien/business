-- Preserve the established resolver contract while making the global emergency
-- branch explicitly Boolean-only. Tenant.plan_id remains the plan authority until
-- Phase 10 introduces and migrates a different subscription assignment model.

create or replace function private.get_effective_feature(target_tenant uuid,target_feature text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare resolved jsonb; default_value jsonb; feature_type text; globally_enabled boolean;
begin
 select f.default_value,f.value_type,g.enabled
 into default_value,feature_type,globally_enabled
 from public.features f
 left join public.feature_global_state g on g.feature_key=f.key
 where f.key=target_feature and f.is_active;
 if not found then raise exception 'FEATURE_NOT_FOUND' using errcode='22023'; end if;
 if feature_type='BOOLEAN' and globally_enabled is false then return 'false'::jsonb; end if;
 select o.value into resolved from public.tenant_feature_overrides o
 where o.tenant_id=target_tenant and o.feature_key=target_feature
  and (o.expires_at is null or o.expires_at>now());
 if found then return resolved; end if;
 select pf.value into resolved from public.tenants t
 join public.plan_features pf on pf.plan_id=t.plan_id and pf.feature_key=target_feature
 where t.id=target_tenant;
 if found then return resolved; end if;
 if not exists(select 1 from public.tenants where id=target_tenant) then
  raise exception 'TENANT_NOT_FOUND' using errcode='22023';
 end if;
 return default_value;
end;
$$;
