-- ============================================================================
-- PHASE 3 — DEVICE CONTROL & TRUST
-- ============================================================================
-- 1) LOCK THE DEVICE ID after admin verification. Once a charger's Tuya device
--    is verified by the admin, the investor can no longer change the device id
--    from the edit page. Enforced on the SERVER so a hacked app can't bypass
--    it. Only an admin may re-assign a device. This also stops a host from
--    self-verifying their own device (tuya_verified is admin-only).
--
-- 2) HARDWARE ↔ APP RECONCILIATION. Store the device's own energy meter reading
--    alongside what we billed, and auto-flag a session for admin review when the
--    two disagree beyond tolerance (catches faulty meters — protects both the
--    customer and the host).
-- ============================================================================

-- ── 1) Freeze the device id + verification flag for non-admins ──────────────
create or replace function public.protect_listing_device()
returns trigger
language plpgsql
as $$
begin
  -- Server-side code (service role / SECURITY DEFINER) passes through.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  -- Admins may change anything (assign/re-assign devices, verify).
  if exists (select 1 from profiles where id = auth.uid() and role = 'admin') then
    return new;
  end if;
  -- A host can NEVER flip verification themselves.
  new.tuya_verified := old.tuya_verified;
  -- Once verified, the device id is locked to its stored value.
  if old.tuya_verified is true then
    new.tuya_device_id := old.tuya_device_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_protect_listing_device on public.charger_listings;
create trigger trg_protect_listing_device
  before update on public.charger_listings
  for each row execute function public.protect_listing_device();

-- ── 2) Reconciliation columns ───────────────────────────────────────────────
alter table public.charging_sessions
  add column if not exists meter_kwh      numeric(8,3),          -- device's own reading
  add column if not exists flagged_review boolean not null default false;

-- ── 3) Finalise billing + reconciliation (replaces the Phase 1 version) ─────
-- Adds p_meter_kwh: the charger's independent energy-meter reading. Billing is
-- unchanged; we additionally store it and flag the session if it disagrees with
-- the physics-based estimate beyond tolerance.
drop function if exists public.complete_charging_session(uuid, numeric, integer, text);
drop function if exists public._finalize_charging_session(uuid, numeric, integer, text, timestamptz);

create function public._finalize_charging_session(
  p_session     uuid,
  p_kwh         numeric,
  p_battery_end integer     default null,
  p_description text        default null,
  p_ended_at    timestamptz default null,
  p_meter_kwh   numeric     default null
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
  v_est     numeric;
  v_flag    boolean := false;
  v_balance numeric;
begin
  select * into v_s from charging_sessions where id = p_session for update;
  if not found then raise exception 'Session not found'; end if;
  v_uid  := v_s.user_id;
  v_hold := coalesce(v_s.held_amount, 0);

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
  v_est   := round(v_hours * v_power, 4);
  v_kwh   := least(greatest(coalesce(p_kwh, 0), 0), round(v_hours * v_power * 1.25, 4));
  v_cost  := round(v_kwh * v_price, 3);

  -- Hold ceiling: never bill more than was reserved.
  if v_hold > 0 and v_cost > v_hold then
    v_cost := v_hold;
    v_kwh  := round(v_cost / nullif(v_price, 0), 4);
  end if;

  -- Reconcile: if the device's own meter disagrees with the physics estimate
  -- by more than 25% (and at least 0.5 kWh), flag for admin review.
  if p_meter_kwh is not null and abs(p_meter_kwh - v_est) > greatest(v_est * 0.25, 0.5) then
    v_flag := true;
  end if;

  update charging_sessions set
    status          = 'completed',
    ended_at        = coalesce(p_ended_at, now()),
    kwh_delivered   = v_kwh,
    cost            = v_cost,
    meter_kwh       = p_meter_kwh,
    flagged_review  = v_flag,
    battery_end_pct = coalesce(p_battery_end, battery_end_pct)
  where id = p_session;

  update bookings set status = 'completed'
    where id = v_s.booking_id and status in ('confirmed', 'active');

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

  if v_listing is not null then
    perform public.credit_host_earning(v_listing, p_session::text, v_cost);
  end if;

  return jsonb_build_object('cost', v_cost, 'kwh', v_kwh, 'balance', v_balance,
    'released', v_hold, 'flagged', v_flag, 'already', false);
end $$;

revoke execute on function public._finalize_charging_session(uuid, numeric, integer, text, timestamptz, numeric) from public, anon, authenticated;
grant  execute on function public._finalize_charging_session(uuid, numeric, integer, text, timestamptz, numeric) to service_role;

-- Client wrapper: authorise, then delegate. p_meter_kwh optional (the app sends
-- the device meter reading when it has one).
create function public.complete_charging_session(
  p_session     uuid,
  p_kwh         numeric,
  p_battery_end integer default null,
  p_description text    default null,
  p_meter_kwh   numeric default null
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
  return public._finalize_charging_session(p_session, p_kwh, p_battery_end, p_description, null, p_meter_kwh);
end $$;

grant execute on function public.complete_charging_session(uuid, numeric, integer, text, numeric) to authenticated;

-- Admin helper: list sessions flagged by reconciliation for review.
create or replace function public.get_flagged_sessions()
returns setof public.charging_sessions
language sql
security definer
stable
set search_path = public
as $$
  select * from charging_sessions
  where flagged_review = true and (select public.is_admin())
  order by ended_at desc nulls last
  limit 200;
$$;

revoke execute on function public.get_flagged_sessions() from public, anon;
grant  execute on function public.get_flagged_sessions() to authenticated;
