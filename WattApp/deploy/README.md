
# GO WATT — Full Backend Deployment Kit

Everything needed to run the **entire GO WATT backend on your own Linux server** —
no Supabase cloud. You run the same open-source Supabase software (Postgres + Auth +
API + Realtime + Edge Functions) on your machine. **The app needs no code changes** —
only the two `.env` values at the end.

> Run these on the **server** (SSH in first). Do them in order. Each step says what
> it does. When a command needs one of *your* secret values, it's marked **⟨FILL⟩**.

## What's in this kit
| File | Purpose |
|---|---|
| `README.md` | This runbook (do the steps in order) |
| `secrets.env.example` | Every secret/value you must provide — copy to `secrets.env` and fill |
| `install-docker.sh` | Installs Docker + Compose (Ubuntu/Debian) |
| `restore-database.sh` | Restores your users + app data into the new DB |
| `cron.sql` | The 2 scheduled jobs (auto-shutoff, payouts) |

You also hand over (from the project, kept out of git):
- `gowatt_auth_users.sql` — your 12 users (+ password hashes)
- `gowatt_public.sql` — all app data
- the `supabase/functions/` folder — the 7 edge functions

---

## Prerequisites
- Ubuntu 22.04+ server, **4 GB RAM min**, 2 vCPU, 40 GB disk, root/sudo SSH access.
- A domain/subdomain pointing at the server IP (e.g. `api.gowatt.om`). Optional to start.
- Ports **80** and **443** open.

---

## Step 1 — Install Docker
```bash
bash install-docker.sh
# then log out & back in once (so your user can run docker without sudo)
docker --version && docker compose version
```

## Step 2 — Get the Supabase self-host stack
```bash
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
```

## Step 3 — Fill in the secrets
Copy `secrets.env.example` (from this kit) and fill every ⟨FILL⟩ value:
```bash
cp /path/to/secrets.env.example ./secrets.env
nano secrets.env        # fill: POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY, …
```
Then copy those values into the stack's `docker/.env` (same key names). Generate the
keys as follows:
- **JWT_SECRET** — any random 40+ char string: `openssl rand -base64 48`
- **ANON_KEY** & **SERVICE_ROLE_KEY** — generate from the JWT_SECRET here:
  https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys
- **POSTGRES_PASSWORD**, **DASHBOARD_PASSWORD** — strong passwords you choose.
- Set `SITE_URL` / `API_EXTERNAL_URL` to `https://api.gowatt.om` (or `http://<IP>:8000` to start).

## Step 4 — Start Supabase
```bash
docker compose up -d
docker compose ps          # all services should be "running"/"healthy"
```
This creates the database and the `auth` schema automatically.

## Step 5 — Restore your data (users + app data)
Put `gowatt_auth_users.sql` and `gowatt_public.sql` on the server, then:
```bash
bash restore-database.sh
```
(Order matters — it loads users first, then app data. Passwords keep working.)

## Step 6 — Install the Edge Functions (the 7 server functions)
Self-hosted serves functions from `docker/volumes/functions/<name>/index.ts`.
Copy each function from the project's `supabase/functions/` into that folder:
```bash
# from the supabase/docker directory
cp -r /path/to/project/supabase/functions/* ./volumes/functions/
```
Add the function secrets to the **functions service** in `docker/.env` (see
`secrets.env.example`, "EDGE FUNCTION SECRETS" section), then:
```bash
docker compose restart functions
```
> The functions run behind `https://<your-domain>/functions/v1/<name>`.

## Step 7 — HTTPS + domain (Caddy = easiest)
```bash
sudo apt install -y caddy
sudo tee /etc/caddy/Caddyfile >/dev/null <<'EOF'
api.gowatt.om {
    reverse_proxy localhost:8000
}
EOF
sudo systemctl restart caddy
```
Now `https://api.gowatt.om` reaches Supabase with an auto TLS certificate.

## Step 8 — Schedule the jobs
```bash
docker compose exec db psql -U postgres -d postgres -f - < cron.sql
```
(Sets the auto-shutoff job every minute and the payout job daily. Edit the URL
inside `cron.sql` to your domain first.)

## Step 9 — Point the app at your server
In the project's **`.env`** (on the dev machine, not the server):
```
EXPO_PUBLIC_SUPABASE_URL=https://api.gowatt.om
EXPO_PUBLIC_SUPABASE_ANON_KEY=⟨the ANON_KEY from Step 3⟩
```
Then `npx expo start -c`, and build the app with EAS for release.
Also set Auth → URL config: redirect URL `watt://`, and SMTP so password-reset emails send.

---

## Final check
- [ ] `curl https://api.gowatt.om/rest/v1/` responds
- [ ] App logs in with an existing account (auth + users restored)
- [ ] Map shows stations; status updates live (realtime)
- [ ] A test charge completes (RPCs/billing)
- [ ] `docker compose logs functions` shows the functions loaded
- [ ] Superadmin page loads for admin@watt-test.com

If any step errors, copy the output — the fix is usually one line.
