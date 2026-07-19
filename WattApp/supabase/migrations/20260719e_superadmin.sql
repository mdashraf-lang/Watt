-- ============================================================================
-- PHASE 5 — SUPERADMIN ROLE & ADMIN MANAGEMENT
-- ============================================================================
-- Adds a 'superadmin' role (you). A superadmin sees everything an admin sees,
-- PLUS can create/remove admins and change platform settings (commission %,
-- payout threshold, etc.) from inside the app.
--
-- Security: only a superadmin can grant or revoke admin/superadmin. Even a
-- normal admin can no longer make someone an admin — enforced on the server.
-- ============================================================================

-- ── 1) Allow the new role value ─────────────────────────────────────────────
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('customer', 'host', 'investor', 'admin', 'superadmin'));

-- ── 2) Helper ───────────────────────────────────────────────────────────────
create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'superadmin');
$$;

grant execute on function public.is_superadmin() to authenticated;

-- ── 3) Tighten profile protection: admins can't create/modify admins ────────
-- Superadmin → full passthrough. Admin → may manage users but CANNOT grant or
-- revoke admin/superadmin (that privilege change is frozen). Everyone else →
-- sensitive columns frozen (unchanged from before).
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
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
    -- An admin may edit users, but privilege changes to/from admin/superadmin
    -- are blocked — only a superadmin can do those (via the RPCs below).
    if (new.role is distinct from old.role)
       and (new.role in ('admin', 'superadmin') or old.role in ('admin', 'superadmin')) then
      new.role := old.role;
    end if;
    return new;
  end if;

  -- Regular clients: sensitive columns are immutable.
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

-- ── 4) Admin management RPCs (superadmin only) ──────────────────────────────
-- Promote a user to admin (p_make = true) or demote an admin back to customer
-- (p_make = false), found by their registered phone number. Never touches a
-- superadmin.
create or replace function public.sa_set_admin(p_phone text, p_make boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target profiles%rowtype;
begin
  if not (select public.is_superadmin()) then
    raise exception 'Permission denied: superadmin only';
  end if;
  if p_phone is null or length(trim(p_phone)) = 0 then
    raise exception 'Enter a phone number';
  end if;

  select * into v_target from profiles
    where phone = trim(p_phone) order by created_at limit 1;
  if not found then raise exception 'No user found with that phone number'; end if;
  if v_target.role = 'superadmin' then
    raise exception 'Cannot change a superadmin'; end if;

  update profiles set role = case when p_make then 'admin' else 'customer' end
    where id = v_target.id;

  return jsonb_build_object('user_id', v_target.id, 'name', v_target.full_name,
    'role', case when p_make then 'admin' else 'customer' end);
end $$;

revoke execute on function public.sa_set_admin(text, boolean) from public, anon;
grant  execute on function public.sa_set_admin(text, boolean) to authenticated;

-- List current admins (and superadmins) for the management screen.
create or replace function public.sa_list_admins()
returns table(id uuid, full_name text, phone text, role text, created_at timestamptz)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.full_name, p.phone, p.role, p.created_at
  from profiles p
  where p.role in ('admin', 'superadmin') and (select public.is_superadmin())
  order by p.role desc, p.created_at;
$$;

revoke execute on function public.sa_list_admins() from public, anon;
grant  execute on function public.sa_list_admins() to authenticated;

-- ── 5) Platform settings RPCs (superadmin only) ─────────────────────────────
-- Only a whitelist of keys can be read/written here.
create or replace function public.sa_get_settings()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
  from app_config
  where (select public.is_superadmin())
    and key in ('host_commission_rate', 'default_price_per_kwh',
                'payout_auto_enabled', 'payout_threshold', 'payout_provider',
                'session_hold_buffer', 'session_hold_min');
$$;

revoke execute on function public.sa_get_settings() from public, anon;
grant  execute on function public.sa_get_settings() to authenticated;

create or replace function public.sa_set_setting(p_key text, p_value text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (select public.is_superadmin()) then
    raise exception 'Permission denied: superadmin only';
  end if;
  if p_key not in ('host_commission_rate', 'default_price_per_kwh',
                   'payout_auto_enabled', 'payout_threshold', 'payout_provider',
                   'session_hold_buffer', 'session_hold_min') then
    raise exception 'Unknown setting';
  end if;
  insert into app_config (key, value) values (p_key, p_value)
    on conflict (key) do update set value = excluded.value;
end $$;

revoke execute on function public.sa_set_setting(text, text) from public, anon;
grant  execute on function public.sa_set_setting(text, text) to authenticated;

-- ── 6) Bootstrap the first superadmin ───────────────────────────────────────
-- There is no superadmin yet, and only a superadmin can create admins — so the
-- very first one must be seeded here. Promotes the founder's account if present.
update public.profiles set role = 'superadmin'
where id in (select id from auth.users where email = 'mdashraf@ankaa.om')
  and role <> 'superadmin';
