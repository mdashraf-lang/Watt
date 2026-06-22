-- ================================================================
-- Watt: Investor role + application RPCs + email queue
-- ================================================================

-- ── 1. Add 'investor' to profiles role constraint ──────────────
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('customer', 'host', 'investor', 'admin'));

-- ── 2. Email queue (stores emails until SMTP is configured) ────
CREATE TABLE IF NOT EXISTS email_queue (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email   text        NOT NULL,
  to_name    text,
  type       text        NOT NULL,
  subject    text        NOT NULL,
  html_body  text        NOT NULL,
  sent       boolean     NOT NULL DEFAULT false,
  error      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_manage_email_queue" ON email_queue
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ── 3. RPC: accept_investor_application ───────────────────────
CREATE OR REPLACE FUNCTION accept_investor_application(p_application_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id     uuid;
  v_charger_type text;
  v_governorate  text;
  v_city         text;
  v_power_kw     float;
BEGIN
  -- Guard: caller must be admin
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  -- Fetch application data
  SELECT user_id, charger_type, governorate, city, power_kw
  INTO v_user_id, v_charger_type, v_governorate, v_city, v_power_kw
  FROM charger_applications
  WHERE id = p_application_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  -- Update application status → approved
  UPDATE charger_applications
  SET status = 'approved', updated_at = now()
  WHERE id = p_application_id;

  -- Upgrade user role → investor
  UPDATE profiles
  SET role = 'investor', updated_at = now()
  WHERE id = v_user_id;

  -- Auto-create a draft charger listing (is_available=false until investor activates)
  INSERT INTO charger_listings
    (host_id, address, latitude, longitude, charger_type, power_kw, price_per_kwh, is_available)
  SELECT
    v_user_id,
    CONCAT(v_city, ', ', v_governorate),
    0, 0,
    v_charger_type,
    COALESCE(v_power_kw, 7.4),
    0.025,
    false
  WHERE NOT EXISTS (
    SELECT 1 FROM charger_listings WHERE host_id = v_user_id
  );
END;
$$;

-- ── 4. RPC: reject_investor_application ───────────────────────
CREATE OR REPLACE FUNCTION reject_investor_application(p_application_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  UPDATE charger_applications
  SET status = 'rejected', updated_at = now()
  WHERE id = p_application_id;
END;
$$;

-- ── 5. RPC: set_application_under_review ──────────────────────
CREATE OR REPLACE FUNCTION set_application_under_review(p_application_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  UPDATE charger_applications
  SET status = 'under_review', updated_at = now()
  WHERE id = p_application_id;
END;
$$;

-- ── 6. Grant execute to authenticated users ───────────────────
GRANT EXECUTE ON FUNCTION accept_investor_application(uuid)    TO authenticated;
GRANT EXECUTE ON FUNCTION reject_investor_application(uuid)    TO authenticated;
GRANT EXECUTE ON FUNCTION set_application_under_review(uuid)   TO authenticated;
