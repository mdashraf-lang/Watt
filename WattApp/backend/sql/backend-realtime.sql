-- ============================================================================
-- Realtime — run ONCE on your PostgreSQL server.
-- ============================================================================
-- Emits a NOTIFY on the 'row_change' channel when stations / charger_listings /
-- bookings rows change. The backend LISTENs and pushes them to app clients over
-- Socket.IO (replaces Supabase Realtime).
-- ============================================================================

create or replace function public.notify_row_change()
returns trigger
language plpgsql
as $$
declare payload text;
begin
  payload := json_build_object(
    'table', TG_TABLE_NAME,
    'event', TG_OP,
    'new',   row_to_json(NEW)
  )::text;
  -- NOTIFY payload limit is ~8000 bytes; these rows are small.
  perform pg_notify('row_change', left(payload, 7900));
  return NEW;
end $$;

drop trigger if exists trg_notify_stations on public.stations;
create trigger trg_notify_stations after update on public.stations
  for each row execute function public.notify_row_change();

drop trigger if exists trg_notify_listings on public.charger_listings;
create trigger trg_notify_listings after update on public.charger_listings
  for each row execute function public.notify_row_change();

drop trigger if exists trg_notify_bookings on public.bookings;
create trigger trg_notify_bookings after update on public.bookings
  for each row execute function public.notify_row_change();
