-- Add station_name to charger_applications so investors can name their charger on the map
ALTER TABLE charger_applications
  ADD COLUMN IF NOT EXISTS station_name TEXT;

-- Add station_name to charger_listings so it shows on the map with the chosen name
ALTER TABLE charger_listings
  ADD COLUMN IF NOT EXISTS station_name TEXT;
