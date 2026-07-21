#!/usr/bin/env bash
# Restores GO WATT data into the running self-hosted Supabase database.
# Order matters: auth users FIRST (into the schema GoTrue created), then app data.
# Run this from the `supabase/docker` directory AFTER `docker compose up -d`.
#
# Put gowatt_auth_users.sql and gowatt_public.sql next to this script (or edit
# the paths below).
set -euo pipefail

AUTH_DUMP="${1:-gowatt_auth_users.sql}"
PUBLIC_DUMP="${2:-gowatt_public.sql}"

for f in "$AUTH_DUMP" "$PUBLIC_DUMP"; do
  [ -f "$f" ] || { echo "❌ Missing $f — put it here or pass its path."; exit 1; }
done

echo "==> 1/2 Restoring auth users (+ password hashes)"
docker compose exec -T db psql -U postgres -d postgres < "$AUTH_DUMP"

echo "==> 2/2 Restoring app data (public schema)"
docker compose exec -T db psql -U postgres -d postgres < "$PUBLIC_DUMP"

echo
echo "✅ Restore complete. Quick check:"
docker compose exec -T db psql -U postgres -d postgres -c "select count(*) as users from auth.users;"
docker compose exec -T db psql -U postgres -d postgres -c "select count(*) as profiles from public.profiles;"
