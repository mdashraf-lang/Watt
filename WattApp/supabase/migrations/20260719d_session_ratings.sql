-- ============================================================================
-- PHASE 4 — RATING AFTER CHARGING
-- ============================================================================
-- "Rating is not working after charging" — because it was never built. The
-- stations/charger_listings already have `rating` and `total_ratings` columns
-- (shown on the map), but nothing ever wrote to them. This adds the missing
-- piece: a star rating on the session-summary screen that updates the average.
--
-- One rating per session (enforced). Customers rate; the aggregate on the
-- station or private listing is recomputed server-side.
-- ============================================================================

create table if not exists public.session_ratings (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null unique references public.charging_sessions(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  station_id  uuid references public.stations(id) on delete cascade,
  listing_id  uuid references public.charger_listings(id) on delete cascade,
  rating      int  not null check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz not null default now()
);

alter table public.session_ratings enable row level security;

drop policy if exists "ratings: read own" on public.session_ratings;
create policy "ratings: read own" on public.session_ratings
  for select using ((select auth.uid()) = user_id);

create index if not exists idx_session_ratings_station on public.session_ratings (station_id);
create index if not exists idx_session_ratings_listing on public.session_ratings (listing_id);

-- Submit (or change) a rating for one of your own completed sessions. Writes
-- through here only — recomputes the station/listing average atomically.
create or replace function public.rate_session(
  p_session uuid,
  p_rating  int,
  p_comment text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_s       charging_sessions%rowtype;
  v_listing uuid;
  v_avg     numeric;
  v_count   int;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be 1 to 5';
  end if;

  select * into v_s from charging_sessions where id = p_session and user_id = v_uid;
  if not found then raise exception 'Session not found'; end if;

  -- Resolve which charger this session used (private listing preferred).
  v_listing := v_s.listing_id;
  if v_listing is null and v_s.booking_id is not null then
    select listing_id into v_listing from bookings where id = v_s.booking_id;
  end if;

  insert into session_ratings (session_id, user_id, station_id, listing_id, rating, comment)
  values (p_session, v_uid,
          case when v_listing is null then v_s.station_id end,
          v_listing, p_rating, nullif(trim(coalesce(p_comment, '')), ''))
  on conflict (session_id) do update
    set rating = excluded.rating, comment = excluded.comment, created_at = now();

  -- Recompute the aggregate for the rated charger.
  if v_listing is not null then
    select round(avg(rating)::numeric, 2), count(*) into v_avg, v_count
      from session_ratings where listing_id = v_listing;
    update charger_listings set rating = coalesce(v_avg, 5.0), total_ratings = v_count
      where id = v_listing;
  elsif v_s.station_id is not null then
    select round(avg(rating)::numeric, 2), count(*) into v_avg, v_count
      from session_ratings where station_id = v_s.station_id;
    update stations set rating = coalesce(v_avg, 5.0), total_ratings = v_count
      where id = v_s.station_id;
  end if;

  return jsonb_build_object('rating', p_rating, 'average', v_avg, 'count', v_count);
end $$;

revoke execute on function public.rate_session(uuid, int, text) from public, anon;
grant  execute on function public.rate_session(uuid, int, text) to authenticated;
