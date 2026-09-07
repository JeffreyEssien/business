create temporary table catalog_fixture(k text primary key,id uuid not null,email text);
grant all on catalog_fixture to authenticated;
insert into catalog_fixture(k,id,email) select k,gen_random_uuid(),gen_random_uuid()::text||'@example.invalid' from unnest(array['admin','owner-a','owner-b','outsider']) k;
insert into auth.users(id,email,email_confirmed_at) select id,email,now() from catalog_fixture;
update public.users set platform_role='SUPER_ADMIN' where auth_user_id=(select id from catalog_fixture where k='admin');
select set_config('request.jwt.claim.sub',(select id::text from catalog_fixture where k='admin'),true);
set local role authenticated;
insert into catalog_fixture(k,id) select 'tenant-a',public.provision_tenant('Catalog A','catalog-a-'||substr(gen_random_uuid()::text,1,8),'Owner A',(select email from catalog_fixture where k='owner-a'),'general','starter','bank_transfer');
insert into catalog_fixture(k,id) select 'tenant-b',public.provision_tenant('Catalog B','catalog-b-'||substr(gen_random_uuid()::text,1,8),'Owner B',(select email from catalog_fixture where k='owner-b'),'general','starter','bank_transfer');
select set_config('businesscare.test_catalog_slug',(select slug from public.tenants where id=(select id from catalog_fixture where k='tenant-a')),true);
insert into catalog_fixture(k,id) select 'invite-a',id from public.tenant_invitations where tenant_id=(select id from catalog_fixture where k='tenant-a');
insert into catalog_fixture(k,id) select 'invite-b',id from public.tenant_invitations where tenant_id=(select id from catalog_fixture where k='tenant-b');
reset role;
select set_config('request.jwt.claim.sub',(select id::text from catalog_fixture where k='owner-a'),true);
set local role authenticated;
select public.accept_tenant_invitation((select id from catalog_fixture where k='invite-a'));
insert into catalog_fixture(k,id) select 'category-a',public.save_category((select id from catalog_fixture where k='tenant-a'),null,'Clothing','clothing','Wearables','ACTIVE');
insert into catalog_fixture(k,id) select 'product-a',public.save_product((select id from catalog_fixture where k='tenant-a'),null,'Shirt','shirt','A shirt','Soft cotton','SKU-A',2500,null,4,true,'ACTIVE',array[(select id from catalog_fixture where k='category-a')],null,null,null,null,null,null);
select public.save_product((select id from catalog_fixture where k='tenant-a'),(select id from catalog_fixture where k='product-a'),'Shirt','shirt','A shirt','Soft cotton','SKU-A',2500,null,4,true,'ACTIVE',array[(select id from catalog_fixture where k='category-a')],'businesscare/tenants/'||(select id from catalog_fixture where k='tenant-a')::text||'/products/first','https://res.cloudinary.com/test/image/upload/first.png','first.png','image/png',100,'First image','cloudinary','image','png',1,1);
select public.save_product((select id from catalog_fixture where k='tenant-a'),(select id from catalog_fixture where k='product-a'),'Shirt','shirt','A shirt','Soft cotton','SKU-A',2500,null,4,true,'ACTIVE',array[(select id from catalog_fixture where k='category-a')],'businesscare/tenants/'||(select id from catalog_fixture where k='tenant-a')::text||'/products/replacement','https://res.cloudinary.com/test/image/upload/replacement.png','replacement.png','image/png',100,'Replacement image','cloudinary','image','png',1,1);
do $$ begin
 if (select count(*) from public.products where tenant_id=(select id from catalog_fixture where k='tenant-a'))<>1 then raise exception 'Own product read failed'; end if;
 if (select count(*) from public.media_assets where tenant_id=(select id from catalog_fixture where k='tenant-a'))<>1 then raise exception 'Replaced Cloudinary media metadata was not cleaned'; end if;
 if not exists(select 1 from public.media_assets where tenant_id=(select id from catalog_fixture where k='tenant-a') and storage_provider='cloudinary' and resource_type='image' and storage_key like '%/replacement') then raise exception 'Cloudinary metadata not persisted'; end if;
 if (select products_added from public.tenant_onboarding where tenant_id=(select id from catalog_fixture where k='tenant-a')) is not true then raise exception 'Checklist not updated'; end if;
 begin perform public.save_product((select id from catalog_fixture where k='tenant-a'),null,'Bad','bad','',null,null,1,null,0,true,'ACTIVE',array[(select id from catalog_fixture where k='tenant-b')],null,null,null,null,null,null);raise exception 'Cross-tenant category accepted';exception when invalid_parameter_value then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from catalog_fixture where k='owner-b'),true);
set local role authenticated;
select public.accept_tenant_invitation((select id from catalog_fixture where k='invite-b'));
do $$ begin
 if exists(select 1 from public.products where tenant_id=(select id from catalog_fixture where k='tenant-a')) then raise exception 'Product leaked to tenant B';end if;
 begin perform public.delete_product((select id from catalog_fixture where k='tenant-a'),(select id from catalog_fixture where k='product-a'));raise exception 'Cross-tenant delete allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from catalog_fixture where k='outsider'),true);
set local role authenticated;
do $$ begin
 begin perform public.save_category((select id from catalog_fixture where k='tenant-a'),null,'Bad','bad','','ACTIVE');raise exception 'Outsider write allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role anon;
do $$ begin
 if jsonb_array_length((public.get_public_storefront(current_setting('businesscare.test_catalog_slug'))->'products'))<>1 then raise exception 'Published catalog unavailable';end if;
 begin perform 1 from public.products;raise exception 'Anonymous table read allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
