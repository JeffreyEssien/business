-- A page-backed homepage action must always have its destination page prepared.
-- This protects submissions made outside the browser UI as well as admin edits.
create function private.ensure_application_destination_page() returns trigger
language plpgsql
set search_path=''
as $$
begin
  if new.primary_action_destination in ('ABOUT','CONTACT','DELIVERY')
     and not new.primary_action_destination=any(new.requested_pages) then
    new.requested_pages:=array_append(new.requested_pages,new.primary_action_destination);
  end if;
  return new;
end;
$$;

create trigger ensure_application_destination_page
before insert or update of primary_action_destination,requested_pages
on public.business_applications
for each row execute function private.ensure_application_destination_page();
