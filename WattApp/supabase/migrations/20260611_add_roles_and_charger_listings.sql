-- Add role and ensure full_name on profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'customer'
    CHECK (role IN ('customer', 'host'));

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Create charger_listings table for home charger hosts
CREATE TABLE IF NOT EXISTS charger_listings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  host_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  address TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  charger_type TEXT NOT NULL DEFAULT 'Type2'
    CHECK (charger_type IN ('Type2', 'CCS', 'CHAdeMO', 'GBT')),
  power_kw NUMERIC(6, 2) NOT NULL DEFAULT 7.4,
  price_per_kwh NUMERIC(6, 3) NOT NULL DEFAULT 0.025,
  is_available BOOLEAN NOT NULL DEFAULT true,
  availability_start TEXT DEFAULT '08:00',
  availability_end TEXT DEFAULT '22:00',
  description TEXT,
  total_bookings INTEGER NOT NULL DEFAULT 0,
  rating NUMERIC(3, 2) NOT NULL DEFAULT 0,
  total_ratings INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add listing_id to bookings so bookings can reference either a station or a private charger
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS listing_id UUID REFERENCES charger_listings(id) ON DELETE SET NULL;

-- Enable Row Level Security
ALTER TABLE charger_listings ENABLE ROW LEVEL SECURITY;

-- Public can view all listings (for the map)
CREATE POLICY "Anyone can view charger listings"
  ON charger_listings FOR SELECT
  USING (true);

-- Hosts can insert their own listing
CREATE POLICY "Hosts can insert own listing"
  ON charger_listings FOR INSERT
  WITH CHECK (auth.uid() = host_id);

-- Hosts can update/delete their own listing
CREATE POLICY "Hosts can manage own listing"
  ON charger_listings FOR UPDATE
  USING (auth.uid() = host_id);

CREATE POLICY "Hosts can delete own listing"
  ON charger_listings FOR DELETE
  USING (auth.uid() = host_id);

-- Index for proximity map queries
CREATE INDEX IF NOT EXISTS idx_charger_listings_location
  ON charger_listings (latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_charger_listings_host
  ON charger_listings (host_id);
