# GO WATT Backend — Test & Readiness Checklist

> Step-by-step verification that the Node/Express/PostgreSQL backend is complete and correct for **every role and feature**. Work top to bottom — later phases assume earlier ones pass.
>
> Roles under test: **guest (no token) · customer · host/investor · admin · superadmin**, plus **cron** (job secret).

---

## How to run these tests

Set up a shell session once. Every `curl` below reuses these variables.

```bash
export BASE=http://localhost:8080          # or https://api.gowatt.om
# capture tokens after each login (jq recommended):
login() { curl -s -X POST $BASE/api/auth/login -H 'Content-Type: application/json' \
  -d "{\"email\":\"$1\",\"password\":\"$2\"}"; }

# Example:
# CUST=$(login cust@test.com Passw0rd! | jq -r .access_token)
# HOST=$(login host@test.com Passw0rd! | jq -r .access_token)
# ADMIN=$(login admin@watt-test.com Passw0rd! | jq -r .access_token)
# SUPER=$(login super@watt-test.com Passw0rd! | jq -r .access_token)
# auth() { echo "-H Authorization: Bearer $1"; }
```

Legend: 🔴 = money-critical · 🔐 = security/authorization · ⚙️ = infra/ops · ⚠️ = known-risk to confirm.

---

## Phase 0 — Environment & boot ⚙️

- [ ] `.env` created from `.env.example`; `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JOB_SECRET` all set to strong values.
- [ ] Booting with a **missing/short secret fails fast** (env schema in `config/env.ts` rejects `<16` char JWT secrets, `<8` char `JOB_SECRET`).
- [ ] `npm run typecheck` passes with no errors.
- [ ] `npm run build` succeeds; `npm start` boots and logs `GO WATT API + realtime listening on :8080`.
- [ ] Startup **aborts if the DB is unreachable** (`index.ts` runs `select 1` before listening).
- [ ] `GET $BASE/health` → `{ ok: true, ts: ... }`.
- [ ] `CORS_ORIGIN` is set to the app's real origin in production (**not `*`**).
- [ ] Unknown route returns 404 JSON `{ error: { code: "not_found" } }` (notFoundHandler).
- [ ] `SIGTERM`/`SIGINT` closes the server and drains the pool cleanly.

## Phase 1 — Database prerequisites ⚙️ 🔴

The backend **calls hardened SQL functions** rather than reimplementing money logic. These must exist in the restored DB or endpoints 500.

- [ ] Ran once: `psql "$DATABASE_URL" -f sql/backend-compat.sql` (defines `auth.uid()`, `auth.role()` reading `request.jwt.claims`).
- [ ] Ran once: `psql "$DATABASE_URL" -f sql/backend-tables.sql` (`auth_refresh_tokens`, `auth_tokens`).
- [ ] Ran once: `psql "$DATABASE_URL" -f sql/backend-realtime.sql` (NOTIFY triggers on stations/listings/bookings).
- [ ] `auth.uid()` resolves inside a `withUser` transaction (smoke test: `select set_config('request.jwt.claims','{"sub":"<uuid>"}',true); select auth.uid();`).
- [ ] **All 15 tables present** (`profiles, stations, connectors, charger_listings, bookings, charging_sessions, wallet_transactions, payment_sessions, payout_requests, session_ratings, favorites, investor_applications, charger_applications, app_config, email_queue`).
- [ ] **All required SQL functions present** — run this and expect an empty result:

```sql
select fn from unnest(array[
  'start_charging_session','complete_charging_session','_finalize_charging_session',
  'rate_session','credit_host_earning','credit_wallet_topup','request_payout',
  'process_payout','get_payout_requests','enqueue_auto_payouts','settle_auto_payout',
  'get_booked_slots','listing_has_active_session','get_host_listing_bookings',
  'get_charger_reviews','release_no_show_bookings','get_admin_analytics',
  'get_flagged_sessions_detail','resolve_flagged_session','accept_investor_application',
  'reject_investor_application','set_application_under_review','delete_user_account',
  'delete_own_account','sa_set_admin','sa_list_admins','sa_get_settings','sa_set_setting'
]) fn
where not exists (select 1 from pg_proc where proname = fn);
```

- [ ] View `expired_active_sessions` exists (used by `/api/jobs/auto-shutoff`).
- [ ] `app_config` has `default_price_per_kwh` (and commission %, hold buffer, payout toggle keys the functions read).
- [ ] Triggers exist: `protect_profile_columns`, `protect_session_columns`, `protect_listing_device`, `enforce_admin_pricing`.
- [ ] ⚠️ **Confirm trigger behavior for the backend role.** The backend connects as a DB owner/superuser, so `protect_*` triggers that pass through non-`authenticated`/`anon` roles **do not fire**. Verify the API allowlists are therefore the real guard (tested in Phases 3/8/10).

## Phase 2 — Authentication 🔐

- [ ] `POST /api/auth/register` (email, password ≥8, full_name) → 201 with `{ user, access_token, refresh_token }`; a `profiles` row with `role='customer'` is created.
- [ ] Register with an **existing email** → 409 `conflict`.
- [ ] Register with password `<8` chars → 400 with the validation message.
- [ ] `POST /api/auth/login` valid creds → 200 with tokens; wrong password → 401 `Invalid email or password` (same message for unknown email — no user enumeration via login).
- [ ] Migrated (bcrypt) users from the dump can log in (bcrypt fallback in `lib/password.ts`).
- [ ] `POST /api/auth/refresh` with a valid refresh token → new pair; the **old refresh token is now revoked** (reuse → 401).
- [ ] Refresh with a **revoked/expired** token → 401.
- [ ] `POST /api/auth/logout` revokes the given refresh token (subsequent refresh → 401).
- [ ] `POST /api/auth/change-password` (auth) with correct current password → 204 and **all refresh tokens revoked**; wrong current → 400.
- [ ] `POST /api/auth/forgot-password` always returns `{ ok: true }` (no email enumeration) and inserts a hashed `auth_tokens` row when the email exists.
- [ ] `POST /api/auth/reset-password` with a valid token → 204; token is single-use (replay → 400); expired (>1h) → 400.
- [ ] `POST /api/auth/check-email` returns `{ exists: bool }`.
- [ ] Access token carries `sub` + `role`; a tampered/expired token leaves `req.user` undefined (protected routes → 401).
- [ ] **Rate limiting**: >50 requests / 15 min to `/api/auth/*` → 429.
- [ ] ⚠️ **Deactivated-user login**: after admin sets `is_active=false`, confirm whether the user can still `login`/`refresh`. `auth.service` does **not** check `is_active` → likely still succeeds. Decide if login must block deactivated accounts and add the check.
- [ ] ⚠️ **Role propagation delay**: after a role change (investor approval / admin promotion), the old access token keeps the old role until it expires (~15 min); `refresh` picks up the new role. Confirm this is acceptable or force re-auth.

## Phase 3 — Profile (customer) 🔐

- [ ] `GET /api/profile` returns own profile + email; no token → 401.
- [ ] `PATCH /api/profile` updates only allow-listed fields (full_name, phone, car_*, battery_kwh, connector_type, avatar_url, notif_*, payout_*, expo_push_token, `profile_prompted`).
- [ ] 🔐 Attempt to PATCH `role`, `wallet_balance`, `held_balance`, `total_sessions`, `total_kwh`, `is_active:true` → rejected (strict zod schema drops them; `is_active` only accepts `false`).
- [ ] `DELETE /api/profile` runs `delete_own_account()` → 204; account and related data cleaned up per the function.
- [ ] Self-deactivate via `PATCH { is_active:false }` works; the same user cannot self-reactivate.

## Phase 4 — Stations, chargers, favorites

- [ ] `GET /api/stations` (auth) returns the station list; guest (no token) → 401.
- [ ] `GET /api/stations/:id` returns station + connectors; unknown id → 404.
- [ ] `GET /api/stations/:id/reviews` returns reviews (via `get_charger_reviews`, first-name only).
- [ ] `GET /api/stations/availability?from&to&station_id|listing_id` returns booked slots (via `get_booked_slots`); invalid dates → 400.
- [ ] `GET /api/chargers` returns only `is_available=true` private listings with host first name.
- [ ] `GET /api/chargers/:id/reviews` works.
- [ ] `GET /api/favorites` lists own favorites with station/listing display info.
- [ ] `POST /api/favorites` with **exactly one** of station_id/listing_id → 201; with both or neither → 400; duplicate → 409.
- [ ] `DELETE /api/favorites/:id` removes only the caller's own row (another user's id → no-op/no leak).

## Phase 5 — Bookings (customer)

- [ ] `POST /api/bookings` (station or listing) → 201; `user_id` is taken from the token, **never the body** (spoof attempt ignored).
- [ ] Duration outside 15–720 min → 400.
- [ ] 🔐 **Overlap protection**: two overlapping bookings for the same station/listing → second returns **409 "Time slot just taken"** (DB exclusion constraint → pg `23P01`). Confirm the exclusion constraint exists on `bookings` and that `booked_end` is populated.
- [ ] `GET /api/bookings` lists only the caller's bookings.
- [ ] `GET /api/bookings/:id` returns own booking + station + listing; another user's booking id → 404.
- [ ] `POST /api/bookings/:id/cancel` works only for `pending|confirmed` and only the owner; already-active/completed → 409.
- [ ] `GET /api/bookings/:listingId/active` → `{ active: bool }` (via `listing_has_active_session`).
- [ ] Booking a **private charger** pushes a "New booking" notification to the host (Phase 12 push opted-in).

## Phase 6 — Charging sessions 🔴 (highest risk)

- [ ] `POST /api/sessions/start { booking_id }` → calls `start_charging_session`: verifies funds, **places a hold**, creates the session. Insufficient balance → **402 `insufficient_balance`** with `required`/`shortfall`.
- [ ] Starting a session for **another user's booking** → rejected (function uses `auth.uid()`).
- [ ] Starting the same booking twice does not create a second active session / double hold (idempotency).
- [ ] `GET /api/sessions/active` returns the caller's active session (used to restore the banner after app restart).
- [ ] `GET /api/sessions/:id` returns own session with station/listing/booking; another user's → 404.
- [ ] `PATCH /api/sessions/:id/progress { kwh_delivered, cost }` updates only the caller's **active** session.
- [ ] `POST /api/sessions/:id/complete { kwh, battery_end?, description?, meter_kwh? }` → calls `complete_charging_session`: **bills capped at the hold**, releases the remaining hold, **pays the host**, reconciles the meter reading.
- [ ] 🔴 **Private-charger pricing is correct**: complete a listing-booking session and confirm it bills at the **listing's** `price_per_kwh`/`power_kw` (regression from the old app where the session lacked `listing_id`). Verify a `charge` debit **and** a host `earning` credit both post (`credit_host_earning`).
- [ ] 🔴 **Idempotent complete**: calling complete twice does not double-charge (second returns the already-settled result).
- [ ] 🔴 **Hold release**: after completion, the customer's `held_balance` returns to 0 and `wallet_balance` reflects only the actual cost.
- [ ] ⚠️ **Meter-mismatch flagging**: pass a `meter_kwh` that diverges from `kwh` and confirm the session is flagged (`flagged_review`) and appears in `/api/admin/flagged`.
- [ ] ⚠️ **Client kWh trust**: send `kwh:0` on complete — confirm the SQL function still charges based on hold/meter/time, not a blind 0 (no free charging).
- [ ] `POST /api/sessions/:id/rate { rating 1–5, comment? }` → records rating (via `rate_session`); rating a session you don't own → rejected; rating twice → per function rule.
- [ ] `GET /api/sessions` returns the caller's last 30 sessions with station name.

## Phase 7 — Wallet & payments 🔴

- [ ] `GET /api/wallet/transactions` returns only the caller's ledger (topup/charge/refund/earning/withdrawal).
- [ ] `POST /api/payments/create { amount }` → creates a Thawani session + `payment_sessions` row (`pending`); returns `pay_url`. Amount <0.1 or >500 OMR → 400. Thawani unconfigured → 503 `not_configured`.
- [ ] `POST /api/payments/verify { session_id }` for a **paid** session credits the wallet via `credit_wallet_topup` and returns the new balance.
- [ ] 🔴 **Idempotent top-up**: verifying the same paid session twice does not double-credit (`already: true`).
- [ ] 🔐 Verifying **another user's** session_id → 404 (ownership check).
- [ ] Cancelled/expired Thawani status marks the `payment_sessions` row `failed`.
- [ ] ⚠️ **Paid-but-not-verified gap**: there is no Thawani webhook — crediting depends on the client calling `verify`. Confirm a reconciliation path (retry/webhook/cron) exists, or accept the risk that a payment made but never verified is not credited.

## Phase 8 — Host / investor 🔐

- [ ] `GET /api/host/listing` (host/investor only) returns the caller's listing; a customer token → 403.
- [ ] `POST /api/host/listing` creates the listing once from the approved application; price comes from `app_config.default_price_per_kwh`; second call returns the existing row (no duplicate).
- [ ] `PATCH /api/host/listing` updates only allow-listed fields (address, power_kw, availability_*, description, tuya_device_id).
- [ ] 🔐 Host **cannot** change `price_per_kwh` via this route (not in the allowlist).
- [ ] 🔐 **Device-ID lock**: once `tuya_verified=true`, a host PATCH of `tuya_device_id` is silently ignored (kept locked).
- [ ] 🔐 Host **cannot** set `tuya_verified`/`is_available`/`switch_status`/`host_id` via `PATCH /listing` (strict allowlist).
- [ ] `PATCH /api/host/listing/availability { is_available }` toggles the flag; **going offline while a customer is mid-charge → 409 "A customer is charging right now"**.
- [ ] `GET /api/host/bookings` returns bookings on the host's charger with customer name/phone (via `get_host_listing_bookings` — confirm it only returns *their* listing's bookings, no PII leak across hosts).
- [ ] 🔴 `POST /api/host/self-charge` requires a linked **and admin-verified** device (no device → 400 `no_device`; unverified → 400 `not_verified`); on success turns the switch on and creates an active session.
- [ ] ⚠️ **Self-charge has no auto-stop**: a self-charge session has no booking, so `/api/jobs/auto-shutoff` (which reads `expired_active_sessions`, keyed on booking end) will not close it. Confirm a max-duration safeguard exists, or add one (safety + billing).

## Phase 9 — Payouts 🔴

- [ ] `POST /api/payouts/request { amount }` (investor) → `request_payout` holds funds atomically; requesting more than available → rejected; negative/zero → 400.
- [ ] `GET /api/payouts/mine` returns the caller's payout history only.
- [ ] `GET /api/payouts` (admin) lists all/by-status requests (via `get_payout_requests`); customer token → 403.
- [ ] `POST /api/payouts/:id/process { action: paid|reject, note? }` (admin): **paid** settles; **reject** refunds the held amount back to the investor (verify the refund posts).
- [ ] 🔴 Processing the same payout twice does not double-pay or double-refund (idempotency).
- [ ] `POST /api/jobs/disburse` currently marks auto-payouts **failed → auto-refund** (no provider wired). Confirm the refund posts and no funds are stranded; wiring a real Oman payout provider is a known TODO.

## Phase 10 — Admin 🔐

- [ ] Every `/api/admin/*` route rejects non-admin tokens with 403 and no token with 401 (`router.use(requireAuth, requireAdmin)`).
- [ ] `GET /api/admin/analytics` returns revenue/sessions/kWh + top chargers + flagged count.
- [ ] `GET /api/admin/flagged` + `POST /api/admin/flagged/:id/resolve` list and clear meter-mismatch sessions.
- [ ] `GET /api/admin/users` returns cross-user list with email; `GET /api/admin/counts` returns station/user counts.
- [ ] `GET /api/admin/applications`, `PATCH /api/admin/applications/:id` (note), `DELETE /api/admin/applications/:id` work.
- [ ] `POST /api/admin/applications/:id/accept` → promotes the user to investor + creates the listing (via `accept_investor_application`); `reject` and `review` set status; unknown action → 400.
- [ ] `GET /api/admin/users/:userId/listing` returns device/price/verify panel data.
- [ ] `PATCH /api/admin/listings/:id { price_per_kwh?, tuya_verified? }` — **the only path** that may set price/verification; price capped at ≤1 OMR; extra fields rejected (strict).
- [ ] `PATCH /api/admin/users/:id { is_active }` activates/deactivates a user.
- [ ] `DELETE /api/admin/users/:id` runs `delete_user_account` (hardened function).
- [ ] 🔐 Confirm an admin **cannot** hit superadmin routes (`/api/superadmin/*` → 403).

## Phase 11 — Superadmin 🔐

- [ ] Every `/api/superadmin/*` route requires the `superadmin` role (admin token → 403).
- [ ] `GET /api/superadmin/admins` lists admins/superadmins (`sa_list_admins`).
- [ ] `POST /api/superadmin/admins { identifier, make }` promotes/removes an admin by email or phone (`sa_set_admin`); confirm a superadmin cannot demote the last superadmin (guard in the function).
- [ ] `GET /api/superadmin/settings` + `PUT /api/superadmin/settings { key, value }` read/update platform settings (commission %, prices, hold buffer, payout toggle) and take effect on subsequent money operations.

## Phase 12 — Devices (Tuya) 🔐

- [ ] `POST /api/devices/switch { action, booking_id|listing_id }` — **customer path** validates the booking belongs to the caller and the charger is admin-verified; **host path** validates listing ownership.
- [ ] Not-your-booking / not-your-charger → 403; unverified device → 400 `not_verified`; no device → 400 `no_device`.
- [ ] On success the physical switch toggles and `charger_listings.switch_status` is updated.
- [ ] `POST /api/devices/energy` returns `{ power_w, energy_kwh }` (nulls for non-metering switches).
- [ ] Tuya unconfigured → 503 `not_configured` (does not crash).
- [ ] Signed-call correctness: token fetch + HMAC signing succeed against the real Tuya base URL (integration smoke test with a real device id).

## Phase 13 — Realtime (Socket.IO)

- [ ] Socket connects only with a valid access token in `handshake.auth.token`; invalid → `unauthorized`.
- [ ] Updating a `stations` row emits a `change` event `{ table, event, new }` to connected clients.
- [ ] Same for `charger_listings` (switch_status/is_available) and `bookings` (status).
- [ ] The pg LISTEN client **auto-reconnects** after the connection drops (kill it and confirm recovery within ~5s).
- [ ] Payloads stay under the NOTIFY limit (rows are small; verify no truncation of needed fields).

## Phase 14 — Background jobs (cron) ⚙️ 🔴

- [ ] All `/api/jobs/*` require the `x-job-secret` header (wrong/missing → 401).
- [ ] `POST /api/jobs/auto-shutoff`: for each expired active session it turns the switch off, finalizes via `_finalize_charging_session` (bills capped at hold, pays host), and pushes the customer.
- [ ] Auto-shutoff kWh estimate prefers the synced meter reading, else `hours × power`, capped at `×1.25`.
- [ ] `POST /api/jobs/no-show` releases no-show bookings and frees the slot (`release_no_show_bookings`).
- [ ] `POST /api/jobs/disburse` enqueues + settles auto-payouts (currently all → failed+refund).
- [ ] ⚠️ **Cron wiring conflict**: `backend/README.md` schedules crontab → `/api/jobs/*` (Node), but `deploy/cron.sql` schedules pg_cron → `/functions/v1/*` (edge functions). Confirm **only one** backend is live and only its jobs are scheduled — running both double-processes sessions/payouts.
- [ ] Jobs are safe to run concurrently / on overlap (no double-billing if two runs overlap).

## Phase 15 — Authorization matrix 🔐 (roles interact correctly)

Run each with the wrong role and confirm the expected reject.

- [ ] Customer → any `/api/host/*` → 403.
- [ ] Customer/host → any `/api/admin/*` → 403.
- [ ] Admin → any `/api/superadmin/*` → 403.
- [ ] Any authenticated user can only read/modify **their own** bookings, sessions, wallet, favorites, payouts, profile (IDOR test: swap ids and confirm 404/no-op).
- [ ] Host sees only **their own** listing and its bookings; not other hosts' data.
- [ ] Client-supplied `user_id`/`host_id` in bodies is always ignored in favor of `req.user.id`.
- [ ] Money/role/price/device columns cannot be changed through any customer- or host-facing route (allowlists hold even though DB triggers don't fire for the backend role).
- [ ] Investor retains customer abilities (can book *other* chargers) while also being a host.

## Phase 16 — Cross-role end-to-end journeys

- [ ] **Customer journey**: register → top-up → browse stations → book → start → charge → complete → rated → wallet debited correctly.
- [ ] **Investor onboarding**: customer submits application → admin accepts → role becomes investor → `POST /host/listing` creates listing → admin sets price + verifies device → host toggles available → charger appears in `GET /chargers`.
- [ ] **Customer ↔ host charge**: customer books the host's charger → starts → host sees it in `/host/bookings` and cannot go offline mid-charge → on complete the **host is credited** and the **customer is debited** (numbers reconcile with commission %).
- [ ] **Payout**: investor requests payout → admin processes paid → balances reconcile; reject path refunds.
- [ ] **Admin/superadmin**: superadmin promotes an admin → admin reviews applications, resolves a flagged session, deactivates a user (deactivated user's access is actually blocked — see Phase 2 ⚠️).

## Phase 17 — Integrations config ⚙️

- [ ] SMTP configured → password-reset email actually sends; unconfigured → `[email:disabled]` log, no crash. **Wire the reset email** (currently the token is generated but the send is commented out in `auth.routes.ts`).
- [ ] Expo push: opted-in tokens receive host-booking and auto-stop notifications; `notif_push=false` or per-category opt-out suppresses them.
- [ ] Thawani base URL points to **production** (`https://checkout.thawani.om`), not UAT, for go-live.
- [ ] Tuya base URL/region matches the devices' region.

## Phase 18 — Resilience & security hardening 🔐 ⚙️

- [ ] Helmet headers present on responses; JSON body limit (1MB) enforced.
- [ ] SQL injection: all queries are parameterized (no string interpolation of user input) — spot-check dynamic `set` clauses in `profile`/`host`/`admin` (keys come from validated allowlists only).
- [ ] Error responses never leak stack traces or raw SQL to the client (500s log server-side only).
- [ ] `pg` pool: no connection leak under load (`withUser` always releases the client on error).
- [ ] Consider rate-limiting the money endpoints (`/api/sessions/*`, `/api/payments/*`) — only `/api/auth` is limited today.
- [ ] Refresh tokens are stored **hashed** (SHA-256) and rotated; reset/verify tokens hashed and single-use.
- [ ] Load/soak test the start→complete path concurrently to confirm no double-charge, no negative balance, no hold left dangling.

---

## Known risks to confirm are closed (carried from the app review)

- [ ] 🔴 **Host actually gets paid** — `credit_host_earning` fires on every customer session on a listing (Phase 6, 16).
- [ ] 🔴 **Private-charger sessions priced from the listing**, not a fallback (Phase 6).
- [ ] 🔐 **`tuya_verified` is admin-only** — not settable by the host via API (Phase 8, 10).
- [ ] ⚠️ **Self-charge sessions cannot hang open** with the switch on (Phase 8, 14).
- [ ] ⚠️ **Deactivated users are actually blocked** at login/refresh (Phase 2).
- [ ] ⚠️ **One backend, one cron** — Node `/api/jobs` *or* the edge-function `deploy/cron.sql`, never both (Phase 14).
- [ ] ⚠️ **Top-up reconciliation** for paid-but-unverified payments (Phase 7).

---

*Backend: Node + Express + PostgreSQL (Supabase-free). Money logic = reused hardened SQL functions called with per-transaction user context (`withUser`). Keep this file updated as endpoints change.*
