-- ============================================================================
-- REPO COMPLETENESS + SUPERADMIN FIX
-- ============================================================================
-- Two helper functions (is_admin, check_email_exists) existed only in the live
-- cloud project, never in the repo migrations. That meant a fresh database
-- (e.g. a self-hosted server) built from this repo would be MISSING them and
-- the app would break. This migration captures them so the repo is complete.
--
-- It also FIXES a Phase 5 bug: is_admin() only recognised role='admin', so a
-- 'superadmin' would fail every admin permission check (payouts, flagged
-- sessions, admin RLS). A superadmin must have all admin powers — so is_admin()
-- now returns true for both 'admin' and 'superadmin'.
-- ============================================================================

-- Admin check used across RLS policies and admin-only RPCs. Superadmin included.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'superadmin')
  );
$$;

-- Used by the sign-up flow to tell the user an email is already registered.
create or replace function public.check_email_exists(p_email text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1 from auth.users
    where email = lower(trim(p_email))
      and is_anonymous = false
  );
end;
$$;
