# Watt — EV Charging Network App (Oman)

A dual-role mobile application built with **React Native (Expo)** and **Supabase** for the Sultanate of Oman's EV charging ecosystem. Customers find and book charging stations; home charger owners list their chargers and earn income.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo SDK 54 (React Native 0.81.5) |
| Language | TypeScript |
| Backend | Supabase (Auth + PostgreSQL + Edge Functions) |
| Navigation | React Navigation v6 |
| Maps | React Native Maps (Google Maps) |
| State | React Context + TanStack Query |
| Storage | AsyncStorage + Expo SecureStore |
| Styling | React Native StyleSheet |

---

## App Roles

### Customer
Find charging stations across Oman, book a slot, pay via digital wallet, and manage sessions.

### Host
List your home charger, set availability and pricing, track bookings, and receive earnings.

---

## Features Built

### Authentication
- Email + password sign-up and sign-in (no SMS or SMTP required)
- Single screen with sign-up / sign-in toggle
- Role selection before login (Customer or Host)
- Profile auto-created in Supabase on first sign-up
- Session persistence via AsyncStorage

### Customer Screens
| Screen | Description |
|---|---|
| Splash | 3-slide onboarding carousel |
| Role Select | Choose between Customer and Host |
| Map | Interactive Google Maps with all 15 Omani charging stations |
| Station Details | Full station info, connectors, ratings, amenities, operating hours |
| Booking | Pick date, time, duration — shows estimated kWh and cost |
| Active Booking | QR code display, countdown timer, start/cancel actions |
| Charging Session | Live session tracking with energy, cost, duration |
| Bookings | Full booking history with status filters |
| Wallet | Balance, top-up, transaction history |
| Profile | User info, car model, membership level, stats |
| Settings | Notifications, Security, Help & Support, About |
| Investor | Apply to add a charging station at your location |

### Host Screens
| Screen | Description |
|---|---|
| Host Setup | Pin charger location on map + fill charger details |
| Dashboard | Today's bookings, total earnings, quick availability toggle |
| My Charger | View and manage charger listing |
| Earnings | Balance, this month's earnings, transaction history |

### Localisation
- Full **Arabic / English** bilingual support
- RTL layout for Arabic
- Omani governorates, wilayats, and station names in both languages
- OMR currency throughout

### Legal
- Terms of Use screen (AR/EN)
- Privacy Policy screen (AR/EN)

### Backend (Supabase)
- `profiles` table — user data, role, wallet, stats
- `charger_listings` table — host charger data
- `stations` table — 15 Omani public stations
- `bookings` table — booking records with QR codes
- `charging_sessions` table — live session tracking
- `wallet_transactions` table — payment history
- `investor_applications` table — investment requests
- Edge Function: `notify-booking` for push notifications

---

## Charging Stations (15 across Oman)

Stations are pre-loaded across all major governorates:

- **Muscat** — Muscat Grand Mall, Avenues Mall, Qurum City Centre, Al Araimi Boulevard, Oman Convention Centre
- **Dhofar** — Lulu Salalah, Salalah Gardens Mall
- **Al Batinah** — Sohar Industrial Area, Barka Beach Resort
- **Al Sharqiyah** — Sur Corniche, Ibra Commercial District
- **Ad Dakhiliyah** — Nizwa Souq, Bahla Fort Area
- **Al Buraimi** — Al Buraimi Border Zone
- **Musandam** — Khasab Port

---

## Project History

### Session 1 — Foundation (`9608c48`)
- Initial Expo project setup
- Basic navigation structure
- Supabase client configuration

### Session 2 — Auth + Maps (`4ec8913`)
- Email OTP authentication (first attempt)
- Google Maps API key integration
- Supabase schema definition
- Twilio Edge Function for notifications

### Session 3 — Bilingual Support (`9f60f7b`, `b49043d`)
- Full Arabic / English language system with `LanguageContext`
- RTL layout support
- Omani governorates and station names in both languages
- English mode fixes for duration abbreviations and locales

### Session 4 — Settings + Legal (`31a958c`, `155f3a0`)
- Notifications settings screen
- Security & Privacy screen
- Help & Support screen (FAQ + WhatsApp/email contact)
- About screen (version, links, social)
- Terms of Use modal (AR/EN)
- Privacy Policy modal (AR/EN)

### Session 5 — Dual-Role Redesign (`70161f5`, `34175fb`)
- Complete redesign to support both Customer and Host roles
- Host signup flow with charger setup wizard (map pin + details form)
- Host dashboard with bookings, earnings, quick toggle
- Google Maps station locator web page (15 stations)
- Investor application screen
- Role-based navigation (separate tab bars per role)

### Session 6 — SDK Upgrade + Auth Overhaul (`a0b3564`) — Today
- **Upgraded Expo SDK 52 → 54** (React Native 0.81.5, React 19.1.0)
- Updated all package versions for SDK 54 compatibility
- Added `react-native-worklets` (required by Reanimated v4)
- **Replaced auth system** — removed phone+password and OTP flows
- Built new **PhoneScreen** as unified sign-up / sign-in screen (email + password)
- Added `signInWithEmailPassword` and `signUpWithEmailPassword` to `AuthContext`
- **Moved HostSetup into HostNavigator** — hosts go through setup after login, not before
- HostNavigator checks for existing charger listing to decide initial route
- Updated `RoleSelectScreen` to route → `Phone` instead of `SignIn`
- Excluded Deno edge function from TypeScript compilation (`tsconfig.json`)
- Zero TypeScript errors

---

## Running the App

### Prerequisites
- Node.js 18+
- Expo Go app on your phone (SDK 54)

### Install
```bash
npm install
```

### Start
```bash
npm start -- --clear
```

Scan the QR code with Expo Go.

---

## Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Run the schema from `supabase/` directory
3. In **Authentication → Providers → Email**: turn OFF **"Confirm email"**
4. Add your Supabase URL and anon key to `src/lib/supabase.ts`

---

## Environment

```
Supabase URL:  https://cnwlmbpmgwmhzzjnmltz.supabase.co
Google Maps:   Configured in app.json (android.config.googleMaps)
```

---

## Folder Structure

```
WattApp/
├── src/
│   ├── context/
│   │   ├── AuthContext.tsx       # Auth state, sign-in/up, profile
│   │   └── LanguageContext.tsx   # AR/EN toggle, RTL
│   ├── i18n/
│   │   ├── en.ts                 # English strings
│   │   └── ar.ts                 # Arabic strings
│   ├── lib/
│   │   └── supabase.ts           # Supabase client
│   ├── navigation/
│   │   └── index.tsx             # Root, Customer, Host navigators
│   ├── screens/                  # All screens (see feature list above)
│   ├── types/
│   │   └── index.ts              # TypeScript interfaces + nav params
│   └── constants/
│       └── colors.ts             # Design tokens
├── assets/                       # Icons, images
├── supabase/
│   └── functions/                # Deno edge functions
├── app.json                      # Expo config
├── package.json
└── tsconfig.json
```

---

## Next Steps

- [ ] Enable phone SMS auth via Twilio (for +968 number login)
- [ ] Integrate Thawani payment gateway for wallet top-up
- [ ] Real-time charger availability via Supabase Realtime
- [ ] Push notifications via Expo Notifications
- [ ] App Store / Google Play submission
- [ ] Admin dashboard for station management
