-- Atomic double-booking guard. Complements get_booked_slots (availability
-- DISPLAY) by making the database reject two overlapping active bookings on the
-- same charger, so a concurrent race cannot create them.
--
-- timestamptz + interval is only STABLE (DST-dependent), so it cannot appear in
-- an index/EXCLUDE expression or a generated column. Instead we maintain a
-- booked_end column via trigger and build the range from two stored timestamps
-- (tstzrange(timestamptz, timestamptz) IS immutable).

-- 1) End-time column, backfilled and kept in sync by a trigger.
alter table public.bookings add column if not exists booked_end timestamptz;

update public.bookings
set booked_end = booked_at + make_interval(mins => duration_minutes)
where booked_end is null;

create or replace function public.set_booking_end()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.booked_end := new.booked_at + make_interval(mins => new.duration_minutes);
  return new;
end $$;

drop trigger if exists trg_set_booking_end on public.bookings;
create trigger trg_set_booking_end
  before insert or update of booked_at, duration_minutes on public.bookings
  for each row execute function public.set_booking_end();

alter table public.bookings alter column booked_end set not null;

-- 2) Clear prerequisite conflicts: stale bookings that already ended but were
--    never completed (all past-dated) -> no_show. An EXCLUDE constraint cannot
--    be added NOT VALID, so existing overlaps must be resolved first.
update public.bookings
set status = 'no_show'
where status in ('pending','confirmed','active')
  and booked_end < now();

-- 3) btree_gist gives the gist opclass for '=' equality on the charger id.
create extension if not exists btree_gist with schema extensions;

-- 4) No two active bookings on the same charger (station OR listing) may have
--    overlapping time ranges. Partial: only live statuses are constrained, so
--    cancelled/completed/no_show rows never block a new booking.
alter table public.bookings
  add constraint bookings_no_overlap
  exclude using gist (
    (coalesce(station_id, listing_id)) with =,
    tstzrange(booked_at, booked_end) with &&
  ) where (status in ('pending','confirmed','active'));
