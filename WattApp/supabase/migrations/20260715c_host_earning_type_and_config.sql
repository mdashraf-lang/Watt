-- Host-earning feature, part 1: new ledger type + admin-configurable commission.
-- (Enum value must be added in its own committed migration before it can be used.)
alter type public.tx_type add value if not exists 'earning';

-- Platform commission on host charging revenue. 0 = host keeps 100%.
-- Admin can change this anytime; the payout function reads it live.
insert into public.app_config (key, value)
values ('host_commission_rate', '0')
on conflict (key) do nothing;
