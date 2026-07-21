-- ============================================================================
-- FAVORITE CHARGERS
-- ============================================================================
-- Lets a customer save chargers for quick access / rebooking. A favorite points
-- at either an official station or a private listing. Each user's favorites are
-- private (RLS: own only), and they manage their own rows directly.
-- ============================================================================

create table if not exists public.favorites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  station_id  uuid references public.stations(id) on delete cascade,
  listing_id  uuid references public.charger_listings(id) on delete cascade,
  created_at  timestamptz not null default now(),
  -- exactly one target, and no duplicates per user
  constraint favorites_one_target check (num_nonnulls(station_id, listing_id) = 1),
  constraint favorites_uniq_station unique (user_id, station_id),
  constraint favorites_uniq_listing unique (user_id, listing_id)
);

alter table public.favorites enable row level security;

drop policy if exists "favorites: read own"   on public.favorites;
create policy "favorites: read own"   on public.favorites
  for select using ((select auth.uid()) = user_id);

drop policy if exists "favorites: insert own" on public.favorites;
create policy "favorites: insert own" on public.favorites
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "favorites: delete own" on public.favorites;
create policy "favorites: delete own" on public.favorites
  for delete using ((select auth.uid()) = user_id);

create index if not exists idx_favorites_user on public.favorites (user_id);
