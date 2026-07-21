-- ============================================================================
-- Backend compatibility — run ONCE on your PostgreSQL server.
-- ============================================================================
-- The GO WATT SQL functions call auth.uid() to know the current user. Supabase
-- provided that from the request JWT. Our Node backend sets the same setting
-- (request.jwt.claims = {"sub": <user-id>}) per transaction, so we (re)define
-- auth.uid() to read it. This lets us REUSE all the hardened money functions.
--
-- If the auth schema/function already exists from the restored dump, this just
-- makes sure it reads our setting. Safe to run.
-- ============================================================================

create schema if not exists auth;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    ),
    ''
  )::uuid
$$;

-- Some functions also reference auth.role(); default to 'authenticated'.
create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(
    current_setting('request.jwt.claim.role', true),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
    'authenticated'
  )
$$;
