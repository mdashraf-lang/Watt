-- Push notification support: store the device's Expo push token and the
-- user's per-category notification preferences directly on the profile.
alter table public.profiles
  add column if not exists expo_push_token text,
  add column if not exists notif_push     boolean not null default true,
  add column if not exists notif_booking  boolean not null default true,
  add column if not exists notif_charging boolean not null default true,
  add column if not exists notif_promo    boolean not null default false;

-- Index for fanning out pushes to opted-in users.
create index if not exists idx_profiles_push_token
  on public.profiles (expo_push_token)
  where expo_push_token is not null;
