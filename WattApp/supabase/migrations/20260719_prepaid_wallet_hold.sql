-- ============================================================================
-- PHASE 1 — PREPAID WALLET HOLD (ESCROW)
-- ============================================================================
-- Goal: a customer can NEVER charge without the money being secured first.
--
-- BEFORE (postpaid): a customer could book with no money, charge, let the
--   wallet go negative, then tap "Pay Later" and walk away. Debt cap was 0.5 OMR.
--
-- AFTER (prepaid hold): when charging STARTS we reserve (hold) the full
--   estimated cost of the booking from the customer's available balance. They
--   physically cannot start unless funded. During/after charging the actual
--   cost is deducted and can never exceed what was held, so the balance can
--   never go negative. Any unused hold is released back instantly on stop.
--
-- Two balances live on the profile now:
--   wallet_balance  = total money in the wallet
--   held_balance    = money reserved for active sessions (not spendable)
--   available       = wallet_balance - held_balance   (what a new charge can use)
-- ============================================================================

-- ── 1) New columns ──────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists held_balance numeric(10,3) not null default 0;

alter table public.charging_sessions
  add column if not exists held_amount numeric(8,3) not null default 0;

-- ── 2) Hold-sizing config (admin can tune later) ────────────────────────────
insert into public.app_config (key, value) values
  ('session_hold_buffer', '1.25'),   -- reserve 25% above the estimate (headroom)
  ('session_hold_min',    '1.000')   -- never reserve less than 1.000 OMR
on conflict (key) do nothing;

-- ── 3) Freeze held_balance from the client ──────────────────────────────────
-- Extends the existing profile-column protection: only server-side code
-- (service role / SECURITY DEFINER functions) may move held_balance.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if exists (select 1 from profiles where id = auth.uid() and role = 'admin') then
    return new;
  end if;
  new.role           := old.role;
  new.wallet_balance := old.wallet_balance;
  new.held_balance   := old.held_balance;
  new.total_sessions := old.total_sessions;
  new.total_kwh      := old.total_kwh;
  if old.is_active = false then
    new.is_active := old.is_active;
  end if;
  return new;
end $$;

-- ── 4) START a charging session with a hold ─────────────────────────────────
-- Replaces the old client-side `insert into charging_sessions`. The client now
-- calls this RPC; it verifies funds, places the hold, and creates the session
-- atomically. Idempotent: calling twice for the same booking returns the
-- session already started (never double-holds).
create or replace function public.start_charging_session(
  p_booking uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_b         bookings%rowtype;
  v_listing   uuid;
  v_price     numeric;
  v_power     numeric;
  v_est_cost  numeric;
  v_buffer    numeric;
  v_min       numeric;
  v_hold      numeric;
  v_available numeric;
  v_wallet    numeric;
  v_held      numeric;
  v_session   uuid;
  v_existing  charging_sessions%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  -- Booking must exist and belong to the caller.
  select * into v_b from bookings where id = p_booking and user_id = v_uid for update;
  if not found then raise exception 'Booking not found'; end if;

  -- Idempotency: if an active session already exists for this booking, return it.
  select * into v_existing from charging_sessions
    where booking_id = p_booking and status = 'active'
    order by started_at desc limit 1;
  if found then
    return jsonb_build_object('session_id', v_existing.id, 'already', true,
      'held_amount', v_existing.held_amount);
  end if;

  -- Resolve price & power (private listing first, else official station).
  v_listing := v_b.listing_id;
  if v_listing is not null then
    select cl.price_per_kwh, cl.power_kw into v_price, v_power
      from charger_listings cl where cl.id = v_listing;
  end if;
  if v_price is null and v_b.station_id is not null then
    select s.price_per_kwh, s.power_kw into v_price, v_power
      from stations s where s.id = v_b.station_id;
  end if;
  v_price := coalesce(v_price, 0.028);
  v_power := coalesce(v_power, 22);

  -- Estimated full-booking cost = duration(h) * power(kW) * price.
  -- Prefer the booking's stored estimate; fall back to computing it.
  v_est_cost := coalesce(
    v_b.estimated_cost,
    round((v_b.duration_minutes / 60.0) * v_power * v_price, 3)
  );

  select coalesce((select value::numeric from app_config where key = 'session_hold_buffer'), 1.25) into v_buffer;
  select coalesce((select value::numeric from app_config where key = 'session_hold_min'),    1.000) into v_min;

  v_hold := greatest(round(v_est_cost * v_buffer, 3), v_min);

  -- Funds check: available = wallet - already-held.
  select wallet_balance, held_balance into v_wallet, v_held
    from profiles where id = v_uid for update;
  v_available := coalesce(v_wallet, 0) - coalesce(v_held, 0);

  if v_available < v_hold then
    raise exception 'INSUFFICIENT_BALANCE|required=%|available=%|shortfall=%',
      v_hold, v_available, round(v_hold - v_available, 3)
      using errcode = 'P0001';
  end if;

  -- Place the hold and create the session atomically.
  update profiles set held_balance = held_balance + v_hold where id = v_uid;

  insert into charging_sessions
    (booking_id, user_id, station_id, listing_id, connector_id,
     status, battery_start_pct, held_amount)
  values
    (v_b.id, v_uid, v_b.station_id, v_listing, v_b.connector_id,
     'active', 20, v_hold)
  returning id into v_session;

  update bookings set status = 'active' where id = v_b.id;

  return jsonb_build_object('session_id', v_session, 'held_amount', v_hold,
    'already', false);
end $$;

grant execute on function public.start_charging_session(uuid) to authenticated;

-- ── 5) FINALISE billing — shared by app stop AND server auto-shutoff ─────────
-- One authoritative code path so the two never diverge. Reads the customer
-- from the session row (no auth.uid()), so the service role can call it too.
-- Caps the final cost at the held amount → the wallet can never go negative.
create or replace function public._finalize_charging_session(
  p_session     uuid,
  p_kwh         numeric,
  p_battery_end integer default null,
  p_description text    default null,
  p_ended_at    timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s       charging_sessions%rowtype;
  v_uid     uuid;
  v_listing uuid;
  v_price   numeric;
  v_power   numeric;
  v_hours   numeric;
  v_kwh     numeric;
  v_cost    numeric;
  v_hold    numeric;
  v_balance numeric;
begin
  select * into v_s from charging_sessions where id = p_session for update;
  if not found then raise exception 'Session not found'; end if;
  v_uid  := v_s.user_id;
  v_hold := coalesce(v_s.held_amount, 0);

  -- Idempotent: already finalised → return stored values, do nothing.
  if v_s.status <> 'active' then
    select wallet_balance into v_balance from profiles where id = v_uid;
    return jsonb_build_object('already', true,
      'cost', v_s.cost, 'kwh', v_s.kwh_delivered, 'balance', v_balance);
  end if;

  v_listing := v_s.listing_id;
  if v_listing is null and v_s.booking_id is not null then
    select listing_id into v_listing from bookings where id = v_s.booking_id;
  end if;

  if v_listing is not null then
    select cl.price_per_kwh, cl.power_kw into v_price, v_power
      from charger_listings cl where cl.id = v_listing;
  end if;
  if v_price is null and v_s.station_id is not null then
    select s.price_per_kwh, s.power_kw into v_price, v_power
      from stations s where s.id = v_s.station_id;
  end if;
  v_price := coalesce(v_price, 0.028);
  v_power := coalesce(v_power, 22);

  v_hours := greatest(extract(epoch from (coalesce(p_ended_at, now()) - v_s.started_at)) / 3600.0, 0);
  v_kwh   := least(greatest(coalesce(p_kwh, 0), 0), round(v_hours * v_power * 1.25, 4));
  v_cost  := round(v_kwh * v_price, 3);

  -- The hold is the hard ceiling: never bill more than was reserved.
  if v_hold > 0 and v_cost > v_hold then
    v_cost := v_hold;
    v_kwh  := round(v_cost / nullif(v_price, 0), 4);
  end if;

  update charging_sessions set
    status          = 'completed',
    ended_at        = coalesce(p_ended_at, now()),
    kwh_delivered   = v_kwh,
    cost            = v_cost,
    battery_end_pct = coalesce(p_battery_end, battery_end_pct)
  where id = p_session;

  update bookings set status = 'completed'
    where id = v_s.booking_id and status in ('confirmed', 'active');

  -- Release the hold and deduct the real cost in one move.
  update profiles set
    held_balance   = greatest(held_balance - v_hold, 0),
    wallet_balance = wallet_balance - v_cost,
    total_sessions = total_sessions + 1,
    total_kwh      = total_kwh + v_kwh
  where id = v_uid
  returning wallet_balance into v_balance;

  insert into wallet_transactions
    (user_id, type, amount, balance_after, description, reference_id)
  values
    (v_uid, 'charge', -v_cost, v_balance,
     coalesce(p_description, 'Charging session'), p_session::text);

  -- Pay the charger owner their share (idempotent per session).
  if v_listing is not null then
    perform public.credit_host_earning(v_listing, p_session::text, v_cost);
  end if;

  return jsonb_build_object('cost', v_cost, 'kwh', v_kwh, 'balance', v_balance,
    'released', v_hold, 'already', false);
end $$;

-- Server-only: the client uses complete_charging_session below.
revoke execute on function public._finalize_charging_session(uuid, numeric, integer, text, timestamptz) from public;
revoke execute on function public._finalize_charging_session(uuid, numeric, integer, text, timestamptz) from anon;
revoke execute on function public._finalize_charging_session(uuid, numeric, integer, text, timestamptz) from authenticated;
grant  execute on function public._finalize_charging_session(uuid, numeric, integer, text, timestamptz) to service_role;

-- ── 6) Client-facing completion: authorise then delegate ────────────────────
create or replace function public.complete_charging_session(
  p_session     uuid,
  p_kwh         numeric,
  p_battery_end integer default null,
  p_description text    default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_owner uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select user_id into v_owner from charging_sessions where id = p_session;
  if v_owner is null then raise exception 'Session not found'; end if;
  if v_owner <> v_uid then raise exception 'Not your session'; end if;
  return public._finalize_charging_session(p_session, p_kwh, p_battery_end, p_description, null);
end $$;

grant execute on function public.complete_charging_session(uuid, numeric, integer, text) to authenticated;

-- ── 7) Repair any orphaned holds (safety) ───────────────────────────────────
-- If a hold was ever left on a session that is no longer active, clear it so
-- held_balance stays truthful. No-op on a clean DB.
update public.profiles p set held_balance = coalesce((
  select sum(cs.held_amount) from charging_sessions cs
  where cs.user_id = p.id and cs.status = 'active'
), 0)
where p.held_balance <> coalesce((
  select sum(cs.held_amount) from charging_sessions cs
  where cs.user_id = p.id and cs.status = 'active'
), 0);
