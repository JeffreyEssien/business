-- Portfolio builder, phase 2: undo (docs/plans/portfolio-templates.md §5.3, §5.5).
-- Before a portfolio part or entry changes, its previous state is kept. Changes made
-- close together (autosave while typing) form one step, so "Undo" reverts the last burst
-- of editing rather than a single keystroke. Only the latest 20 steps per item are kept.

create table public.portfolio_revisions (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants (id),
  target_kind text not null check (target_kind in ('part', 'entry')),
  target_ref text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);
create index portfolio_revisions_target on public.portfolio_revisions (tenant_id, target_kind, target_ref, id desc);
alter table public.portfolio_revisions enable row level security;
revoke all on public.portfolio_revisions from anon, authenticated;
grant select on public.portfolio_revisions to authenticated;
create policy tenant_read on public.portfolio_revisions for select to authenticated
  using ((select private.is_super_admin()) or private.is_tenant_member(tenant_id));

-- Edits within this window of the previous recorded step join that step.
create function private.record_portfolio_revision(
  target_tenant uuid, kind text, ref text, snapshot jsonb
) returns void language plpgsql security definer set search_path = '' as $$
begin
  -- Restoring a step must not record itself as a new step.
  if coalesce(current_setting('businesscare.undoing', true), '') = 'true' then return; end if;
  if exists (
    select 1 from public.portfolio_revisions
    where tenant_id = target_tenant and target_kind = kind and target_ref = ref
      and created_at > now() - interval '30 seconds'
  ) then
    return;
  end if;
  insert into public.portfolio_revisions (tenant_id, target_kind, target_ref, snapshot)
  values (target_tenant, kind, ref, snapshot);
  delete from public.portfolio_revisions
  where tenant_id = target_tenant and target_kind = kind and target_ref = ref
    and id not in (
      select id from public.portfolio_revisions
      where tenant_id = target_tenant and target_kind = kind and target_ref = ref
      order by id desc limit 20);
end;
$$;
revoke all on function private.record_portfolio_revision(uuid, text, text, jsonb) from public;

create function private.track_part_revision() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if private.tenant_site_kind(old.tenant_id) = 'PORTFOLIO'
    and (old.content, old.variant, old.is_enabled)
      is distinct from (new.content, new.variant, new.is_enabled) then
    perform private.record_portfolio_revision(old.tenant_id, 'part', old.block_key, jsonb_build_object(
      'content', old.content, 'variant', old.variant, 'isEnabled', old.is_enabled));
  end if;
  return new;
end;
$$;
revoke all on function private.track_part_revision() from public;
create trigger content_blocks_track_revision before update on public.content_blocks
for each row execute function private.track_part_revision();

create function private.track_entry_revision() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Example tracking recomputes is_sample on every write; only owner-visible fields count.
  if (old.title, old.subtitle, old.summary, old.body, old.role, old.outcome, old.link_url,
      old.source_url, old.starts_on, old.ends_on, old.is_current, old.tags, old.status)
    is distinct from (new.title, new.subtitle, new.summary, new.body, new.role, new.outcome,
      new.link_url, new.source_url, new.starts_on, new.ends_on, new.is_current, new.tags, new.status) then
    perform private.record_portfolio_revision(old.tenant_id, 'entry', old.id::text, jsonb_build_object(
      'title', old.title, 'subtitle', old.subtitle, 'summary', old.summary, 'body', old.body,
      'role', old.role, 'outcome', old.outcome, 'link_url', old.link_url, 'source_url', old.source_url,
      'starts_on', old.starts_on, 'ends_on', old.ends_on, 'is_current', old.is_current,
      'tags', to_jsonb(old.tags), 'status', old.status));
  end if;
  return new;
end;
$$;
revoke all on function private.track_entry_revision() from public;
create trigger portfolio_items_track_revision before update on public.portfolio_items
for each row execute function private.track_entry_revision();

-- Restores the latest step for one part or entry and removes it from the history.
-- Photos are not part of undo (a replaced file may already be gone from Cloudinary).
create function public.undo_portfolio_change(target_tenant uuid, kind text, ref text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare step public.portfolio_revisions%rowtype; actor uuid;
begin
  perform private.assert_portfolio_editor(target_tenant);
  select * into step from public.portfolio_revisions
  where tenant_id = target_tenant and target_kind = kind and target_ref = ref
  order by id desc limit 1 for update;
  if step.id is null then return false; end if;
  perform set_config('businesscare.undoing', 'true', true);
  if kind = 'part' then
    update public.content_blocks set
      content = step.snapshot -> 'content',
      variant = step.snapshot ->> 'variant',
      is_enabled = case when block_type = 'hero' then true else (step.snapshot ->> 'isEnabled')::boolean end
    where tenant_id = target_tenant and page_id = private.portfolio_home_page(target_tenant)
      and block_key = ref;
    perform private.sync_layout_settings(target_tenant);
  elsif kind = 'entry' then
    update public.portfolio_items set
      title = step.snapshot ->> 'title', subtitle = step.snapshot ->> 'subtitle',
      summary = step.snapshot ->> 'summary', body = step.snapshot ->> 'body',
      role = step.snapshot ->> 'role', outcome = step.snapshot ->> 'outcome',
      link_url = step.snapshot ->> 'link_url', source_url = step.snapshot ->> 'source_url',
      starts_on = (step.snapshot ->> 'starts_on')::date, ends_on = (step.snapshot ->> 'ends_on')::date,
      is_current = (step.snapshot ->> 'is_current')::boolean,
      tags = array(select jsonb_array_elements_text(step.snapshot -> 'tags')),
      status = step.snapshot ->> 'status'
    where tenant_id = target_tenant and id::text = ref;
  else
    raise exception 'INVALID_CONTENT' using errcode = '22023';
  end if;
  perform set_config('businesscare.undoing', 'false', true);
  delete from public.portfolio_revisions where id = step.id;
  select id into actor from public.users where auth_user_id = auth.uid();
  insert into public.audit_logs (tenant_id, actor_user_id, action, resource_type, resource_id)
  values (target_tenant, actor, 'PORTFOLIO_CHANGE_UNDONE', 'portfolio_revisions', target_tenant);
  return true;
end;
$$;
revoke all on function public.undo_portfolio_change(uuid, text, text) from public, anon;
grant execute on function public.undo_portfolio_change(uuid, text, text) to authenticated;
