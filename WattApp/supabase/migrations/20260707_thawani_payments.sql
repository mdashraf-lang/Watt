-- Thawani wallet top-up support.
-- payment_sessions tracks each checkout attempt so top-ups are credited
-- exactly once, only after Thawani confirms the payment.
create table if not exists public.payment_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  session_id text not null unique,
  amount     numeric not null check (amount > 0),
  status     text    not null default 'pending',   -- pending | paid | failed
  created_at timestamptz not null default now(),
  paid_at    timestamptz
);

alter table public.payment_sessions enable row level security;

-- Users may read their own sessions; all writes happen via the service role.
drop policy if exists "own payment sessions" on public.payment_sessions;
create policy "own payment sessions" on public.payment_sessions
  for select using (auth.uid() = user_id);

-- Atomically credit a verified top-up. Idempotent on the Thawani session id,
-- so replaying a verification never double-credits the wallet.
create or replace function public.credit_wallet_topup(
  p_user    uuid,
  p_amount  numeric,
  p_session text,
  p_method  text default 'thawani'
) returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare v_balance numeric;
begin
  if exists (
    select 1 from wallet_transactions
    where reference_id = p_session and type = 'topup'
  ) then
    select wallet_balance into v_balance from profiles where id = p_user;
    return v_balance;
  end if;

  update profiles
    set wallet_balance = wallet_balance + p_amount
    where id = p_user
    returning wallet_balance into v_balance;

  insert into wallet_transactions
    (user_id, type, amount, balance_after, description, reference_id, payment_method)
  values
    (p_user, 'topup', p_amount, v_balance, 'Wallet top-up', p_session, p_method);

  update payment_sessions set status = 'paid', paid_at = now() where session_id = p_session;

  return v_balance;
end $$;

revoke execute on function public.credit_wallet_topup(uuid, numeric, text, text) from anon, authenticated;
grant  execute on function public.credit_wallet_topup(uuid, numeric, text, text) to service_role;
