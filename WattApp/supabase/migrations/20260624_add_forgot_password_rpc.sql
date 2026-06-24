-- RPC to check if an email exists in auth.users
-- Used by the forgot-password flow to avoid leaking reset emails to unknown addresses.
-- SECURITY DEFINER so the client can query auth.users without direct table access.
CREATE OR REPLACE FUNCTION check_email_exists(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE email = lower(trim(p_email))
      AND is_anonymous = false
  );
END;
$$;
