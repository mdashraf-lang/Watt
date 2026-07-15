-- Security hardening #3 — advisor-driven fixes.
--
-- 1) CRITICAL: credit_wallet_topup free-money hole.
--    The function adds an arbitrary amount to any wallet and has NO internal
--    auth guard — it is meant to be called only by the service role from the
--    thawani-checkout edge function AFTER Thawani confirms payment.
--    The original migration did `revoke ... from anon, authenticated`, but
--    Postgres grants EXECUTE to PUBLIC by default and revoking from
--    anon/authenticated does NOT remove the PUBLIC grant — so any signed-in
--    user could call it directly and credit themselves unlimited money.
--    Fix: revoke from PUBLIC (and anon/authenticated explicitly). It is
--    SECURITY DEFINER owned by postgres, so the edge function (service_role)
--    keeps working.
revoke execute on function public.credit_wallet_topup(uuid, numeric, text, text) from public;
revoke execute on function public.credit_wallet_topup(uuid, numeric, text, text) from anon;
revoke execute on function public.credit_wallet_topup(uuid, numeric, text, text) from authenticated;

-- 2) ERROR: expired_active_sessions is a SECURITY DEFINER view, so querying it
--    over REST as any user would return EVERY user's active session (user_id,
--    tuya_device_id, …), bypassing RLS. The only real caller is the
--    auto-shutoff edge function, which uses the service role (bypasses RLS
--    regardless). Switch the view to invoker security so RLS on the underlying
--    tables applies to normal users while the cron keeps full visibility.
alter view public.expired_active_sessions set (security_invoker = true);

-- 3) WARN: pin search_path on the client-write protection trigger functions
--    so it cannot be shadowed by a role-mutable search_path.
alter function public.protect_session_columns() set search_path = public;
alter function public.protect_profile_columns() set search_path = public;
