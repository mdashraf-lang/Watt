-- ============================================================================
-- GO WATT — scheduled jobs (pg_cron) for the self-hosted server
-- ============================================================================
-- Runs the two background functions on a timer. EDIT the two URLs below to your
-- domain, and the secret headers to match AUTO_SHUTOFF_SECRET / DISBURSE_SECRET
-- from your secrets.env.
--
-- Requires the pg_cron + pg_net extensions (Supabase self-host ships them).
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ── 1) Auto-shutoff — every minute: stop expired sessions & bill them ───────
select cron.schedule(
  'auto-shutoff-chargers',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://api.gowatt.om/functions/v1/auto-shutoff-chargers',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-shutoff-secret', 'REPLACE_WITH_AUTO_SHUTOFF_SECRET'),
    body    := '{}'::jsonb
  );
  $$
);

-- ── 2) No-show release — every 10 minutes (pure SQL, already in the DB) ──────
select cron.schedule(
  'release-no-shows',
  '*/10 * * * *',
  'select public.release_no_show_bookings()'
);

-- ── 3) Automatic payouts — once daily (only acts if enabled + provider set) ──
select cron.schedule(
  'disburse-payouts',
  '0 6 * * *',
  $$
  select net.http_post(
    url     := 'https://api.gowatt.om/functions/v1/disburse-payouts',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-disburse-secret', 'REPLACE_WITH_DISBURSE_SECRET'),
    body    := '{}'::jsonb
  );
  $$
);

-- Verify:
select jobname, schedule, active from cron.job order by jobname;
