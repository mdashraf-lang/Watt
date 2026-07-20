-- ============================================================================
-- CUSTOMER CAR PROFILE
-- ============================================================================
-- Car details the customer fills in (once) so charging estimates and the
-- booking flow work smoothly. These are non-sensitive and client-editable —
-- the protect_profile_columns trigger does NOT freeze them, so the app can
-- update them via a normal profile update.
--
-- car_model already exists on profiles. We add:
--   car_make        text     — e.g. "Tesla", "Nissan"
--   battery_kwh     numeric  — usable battery size in kWh (for full-charge time)
--   connector_type  text     — Type2 | CCS | CHAdeMO | GBT
--   profile_prompted boolean — has the post-signup "complete profile" popup shown?
-- ============================================================================

alter table public.profiles
  add column if not exists car_make         text,
  add column if not exists battery_kwh      numeric(5,1),
  add column if not exists connector_type   text,
  add column if not exists profile_prompted boolean not null default false;
