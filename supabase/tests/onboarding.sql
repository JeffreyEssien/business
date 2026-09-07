create temporary table onboarding_fixture(k text primary key,id uuid not null,email text);
grant all on onboarding_fixture to authenticated;
insert into onboarding_fixture(k,id,email) select k,gen_random_uuid(),gen_random_uuid()::text||'@example.invalid' from unnest(array['admin','owner-a','owner-b','outsider']) k;
insert into auth.users(id,email,email_confirmed_at) select id,email,now() from onboarding_fixture;
update public.users set platform_role='SUPER_ADMIN' where auth_user_id=(select id from onboarding_fixture where k='admin');
select set_config('request.jwt.claim.sub',(select id::text from onboarding_fixture where k='admin'),true);
set local role authenticated;
insert into onboarding_fixture(k,id) select 'tenant-a',public.provision_tenant('Fixture A','fixture-'||gen_random_uuid()::text,'Owner A',(select email from onboarding_fixture where k='owner-a'),'fashion','growth','paystack');
insert into onboarding_fixture(k,id) select 'tenant-b',public.provision_tenant('Fixture B','fixture-'||gen_random_uuid()::text,'Owner B',(select email from onboarding_fixture where k='owner-b'),'beauty','starter','bank_transfer');
insert into onboarding_fixture(k,id) select 'invite-a',id from public.tenant_invitations where tenant_id=(select id from onboarding_fixture where k='tenant-a');
insert into onboarding_fixture(k,id) select 'invite-b',id from public.tenant_invitations where tenant_id=(select id from onboarding_fixture where k='tenant-b');
do $$ declare tbl text; n integer; reserved text; begin
 foreach tbl in array array['tenant_invitations','tenant_business_settings','tenant_theme_settings','tenant_layout_settings','pages','content_blocks','navigation_items','tenant_seo_settings','tenant_email_settings','tenant_sms_settings','tenant_checkout_settings','subscriptions','tenant_domains','tenant_onboarding'] loop
  execute format('select count(*) from public.%I where tenant_id in(select id from onboarding_fixture where k in (''tenant-a'',''tenant-b''))',tbl) into n;
  if n<>2 then raise exception 'Atomic provisioning missing records in %',tbl; end if;
 end loop;
 if exists(select 1 from public.pages where tenant_id=(select id from onboarding_fixture where k='tenant-a') and status<>'DRAFT') then raise exception 'Premature publish'; end if;
 if exists(select 1 from public.tenant_domains where tenant_id=(select id from onboarding_fixture where k='tenant-a') and status<>'NOT_CONFIGURED') then raise exception 'Premature domain activation'; end if;
 select slug into reserved from public.tenants where id=(select id from onboarding_fixture where k='tenant-a');
 begin perform public.provision_tenant('Duplicate',reserved,'Owner','test@example.invalid','fashion','growth','paystack');raise exception 'Duplicate slug accepted';exception when unique_violation then null;end;
 begin perform public.provision_tenant('Invalid','admin','Owner','test@example.invalid','fashion','growth','paystack');raise exception 'Reserved slug accepted';exception when invalid_parameter_value then null;end;
 begin perform public.provision_tenant('Invalid','invalid-'||gen_random_uuid()::text,'Owner','test@example.invalid','fashion','nonexistent','paystack');raise exception 'Unknown plan accepted';exception when invalid_parameter_value then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from onboarding_fixture where k='outsider'),true);
set local role authenticated;
do $$ begin
 begin perform public.provision_tenant('Forbidden','forbidden-fixture','Owner','a@example.invalid','general','starter','bank_transfer');raise exception 'Non-admin provision allowed';exception when insufficient_privilege then null;end;
 begin perform public.accept_tenant_invitation((select id from onboarding_fixture where k='invite-a'));raise exception 'Wrong owner accepted';exception when insufficient_privilege then null;end;
 begin perform public.set_tenant_suspended((select id from onboarding_fixture where k='tenant-a'),true);raise exception 'Unauthorized suspension';exception when insufficient_privilege then null;end;
 begin perform public.record_invitation_link((select id from onboarding_fixture where k='invite-a'));raise exception 'Unauthorized invitation audit';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from onboarding_fixture where k='owner-a'),true);
set local role authenticated;
select public.accept_tenant_invitation((select id from onboarding_fixture where k='invite-a'));
select public.accept_tenant_invitation((select id from onboarding_fixture where k='invite-a'));
do $$ declare tbl text;n integer;begin
 foreach tbl in array array['tenant_invitations','tenant_business_settings','tenant_theme_settings','tenant_layout_settings','pages','content_blocks','navigation_items','tenant_seo_settings','tenant_email_settings','tenant_sms_settings','tenant_checkout_settings','subscriptions','tenant_domains','tenant_onboarding'] loop
  execute format('select count(*) from public.%I where tenant_id=(select id from onboarding_fixture where k=''tenant-a'')',tbl) into n;
  if n<>1 then raise exception 'Owner own read failed: %',tbl;end if;
  execute format('select count(*) from public.%I where tenant_id=(select id from onboarding_fixture where k=''tenant-b'')',tbl) into n;
  if n<>0 then raise exception 'Cross tenant leak: %',tbl;end if;
  begin execute format('delete from public.%I where tenant_id=(select id from onboarding_fixture where k=''tenant-b'')',tbl);raise exception 'Cross tenant delete allowed: %',tbl;exception when insufficient_privilege then null;end;
  begin execute format('update public.%I set tenant_id=tenant_id where tenant_id=(select id from onboarding_fixture where k=''tenant-a'')',tbl);raise exception 'Direct update allowed: %',tbl;exception when insufficient_privilege then null;end;
 end loop;
 if (select count(*) from public.tenant_memberships where tenant_id=(select id from onboarding_fixture where k='tenant-a'))<>1 then raise exception 'Invitation replay duplicated membership';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from onboarding_fixture where k='admin'),true);
set local role authenticated;
select public.set_tenant_suspended((select id from onboarding_fixture where k='tenant-a'),true);
reset role;
select set_config('request.jwt.claim.sub',(select id::text from onboarding_fixture where k='owner-a'),true);
set local role authenticated;
do $$ begin
 begin perform public.accept_tenant_invitation((select id from onboarding_fixture where k='invite-a'));raise exception 'Suspended invitation allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from onboarding_fixture where k='admin'),true);
set local role authenticated;
select public.set_tenant_suspended((select id from onboarding_fixture where k='tenant-a'),false);
do $$ begin if not exists(select 1 from public.tenants where id=(select id from onboarding_fixture where k='tenant-a') and status='TRIAL') then raise exception 'Reactivation did not restore status';end if;end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from onboarding_fixture where k='owner-b'),true);
set local role authenticated;
select public.accept_tenant_invitation((select id from onboarding_fixture where k='invite-b'));
do $$ declare tbl text;n integer;begin
 foreach tbl in array array['tenant_invitations','tenant_business_settings','tenant_theme_settings','tenant_layout_settings','pages','content_blocks','navigation_items','tenant_seo_settings','tenant_email_settings','tenant_sms_settings','tenant_checkout_settings','subscriptions','tenant_domains','tenant_onboarding'] loop
 execute format('select count(*) from public.%I where tenant_id=(select id from onboarding_fixture where k=''tenant-a'')',tbl) into n;
 if n<>0 then raise exception 'Reverse tenant leak: %',tbl;end if;
 end loop;
end $$;
reset role;
set local role anon;
do $$ declare tbl text;begin
 foreach tbl in array array['tenant_invitations','tenant_business_settings','tenant_theme_settings','tenant_layout_settings','pages','content_blocks','navigation_items','tenant_seo_settings','tenant_email_settings','tenant_sms_settings','tenant_checkout_settings','subscriptions','tenant_domains','tenant_onboarding'] loop
 begin execute format('select 1 from public.%I',tbl);raise exception 'Anonymous access allowed: %',tbl;exception when insufficient_privilege then null;end;
 end loop;
end $$;
reset role;
