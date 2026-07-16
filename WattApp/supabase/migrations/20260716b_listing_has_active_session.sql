-- Lets a host safely check whether their charger currently has an active
-- charging session, without exposing other users' session rows (RLS hides
-- them). Used to stop a host from toggling availability OFF -- which sends the
-- Tuya switch OFF -- while a customer is mid-charge. Ownership-guarded so it
-- only ever reports on the caller's own listing.
create or replace function public.listing_has_active_session(p_listing uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not exists (
    select 1 from charger_listings where id = p_listing and host_id = auth.uid()
  ) then
    return false;   -- not the owner: reveal nothing
  end if;
  return exists (
    select 1 from charging_sessions
    where listing_id = p_listing and status = 'active'
  );
end $$;

revoke execute on function public.listing_has_active_session(uuid) from public;
revoke execute on function public.listing_has_active_session(uuid) from anon;
grant  execute on function public.listing_has_active_session(uuid) to authenticated;
