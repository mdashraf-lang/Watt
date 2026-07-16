-- App Store compliance (Apple Guideline 5.1.1(v)): users who can create an
-- account must be able to permanently DELETE it (not just deactivate).
-- Deleting the auth.users row cascades to profiles and all owned data
-- (bookings, charging_sessions, wallet_transactions, payout_requests, ...).
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  delete from auth.users where id = v_uid;
end $$;

revoke execute on function public.delete_own_account() from public, anon;
grant  execute on function public.delete_own_account() to authenticated;
