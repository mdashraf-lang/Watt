-- Fix double-booking: the client slot picker queried the bookings table
-- directly, but RLS ("bookings: read own") means a customer only sees their
-- OWN bookings -- so slots taken by OTHER users showed as free and two people
-- could book the same slot. It also filtered by station_id only, missing
-- private-charger (listing) bookings entirely.
--
-- This SECURITY DEFINER function returns ONLY slot ranges (start + duration)
-- for one charger over a time window -- no user id, cost, or other data -- so
-- it is safe to expose while giving the picker a true, all-users view.
create or replace function public.get_booked_slots(
  p_from    timestamptz,
  p_to      timestamptz,
  p_station uuid default null,
  p_listing uuid default null
) returns table(booked_at timestamptz, duration_minutes integer)
language sql
security definer
stable
set search_path = public
as $$
  select b.booked_at, b.duration_minutes
  from bookings b
  where b.status in ('pending', 'confirmed', 'active')
    and b.booked_at >= p_from
    and b.booked_at <= p_to
    and (
      (p_listing is not null and b.listing_id = p_listing)
      or (p_listing is null and p_station is not null and b.station_id = p_station)
    );
$$;

revoke execute on function public.get_booked_slots(timestamptz, timestamptz, uuid, uuid) from public;
grant  execute on function public.get_booked_slots(timestamptz, timestamptz, uuid, uuid) to authenticated;
