-- Runs in a transaction that the test runner ALWAYS rolls back.
create temporary table fixture_ids(k text primary key,id uuid not null);
insert into fixture_ids values ('a',gen_random_uuid()),('b',gen_random_uuid()),('admin',gen_random_uuid()),('ta',gen_random_uuid()),('tb',gen_random_uuid());
grant select on fixture_ids to authenticated;
insert into auth.users(id,email) select id,id::text||'@example.invalid' from fixture_ids where k in ('a','b','admin');
update public.users set platform_role='SUPER_ADMIN' where auth_user_id=(select id from fixture_ids where k='admin');
insert into public.tenants(id,name,slug,status) select id,'Isolation fixture', 'test-'||id::text,'ACTIVE' from fixture_ids where k in ('ta','tb');
insert into public.tenant_memberships(tenant_id,user_id,role)
 select t.id,u.id,'TENANT_OWNER' from fixture_ids t join fixture_ids a on (t.k='ta' and a.k='a') or (t.k='tb' and a.k='b') join public.users u on u.auth_user_id=a.id;

select set_config('request.jwt.claim.sub',(select id::text from fixture_ids where k='a'),true);
set local role authenticated;
do $$
begin
 if (select count(*) from public.tenants where id in(select id from fixture_ids where k in ('ta','tb')))<>1 then raise exception 'Tenant A isolation failed'; end if;
 if not exists(select 1 from public.tenants where id=(select id from fixture_ids where k='ta')) then raise exception 'Own tenant missing'; end if;
 if exists(select 1 from public.tenant_memberships where tenant_id=(select id from fixture_ids where k='tb')) then raise exception 'Membership leak'; end if;
 if exists(select 1 from public.users where auth_user_id=(select id from fixture_ids where k='b')) then raise exception 'Profile leak'; end if;
 if exists(select 1 from public.audit_logs) then raise exception 'Audit leak'; end if;
 begin update public.tenants set name='Forbidden' where id=(select id from fixture_ids where k='tb'); raise exception 'Cross tenant update allowed'; exception when insufficient_privilege then null; end;
 begin delete from public.tenants where id=(select id from fixture_ids where k='tb'); raise exception 'Cross tenant delete allowed'; exception when insufficient_privilege then null; end;
 begin update public.users set platform_role='SUPER_ADMIN' where auth_user_id=auth.uid(); raise exception 'Role escalation allowed'; exception when insufficient_privilege then null; end;
 begin insert into public.tenants(name,slug) values('Forbidden','forbidden-test'); raise exception 'Unauthorized provisioning allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from fixture_ids where k='b'),true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.tenants where id=(select id from fixture_ids where k='ta')) then raise exception 'Tenant B isolation failed'; end if;
 if not exists(select 1 from public.tenants where id=(select id from fixture_ids where k='tb')) then raise exception 'Own tenant B missing'; end if;
end $$;
reset role;
update public.tenant_memberships set status='DISABLED' where tenant_id=(select id from fixture_ids where k='tb');
set local role authenticated;
do $$ begin if exists(select 1 from public.tenants where id=(select id from fixture_ids where k='tb')) then raise exception 'Disabled membership retained access'; end if; end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from fixture_ids where k='admin'),true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.tenants where id in(select id from fixture_ids where k in ('ta','tb')))<>2 then raise exception 'Admin visibility failed'; end if;
end $$;
reset role;
update public.users set status='DISABLED' where auth_user_id=(select id from fixture_ids where k='admin');
set local role authenticated;
do $$ begin if exists(select 1 from public.tenants where id in(select id from fixture_ids where k in ('ta','tb'))) then raise exception 'Disabled admin retained access'; end if; end $$;
reset role;
set local role anon;
do $$ begin
 begin perform 1 from public.tenants; raise exception 'Anonymous tenant read allowed'; exception when insufficient_privilege then null; end;
 begin perform 1 from public.users; raise exception 'Anonymous profile read allowed'; exception when insufficient_privilege then null; end;
 begin perform 1 from public.tenant_memberships; raise exception 'Anonymous membership read allowed'; exception when insufficient_privilege then null; end;
 begin perform 1 from public.audit_logs; raise exception 'Anonymous audit read allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
