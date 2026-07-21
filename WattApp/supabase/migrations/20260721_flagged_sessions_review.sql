-- ============================================================================
-- ADMIN — FLAGGED SESSIONS REVIEW
-- ============================================================================
-- Phase 3 flags a charging session when the device's own meter disagrees with
-- the physics estimate beyond tolerance (possible faulty meter / tampering).
-- These give the admin app a detailed list to review, and a way to clear a
-- flag once checked.
-- ============================================================================

-- Detailed list of flagged sessions with customer + charger names and the
-- meter-vs-billed numbers, for the admin review screen. Admin-guarded.
create or replace function public.get_flagged_sessions_detail()
returns table(
  id             uuid,
  customer_name  text,
  charger_name   text,
  started_at     timestamptz,
  ended_at       timestamptz,
  kwh_delivered  numeric,
  meter_kwh      numeric,
  cost           numeric
)
language sql
security definer
stable
set search_path = public
as $$
  select cs.id,
         p.full_name,
         coalesce(st.name, cl.station_name, cl.address, 'Charger'),
         cs.started_at, cs.ended_at,
         cs.kwh_delivered, cs.meter_kwh, cs.cost
  from charging_sessions cs
  left join profiles p          on p.id = cs.user_id
  left join stations st         on st.id = cs.station_id
  left join charger_listings cl on cl.id = cs.listing_id
  where cs.flagged_review = true and (select public.is_admin())
  order by cs.ended_at desc nulls last
  limit 200;
$$;

revoke execute on function public.get_flagged_sessions_detail() from public, anon;
grant  execute on function public.get_flagged_sessions_detail() to authenticated;

-- Clear a flag after the admin has reviewed it.
create or replace function public.resolve_flagged_session(p_session uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'Permission denied: admin only';
  end if;
  update charging_sessions set flagged_review = false where id = p_session;
end $$;

revoke execute on function public.resolve_flagged_session(uuid) from public, anon;
grant  execute on function public.resolve_flagged_session(uuid) to authenticated;
