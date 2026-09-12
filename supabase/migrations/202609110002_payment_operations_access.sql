-- RLS already restricts these sanitized webhook records to super admins. The
-- table also needs a SELECT grant for that policy to become reachable.
grant select on public.payment_webhook_events to authenticated;
