create temporary table site_fixture(k text primary key,id uuid not null,email text);
grant all on site_fixture to authenticated;
insert into site_fixture(k,id,email) select k,gen_random_uuid(),gen_random_uuid()::text||'@example.invalid' from unnest(array['admin','owner-a','owner-b','outsider']) k;
insert into auth.users(id,email,email_confirmed_at) select id,email,now() from site_fixture;
update public.users set platform_role='SUPER_ADMIN' where auth_user_id=(select id from site_fixture where k='admin');
select set_config('request.jwt.claim.sub',(select id::text from site_fixture where k='admin'),true);
set local role authenticated;
insert into site_fixture(k,id) select 'tenant-a',public.provision_tenant('Site A','site-a-'||substr(gen_random_uuid()::text,1,8),'Owner A',(select email from site_fixture where k='owner-a'),'fashion','starter','bank_transfer');
insert into site_fixture(k,id) select 'tenant-b',public.provision_tenant('Site B','site-b-'||substr(gen_random_uuid()::text,1,8),'Owner B',(select email from site_fixture where k='owner-b'),'beauty','starter','bank_transfer');
select set_config('businesscare.test_site_slug',(select slug from public.tenants where id=(select id from site_fixture where k='tenant-a')),true);
insert into site_fixture(k,id) select 'invite-a',id from public.tenant_invitations where tenant_id=(select id from site_fixture where k='tenant-a');
reset role;

select set_config('request.jwt.claim.sub',(select id::text from site_fixture where k='owner-a'),true);
set local role authenticated;
select public.accept_tenant_invitation((select id from site_fixture where k='invite-a'));
select public.save_site_draft(
 target_tenant=>(select id from site_fixture where k='tenant-a'),business_name=>'Distinct Store A',business_description=>'A unique description',business_phone=>'+234 800 000 0000',business_address=>'Lagos',
 theme_preset=>'fashion',primary_color=>'#112233',accent_color=>'#aabbcc',background_color=>'#fefefe',text_color=>'#121212',
 announcement_text=>'Today only',announcement_enabled=>true,hero_eyebrow=>'New',hero_headline=>'First published headline',hero_subheadline=>'Made for A',hero_cta_label=>'Shop now',hero_variant=>'split',
 products_heading=>'Store A products',products_enabled=>true,footer_description=>'Footer A',navigation=>'[{"label":"Home","target":"/","location":"HEADER","linkType":"URL","enabled":true}]'::jsonb
);
select public.publish_site((select id from site_fixture where k='tenant-a'));
do $$ begin
 if (select count(*) from public.tenant_site_versions where tenant_id=(select id from site_fixture where k='tenant-a') and status='PUBLISHED')<>1 then raise exception 'Initial publish failed'; end if;
 if (select configuration#>>'{sections,1,content,headline}' from public.tenant_site_versions where tenant_id=(select id from site_fixture where k='tenant-a') and status='PUBLISHED')<>'First published headline' then raise exception 'Published snapshot incorrect'; end if;
 if exists(select 1 from public.tenant_site_versions where tenant_id=(select id from site_fixture where k='tenant-b')) then raise exception 'Cross-tenant version leaked'; end if;
end $$;
select public.save_site_draft(
 target_tenant=>(select id from site_fixture where k='tenant-a'),business_name=>'Distinct Store A',business_description=>'Changed draft',business_phone=>'',business_address=>'',
 theme_preset=>'restaurant',primary_color=>'#654321',accent_color=>'#ccbbaa',background_color=>'#202020',text_color=>'#f1f1f1',
 announcement_text=>'',announcement_enabled=>false,hero_eyebrow=>'',hero_headline=>'Unpublished headline',hero_subheadline=>'',hero_cta_label=>'',hero_variant=>'centered',
 products_heading=>'New products heading',products_enabled=>true,footer_description=>'',navigation=>'[{"label":"Home","target":"/","location":"HEADER","linkType":"URL","enabled":true}]'::jsonb
);
do $$ begin
 if (select configuration#>>'{sections,1,content,headline}' from public.tenant_site_versions where tenant_id=(select id from site_fixture where k='tenant-a') and status='PUBLISHED')<>'First published headline' then raise exception 'Draft changed live snapshot'; end if;
end $$;
select public.publish_site((select id from site_fixture where k='tenant-a'));
do $$ begin
 if (select count(*) from public.tenant_site_versions where tenant_id=(select id from site_fixture where k='tenant-a'))<>2 then raise exception 'Version history missing'; end if;
 if (select count(*) from public.tenant_site_versions where tenant_id=(select id from site_fixture where k='tenant-a') and status='PUBLISHED')<>1 then raise exception 'Multiple versions published'; end if;
 if (select configuration#>>'{sections,1,content,headline}' from public.tenant_site_versions where tenant_id=(select id from site_fixture where k='tenant-a') and status='PUBLISHED')<>'Unpublished headline' then raise exception 'Republish snapshot incorrect'; end if;
end $$;
insert into site_fixture(k,id) select 'page-a',public.save_content_page(
 target_tenant=>(select id from site_fixture where k='tenant-a'),target_page=>null,page_type=>'ABOUT',page_name=>'About us',page_slug=>'about-us',
 page_title=>'Our story',page_introduction=>'Who we are',page_body=>'Tenant-owned page content.',show_in_navigation=>true,page_enabled=>true
);
do $$ begin
 if jsonb_array_length((select configuration->'pages' from public.tenant_site_versions where tenant_id=(select id from site_fixture where k='tenant-a') and status='PUBLISHED'))<>0 then raise exception 'Saved page changed live snapshot'; end if;
end $$;
select public.reorder_homepage_sections((select id from site_fixture where k='tenant-a'),array['products','hero','announcement','footer']);
select public.save_global_seo((select id from site_fixture where k='tenant-a'),'Distinct Store A in Search','%s | Distinct Store A','Tenant A search description','@distincta',true,true,'','');
select public.publish_site((select id from site_fixture where k='tenant-a'));
do $$ begin
 if (select configuration#>>'{sections,0,key}' from public.tenant_site_versions where tenant_id=(select id from site_fixture where k='tenant-a') and status='PUBLISHED') is distinct from 'products' then raise exception 'Section order not published'; end if;
 if (select configuration#>>'{pages,0,title}' from public.tenant_site_versions where tenant_id=(select id from site_fixture where k='tenant-a') and status='PUBLISHED') is distinct from 'Our story' then raise exception 'Content page not published'; end if;
 if (select configuration#>>'{seo,title}' from public.tenant_site_versions where tenant_id=(select id from site_fixture where k='tenant-a') and status='PUBLISHED') is distinct from 'Distinct Store A in Search' then raise exception 'Search appearance not published'; end if;
 if not exists(select 1 from public.navigation_items where tenant_id=(select id from site_fixture where k='tenant-a') and link_type='PAGE' and target='/about-us') then raise exception 'Page menu link missing'; end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub',(select id::text from site_fixture where k='outsider'),true);
set local role authenticated;
do $$ begin
 begin perform public.publish_site((select id from site_fixture where k='tenant-a'));raise exception 'Outsider publish allowed';exception when insufficient_privilege then null;end;
 begin perform public.save_site_draft(target_tenant=>(select id from site_fixture where k='tenant-a'),business_name=>'Bad',business_description=>'',business_phone=>'',business_address=>'',theme_preset=>'general',primary_color=>'#111111',accent_color=>'#222222',background_color=>'#ffffff',text_color=>'#000000',announcement_text=>'',announcement_enabled=>false,hero_eyebrow=>'',hero_headline=>'Bad',hero_subheadline=>'',hero_cta_label=>'',hero_variant=>'centered',products_heading=>'Bad',products_enabled=>true,footer_description=>'',navigation=>'[]'::jsonb);raise exception 'Outsider draft write allowed';exception when insufficient_privilege then null;end;
 begin perform public.delete_content_page((select id from site_fixture where k='tenant-a'),(select id from site_fixture where k='page-a'));raise exception 'Outsider page delete allowed';exception when insufficient_privilege then null;end;
 begin perform public.save_global_seo((select id from site_fixture where k='tenant-a'),'Forbidden','%s | Forbidden','', '',true,true,'','');raise exception 'Outsider search settings write allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;

set local role anon;
do $$ declare site jsonb; begin
 site:=public.get_public_storefront(current_setting('businesscare.test_site_slug'))->'site';
 if site#>>'{sections,1,content,headline}' is distinct from 'Unpublished headline' then raise exception 'Published site unavailable anonymously'; end if;
 if site#>>'{pages,0,body}' is distinct from 'Tenant-owned page content.' then raise exception 'Published content page unavailable anonymously'; end if;
 if site#>>'{seo,description}' is distinct from 'Tenant A search description' then raise exception 'Published search settings unavailable anonymously'; end if;
 begin perform 1 from public.tenant_site_versions;raise exception 'Anonymous version table read allowed';exception when insufficient_privilege then null;end;
 begin perform 1 from public.content_blocks;raise exception 'Anonymous content table read allowed';exception when insufficient_privilege then null;end;
 begin perform 1 from public.seo_entries;raise exception 'Anonymous search override table read allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
