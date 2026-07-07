-- Enable realtime on charger_listings so the investor's "My Charger" screen
-- reflects switch_status / is_available changes live (session start,
-- auto-shutoff, admin actions). RLS still governs what each client receives.
alter publication supabase_realtime add table public.charger_listings;
