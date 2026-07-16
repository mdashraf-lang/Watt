-- Performance: wrap auth.uid() as (select auth.uid()) in the "own"/"auth" RLS
-- policies so Postgres evaluates it once per query instead of once per row
-- (advisor 0003 auth_rls_initplan). Semantics are identical. Admin policies are
-- left untouched.

-- profiles
drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles for select using ((select auth.uid()) = id);
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles for update using ((select auth.uid()) = id);

-- bookings
drop policy if exists "bookings: read own" on public.bookings;
create policy "bookings: read own" on public.bookings for select using ((select auth.uid()) = user_id);
drop policy if exists "bookings: insert own" on public.bookings;
create policy "bookings: insert own" on public.bookings for insert with check ((select auth.uid()) = user_id);
drop policy if exists "bookings: update own" on public.bookings;
create policy "bookings: update own" on public.bookings for update using ((select auth.uid()) = user_id);

-- charging_sessions
drop policy if exists "sessions: read own" on public.charging_sessions;
create policy "sessions: read own" on public.charging_sessions for select using ((select auth.uid()) = user_id);
drop policy if exists "sessions: insert own" on public.charging_sessions;
create policy "sessions: insert own" on public.charging_sessions for insert with check ((select auth.uid()) = user_id);
drop policy if exists "sessions: update own" on public.charging_sessions;
create policy "sessions: update own" on public.charging_sessions for update using ((select auth.uid()) = user_id);

-- wallet_transactions
drop policy if exists "wallet: read own" on public.wallet_transactions;
create policy "wallet: read own" on public.wallet_transactions for select using ((select auth.uid()) = user_id);

-- investor_applications
drop policy if exists "investor: insert auth" on public.investor_applications;
create policy "investor: insert auth" on public.investor_applications for insert with check ((select auth.uid()) is not null);
drop policy if exists "investor: read own" on public.investor_applications;
create policy "investor: read own" on public.investor_applications for select using ((select auth.uid()) = user_id);

-- payment_sessions
drop policy if exists "own payment sessions" on public.payment_sessions;
create policy "own payment sessions" on public.payment_sessions for select using ((select auth.uid()) = user_id);

-- Index the FK used by get_host_listing_bookings / get_booked_slots joins.
create index if not exists idx_bookings_listing_id on public.bookings (listing_id);
