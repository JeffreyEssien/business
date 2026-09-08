-- Keep page-backed navigation attached to the page throughout edits and deletion.
create or replace function public.save_content_page(
 target_tenant uuid,target_page uuid,page_type text,page_name text,page_slug text,
 page_title text,page_introduction text,page_body text,show_in_navigation boolean,page_enabled boolean
) returns uuid
language plpgsql security definer set search_path='' as $$
declare saved uuid; actor uuid; next_order integer;
begin
 if not private.can_manage_catalog(target_tenant) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if save_content_page.page_type not in ('ABOUT','CONTACT','POLICY','CUSTOM')
  or save_content_page.page_name is null or length(trim(save_content_page.page_name)) not between 1 and 80
  or save_content_page.page_slug is null or length(save_content_page.page_slug) not between 1 and 100
  or save_content_page.page_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or save_content_page.page_slug in ('home','products')
  or save_content_page.page_title is null or length(trim(save_content_page.page_title)) not between 1 and 160
  or length(coalesce(save_content_page.page_introduction,''))>500
  or length(coalesce(save_content_page.page_body,'')) not between 1 and 20000
  or save_content_page.show_in_navigation is null or save_content_page.page_enabled is null
 then raise exception 'INVALID_CONTENT_PAGE' using errcode='22023'; end if;
 select u.id into actor from public.users u where u.auth_user_id=auth.uid();
 if target_page is null then
  select coalesce(max(p.sort_order),0)+1 into next_order from public.pages p where p.tenant_id=target_tenant;
  insert into public.pages(tenant_id,slug,name,status,page_type,show_in_navigation,sort_order,is_enabled)
  values(target_tenant,page_slug,trim(page_name),'DRAFT',page_type,show_in_navigation,next_order,page_enabled)
  returning id into saved;
 else
  update public.pages p set
   slug=save_content_page.page_slug,
   name=trim(save_content_page.page_name),
   page_type=save_content_page.page_type,
   show_in_navigation=save_content_page.show_in_navigation,
   is_enabled=save_content_page.page_enabled
  where p.tenant_id=target_tenant and p.id=target_page and p.page_type<>'HOME'
  returning p.id into saved;
  if saved is null then raise exception 'CONTENT_PAGE_NOT_FOUND'; end if;
 end if;
 insert into public.content_blocks(tenant_id,page_id,block_key,block_type,variant,sort_order,is_enabled,content)
 values(target_tenant,saved,'main','rich-text','plain',0,true,jsonb_build_object(
  'title',trim(page_title),'introduction',trim(coalesce(page_introduction,'')),'body',trim(page_body)
 )) on conflict(tenant_id,page_id,block_key) do update set content=excluded.content,is_enabled=true;
 if show_in_navigation and page_enabled then
  if exists(select 1 from public.navigation_items n where n.tenant_id=target_tenant and n.link_type='PAGE' and n.page_id=saved) then
   update public.navigation_items n set target='/'||page_slug
   where n.tenant_id=target_tenant and n.link_type='PAGE' and n.page_id=saved;
  else
   select coalesce(max(n.sort_order),-1)+1 into next_order from public.navigation_items n
   where n.tenant_id=target_tenant and n.location='HEADER';
   insert into public.navigation_items(tenant_id,label,target,sort_order,location,link_type,is_enabled,page_id)
   values(target_tenant,trim(page_name),'',next_order,'HEADER','PAGE',true,saved);
  end if;
 else
  delete from public.navigation_items n where n.tenant_id=target_tenant and n.link_type='PAGE' and n.page_id=saved;
 end if;
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id)
 values(target_tenant,actor,case when target_page is null then 'CONTENT_PAGE_CREATED' else 'CONTENT_PAGE_UPDATED' end,'pages',saved);
 return saved;
end $$;

create or replace function public.delete_content_page(target_tenant uuid,target_page uuid) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid; deleted uuid;
begin
 if not private.can_manage_catalog(target_tenant) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select u.id into actor from public.users u where u.auth_user_id=auth.uid();
 delete from public.content_blocks c
 where c.tenant_id=target_tenant and c.page_id=target_page
  and exists(select 1 from public.pages p where p.tenant_id=target_tenant and p.id=target_page and p.page_type<>'HOME');
 delete from public.pages p
 where p.tenant_id=target_tenant and p.id=target_page and p.page_type<>'HOME'
 returning p.id into deleted;
 if deleted is null then raise exception 'CONTENT_PAGE_NOT_FOUND'; end if;
 insert into public.audit_logs(tenant_id,actor_user_id,action,resource_type,resource_id)
 values(target_tenant,actor,'CONTENT_PAGE_DELETED','pages',target_page);
end $$;
