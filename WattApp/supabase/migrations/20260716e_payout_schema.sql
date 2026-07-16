-- Investor payout infrastructure, part 1: schema.
-- Money flow: customer pays -> platform Thawani account -> commission kept ->
-- rest accrues as the host's in-app balance -> host requests a payout ->
-- admin transfers to their bank and marks it paid (Thawani has no automated
-- disbursement API, so the bank transfer is a manual admin step).

-- New ledger type for held/withdrawn funds.
alter type public.tx_type add value if not exists 'withdrawal';

-- Investor bank details for receiving payouts (kept on their profile; the
-- profile RLS protects them, and they are NOT in the frozen-column trigger so
-- the investor can edit them).
alter table public.profiles
  add column if not exists payout_bank_name      text,
  add column if not exists payout_account_holder text,
  add column if not exists payout_iban           text;

-- Payout requests. Writes happen only through SECURITY DEFINER RPCs.
create table if not exists public.payout_requests (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  amount         numeric not null check (amount > 0),
  status         text not null default 'pending',  -- pending | paid | rejected
  bank_name      text,
  account_holder text,
  iban           text,
  admin_note     text,
  requested_at   timestamptz not null default now(),
  processed_at   timestamptz,
  processed_by   uuid references public.profiles(id)
);

alter table public.payout_requests enable row level security;

drop policy if exists "payouts: read own"   on public.payout_requests;
create policy "payouts: read own"   on public.payout_requests
  for select using ((select auth.uid()) = user_id);

drop policy if exists "payouts: admin read" on public.payout_requests;
create policy "payouts: admin read" on public.payout_requests
  for select using ((select public.is_admin()));

create index if not exists idx_payout_requests_user   on public.payout_requests (user_id);
create index if not exists idx_payout_requests_status on public.payout_requests (status);
