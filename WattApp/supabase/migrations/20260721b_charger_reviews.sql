-- ============================================================================
-- CHARGER REVIEWS (surface the Phase 4 ratings)
-- ============================================================================
-- Customers rate + comment after charging (session_ratings). Those are private
-- ("read own" RLS). This SECURITY DEFINER function returns a charger's public
-- reviews — rating, comment, date, and the reviewer's FIRST NAME only (privacy)
-- — so any signed-in user can see them on the station details screen.
-- ============================================================================

create or replace function public.get_charger_reviews(
  p_station uuid default null,
  p_listing uuid default null
)
returns table(
  rating        int,
  comment       text,
  reviewer      text,
  created_at    timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select r.rating,
         r.comment,
         -- First name only for privacy; "Customer" if unknown.
         coalesce(nullif(split_part(p.full_name, ' ', 1), ''), 'Customer'),
         r.created_at
  from session_ratings r
  left join profiles p on p.id = r.user_id
  where (p_station is not null and r.station_id = p_station)
     or (p_listing is not null and r.listing_id = p_listing)
  order by r.created_at desc
  limit 30;
$$;

revoke execute on function public.get_charger_reviews(uuid, uuid) from public, anon;
grant  execute on function public.get_charger_reviews(uuid, uuid) to authenticated;
