# GO WATT Backend (Supabase-free)

Node.js + TypeScript + Express + PostgreSQL API that sits in front of the dedicated
server's database. No Supabase. The mobile app talks only to this API.

## Design principles (why it's built for the long run)
- **Layered & modular:** `modules/<name>/{routes,service}` — add a feature without
  touching others.
- **Reuse the hardened SQL functions for money.** The billing / hold / payout logic
  lives in the database as atomic, row-locked, idempotent functions. This backend
  **calls them** (it does not re-implement them), so money correctness is preserved.
  The trick: `db/pool.ts → withUser()` sets `request.jwt.claims = {sub: userId}` for
  the transaction, so the functions' internal `auth.uid()` resolves. See
  `sql/backend-compat.sql`.
- **Auth = JWT access + rotating refresh tokens**, Argon2 for new passwords, and
  **bcrypt fallback** so the migrated Supabase users keep their passwords.
- **Validation everywhere** (zod), central error handling, Helmet, CORS, rate limiting.
- **Fail-fast config** (`config/env.ts` validates env at boot).

## First-time setup (on the server)
```bash
cd backend
cp .env.example .env          # fill DATABASE_URL, JWT secrets, SMTP, Thawani, Tuya
npm install

# One-time DB prep (adds auth.uid() compat + backend tables):
psql "$DATABASE_URL" -f sql/backend-compat.sql
psql "$DATABASE_URL" -f sql/backend-tables.sql

npm run dev                   # or: npm run build && npm start
curl localhost:8080/health
```

## Project layout
```
src/
  config/env.ts          validated environment
  db/pool.ts             pg pool + withUser()/callFn() (user-context transactions)
  lib/                   errors, jwt, password (argon2 + bcrypt fallback)
  middleware/            attachUser, requireAuth, requireRole, validate, error
  modules/
    auth/                register, login, refresh, logout, change/forgot/reset password
    profile/            get/update/delete own profile
    stations/           list/detail/reviews/availability
    sessions/           🔴 start / complete / rate  (calls SQL functions)
  app.ts / index.ts      assembly + startup
sql/
  backend-compat.sql     auth.uid()/auth.role() reading our session setting
  backend-tables.sql     refresh-token + reset/verify token tables
```

## What's implemented vs. remaining
Implemented (the foundation + patterns to copy):
- ✅ Config, DB layer, error handling, JWT/password, middleware
- ✅ **Auth** (register/login/refresh/logout/change/forgot/reset/check-email)
- ✅ **Profile** (get/update/delete)
- ✅ **Stations** (list/detail/reviews/availability)
- ✅ **Sessions** (start/complete/rate — the money pattern)

Remaining modules — each follows the SAME pattern (a `.routes.ts` calling either a
plain query or an existing SQL function via `callFn`):

| Module | Endpoints | Backing (reuse) |
|---|---|---|
| bookings | create / list own / cancel | table + exclusion constraint |
| wallet | list transactions | `wallet_transactions` |
| favorites | add / list / remove | `favorites` table |
| payouts | request / (admin) list / process | `request_payout`, `get_payout_requests`, `process_payout` |
| admin | analytics / flagged / resolve | `get_admin_analytics`, `get_flagged_sessions_detail`, `resolve_flagged_session` |
| superadmin | admins list/set / settings get/set | `sa_list_admins`, `sa_set_admin`, `sa_get_settings`, `sa_set_setting` |
| host | listing bookings, toggle availability | `get_host_listing_bookings` |
| payments | Thawani create/verify | port `thawani-checkout` edge fn |
| devices | Tuya on/off/energy | port `control-tuya-switch` edge fn |
| notify | push / email / booking SMS | port `send-push` / `send-watt-email` / `notify-booking` |
| realtime | WS for stations/listings/bookings updates | Socket.IO + Postgres LISTEN/NOTIFY |
| jobs | auto-shutoff (1m), no-show (10m), disburse (daily) | `_finalize_charging_session`, `release_no_show_bookings`, `enqueue/settle_auto_payout` |

See `../C-server.md` for the complete endpoint ↔ function map and auth/roles.

## Security notes
- Never trust an id from the client — always use `req.user.id` from the verified JWT.
- Admin routes: `requireAdmin` (admin or superadmin). Role changes: `requireSuperadmin`.
- The DB `protect_*` triggers still guard money/role columns even if a route slips.
- Set `CORS_ORIGIN` to the app's real origin in production (not `*`).
