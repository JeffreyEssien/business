create temporary table application_fixture(k text primary key,id uuid not null,email text,value jsonb);
grant all on application_fixture to anon,authenticated;
insert into application_fixture(k,id,email) values
 ('admin',gen_random_uuid(),gen_random_uuid()::text||'@example.invalid'),
 ('ordinary',gen_random_uuid(),gen_random_uuid()::text||'@example.invalid'),
 ('application',gen_random_uuid(),'applicant@example.invalid');
insert into auth.users(id,email,email_confirmed_at) select id,email,now() from application_fixture where k in ('admin','ordinary');
update public.users set platform_role='SUPER_ADMIN' where auth_user_id=(select id from application_fixture where k='admin');
update application_fixture set value=jsonb_build_object(
 'businessName','Original Business','businessType','fashion','businessDescription','Made with care.',
 'ownerName','Application Owner','ownerEmail','applicant@example.invalid','businessPhone','08010000000',
 'whatsapp','08010000000','businessEmail','hello@example.invalid','instagram','@originalbusiness','facebook','','tiktok','',
 'hasPhysicalLocation',true,'addressLine','1 Test Street','city','Ikeja','state','Lagos','country','Nigeria',
 'primaryColor','#112233','secondaryColor','#445566','accentColor','#778899','styleKey','elegant-luxury',
 'homepageHeadline','Made for you','homepageMessage','Welcome to our business.','primaryActionLabel','Shop Now',
 'primaryActionDestination','PRODUCTS','announcement','Opening soon','requestedPages',jsonb_build_array('ABOUT','PRIVACY'),
 'productReadiness','READY','productQuantityRange','1_10','productCategories',jsonb_build_array('Dresses','Shoes'),
 'preferredSlug','application-'||substr(gen_random_uuid()::text,1,8),'proposedPlan','growth','logo',null
) where k='application';

set local role anon;
do $$ declare result jsonb; begin
 result:=public.submit_business_application(
  (select id from application_fixture where k='application'),
  (select value from application_fixture where k='application'),repeat('a',64));
 if result->>'ok'<>'true' or result->>'reference' not like 'BCA-%' then raise exception 'Public application submission failed'; end if;
end $$;
do $$ begin
 begin perform 1 from public.business_applications;raise exception 'Anonymous application read allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ begin
 if exists(select 1 from public.tenants where slug=(select value->>'preferredSlug' from application_fixture where k='application')) then
  raise exception 'Public submission created a tenant';
 end if;
end $$;

select set_config('request.jwt.claim.sub',(select id::text from application_fixture where k='ordinary'),true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.business_applications) then raise exception 'Application PII leaked to ordinary user'; end if;
 begin perform public.change_business_application_status((select id from application_fixture where k='application'),'UNDER_REVIEW','');raise exception 'Ordinary user changed application';exception when insufficient_privilege then null;end;
end $$;
reset role;

select set_config('request.jwt.claim.sub',(select id::text from application_fixture where k='admin'),true);
set local role authenticated;
do $$ declare updated jsonb; begin
 if (select count(*) from public.business_applications where id=(select id from application_fixture where k='application'))<>1 then raise exception 'Admin cannot read application'; end if;
 updated:=(select value||jsonb_build_object('businessName','Approved Business') from application_fixture where k='application');
 perform public.save_business_application((select id from application_fixture where k='application'),updated,'Reviewed carefully.');
 perform public.change_business_application_status((select id from application_fixture where k='application'),'UNDER_REVIEW','');
end $$;
insert into application_fixture(k,id) select 'tenant',public.provision_business_application((select id from application_fixture where k='application'));
do $$ begin
 if (select status from public.business_applications where id=(select id from application_fixture where k='application'))<>'PROVISIONED' then raise exception 'Application was not marked provisioned'; end if;
 if (select business_name from public.tenant_business_settings where tenant_id=(select id from application_fixture where k='tenant'))<>'Approved Business' then raise exception 'Approved name did not reach tenant'; end if;
 if (select tokens->>'secondary' from public.tenant_theme_settings where tenant_id=(select id from application_fixture where k='tenant'))<>'#445566' then raise exception 'Secondary brand colour did not reach theme'; end if;
 if (select whatsapp from public.tenant_business_settings where tenant_id=(select id from application_fixture where k='tenant'))<>'08010000000' then raise exception 'Application contact did not reach tenant'; end if;
 if (select count(*) from public.pages where tenant_id=(select id from application_fixture where k='tenant') and page_type<>'HOME' and status='DRAFT' and not is_enabled)<>2 then raise exception 'Requested pages were not prepared as private drafts'; end if;
 if (select link_type from public.navigation_items where tenant_id=(select id from application_fixture where k='tenant') and label='Home')<>'PAGE' then raise exception 'Provisioned Home navigation is not typed'; end if;
 if (select original_submission->>'businessName' from public.business_applications where id=(select id from application_fixture where k='application'))<>'Original Business' then raise exception 'Original submission was changed'; end if;
 if not exists(select 1 from public.business_application_revisions where application_id=(select id from application_fixture where k='application') and previous_values->>'business_name'='Original Business') then raise exception 'Application revision was not preserved'; end if;
 begin perform public.provision_business_application((select id from application_fixture where k='application'));raise exception 'Application provisioned twice';exception when sqlstate '22023' then null;end;
end $$;
reset role;
