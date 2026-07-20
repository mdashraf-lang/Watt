-- ============================================================================
-- SECURITY HARDENING — pin search_path on the two new trigger functions
-- ============================================================================
-- Addresses the "function_search_path_mutable" advisor for the trigger
-- functions added/redefined in Phases 1/3/5. Behaviour is unchanged; this just
-- fixes the mutable search_path warning. Also lets a superadmin pass the device
-- lock (consistent with is_admin() now including superadmin).
-- ============================================================================

create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
set search_path = public
as $$
declare v_actor text;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  select role into v_actor from profiles where id = auth.uid();

  if v_actor = 'superadmin' then
    return new;
  end if;

  if v_actor = 'admin' then
    if (new.role is distinct from old.role)
       and (new.role in ('admin', 'superadmin') or old.role in ('admin', 'superadmin')) then
      new.role := old.role;
    end if;
    return new;
  end if;

  new.role           := old.role;
  new.wallet_balance := old.wallet_balance;
  new.held_balance   := old.held_balance;
  new.total_sessions := old.total_sessions;
  new.total_kwh      := old.total_kwh;
  if old.is_active = false then
    new.is_active := old.is_active;
  end if;
  return new;
end $$;

create or replace function public.protect_listing_device()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'superadmin')) then
    return new;
  end if;
  new.tuya_verified := old.tuya_verified;
  if old.tuya_verified is true then
    new.tuya_device_id := old.tuya_device_id;
  end if;
  return new;
end $$;
