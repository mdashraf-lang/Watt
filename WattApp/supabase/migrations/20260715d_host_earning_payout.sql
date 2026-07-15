-- Host-earning feature, part 2: credit the charger owner when a customer pays.
-- Previously complete_charging_session only debited the customer; the host
-- (charger owner) was never paid, so the whole "hosts earn" premise was inert.

-- Credit a host their share of a completed charge. Idempotent per session,
-- reads the commission rate live from app_config. Server-only (service role
-- + the SECURITY DEFINER billing RPC that owns it).
create or replace function public.credit_host_earning(
  p_listing uuid,
  p_session text,
  p_gross   numeric
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host    uuid;
  v_rate    numeric;
  v_net     numeric;
  v_balance numeric;
begin
  if p_listing is null or coalesce(p_gross, 0) <= 0 then return; end if;

  select host_id into v_host from charger_listings where id = p_listing;
  if v_host is null then return; end if;

  -- At most one earning credit per session (idempotent on retries/auto-stop).
  if exists (select 1 from wallet_transactions
             where reference_id = p_session and type = 'earning') then
    return;
  end if;

  select coalesce((select value::numeric from app_config where key = 'host_commission_rate'), 0)
    into v_rate;
  v_rate := least(greatest(coalesce(v_rate, 0), 0), 1);
  v_net  := round(p_gross * (1 - v_rate), 3);
  if v_net <= 0 then return; end if;

  update profiles set wallet_balance = wallet_balance + v_net
    where id = v_host
    returning wallet_balance into v_balance;

  insert into wallet_transactions
    (user_id, type, amount, balance_after, description, reference_id)
  values
    (v_host, 'earning', v_net, v_balance, 'Charging earnings', p_session);
end $$;

revoke execute on function public.credit_host_earning(uuid, text, numeric) from public;
revoke execute on function public.credit_host_earning(uuid, text, numeric) from anon;
revoke execute on function public.credit_host_earning(uuid, text, numeric) from authenticated;
grant  execute on function public.credit_host_earning(uuid, text, numeric) to service_role;

-- Extend the billing RPC to pay the host after debiting the customer.
-- (Superseded by 20260715e which also derives listing_id from the booking.)
