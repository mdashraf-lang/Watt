-- Allow charging sessions without a booking (investor self-charge flow)
ALTER TABLE charging_sessions
  ADD COLUMN IF NOT EXISTS listing_id UUID REFERENCES charger_listings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_charging_sessions_listing
  ON charging_sessions (listing_id);
