# Watt App — Update Notes

## Role System

The app has **two user roles**. Every signed-in user has exactly one role stored in `profiles.role`.

| Role | Navigator | Tabs |
|---|---|---|
| `customer` | `CustomerNavigator` | Map · Bookings · Wallet · Profile |
| `host` | `HostNavigator` | Dashboard · My Charger · Earnings · Profile |

After login, `AppNavigator` reads `profile.role` and routes to the correct navigator automatically:

```
session exists + role === 'admin'    → AdminNavigator
session exists + role === 'host'     → HostNavigator
session exists + role === 'customer' → CustomerNavigator
no session                           → DevLoginScreen  (dev mode, see below)
```

Hosts who have no charger listing yet are sent to `HostSetupScreen` first; once they complete setup they land in `HostTabs`.

---

## Dev Mode — Bypassed Auth

The normal login/signup flow is **temporarily disabled** while testing.

### Active right now
```
src/navigation/index.tsx  →  DevLogin screen only (no Splash / RoleSelect / Phone / OTP)
src/screens/DevLoginScreen.tsx  →  three-button quick-login screen
```

### Test accounts (auto-created in Supabase on first tap)

| Role | Email | Password |
|---|---|---|
| Customer | `customer@watt-test.com` | `Watt@test1` |
| Host | `host@watt-test.com` | `Watt@test1` |
| Admin | `admin@watt-test.com` | `Watt@test1` |

The DevLogin screen handles everything:
1. Tries `signInWithPassword` first
2. If user does not exist → calls `signUp` → creates profile with test data → signs in
3. Subsequent taps = instant login, no account creation

### Test customer profile
- Full name: Test Customer
- Membership: Gold
- Wallet: 25.000 OMR
- Sessions: 12 · kWh: 148
- Car: Tesla Model 3

### Test host profile
- Full name: Test Host
- Membership: Standard
- Wallet: 8.500 OMR

### Test admin profile
- Full name: Watt Admin
- Full platform access

---

## How to Restore Normal Auth (before production)

**Step 1** — In `src/navigation/index.tsx`, uncomment the 6 auth imports:

```ts
import SplashScreen from '../screens/SplashScreen';
import RoleSelectScreen from '../screens/RoleSelectScreen';
import PhoneScreen from '../screens/PhoneScreen';
import OTPScreen from '../screens/OTPScreen';
import SignInScreen from '../screens/SignInScreen';
import SignUpScreen from '../screens/SignUpScreen';
```

**Step 2** — In the same file, replace the DevLogin block:

```tsx
// Remove this:
<RootStack.Screen name="DevLogin" component={DevLoginScreen} />

// Restore this (already written as a comment in the file):
<RootStack.Screen name="Splash" component={SplashScreen} />
<RootStack.Screen name="RoleSelect" component={RoleSelectScreen} ... />
<RootStack.Screen name="Phone" component={PhoneScreen} ... />
<RootStack.Screen name="OTP" component={OTPScreen} ... />
<RootStack.Screen name="SignIn" component={SignInScreen} ... />
<RootStack.Screen name="SignUp" component={SignUpScreen} ... />
```

**Step 3** — Delete `src/screens/DevLoginScreen.tsx`.

---

## UI Redesign (this session)

### New files
| File | Purpose |
|---|---|
| `src/components/icons.tsx` | 25+ SVG vector icons (replaces emojis throughout) |
| `src/screens/DevLoginScreen.tsx` | Dev-only quick login (remove before production) |
| `src/screens/admin/AdminDashboardScreen.tsx` | Admin analytics dashboard |
| `src/screens/admin/AdminUsersScreen.tsx` | Admin user management |
| `src/screens/admin/AdminApplicationsScreen.tsx` | Investor applications list |
| `src/screens/admin/AdminApplicationDetailScreen.tsx` | Application review + approve/reject |

### Updated files
| File | Changes |
|---|---|
| `src/constants/colors.ts` | Added semantic bg colors: `primaryBg`, `primaryTint`, `successBg`, `errorBg`, `warningBg`, `goldBg`, `backgroundAlt`, `borderStrong` |
| `src/navigation/index.tsx` | Custom tab bar with SVG icons + pill active indicator; admin/dev mode routing |
| `src/screens/SplashScreen.tsx` | Decorative circles, better logo ring, gold animated dots |
| `src/screens/RoleSelectScreen.tsx` | Background decorations, badge chips, SVG arrow buttons |
| `src/screens/SignInScreen.tsx` | SVG back arrow + eye toggle, focused-border input highlight |
| `src/screens/MapScreen.tsx` | SVG search/clear/locate icons, improved bottom sheet + station cards |
| `src/screens/BookingsScreen.tsx` | Scrollable filter tabs, status dot badges, active booking border |
| `src/screens/WalletScreen.tsx` | Decorative balance card, PlusIcon top-up, summary box |
| `src/screens/ProfileScreen.tsx` | Stats card overlapping hero, SVG settings icons, improved modals |
| `src/screens/StationDetailsScreen.tsx` | SVG back + book icons, colored stat cards with top accent |
| `src/screens/HostDashboardScreen.tsx` | Gold HOST badge, earning cards with color accent, better empty state |
| `src/screens/HostChargerScreen.tsx` | Border radius updated to match design system |

---

## Supabase Project

URL: `https://cnwlmbpmgwmhzzjnmltz.supabase.co`

Key tables:
- `profiles` — user accounts (role: customer / host / admin)
- `stations` — official EV stations (15 Oman stations)
- `charger_listings` — private host chargers (blue pins on map)
- `bookings` — all booking records
- `charging_sessions` — active and completed charging sessions
- `wallet_transactions` — top-up / charge / refund / bonus history
- `investor_applications` — investor applications pending admin review
- `connectors` — individual connector status per station

Pending SQL to apply in Supabase SQL Editor:
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'host', 'admin'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
```

---

---

# Plan Till Production

## Overview

Watt is a 3-role EV charging platform built for Oman. Every user has exactly one role: **Admin**, **Customer**, or **Host (Investor)**. The goal is a fully self-sustaining marketplace where customers find and book chargers, hosts earn money from their private chargers, and the admin controls and monitors everything from a single panel.

---

## Role 1 — Admin (You / Watt Team)

The admin is the platform operator. There is only one admin account. The admin never books or charges — they manage and control the entire platform.

### What Admin Has Now
- Dashboard with total users, total revenue, bookings count, pending applications alert
- Users screen — search all users, filter by role, change role, delete accounts
- Applications screen — list all investor applications filtered by status
- Application Detail — full review page with Approve (upgrades user to Host) and Reject

### What Admin Still Needs

**Analytics & Reporting**
- Revenue chart by month (line/bar chart)
- Bookings chart by week
- Most active stations (top 5 by bookings)
- User growth over time
- Export reports as CSV or PDF

**Station Management**
- List all 15 official Watt stations
- Edit station details (name, address, price per kWh, power, hours)
- Change station status (available / busy / fault / offline)
- Add new official stations
- View per-station revenue and booking count

**Booking Management**
- View all bookings across all users
- Filter by status, date range, station, user
- Force cancel any active booking
- View booking QR code
- See real-time active sessions

**Charger Listing Management**
- View all private host charger listings
- Approve or suspend a listing
- Edit pricing or availability on behalf of host
- Remove a listing

**Notifications & Broadcasts**
- Send push notification to all users
- Send targeted message to specific user by role or ID
- Announce new stations or promotions

**Admin Profile**
- Admin name and contact details
- Change admin password
- View admin activity log (who approved what, when)

---

## Role 2 — Customer

The customer is the EV driver. They open the app to find a nearby charger, book it, pay, and charge their car.

### What Customer Has Now
- Map screen with official stations (colored pins) and private host chargers (blue pins)
- Search stations by name or governorate
- Station details page (connectors, price, hours, amenities, ratings)
- Booking flow (select duration, estimated cost, confirm)
- Active booking screen — QR code + animated scan line + Start Charging button + countdown timer
- Charging session screen
- Bookings history with filter tabs (all / active / confirmed / completed)
- Wallet — balance card, top-up with Thawani Pay (demo), transaction history
- Profile — stats, car model, membership level (standard / silver / gold), settings
- Language toggle (Arabic / English)
- Investor application form (3-step: personal info → location → package selection)

### What Customer Still Needs

**Map Improvements**
- Filter stations by connector type (Type2, CCS, CHAdeMO)
- Filter by price range
- Filter by availability only
- Show distance in km from user location
- Navigate to station via Google Maps / Apple Maps button
- Station reviews — read and write ratings with comments

**Booking Improvements**
- Select specific connector (not just station)
- Real-time connector availability polling
- Booking reminder push notification 15 min before slot
- Reschedule booking before it starts
- Booking receipt / invoice as PDF

**Charging Session**
- Live kWh counter during active session
- Live cost counter during active session
- Stop charging button (ends session, calculates final cost, deducts from wallet)
- Session summary screen after stop (total kWh, total cost, duration, CO2 saved)
- Share session summary card (for social)

**Wallet**
- Real Thawani Pay integration (not demo)
- Transaction filter (top-up / charges / refunds)
- Refund request button for cancelled bookings
- Low balance warning notification

**Profile**
- Upload profile photo
- Edit email address
- Push notification preferences saved to Supabase (currently UI-only)
- View current investor application status (pending / approved / rejected)
- Loyalty points system tied to kWh charged
- Membership upgrade path: Standard → Silver (20 sessions) → Gold (50 sessions)

**Notifications**
- Push notification when booking is confirmed
- Push notification when charger is ready to use
- Push notification when charging session ends
- Push notification when wallet is topped up

---

## Role 3 — Host (Investor)

The host is a property owner or business who installs a Watt charger at their location and earns money from bookings made by customers. A customer becomes a host by submitting an investor application from their profile — the admin reviews and approves it.

### What Host Has Now
- Dashboard — online/offline toggle, today's bookings, this month earnings, all-time earnings
- My Charger — mini map showing charger location, charger details (type, power, price, hours), edit mode
- Earnings — wallet balance, monthly/all-time earnings, recent transaction list
- Profile (shared with customer profile screen)

### Investor Application Flow (customer → host)
1. Customer taps "Become Investor" in profile
2. 3-step form: personal info, location details, package selection (Basic 15 OMR/mo or Pro 50 OMR/mo)
3. Revenue estimator shows projected monthly earnings
4. Application submitted → status: pending
5. Admin reviews in Applications tab → Approve → customer role upgrades to host
6. Host opens app → lands in HostNavigator automatically
7. Host completes charger setup (map pin + charger details)

### What Host Still Needs

**Dashboard Improvements**
- Weekly earnings chart (bar chart by day)
- Upcoming bookings list for next 7 days
- Average rating displayed prominently
- Occupancy rate (% of available hours that were booked)

**My Charger Improvements**
- Multiple photos of the charger location (upload from gallery)
- Set custom pricing by time of day (peak / off-peak)
- Set blocked dates (charger not available)
- Charger health / connectivity status
- Request maintenance from Watt team button

**Bookings Management**
- Full list of all bookings for their charger
- Filter by status (confirmed / active / completed / cancelled)
- View customer name for each booking
- Block a specific customer if needed

**Earnings & Payouts**
- Payout request button (transfer earnings to bank account)
- Payout history
- Watt commission breakdown (10% deducted, shown clearly)
- Monthly earnings report PDF

**Notifications**
- Push notification when a new booking arrives
- Push notification when a customer starts charging
- Push notification when a booking is cancelled
- Weekly earnings summary every Sunday

**Host Profile**
- Host public rating (average across all bookings)
- Switch to Customer view (host can also use the app as a customer)

---

## Production Checklist

### Auth & Security
- [ ] Restore real auth flow (Splash → RoleSelect → Phone/OTP → SignIn/Up)
- [ ] Delete DevLoginScreen.tsx
- [ ] Enable phone number OTP via Supabase (Twilio or similar)
- [ ] Set up Row Level Security (RLS) for admin-only tables
- [ ] Protect admin routes so only role=admin can access them
- [ ] Rate limiting on auth endpoints

### Payments
- [ ] Real Thawani Pay SDK integration (replace demo top-up)
- [ ] Webhook for payment confirmation
- [ ] Automatic wallet deduction when charging session ends
- [ ] Refund flow for cancelled bookings

### Push Notifications
- [ ] Expo Push Notifications setup (expo-notifications)
- [ ] Save device push token to profiles table on login
- [ ] Supabase Edge Function to send notifications on booking events
- [ ] Admin broadcast notification screen

### Database
- [ ] Apply all pending migrations to production Supabase
- [ ] Add indexes for performance (bookings by user, bookings by station)
- [ ] Set up database backups
- [ ] RLS policies for admin-only queries

### App Store
- [ ] App icon (all sizes) for iOS and Android
- [ ] Splash screen asset
- [ ] App Store description in Arabic and English
- [ ] Google Play listing
- [ ] Privacy Policy URL live
- [ ] Terms of Use URL live
- [ ] Build with EAS Build (not Expo Go)

### Testing
- [ ] Test all 3 roles end-to-end on real device
- [ ] Test booking → charging → session end → wallet deduction full flow
- [ ] Test investor application → admin approval → host navigation
- [ ] Test wallet top-up with real Thawani payment
- [ ] Test Arabic RTL layout on all screens
- [ ] Test on both iOS and Android

---

## Current State (June 2026)

| Feature | Status |
|---|---|
| Customer map + stations | Done |
| Customer booking flow | Done |
| Customer wallet (demo) | Done |
| Customer wallet transaction filter | Done |
| Customer profile + settings | Done |
| Customer profile — investor application status | Done |
| Customer profile — membership progress bar | Done |
| Investor application form | Done |
| Map filters (availability + connector type) | Done |
| Map distance in km + Navigate button | Done |
| Live charging session counters (kWh / cost) | Done |
| Session summary screen (CO₂ saved, share) | Done |
| Host dashboard | Done |
| Host charger management | Done |
| Host earnings screen | Done |
| Host earnings — commission breakdown | Done |
| Host bookings list | Done |
| Admin dashboard | Done |
| Admin users management | Done |
| Admin application review + approve/reject | Done |
| Admin station management (view + change status) | Done |
| Admin station — add new station | Done |
| Admin bookings management (view + force cancel) | Done |
| Real auth flow (OTP) | Bypassed for dev |
| Real Thawani Pay | Not started |
| Push notifications | Not started |
| Host payout system | Not started |
| App Store submission | Not started |
