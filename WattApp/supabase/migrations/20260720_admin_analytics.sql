-- ============================================================================
-- PHASE 8 — ADMIN ANALYTICS
-- ============================================================================
-- One admin-only function that returns the network's key numbers: revenue,
-- sessions, and kWh for today / this month / all-time, plus the top chargers
-- this month. Aggregates across all sessions (SECURITY DEFINER, admin-guarded).
-- ============================================================================

create or replace function public.get_admin_analytics()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_today timestamptz := date_trunc('day', now());
  v_month timestamptz := date_trunc('month', now());
  v_result jsonb;
begin
  if not (select public.is_admin()) then
    raise exception 'Permission denied: admin only';
  end if;

  select jsonb_build_object(
    'today', (
      select jsonb_build_object(
        'revenue',  coalesce(sum(cost), 0),
        'sessions', count(*),
        'kwh',      coalesce(sum(kwh_delivered), 0))
      from charging_sessions
      where status = 'completed' and ended_at >= v_today),
    'month', (
      select jsonb_build_object(
        'revenue',  coalesce(sum(cost), 0),
        'sessions', count(*),
        'kwh',      coalesce(sum(kwh_delivered), 0))
      from charging_sessions
      where status = 'completed' and ended_at >= v_month),
    'all_time', (
      select jsonb_build_object(
        'revenue',  coalesce(sum(cost), 0),
        'sessions', count(*),
        'kwh',      coalesce(sum(kwh_delivered), 0))
      from charging_sessions
      where status = 'completed'),
    'flagged', (
      select count(*) from charging_sessions where flagged_review = true),
    'top_chargers', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select coalesce(st.name, cl.station_name, cl.address, 'Charger') as name,
               count(*)                as sessions,
               coalesce(sum(cs.cost),0) as revenue
        from charging_sessions cs
        left join stations st        on st.id = cs.station_id
        left join charger_listings cl on cl.id = cs.listing_id
        where cs.status = 'completed' and cs.ended_at >= v_month
        group by 1
        order by revenue desc
        limit 5
      ) t)
  ) into v_result;

  return v_result;
end $$;

revoke execute on function public.get_admin_analytics() from public, anon;
grant  execute on function public.get_admin_analytics() to authenticated;
