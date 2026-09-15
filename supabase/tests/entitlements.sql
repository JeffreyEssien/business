create temporary table entitlement_fixture(k text primary key,id uuid not null,email text);
grant all on entitlement_fixture to authenticated;
insert into entitlement_fixture(k,id,email)
select k,gen_random_uuid(),gen_random_uuid()::text||'@example.invalid'
from unnest(array['admin','owner']) k;
insert into auth.users(id,email,email_confirmed_at)
select id,email,now() from entitlement_fixture;
update public.users set platform_role='SUPER_ADMIN'
where auth_user_id=(select id from entitlement_fixture where k='admin');

select set_config('request.jwt.claim.sub',(select id::text from entitlement_fixture where k='admin'),true);
set local role authenticated;
insert into entitlement_fixture(k,id,email)
select 'tenant',public.provision_tenant(
 'Entitlement Test','entitlement-'||substr(gen_random_uuid()::text,1,8),'Entitlement Owner',
 (select email from entitlement_fixture where k='owner'),'general','starter','bank_transfer'
),'';
insert into entitlement_fixture(k,id,email)
select 'invitation',id,email from public.tenant_invitations
where tenant_id=(select id from entitlement_fixture where k='tenant');

do $$ begin
 if (public.get_tenant_entitlements((select id from entitlement_fixture where k='tenant'))
  ->>'sms_notifications')::boolean then
  raise exception 'Starter unexpectedly received SMS';
 end if;
end $$;

select public.save_tenant_feature_override(
 (select id from entitlement_fixture where k='tenant'),'sms_notifications','true'::jsonb,
 'Approved support exception',now()+interval '1 day'
);
select public.save_tenant_feature_override(
 (select id from entitlement_fixture where k='tenant'),'sms_notifications','false'::jsonb,
 'Temporary restriction',now()+interval '2 days'
);
do $$ begin
 if (public.get_tenant_entitlements((select id from entitlement_fixture where k='tenant'))
  ->>'sms_notifications')::boolean then
  raise exception 'Updated tenant override did not beat plan';
 end if;
 if not exists(select 1 from public.audit_logs
  where tenant_id=(select id from entitlement_fixture where k='tenant')
   and action='TENANT_FEATURE_OVERRIDE_SAVED'
   and context->>'featureKey'='sms_notifications'
   and context->'oldValue'='true'::jsonb
   and context->'newValue'='false'::jsonb
   and context->>'oldExpiresAt' is not null
   and context->>'newExpiresAt' is not null) then
  raise exception 'Feature override audit before/after context is incomplete';
 end if;
end $$;
select public.save_tenant_feature_override(
 (select id from entitlement_fixture where k='tenant'),'sms_notifications','true'::jsonb,
 'Approved support exception',now()+interval '1 day'
);

select public.set_feature_global_state('sms_notifications',false,'Provider incident');
do $$ begin
 if (public.get_tenant_entitlements((select id from entitlement_fixture where k='tenant'))
  ->>'sms_notifications')::boolean then
  raise exception 'Global shutdown did not beat tenant override';
 end if;
end $$;
select public.set_feature_global_state('sms_notifications',true,'');
do $$ begin
 if not exists(select 1 from public.audit_logs
  where action='FEATURE_GLOBAL_ENABLED'
   and context->>'featureKey'='sms_notifications'
   and context->'oldEnabled'='false'::jsonb
   and context->'newEnabled'='true'::jsonb) then
  raise exception 'Global-state audit before/after context is incomplete';
 end if;
 begin
  perform public.set_feature_global_state('product_limit',false,'Invalid numeric shutdown');
  raise exception 'Numeric feature accepted a Boolean emergency shutdown';
 exception when invalid_parameter_value then null;
 end;
end $$;
select public.delete_tenant_feature_override(
 (select id from entitlement_fixture where k='tenant'),'sms_notifications'
);
select public.save_plan_feature('starter','sms_notifications','true'::jsonb);
do $$ begin
 if not (public.get_tenant_entitlements((select id from entitlement_fixture where k='tenant'))
  ->>'sms_notifications')::boolean then
  raise exception 'Live plan change did not reach tenant';
 end if;
 if not exists(select 1 from public.audit_logs
  where action='PLAN_FEATURE_UPDATED'
   and context->>'planSlug'='starter'
   and context->>'featureKey'='sms_notifications'
   and context->'oldValue'='false'::jsonb
   and context->'newValue'='true'::jsonb) then
  raise exception 'Plan audit before/after context is incomplete';
 end if;
end $$;
select public.save_plan_feature('starter','sms_notifications','false'::jsonb);
do $$ begin
 begin
  perform public.save_plan_feature('starter','product_limit','"invalid"'::jsonb);
  raise exception 'Invalid typed plan value was accepted';
 exception when invalid_parameter_value then null;
 end;
end $$;
select public.save_tenant_feature_override(
 (select id from entitlement_fixture where k='tenant'),'product_limit','0'::jsonb,
 'Zero product allowance test',null
);
select public.save_tenant_feature_override(
 (select id from entitlement_fixture where k='tenant'),'staff_limit','0'::jsonb,
 'Zero staff allowance test',null
);
reset role;

select set_config('request.jwt.claim.sub',(select id::text from entitlement_fixture where k='owner'),true);
set local role authenticated;
do $$ begin
 begin
  perform public.accept_tenant_invitation((select id from entitlement_fixture where k='invitation'));
  raise exception 'Zero staff allowance permitted membership growth';
 exception when check_violation then
  if sqlerrm not like '%USAGE_LIMIT_EXCEEDED%' then raise; end if;
 end;
end $$;
reset role;

select set_config('request.jwt.claim.sub',(select id::text from entitlement_fixture where k='admin'),true);
set local role authenticated;
select public.save_tenant_feature_override(
 (select id from entitlement_fixture where k='tenant'),'staff_limit','1'::jsonb,
 'Permit the tenant owner',null
);
reset role;

select set_config('request.jwt.claim.sub',(select id::text from entitlement_fixture where k='owner'),true);
set local role authenticated;
select public.accept_tenant_invitation((select id from entitlement_fixture where k='invitation'));
do $$ begin
 begin
  perform public.save_product(
   (select id from entitlement_fixture where k='tenant'),null,'Blocked product','blocked-product','','','',
   100,null,0,false,'DRAFT','{}'::uuid[],null,null,null,null,null,null
  );
  raise exception 'Zero product allowance permitted creation';
 exception when check_violation then
  if sqlerrm not like '%USAGE_LIMIT_EXCEEDED%' then raise; end if;
 end;
end $$;
reset role;

select set_config('request.jwt.claim.sub',(select id::text from entitlement_fixture where k='admin'),true);
set local role authenticated;
select public.save_tenant_feature_override(
 (select id from entitlement_fixture where k='tenant'),'product_limit','null'::jsonb,
 'Unlimited catalog test',null,true
);
reset role;

select set_config('request.jwt.claim.sub',(select id::text from entitlement_fixture where k='owner'),true);
set local role authenticated;
select public.save_product(
 (select id from entitlement_fixture where k='tenant'),null,'First product','first-product','','','',
 100,null,0,false,'DRAFT','{}'::uuid[],null,null,null,null,null,null
);
select public.save_product(
 (select id from entitlement_fixture where k='tenant'),null,'Second product','second-product','','','',
 100,null,0,false,'DRAFT','{}'::uuid[],null,null,null,null,null,null
);
select public.save_product(
 (select id from entitlement_fixture where k='tenant'),null,'Archived product','archived-product','','','',
 100,null,0,false,'ARCHIVED','{}'::uuid[],null,null,null,null,null,null
);
reset role;

select set_config('request.jwt.claim.sub',(select id::text from entitlement_fixture where k='admin'),true);
set local role authenticated;
select public.save_tenant_feature_override(
 (select id from entitlement_fixture where k='tenant'),'product_limit','1'::jsonb,
 'Downgrade below current usage',null
);
do $$ begin
 if (select count(*) from public.products
  where tenant_id=(select id from entitlement_fixture where k='tenant') and status<>'ARCHIVED')<>2 then
  raise exception 'Downgrade destructively changed existing product usage';
 end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub',(select id::text from entitlement_fixture where k='owner'),true);
set local role authenticated;
do $$ begin
 begin
  perform public.save_product(
   (select id from entitlement_fixture where k='tenant'),null,'Third product','third-product','','','',
   100,null,0,false,'DRAFT','{}'::uuid[],null,null,null,null,null,null
  );
  raise exception 'Downgraded product limit was bypassed';
 exception when check_violation then
  if sqlerrm not like '%USAGE_LIMIT_EXCEEDED%' then raise; end if;
 end;
 begin
  perform public.save_product(
   (select id from entitlement_fixture where k='tenant'),
   (select id from public.products where tenant_id=(select id from entitlement_fixture where k='tenant') and slug='archived-product'),
   'Archived product','archived-product','','','',100,null,0,false,'DRAFT','{}'::uuid[],
   null,null,null,null,null,null
  );
  raise exception 'Archived product was restored above the limit';
 exception when check_violation then
  if sqlerrm not like '%USAGE_LIMIT_EXCEEDED%' then raise; end if;
 end;
 begin
  perform public.save_tenant_feature_override(
   (select id from entitlement_fixture where k='tenant'),'sms_notifications','true'::jsonb,
   'Unauthorized owner override',null
  );
  raise exception 'Tenant owner changed a feature override';
 exception when insufficient_privilege then null;
 end;
 begin
  update public.tenant_feature_overrides set value='true'::jsonb
  where tenant_id=(select id from entitlement_fixture where k='tenant');
  raise exception 'Tenant owner wrote override table directly';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;

-- Expired rows remain auditable but no longer affect the effective value.
update public.tenant_feature_overrides set expires_at=now()-interval '1 minute'
where tenant_id=(select id from entitlement_fixture where k='tenant') and feature_key='product_limit';
insert into public.feature_global_state(feature_key,enabled,reason,updated_by)
values('product_limit',false,'Malformed numeric state regression',
 (select id from public.users where auth_user_id=(select id from entitlement_fixture where k='admin'))
);
select set_config('request.jwt.claim.sub',(select id::text from entitlement_fixture where k='admin'),true);
set local role authenticated;
do $$ begin
 if (public.get_tenant_entitlements((select id from entitlement_fixture where k='tenant'))
  ->>'product_limit')::integer<>50 then
  raise exception 'Expired override did not fall back to plan or numeric emergency state leaked';
 end if;
 begin
  perform public.delete_tenant_feature_override(
   (select id from entitlement_fixture where k='tenant'),'custom_domain'
  );
  raise exception 'Missing override removal appeared successful';
 exception when invalid_parameter_value then null;
 end;
end $$;
reset role;
