-- Payout/pricing fix: the customer booking flow created charging_sessions with
-- booking_id but no listing_id, so complete_charging_session couldn't find the
-- host (no payout) or the listing price (wrong price). Derive listing_id from
-- the booking when the session lacks it. Belt-and-braces alongside the app fix
-- in ActiveBookingScreen (which now also copies listing_id onto the session).
create or replace function public.complete_charging_session(
  p_session     uuid,
  p_kwh         numeric,
  p_battery_end integer default null,
  p_description text    default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid     uuid := auth.uid();
  v_s       charging_sessions%rowtype;
  v_listing uuid;
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

  if v_s.status <> 'active' then
    select wallet_balance into v_balance from profiles where id = v_uid;
    return jsonb_build_object('already', true,
      'cost', v_s.cost, 'kwh', v_s.kwh_delivered, 'balance', v_balance);
  end if;

  -- Resolve the listing: session's own, else the one on its booking.
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

  -- Pay the charger owner their share (0-commission by default).
  if v_listing is not null then
    perform public.credit_host_earning(v_listing, p_session::text, v_cost);
  end if;

  return jsonb_build_object('cost', v_cost, 'kwh', v_kwh, 'balance', v_balance);
end $function$;
