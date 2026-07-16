-- Host booking list was broken: it queried bookings directly, but RLS
-- ("bookings: read own") hides customer bookings from the host, and
-- ("profiles: read own") nulls the joined customer name/phone. So a host could
-- not see who booked their charger. This ownership-scoped SECURITY DEFINER
-- function returns bookings for the caller's OWN listings only, with the
-- customer name/phone the host needs to expect their visitor.
create or replace function public.get_host_listing_bookings()
returns table(
  id                  uuid,
  listing_id          uuid,
  user_id             uuid,
  status              text,
  booked_at           timestamptz,
  duration_minutes    integer,
  estimated_kwh       numeric,
  estimated_cost      numeric,
  cancellation_reason text,
  customer_name       text,
  customer_phone      text
)
language sql
security definer
stable
set search_path = public
as $$
  select b.id, b.listing_id, b.user_id, b.status::text,
         b.booked_at, b.duration_minutes,
         b.estimated_kwh, b.estimated_cost, b.cancellation_reason,
         p.full_name, p.phone
  from bookings b
  join charger_listings cl on cl.id = b.listing_id and cl.host_id = auth.uid()
  left join profiles p on p.id = b.user_id
  order by b.booked_at desc
  limit 100;
$$;

revoke execute on function public.get_host_listing_bookings() from public;
revoke execute on function public.get_host_listing_bookings() from anon;
grant  execute on function public.get_host_listing_bookings() to authenticated;
