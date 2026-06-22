-- Add GPS coordinates to charger_applications
ALTER TABLE charger_applications
  ADD COLUMN IF NOT EXISTS latitude  double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

-- Update accept RPC to use actual coordinates for the charger listing
CREATE OR REPLACE FUNCTION accept_investor_application(p_application_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id      uuid;
  v_charger_type text;
  v_governorate  text;
  v_city         text;
  v_power_kw     float;
  v_latitude     double precision;
  v_longitude    double precision;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  SELECT user_id, charger_type, governorate, city, power_kw, latitude, longitude
  INTO v_user_id, v_charger_type, v_governorate, v_city, v_power_kw, v_latitude, v_longitude
  FROM charger_applications WHERE id = p_application_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  UPDATE charger_applications SET status = 'approved', updated_at = now() WHERE id = p_application_id;
  UPDATE profiles SET role = 'investor', updated_at = now() WHERE id = v_user_id;

  INSERT INTO charger_listings
    (host_id, address, latitude, longitude, charger_type, power_kw, price_per_kwh, is_available)
  SELECT
    v_user_id,
    CONCAT(v_city, ', ', v_governorate),
    COALESCE(v_latitude, 23.588),
    COALESCE(v_longitude, 58.383),
    v_charger_type,
    COALESCE(v_power_kw, 7.4),
    0.025,
    false
  WHERE NOT EXISTS (SELECT 1 FROM charger_listings WHERE host_id = v_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION accept_investor_application(uuid) TO authenticated;
