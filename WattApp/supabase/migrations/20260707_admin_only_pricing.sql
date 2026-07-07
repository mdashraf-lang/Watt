-- Pricing is controlled centrally by Watt admins.
-- Investors cannot set or change price_per_kwh on their listing — a trigger
-- enforces this at the database level (UI hiding alone is not security).

-- Default price applied to newly created listings (admin can change later).
insert into public.app_config (key, value)
values ('default_price_per_kwh', '0.028')
on conflict (key) do nothing;

create or replace function public.enforce_admin_pricing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_is_admin boolean;
begin
  select (role = 'admin') into v_is_admin from profiles where id = auth.uid();
  if coalesce(v_is_admin, false) then
    return new;   -- admins may set any price
  end if;

  -- Non-admin (investor app) or service role: price is centrally managed.
  if tg_op = 'INSERT' then
    new.price_per_kwh := coalesce(
      (select value::numeric from app_config where key = 'default_price_per_kwh'),
      0.028
    );
  else
    new.price_per_kwh := old.price_per_kwh;   -- silently keep existing price
  end if;
  return new;
end $$;

drop trigger if exists trg_enforce_admin_pricing on public.charger_listings;
create trigger trg_enforce_admin_pricing
  before insert or update on public.charger_listings
  for each row execute function public.enforce_admin_pricing();
