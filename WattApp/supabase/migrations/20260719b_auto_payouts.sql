-- ============================================================================
-- PHASE 2 — AUTOMATIC INVESTOR PAYOUTS (no requests, no manual approvals)
-- ============================================================================
-- Money flow the founder wants:
--   customer pays -> company Thawani account -> commission kept automatically
--   -> the rest accrues as the investor's in-app balance -> the platform
--   automatically DISBURSES that balance to the investor's bank via a payout
--   provider API. No "request payout" button, no admin approval queue.
--
-- The automatic split already happens on every completed charge
-- (credit_host_earning). This migration adds the OUTBOUND automatic payout.
--
-- SAFETY: the whole feature is OFF by default (payout_auto_enabled = 'false')
-- and does nothing until BOTH a provider is configured and it's switched on.
-- So this can be deployed with zero behaviour change until you're ready.
-- ============================================================================

-- ── 1) Settings (admin/superadmin will tune these later) ────────────────────
insert into public.app_config (key, value) values
  ('payout_auto_enabled', 'false'),   -- master switch
  ('payout_threshold',    '20.000'),  -- auto-pay once balance reaches this (OMR)
  ('payout_provider',     '')         -- '' = no provider yet; set to provider id
on conflict (key) do nothing;

-- ── 2) Extend the payout table to record automatic disbursements ────────────
-- Reuses payout_requests as the single payout ledger. New rows created by the
-- auto engine use method='auto'; the old manual flow (method='manual') still
-- works but the UI no longer creates manual requests.
alter table public.payout_requests
  add column if not exists method       text not null default 'manual',
  add column if not exists provider      text,
  add column if not exists provider_ref  text;

-- Status values now: pending | processing | paid | failed | rejected

-- ── 3) Enqueue automatic payouts (server-only; called by the cron function) ──
-- Finds investors/hosts whose balance has reached the threshold and who have
-- bank details, then atomically HOLDS the funds (deduct now, so a crash can't
-- double-pay) and creates a 'processing' payout row. Returns the batch for the
-- edge function to send to the provider.
create or replace function public.enqueue_auto_payouts()
returns table(
  id             uuid,
  user_id        uuid,
  amount         numeric,
  bank_name      text,
  account_holder text,
  iban           text,
  provider       text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enabled   boolean;
  v_provider  text;
  v_threshold numeric;
  v_min       numeric := 1;   -- never disburse less than 1 OMR
  rec         record;
  v_amount    numeric;
  v_bal       numeric;
  v_id        uuid;
begin
  select (value = 'true')      into v_enabled   from app_config where key = 'payout_auto_enabled';
  select value                 into v_provider  from app_config where key = 'payout_provider';
  select coalesce(value::numeric, 20) into v_threshold from app_config where key = 'payout_threshold';

  -- Hard stop unless explicitly enabled AND a provider is configured.
  if not coalesce(v_enabled, false) or coalesce(trim(v_provider), '') = '' then
    return;
  end if;

  for rec in
    select p.id, p.wallet_balance, p.payout_bank_name, p.payout_account_holder, p.payout_iban
    from profiles p
    where p.role in ('investor', 'host')
      and coalesce(p.wallet_balance, 0) >= greatest(v_threshold, v_min)
      and coalesce(trim(p.payout_iban), '') <> ''
      and not exists (
        select 1 from payout_requests r
        where r.user_id = p.id and r.status in ('pending', 'processing')
      )
    for update of p
  loop
    v_amount := round(rec.wallet_balance, 3);   -- pay out the whole balance
    if v_amount < v_min then continue; end if;

    update profiles set wallet_balance = wallet_balance - v_amount
      where id = rec.id returning wallet_balance into v_bal;

    insert into wallet_transactions (user_id, type, amount, balance_after, description)
      values (rec.id, 'withdrawal', -v_amount, v_bal, 'Automatic payout to bank');

    insert into payout_requests
      (user_id, amount, status, method, provider, bank_name, account_holder, iban)
    values
      (rec.id, v_amount, 'processing', 'auto', v_provider,
       rec.payout_bank_name, rec.payout_account_holder, rec.payout_iban)
    returning payout_requests.id into v_id;

    id := v_id; user_id := rec.id; amount := v_amount;
    bank_name := rec.payout_bank_name; account_holder := rec.payout_account_holder;
    iban := rec.payout_iban; provider := v_provider;
    return next;
  end loop;
end $$;

revoke execute on function public.enqueue_auto_payouts() from public, anon, authenticated;
grant  execute on function public.enqueue_auto_payouts() to service_role;

-- ── 4) Settle a disbursement after the provider responds (server-only) ──────
-- ok = the bank transfer succeeded → mark paid. Otherwise → refund the held
-- amount back to the investor's balance and mark failed (they'll be retried
-- next run).
create or replace function public.settle_auto_payout(
  p_id   uuid,
  p_ok   boolean,
  p_ref  text default null,
  p_note text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req payout_requests%rowtype;
  v_bal numeric;
begin
  select * into v_req from payout_requests where id = p_id for update;
  if not found then raise exception 'Payout not found'; end if;
  if v_req.status <> 'processing' then return; end if;   -- idempotent

  if p_ok then
    update payout_requests
      set status = 'paid', provider_ref = p_ref, admin_note = p_note, processed_at = now()
      where id = p_id;
  else
    update profiles set wallet_balance = wallet_balance + v_req.amount
      where id = v_req.user_id returning wallet_balance into v_bal;
    insert into wallet_transactions (user_id, type, amount, balance_after, description)
      values (v_req.user_id, 'refund', v_req.amount, v_bal, 'Payout failed — refunded');
    update payout_requests
      set status = 'failed', admin_note = coalesce(p_note, 'Provider error'), processed_at = now()
      where id = p_id;
  end if;
end $$;

revoke execute on function public.settle_auto_payout(uuid, boolean, text, text) from public, anon, authenticated;
grant  execute on function public.settle_auto_payout(uuid, boolean, text, text) to service_role;
