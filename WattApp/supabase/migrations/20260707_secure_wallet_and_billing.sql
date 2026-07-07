-- Security hardening for public launch.
--
-- 1) protect_profile_columns: the "update own profile" RLS policy allows any
--    column — so a user could set role='admin' or wallet_balance=99999 via
--    the API. This trigger makes security-sensitive columns immutable from
--    the client; only admins and server-side (service role / SECURITY
--    DEFINER) code may change them.
--
-- 2) complete_charging_session: billing used to happen client-side (the
--    phone computed the cost and wrote the wallet deduction). This RPC does
--    it server-side: recomputes cost from the admin-set price, caps kWh at
--    physical limits, and atomically completes session + booking + wallet.

create or replace function public.protect_profile_columns()
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
  -- Regular clients: sensitive columns are immutable
  new.role           := old.role;
  new.wallet_balance := old.wallet_balance;
  new.total_sessions := old.total_sessions;
  new.total_kwh      := old.total_kwh;
  if old.is_active = false then
    new.is_active := old.is_active;   -- may self-deactivate, never self-reactivate
  end if;
  return new;
end $$;

drop trigger if exists trg_protect_profile_columns on public.profiles;
create trigger trg_protect_profile_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- ── Server-side session completion & billing ─────────────────────────────
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
  v_uid     uuid := auth.uid();
  v_s       charging_sessions%rowtype;
  v_price   numeric;
  v_power   numeric;
  v_hours   numeric;
  v_kwh     numeric;
  v_cost    numeric;
  v_balance numeric;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_s from charging_sessions
    where id = p_session and user_id = v_uid
    for update;
  if not found then raise exception 'Session not found'; end if;

  -- Idempotent: stopping twice never double-charges
  if v_s.status <> 'active' then
    select wallet_balance into v_balance from profiles where id = v_uid;
    return jsonb_build_object('already', true,
      'cost', v_s.cost, 'kwh', v_s.kwh_delivered, 'balance', v_balance);
  end if;

  -- Price & power come from the server (admin-set), never the client
  if v_s.listing_id is not null then
    select cl.price_per_kwh, cl.power_kw into v_price, v_power
      from charger_listings cl where cl.id = v_s.listing_id;
  end if;
  if v_price is null and v_s.station_id is not null then
    select s.price_per_kwh, s.power_kw into v_price, v_power
      from stations s where s.id = v_s.station_id;
  end if;
  v_price := coalesce(v_price, 0.028);
  v_power := coalesce(v_power, 22);

  -- Accept the meter reading only within physical limits (25% headroom)
  v_hours := greatest(extract(epoch from (now() - v_s.started_at)) / 3600.0, 0);
  v_kwh   := least(greatest(coalesce(p_kwh, 0), 0), round(v_hours * v_power * 1.25, 4));
  v_cost  := round(v_kwh * v_price, 3);

  update charging_sessions set
    status          = 'completed',
    ended_at        = now(),
    kwh_delivered   = v_kwh,
    cost            = v_cost,
    battery_end_pct = coalesce(p_battery_end, battery_end_pct)
  where id = p_session;

  update bookings set status = 'completed'
    where id = v_s.booking_id and status in ('confirmed', 'active');

  update profiles set
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

  return jsonb_build_object('cost', v_cost, 'kwh', v_kwh, 'balance', v_balance);
end $$;

grant execute on function public.complete_charging_session(uuid, numeric, integer, text) to authenticated;
