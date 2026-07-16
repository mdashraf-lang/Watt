-- Investor payout infrastructure, part 2: RPCs.

-- Investor requests a payout. Atomically validates, holds the funds (deducts
-- from balance now so it can't be double-spent), and records the request with a
-- snapshot of the bank details.
create or replace function public.request_payout(p_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_p   profiles%rowtype;
  v_bal numeric;
  v_req uuid;
  v_min numeric := 1;   -- minimum payout: 1 OMR
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_amount is null or p_amount < v_min then
    raise exception 'Minimum payout is % OMR', v_min;
  end if;

  select * into v_p from profiles where id = v_uid for update;

  if v_p.payout_iban is null or length(trim(v_p.payout_iban)) = 0 then
    raise exception 'Add your bank details before requesting a payout';
  end if;
  if exists (select 1 from payout_requests where user_id = v_uid and status = 'pending') then
    raise exception 'You already have a pending payout request';
  end if;
  if coalesce(v_p.wallet_balance, 0) < p_amount then
    raise exception 'Amount exceeds your available balance';
  end if;

  update profiles set wallet_balance = wallet_balance - p_amount
    where id = v_uid returning wallet_balance into v_bal;

  insert into wallet_transactions (user_id, type, amount, balance_after, description)
    values (v_uid, 'withdrawal', -p_amount, v_bal, 'Payout request');

  insert into payout_requests (user_id, amount, bank_name, account_holder, iban)
    values (v_uid, round(p_amount, 3), v_p.payout_bank_name, v_p.payout_account_holder, v_p.payout_iban)
    returning id into v_req;

  return jsonb_build_object('request_id', v_req, 'balance', v_bal);
end $$;

revoke execute on function public.request_payout(numeric) from public, anon;
grant  execute on function public.request_payout(numeric) to authenticated;

-- Admin marks a request paid (funds already held) or rejects it (refund the
-- held amount back to the investor's balance).
create or replace function public.process_payout(p_request uuid, p_action text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req payout_requests%rowtype;
  v_bal numeric;
begin
  if not (select public.is_admin()) then
    raise exception 'Permission denied: admin only';
  end if;
  if p_action not in ('paid', 'reject') then
    raise exception 'Invalid action';
  end if;

  select * into v_req from payout_requests where id = p_request for update;
  if not found then raise exception 'Request not found'; end if;
  if v_req.status <> 'pending' then raise exception 'Request already processed'; end if;

  if p_action = 'paid' then
    update payout_requests
      set status = 'paid', processed_at = now(), processed_by = auth.uid(), admin_note = p_note
      where id = p_request;
    return jsonb_build_object('status', 'paid');
  else
    update profiles set wallet_balance = wallet_balance + v_req.amount
      where id = v_req.user_id returning wallet_balance into v_bal;
    insert into wallet_transactions (user_id, type, amount, balance_after, description)
      values (v_req.user_id, 'refund', v_req.amount, v_bal, 'Payout rejected');
    update payout_requests
      set status = 'rejected', processed_at = now(), processed_by = auth.uid(), admin_note = p_note
      where id = p_request;
    return jsonb_build_object('status', 'rejected');
  end if;
end $$;

revoke execute on function public.process_payout(uuid, text, text) from public, anon;
grant  execute on function public.process_payout(uuid, text, text) to authenticated;

-- Admin list of payout requests with the investor's name/phone. Returns nothing
-- to non-admins (guarded in the WHERE clause).
create or replace function public.get_payout_requests(p_status text default null)
returns table(
  id             uuid,
  user_id        uuid,
  amount         numeric,
  status         text,
  bank_name      text,
  account_holder text,
  iban           text,
  admin_note     text,
  requested_at   timestamptz,
  processed_at   timestamptz,
  customer_name  text,
  customer_phone text
)
language sql
security definer
stable
set search_path = public
as $$
  select r.id, r.user_id, r.amount, r.status, r.bank_name, r.account_holder, r.iban,
         r.admin_note, r.requested_at, r.processed_at, p.full_name, p.phone
  from payout_requests r
  left join profiles p on p.id = r.user_id
  where (select public.is_admin())
    and (p_status is null or r.status = p_status)
  order by r.requested_at desc
  limit 200;
$$;

revoke execute on function public.get_payout_requests(text) from public, anon;
grant  execute on function public.get_payout_requests(text) to authenticated;
