-- Preserve the payment instructions shown when an order was placed, even if the
-- merchant changes their active settlement account later.
alter table public.orders
  add column payment_instructions_snapshot jsonb not null default '{}'::jsonb;

create function private.snapshot_order_payment_instructions() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.payment_method='BANK_TRANSFER' and new.payment_instructions_snapshot='{}'::jsonb then
  select jsonb_build_object(
   'bankName',b.bank_name,'accountNumber',b.account_number,
   'accountName',b.account_name,'instructions',b.instructions
  ) into new.payment_instructions_snapshot
  from public.tenant_bank_accounts b
  where b.tenant_id=new.tenant_id and b.is_active limit 1;
  new.payment_instructions_snapshot=coalesce(new.payment_instructions_snapshot,'{}'::jsonb);
 end if;
 return new;
end $$;
revoke all on function private.snapshot_order_payment_instructions() from public;
create trigger orders_payment_instructions_snapshot
before insert on public.orders for each row execute function private.snapshot_order_payment_instructions();

