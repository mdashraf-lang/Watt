-- ============================================================================
-- PHASE 8 — NO-SHOW HANDLING
-- ============================================================================
-- If a customer books but never starts charging, the slot stays "taken" until
-- its time window ends. This marks such bookings as `no_show` once their window
-- has fully passed — which frees the slot (the no-overlap constraint is partial
-- and ignores no_show/cancelled/completed). Runs every 10 minutes via pg_cron.
--
-- No fee is charged (no money was ever held for a session that never started);
-- a small no-show fee can be added later if desired.
-- ============================================================================

create or replace function public.release_no_show_bookings()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count int;
begin
  update bookings
  set status = 'no_show',
      cancellation_reason = coalesce(cancellation_reason, 'No-show — charging never started')
  where status in ('pending', 'confirmed')
    and booked_end < now();
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke execute on function public.release_no_show_bookings() from public, anon, authenticated;
grant  execute on function public.release_no_show_bookings() to service_role;

-- Schedule every 10 minutes (upsert by job name).
select cron.unschedule(jobid) from cron.job where jobname = 'release-no-shows';
select cron.schedule('release-no-shows', '*/10 * * * *', 'select public.release_no_show_bookings()');
