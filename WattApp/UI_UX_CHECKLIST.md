# Watt — UI/UX Pre-Deployment Checklist & Findings

A review document for the UI/UX developer to work through **before deploying** the Watt app.

- **Part 1** is a universal, industry-standard UI/UX checklist that every production mobile app should pass. Use it as a repeatable gate.
- **Part 2** is a list of concrete issues, imperfections, and bugs found in the *current* Watt codebase, with file references, ordered by priority.

Scope of the review: every screen across all four roles — **Guest, Customer, Investor, Admin** — plus shared contexts (`AuthContext`, `LanguageContext`), navigation, and design tokens (`colors.ts`).

---

# Part 1 — Standard UI/UX checklist (all apps)

Tick each item on a real device (small phone + large phone), in **both English and Arabic**, in both light conditions.

## 1. Navigation & flow
- [ ] Every screen reachable and every screen has a clear way back (no dead ends).
- [ ] Back button / swipe-back behaves consistently and never traps the user.
- [ ] Primary actions ("Book", "Start Charging", "Top up") are reachable within one or two taps.
- [ ] Irreversible actions (cancel booking, delete/deactivate, sign out) require confirmation.
- [ ] After a completed action the user lands somewhere sensible (e.g. summary → home), not a broken back-stack.
- [ ] Deep links / redirects (password reset, payment return) resolve to the right screen.

## 2. Visual consistency
- [ ] One consistent icon system (don't mix vector icons and emoji as UI icons).
- [ ] Consistent spacing, corner radius, shadow, and button styles across screens.
- [ ] All colors come from the design tokens — no stray hardcoded hex values.
- [ ] Consistent typographic scale (titles, body, captions) — no random font sizes.
- [ ] Consistent modal/sheet pattern (bottom sheet vs. centered dialog used intentionally, not at random).
- [ ] Brand elements (logo, name) rendered identically everywhere.

## 3. Localization & RTL (critical for a bilingual AR/EN app)
- [ ] **No hardcoded user-facing strings** — every label goes through the i18n layer.
- [ ] Switching language updates 100% of visible text with no leftovers.
- [ ] RTL is applied natively and globally (via `I18nManager`), not faked per-screen.
- [ ] Layouts mirror correctly in RTL (rows reverse, icons/arrows flip, text right-aligns).
- [ ] Dates, times, numbers and currency format according to the selected language, not the device.
- [ ] No English text leaks into Arabic mode and vice-versa.
- [ ] Arabic text is not clipped (line-height / diacritics) and letter-spacing is disabled for Arabic.

## 4. Forms & input
- [ ] Inline, field-level validation with clear messages (not one generic "fill everything" alert).
- [ ] Disabled submit buttons explain what's missing, or fields highlight the problem.
- [ ] Correct keyboard type per field (email, number, phone, decimal).
- [ ] `returnKeyType` / next-field focus flows logically through the form.
- [ ] Keyboard never covers the focused input or the submit button (scroll or avoid-view).
- [ ] Password fields have show/hide, and sign-up communicates password rules.
- [ ] Sensible max-lengths and input sanitization.

## 5. Feedback & states
- [ ] Every async action shows a loading state (spinner / disabled button).
- [ ] Every list/screen has: **loading**, **empty**, **error**, and **populated** states.
- [ ] Success confirmations are shown (toast, alert, or state change).
- [ ] Error messages are human-readable — never raw server/DB error text.
- [ ] Errors offer a next step (retry, contact support).
- [ ] No visible non-functional controls ("Coming soon" buttons should be hidden or clearly marked, not primary CTAs).
- [ ] Optimistic UI updates roll back gracefully on failure.

## 6. Layout & responsiveness
- [ ] Works on small screens (e.g. iPhone SE) and large screens without clipping.
- [ ] Content scrolls when it can't fit; nothing critical is pushed off-screen by the keyboard.
- [ ] Respects safe areas (notch, home indicator, status bar) on all screens.
- [ ] Handles rotation / dynamic resize (or locks orientation intentionally).
- [ ] Long text (names, addresses, stations) truncates or wraps gracefully.
- [ ] Bottom tab bar / floating elements never overlap content or each other.

## 7. Accessibility (a11y)
- [ ] Icon-only buttons have `accessibilityLabel` + `accessibilityRole`.
- [ ] Touch targets ≥ 44×44 pt (use `hitSlop` where visuals are smaller).
- [ ] Status is never conveyed by color alone (add text/icon).
- [ ] Text contrast meets WCAG AA (≥ 4.5:1 for body text).
- [ ] Layout survives OS large-font / dynamic-type settings without clipping.
- [ ] Screen-reader can traverse each screen in a logical order.

## 8. Performance & polish
- [ ] Lists use virtualization (`FlatList`) with stable `keyExtractor`.
- [ ] No dropped frames on scroll / animations on a mid-range device.
- [ ] Images sized/compressed; no oversized assets.
- [ ] No console warnings/errors in a production build.
- [ ] App launches without a flash of wrong-language / wrong-theme content.

## 9. Trust, privacy & correctness
- [ ] Money, energy, and totals are always accurate and never "estimated" without saying so.
- [ ] No fabricated/mock data shown as if real (e.g. fake battery %).
- [ ] Permission prompts (location, photos, notifications) explain *why* before asking.
- [ ] Destructive-action labels match what actually happens ("Delete" must delete).
- [ ] Legal (Terms, Privacy) reachable; sensitive data not shown in the wrong field.

## 10. Theming
- [ ] Light mode fully polished; dark mode supported or intentionally deferred.
- [ ] `StatusBar` style matches the screen background on every screen.

---

# Part 2 — Findings in the current Watt app

Priorities: **P1 = fix before launch**, **P2 = should fix**, **P3 = polish**.

## P1 — Fix before launch

### 1. RTL is only half-implemented (systemic)
`LanguageContext` sets an `isRTL` boolean but **never calls `I18nManager.forceRTL()`** ([src/context/LanguageContext.tsx](src/context/LanguageContext.tsx)). RTL is then re-implemented by hand on each screen with `textAlign: 'right'` and `flexDirection: 'row-reverse'` — and applied **inconsistently**. Screens with little or no RTL handling include **WalletScreen, ChargingScreen, SessionSummaryScreen, InvestorEarningsScreen**, and large parts of **ProfileScreen**. Result: Arabic users get a half-mirrored, inconsistent layout.
*Fix:* adopt native RTL (`I18nManager.forceRTL` + reload) so layouts mirror globally, then remove the ad-hoc per-screen overrides.

### 2. Default language flashes Arabic on launch
`useState<Lang>('ar')` ([LanguageContext.tsx:20](src/context/LanguageContext.tsx)) is the initial value before the stored preference loads from AsyncStorage. English users see a brief Arabic flash on every cold start.
*Fix:* gate first render until the stored language resolves (or detect device locale).

### 3. Hardcoded strings that never translate
These are user-facing and will show the wrong language:
- Arabic `لكل kWh` shown **even in English** in the station book bar — [StationDetailsScreen.tsx:177](src/screens/StationDetailsScreen.tsx).
- Booking time-picker labels `"Hour" / "Min" / "Period"` — [BookingScreen.tsx:367,384,400](src/screens/BookingScreen.tsx).
- `"Enter a duration between 15 and 720 minutes."`, `"This time has passed"`, `"This slot is booked"`, `"Unable to open maps."` — [BookingScreen.tsx:238,248,415](src/screens/BookingScreen.tsx).
- `"Ref #"` — [ActiveBookingScreen.tsx:208](src/screens/ActiveBookingScreen.tsx); `"Private Charger"` fallback — [ActiveBookingScreen.tsx:135](src/screens/ActiveBookingScreen.tsx), [MapScreen.tsx:379](src/screens/MapScreen.tsx).
- Photo-permission alert & `"Edit"` & `"Unknown Station"` — [ProfileScreen.tsx:141,692,804](src/screens/ProfileScreen.tsx).
- `"Edit"`, `"Setup Progress"`, Tuya device hint, and **all customer-booking status labels** (`Active/Confirmed/Pending/Done/Cancelled/No Show`) — [investor/InvestorChargerScreen.tsx:336,363,502,526-531](src/screens/investor/InvestorChargerScreen.tsx).
- `"Coming Soon"` / `"Withdrawal feature coming in next update."` — [investor/InvestorEarningsScreen.tsx:83](src/screens/investor/InvestorEarningsScreen.tsx).
- `"Error"` title and `"{n} active · {n} deactivated"` — [admin/AdminUsersScreen.tsx:40,112](src/screens/admin/AdminUsersScreen.tsx).

### 4. Dates/times don't follow the selected language
Wallet transaction dates are hardcoded to Arabic locale `'ar-OM'` even in English — [WalletScreen.tsx:134](src/screens/WalletScreen.tsx). Many other places call `toLocaleDateString()` with **no locale**, so they follow the device, not the app: [ProfileScreen.tsx:296,817](src/screens/ProfileScreen.tsx), [admin/AdminUsersScreen.tsx:86](src/screens/admin/AdminUsersScreen.tsx), [admin/AdminMapScreen.tsx:280](src/screens/admin/AdminMapScreen.tsx), [admin/AdminInvestorsScreen.tsx:237](src/screens/admin/AdminInvestorsScreen.tsx), [admin/AdminProfileScreen.tsx:113](src/screens/admin/AdminProfileScreen.tsx), [investor/InvestorEarningsScreen.tsx:139](src/screens/investor/InvestorEarningsScreen.tsx), [investor/InvestorChargerScreen.tsx:538](src/screens/investor/InvestorChargerScreen.tsx).

### 5. "Delete account" only signs out
In the Security modal, the **Delete account** action calls `signOut` — it does **not** delete or deactivate anything — [ProfileScreen.tsx:508-516](src/screens/ProfileScreen.tsx). Users expect deletion. (A separate, real deactivate exists lower on the screen, which is itself confusing — two different "remove me" controls.)
*Fix:* make the label match the behavior, and consolidate to one clear account-removal flow.

### 6. Visible non-functional primary action
The investor **Withdraw** button is a primary gold CTA that only pops a "Coming Soon" alert — [investor/InvestorEarningsScreen.tsx:81-87](src/screens/investor/InvestorEarningsScreen.tsx). Shipping a dead primary button erodes trust.
*Fix:* hide it until implemented, or clearly mark it as upcoming/disabled.

### 7. Fabricated data shown as real
Battery percentage is invented, not measured: `battery_start_pct: 20` hardcoded ([ActiveBookingScreen.tsx:123](src/screens/ActiveBookingScreen.tsx)) and `battery_end = 20 + kwh*4` ([ChargingScreen.tsx:238](src/screens/ChargingScreen.tsx)). If any screen surfaces this as a real reading it's misleading.
*Fix:* don't display invented values as measurements.

## P2 — Should fix

### 8. "Create Account" navigates to Sign In
Both guest screens send the **Create Account** button to the `SignIn` screen, not `SignUp` — [GuestLockedScreen.tsx:77](src/screens/GuestLockedScreen.tsx), [GuestProfileScreen.tsx:73](src/screens/GuestProfileScreen.tsx).

### 9. Security modal mislabels phone as email
The "Email" row in the Security modal displays `profile.phone` — [ProfileScreen.tsx:499-502](src/screens/ProfileScreen.tsx).

### 10. Raw server errors shown to users
Many catch blocks surface `e.message` directly (Supabase/Postgres text): [ChargingScreen.tsx:264](src/screens/ChargingScreen.tsx), [ActiveBookingScreen.tsx:142](src/screens/ActiveBookingScreen.tsx), [BookingScreen.tsx:297](src/screens/BookingScreen.tsx), [WalletScreen.tsx:114](src/screens/WalletScreen.tsx), [ProfileScreen.tsx:179](src/screens/ProfileScreen.tsx), [investor/InvestorChargerScreen.tsx:116](src/screens/investor/InvestorChargerScreen.tsx), and more.
*Fix:* map to friendly, localized messages; log the raw error separately.

### 11. Sign-in / sign-up can clip on small screens
`SignInScreen` and `SignUpScreen` use `KeyboardAvoidingView` with **no ScrollView**; the social panel "slides off" by design, and on small devices sign-up (name + email + password + button + divider + 2 social buttons) can clip with no way to scroll — [SignInScreen.tsx:133-239](src/screens/SignInScreen.tsx), [SignUpScreen.tsx:114-230](src/screens/SignUpScreen.tsx).
*Fix:* wrap the form in a `ScrollView` with `keyboardShouldPersistTaps`.

### 12. Weak form validation UX
- Investor application shows a single generic "fill all fields" alert on submit and disables the button with no hint about the missing field — [InvestorApplicationScreen.tsx:106-109](src/screens/InvestorApplicationScreen.tsx).
- Sign-up validates email inline but name/password via blocking `Alert`, and has no password-strength guidance or confirm field — [SignUpScreen.tsx:61-73](src/screens/SignUpScreen.tsx).

### 13. Investor "earnings" numbers are misleading
"This month" / "All time" earnings sum `topup` + `bonus` transactions on the same shared wallet, so the investor's own customer top-ups count as earnings — [investor/InvestorEarningsScreen.tsx:45-56](src/screens/investor/InvestorEarningsScreen.tsx).

### 14. Empty alert titles
`Alert.alert('', …)` produces a title-less dialog — [BookingsScreen.tsx:159](src/screens/BookingsScreen.tsx), [InvestorApplicationScreen.tsx:413](src/screens/InvestorApplicationScreen.tsx).

### 15. Profile shows an empty line for phone
The profile hero renders `profile.phone` under the name, but email-signup users have no phone → blank line — [ProfileScreen.tsx:272](src/screens/ProfileScreen.tsx).

## P3 — Polish

### 16. Mixed icon systems (vector + emoji)
Most screens use the SVG icon set, but several use emoji as UI icons: InvestorCharger info rows (📍⚡🔋💰🕐📝🔌), StationDetails stats/amenities (💰⚡⭐🔌), InvestorEarnings tx icons (⬆️⚡↩️🎁), Profile security/about rows (🔐🚫📱🗑📄🔒). Emoji render differently per platform and OS version.
*Fix:* standardize on the vector icon set.

### 17. Inconsistent dismiss controls
MapScreen uses a literal `"✕"` text character for its dismiss buttons ([MapScreen.tsx:418,573](src/screens/MapScreen.tsx)) while the rest of the app uses the `XIcon` SVG.

### 18. Hardcoded values outside the design system
The floating tab-bar pill uses a hardcoded `#F2F3F5` background instead of a token — [src/navigation/index.tsx:183](src/navigation/index.tsx). Audit for other stray hex values.

### 19. Accessibility is largely absent
No `accessibilityLabel` / `accessibilityRole` on icon-only buttons (back arrows, close, password eye, locate, camera badge, tab items) across all screens. Several small dismiss targets (~26–28 pt) sit below the 44 pt minimum without `hitSlop` (e.g. [MapScreen.tsx dismissBtn](src/screens/MapScreen.tsx)). No handling/testing for OS large-font settings, which is risky given the many `numberOfLines={1}` clamps.

### 20. Map bottom sheet doesn't adapt to resize
Sheet height is computed once from `Dimensions.get('window')` ([MapScreen.tsx:529](src/screens/MapScreen.tsx)); it won't respond to rotation or split-screen.

### 21. No dark mode
All tokens are light-only and `StatusBar` is `style="auto"`; on dark-preference devices the app stays light. Acceptable to defer for launch, but decide explicitly.

### 22. Charging metrics row can crowd on narrow screens
When live power is available, the row shows three metrics + two dividers ([ChargingScreen.tsx:325-350](src/screens/ChargingScreen.tsx)); verify values don't truncate on small devices.

---

## Note on documentation drift
`README.md` and `UPDATE.md` describe an older design (Customer/Host two-role model, DevLogin, 3-step investor form, screens like `AdminDashboardScreen`/`HostSetupScreen` that no longer exist). The **actual** app is Guest / Customer / Investor / Admin with real auth and a single-scroll investor form. Trust the source, and refresh the docs so QA tests against reality. `GO_LIVE.md` is the most current document.
