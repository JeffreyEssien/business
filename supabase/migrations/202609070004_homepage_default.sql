-- Provisioning creates the reserved home page without specifying page_type.
alter table public.pages alter column page_type set default 'HOME';
update public.pages set page_type='HOME' where slug='home' and page_type<>'HOME';
