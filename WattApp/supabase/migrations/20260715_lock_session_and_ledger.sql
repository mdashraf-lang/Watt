-- Security hardening #2 — close two client-side write loopholes.
--
-- 1) FREE-CHARGING HOLE. The "sessions: update own" RLS policy let a client
--    update ANY column of its own charging_sessions row. A technical user
--    could set status='completed', cost=0 directly — then complete_charging_session
--    sees a non-active session, takes its idempotent early-return, and never
--    charges for electricity actually delivered.
--    Fix: a trigger (mirroring protect_profile_columns) that lets regular
--    clients change ONLY the live-progress fields (kwh_delivered, cost,
--    battery_end_pct) while status/timestamps/ownership stay server-controlled.
--    The billing RPC is SECURITY DEFINER, so current_user is the function owner
--    (not authenticated/anon) and passes straight through.
--
-- 2) WALLET LEDGER INJECTION. "wallet: insert own" let a client insert
--    arbitrary rows into wallet_transactions. wallet_balance itself is already
--    protected, but the ledger (history/receipts) could be polluted with fake
--    entries. All real inserts come from SECURITY DEFINER RPCs, so the client
--    insert policy is unnecessary. Drop it.

-- ── 1) Lock charging_sessions billing fields ─────────────────────────────
create or replace function public.protect_session_columns()
returns trigger
language plpgsql
as $$
begin
  -- Server-side code (service role, SECURITY DEFINER functions) passes through
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  -- Admins may change anything
  if exists (select 1 from profiles where id = auth.uid() and role = 'admin') then
    return new;
  end if;
  -- Regular clients: only live-progress fields may change; everything that
  -- affects billing or lifecycle is frozen to its stored value.
  new.status          := old.status;
  new.started_at      := old.started_at;
  new.ended_at        := old.ended_at;
  new.user_id         := old.user_id;
  new.booking_id      := old.booking_id;
  new.listing_id      := old.listing_id;
  new.station_id      := old.station_id;
  -- kwh_delivered, cost, battery_end_pct remain client-writable for the live
  -- progress display; the completion RPC recomputes and caps them anyway.
  return new;
end $$;

drop trigger if exists trg_protect_session_columns on public.charging_sessions;
create trigger trg_protect_session_columns
  before update on public.charging_sessions
  for each row execute function public.protect_session_columns();

-- ── 2) Remove client insert into the wallet ledger ───────────────────────
drop policy if exists "wallet: insert own" on public.wallet_transactions;
