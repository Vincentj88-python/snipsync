# SnipSync (snipsync.xyz) — Project Status

**Last Updated**: 2026-03-20
**Current Version**: v0.3.1 (released Mac DMG + Windows EXE on GitHub Releases)
**Status**: Active Development — security hardened, mobile Phase 1 in progress
**Repo**: github.com/Vincentj88-python/snipsync (public)
**Website**: snipsync.xyz (live on Vercel, waitlist active)
**Supabase**: kohwpkwcopkslbtkczag (EU region, free plan)
**Sentry**: Active (main + renderer, confirmed working)
**CI/CD**: GitHub Actions (tests on push, Mac+Win builds on tag)

---

## What's Shipped (v0.3.1)

### Logo Rebrand
- New SnipSync logo (S-arrow hexagon design) integrated across entire project
- App icon, tray icons, website nav/footer, favicon, OG image, and email headers all updated
- Tray icons regenerated with proper transparency via sharp

### Security Hardening (Critical)
- JWT auth added to all 3 edge functions (record-deletion, send-email, check-deleted)
- Users can only delete own account / email own address / check own deletion status
- send-email supports dual-mode: user JWT or service-role key (for internal calls)
- URL protocol validation added in browser mode

### Security Hardening (High)
- Electron sandbox and webSecurity enabled
- Permission denial handlers for camera, microphone, and geolocation
- PBKDF2 iterations increased from 100K to 600K with backward compatibility (tries 600K then 100K)
- Master key cleared from memory on sign-out, on beforeunload, and after 30-minute auto-lock
- File upload path sanitization
- Signed URL expiry reduced from 1 hour to 15 minutes
- Constant-time HMAC verification in ls-webhook (prevents timing attacks)
- Recovery phrase wordlist expanded from 64 to 256 words (increased entropy)

### Security Hardening (Medium)
- Vault unlock rate limiting with exponential backoff
- CSP hardened: object-src none, base-uri self, form-action self
- Vercel security headers added: X-Frame-Options, HSTS, and others
- Error messages sanitized in edge functions to prevent information leakage

### Dependency Upgrades
- Electron 28 → 35, electron-builder 24 → 26, @sentry/electron 4 → 5
- Vite 5 → 6, Vitest 1 → 2, @vitejs/plugin-react 4 → 5
- Sentry import fixed for v5 (require @sentry/electron/main)
- vite.config.js renamed to vite.config.mjs for ESM compatibility
- Vulnerability audit: 16 vulns (5 high) reduced to 5 (all moderate, dev-only)

### OAuth Fix
- Reverted custom state parameter — it conflicted with Supabase's internal CSRF state handling
- Simple callback approach adopted; Supabase handles CSRF internally

### Encryption Fix
- Added re-check before enabling encryption to prevent master key overwrite when enabling on a second device

### Pricing Updates
- Pro: $3.99/mo → $4.99/mo, $29/yr → $39/yr
- Team: $6.99/seat/mo → $8.99/seat/mo
- Website pricing section redesigned: Pro hero card, cleaner layout structure
- Upgrade note added to website: "Upgrade to Pro from inside the app via Settings"

### Mobile App — React Native (Phase 1 in progress)
- React Native project scaffolded in `mobile/` folder (bare workflow)
- All Phase 1 dependencies installed: Supabase, tweetnacl, react-native-quick-crypto, Google Sign-In, etc.
- Adapted lib files from desktop: supabase.js, crypto.js, utils.js ported for React Native
- Built screens: SignInScreen (with app icon), ClipListScreen (full clip list with realtime, vault unlock, compose, filters)
- Built ClipCard component
- Navigation: AppNavigator with auth gating (signed-out vs signed-in stack)
- Google OAuth: configured with iOS client ID, PKCE flow via Supabase `signInWithIdToken`
- Deep linking: snipsync:// URL scheme registered, AppDelegate bridged for RCTLinkingManager
- Sign-in flow working end-to-end: Google → Safari → callback → app
- PBKDF2 backward compatibility: tries 600K iterations first, falls back to 100K for legacy keys
- Currently testing vault unlock on physical iPhone

---

## What's Shipped (v0.3.0)

### Core
- Real-time clipboard sync across Mac and Windows via Supabase Realtime
- Google OAuth sign-in (local callback server for Electron)
- Device tracking via persistent UUID (`userData/device-id.txt`) — survives hardware changes
- Legacy device migration from SHA-256 hardware fingerprint to UUID
- Smart type detection (link, code, address, note, image, file)
- Persistent search bar with `/` keyboard shortcut, `Esc` to clear
- Clip CRUD: create, copy, pin, delete with 3s undo
- Right-click context menu on clips (Copy, Pin/Unpin, Open link, Delete)
- Expandable clip content (Show more/less for long clips)
- Hover-to-reveal action buttons (compact card design)
- Type-colored left border on clip cards
- Realtime DELETE sync working (REPLICA IDENTITY FULL on clips table)
- Single instance lock on Windows (prevents multiple instances)
- Enter to send, Shift+Enter for newline
- Optimistic UI: clips appear instantly, realtime deduplicates
- Last synced time in footer

### End-to-End Encryption
- **Algorithm**: tweetnacl XSalsa20-Poly1305 (secretbox)
- **Key derivation**: PBKDF2 with 100,000 iterations (Web Crypto API)
- **Vault password**: With confirmation field + 4-level strength indicator
- **Show/hide toggle**: Eye icon on all password inputs
- **Recovery phrase**: 12-word phrase displayed as numbered chips in 3x4 grid with copy button
- **Recovery flow**: "Forgot password?" → enter phrase → can unlock OR decrypt+disable in one step
- **Force reset**: Lost both password and phrase → wipe encrypted clips + disable encryption
- **Vault overlay**: When locked, password input appears directly over clip list (no Settings navigation needed)
- **Batch migration**: Existing clips encrypted/decrypted in place
- **Zero-knowledge**: Server stores only encrypted blobs

### File & Image Clips (Pro-only)
- Image clips: paste screenshots or drag images (up to 10MB on Pro)
- File clips: drag and drop any file (up to 25MB on Pro)
- File display: contextual icon, filename, size, download button
- Image lightbox: click thumbnails to view full size
- Drag-and-drop zone with visual feedback (green highlight, "Drop file here")
- Smart routing: images → clip-images bucket, files → clip-files bucket
- Free tier: image and file clips blocked with upgrade toast

### Account Management & Abuse Prevention
- **Sign out**: Moved to Settings → Account section (removed avatar from titlebar)
- **Account deletion**: Edge function handles everything — records deletion, deletes profile (cascade), deletes auth user, sends confirmation email
- **deleted_accounts table**: Tracks email + machine_ids (service-role only, no client access)
- **Re-signup detection**: On sign-in, checks deleted_accounts → shows warning toast + sends welcome-back email
- **Full auth cleanup**: Deleting account removes the Supabase auth user, forcing fresh Google OAuth on re-signup

### Transactional Emails (Resend)
- **Welcome**: Sent on first signup (new profile creation)
- **Account deleted**: Sent after account deletion (from record-deletion edge function)
- **Welcome back**: Sent when a previously deleted user re-signs up
- **Design**: Dark header with SnipSync branding, white card body, color-coded info boxes, CTA buttons

### UI/UX Overhaul
- Improved text contrast throughout (WCAG AA compliant on dark backgrounds)
- Card background with subtle blue undertone (#121315)
- Compact clip cards with reduced padding
- Settings scroll fixed (flex: 1, min-height: 0, overflow-y: auto)
- Enhanced empty state with actionable buttons (Settings, Quick tips)
- Persistent search bar (always visible, `/` to focus)
- Better sign-in screen (brighter subtitle, polished button borders)

### Infrastructure
- Free/Pro tier enforcement with file size limits
- 4 Supabase Edge Functions (ls-webhook, record-deletion, check-deleted, send-email)
- deleted_accounts migration + clip-files storage bucket
- profiles INSERT RLS policy (was missing, caused silent failures)
- `file` type added to clips check constraint
- Subscriptions table with auto-create trigger
- Auto-updates via electron-updater + GitHub Releases
- Sentry error reporting (both processes)
- Resend API key as Supabase secret

### Browser Extension — Chrome
- Chrome extension working (loaded unpacked, not published)
- Google OAuth via chrome.identity API
- Same Supabase backend, same Realtime sync
- Counts as a device toward free tier limit

### Website (updated for v0.3.0)
- Version badge: v0.3.0
- Features: image & file clips, recovery phrase, drag-and-drop
- Pricing: image clips (10MB) and file clips (25MB) listed separately under Pro
- How it works: Enter to send, drag files
- Meta descriptions updated with images/files/encryption
- Waitlist still active (not live yet)

### CI/CD
- `ci.yml`: tests + build on push to main / PRs
- `release.yml`: Mac DMG + Windows x64 EXE on version tags
- Supabase env vars in Vite build step
- Code signing on Mac (not notarized — needs Apple Developer account)

---

## Known Issues / Bugs

| # | Issue | Severity | Notes |
|---|-------|----------|-------|
| 1 | **Mac DMG Gatekeeper warning** | Medium | App is signed but not notarized. Users must go to System Settings → Privacy & Security → Open Anyway. Needs Apple Developer account ($99/yr) for notarization. |
| 2 | **GitHub Release duplicate .exe files** | Low | Sometimes two .exe files appear from previous releases. Need clean release process. |
| 3 | **Windows installer retry + multi-instance** | Low | User reported needing to click "retry" during install. Single instance lock added but NSIS config may need tweaks. |
| 4 | **Extension popup CSS** | Cosmetic | Chrome popup has hard square corners (browser limitation). |
| 5 | **Mobile vault unlock** | In Testing | Vault unlock on physical iPhone being tested — PBKDF2 backward compat (600K/100K) may need verification against live encrypted clips. |

---

## Waiting On

| Item | Status | Blocker |
|------|--------|---------|
| Lemon Squeezy approval | Submitted, need to send demo video | Need to record video and submit |
| Apple Developer account | Not purchased | $99/yr, needed for Mac notarization |
| Google OAuth verification | Not submitted | 100 user cap without it, needs privacy policy URL |
| Supabase upgrade | On free plan | Must upgrade before 50 users (auto-pause risk) |

---

## Current Account / Service State

| Service | State |
|---------|-------|
| User account | Pro plan (set for testing) |
| Sentry | Confirmed working |
| Vercel Analytics | Enabled |
| Supabase | Free plan (EU region) |
| Resend | Active (noreply@updates.snipsync.xyz) |
| Lemon Squeezy | Awaiting approval |
| Chrome extension | Working (loaded unpacked) |
| Mac + Windows builds | On GitHub Releases (v0.3.1) |
| Mobile (iOS) | Phase 1 in progress — sign-in working, vault unlock in testing |
| Website | Live at snipsync.xyz with waitlist — pricing updated for v0.3.1 |

---

## What's Next

1. Finish mobile Phase 1: confirm vault unlock works on physical iPhone with live encrypted clips
2. Mobile Phase 1: build basic SettingsScreen (account info, sign out, device list)
3. Mobile Phase 1: test end-to-end — sign in on phone, see desktop clips in real time, tap to copy
4. Record demo video for Lemon Squeezy
5. Submit demo video to Lemon Squeezy for approval
6. Submit Google OAuth for verification (with privacy policy URL)
7. Purchase Apple Developer account for Mac notarization (also needed for App Store)
8. Upgrade Supabase before public launch
9. Browser extension: right-click context menu, Chrome Web Store publish

---

## Tests

27 tests passing (Vitest):
- `src/lib/__tests__/utils.test.js` — detectType, mapPlatform
- `src/lib/__tests__/supabase.test.js` — CRUD helpers (mocked)
- `src/components/__tests__/Toast.test.jsx` — render, undo, dismiss

---

## Key Files

```
/electron/main.js                        — Main process (tray, OAuth, clipboard watch, IPC, persistent UUID)
/electron/preload.js                     — IPC bridge to renderer (includes getLegacyMachineId)
/src/App.jsx                             — Root component (auth, device setup, clip sync, vault overlay, lightbox)
/src/lib/supabase.js                     — Supabase client + all DB helpers + file/image upload + email
/src/lib/crypto.js                       — E2E encryption (key gen, vault password, encrypt/decrypt, recovery)
/src/lib/utils.js                        — detectType(), mapPlatform()
/src/components/                         — ClipCard (context menu, expand, lightbox), InputArea (drag-drop), FilterBar, SearchBar (persistent, / shortcut), Toast, SettingsView (sign-out, encryption UX)
/src/styles.css                          — All styles + animations + context menu + vault overlay + lightbox
/website/                                — Landing page (index, privacy, terms, styles, script)
/supabase/functions/                     — ls-webhook, record-deletion, check-deleted, send-email (all JWT-protected)
/.github/workflows/                      — CI + Release
/vite.config.mjs                         — Vite config (renamed from .js for ESM compat)
/PLAN.md                                 — Product roadmap
/ENCRYPTION_PLAN.md                      — Encryption architecture (implemented)
/mobile/src/lib/supabase.js             — Supabase client adapted for React Native
/mobile/src/lib/crypto.js              — Crypto adapted: PBKDF2 via react-native-quick-crypto
/mobile/src/screens/SignInScreen.js    — Google OAuth sign-in screen
/mobile/src/screens/ClipListScreen.js  — Main clip list (realtime, vault unlock, compose, filters)
/mobile/src/components/ClipCard.js     — Clip card component
/mobile/src/navigation/AppNavigator.js — Auth-gated navigation stack
/mobile/PLAN.md                        — Mobile app phased plan
```

---

## Session Log

### 2026-03-20 (v0.3.1 — Security Hardening, Dependency Upgrades, Mobile Phase 1)

**Logo Rebrand**
- New S-arrow hexagon logo integrated across app icon, tray icons, website nav/footer, favicon, OG image, email headers
- Tray icons regenerated with proper transparency via sharp

**Security — Critical**
- JWT auth added to all 3 edge functions (record-deletion, send-email, check-deleted)
- Users scoped to own data only; send-email supports service-role bypass for internal calls
- URL protocol validation added in browser mode

**Security — High**
- Electron sandbox + webSecurity enabled; permission denial handlers for camera/mic/geo
- PBKDF2 iterations increased 100K → 600K with backward compat (tries 600K, falls back to 100K)
- Master key cleared from memory on sign-out, beforeunload, and 30min auto-lock
- File upload path sanitization; signed URL expiry reduced 1hr → 15min
- Constant-time HMAC in ls-webhook; recovery phrase wordlist expanded 64 → 256 words

**Security — Medium**
- Vault unlock rate limiting with exponential backoff
- CSP hardened (object-src none, base-uri self, form-action self)
- Vercel security headers added (X-Frame-Options, HSTS, etc.)
- Error messages sanitized in edge functions

**Dependency Upgrades**
- Electron 28→35, electron-builder 24→26, @sentry/electron 4→5
- Vite 5→6, Vitest 1→2, @vitejs/plugin-react 4→5
- Sentry v5 import fixed; vite.config.js → vite.config.mjs for ESM compat
- Vuln audit: 16 (5 high) → 5 (moderate, dev-only)

**Bug Fixes**
- OAuth: reverted custom state param — conflicted with Supabase's own CSRF handling
- Encryption: re-check before enabling prevents master key overwrite on second device

**Pricing**
- Pro: $3.99→$4.99/mo, $29→$39/yr; Team: $6.99→$8.99/seat/mo
- Website pricing section redesigned with Pro hero card and cleaner structure

**Mobile — React Native Phase 1 (in progress)**
- Project scaffolded in mobile/ (bare workflow), all Phase 1 deps installed
- Adapted supabase.js, crypto.js, utils.js for React Native (AsyncStorage, quick-crypto)
- Built SignInScreen, ClipListScreen (realtime, vault unlock, compose, filters), ClipCard, AppNavigator
- Google OAuth via native SDK + Supabase signInWithIdToken; PKCE flow working
- snipsync:// deep link registered; AppDelegate bridged for RCTLinkingManager
- Sign-in flow confirmed working end-to-end on device
- PBKDF2 backward compat in mobile crypto.js (600K then 100K)
- Vault unlock on physical iPhone currently being tested

**Release**
- v0.3.1 tagged and released (Mac DMG + Windows EXE on GitHub Releases)

### 2026-03-18 (v0.3.0 — Production-Ready Overhaul)
- UI overhaul: text contrast, card polish, compact layout, type-colored borders
- Settings scroll fix, hover-to-reveal actions, persistent search with / shortcut
- Sign-out moved to Settings, avatar removed from titlebar
- Persistent UUID device ID (replaces hardware fingerprint), legacy migration
- Account deletion: edge function deletes profile + auth user, records in deleted_accounts
- Re-signup detection with warning toast
- Transactional emails via Resend (welcome, deletion, welcome-back)
- Encryption UX: password confirm, strength bar, show/hide toggle, recovery chips
- Recovery phrase can decrypt + disable in one step, force-reset escape hatch
- Vault overlay on main screen when locked
- File clips: drag-and-drop, storage bucket, contextual icons, download button
- Image lightbox, right-click context menu, expandable clip content
- Enhanced empty state with actionable buttons
- Enter to send, optimistic clip rendering, last synced time in footer
- Strict file size limits (Pro: 10MB images, 25MB files; Free: blocked)
- Website updated with v0.3.0 features, pricing, descriptions
- Version bump to 0.3.0, all 27 tests passing
- Built Mac DMG + Windows EXE, pushed to GitHub Releases v0.3.0
- Fixed: profiles INSERT RLS policy, clips type check constraint for 'file'
- Fixed: edge functions 401 (verify_jwt disabled for service-role functions)

### 2026-03-17
- Built E2E encryption (tweetnacl, vault password, PBKDF2, recovery phrase)
- Built account deletion with cascade + ensureProfile auto-recreation
- Built monthly clip limit (30/month free, resets 1st, delete doesn't restore)
- Chrome extension OAuth working with chrome.identity API
- Website encryption section with visual demo
- Updated privacy policy and terms of service with encryption details
- Fixed CI: Supabase env vars in GitHub Actions Vite build step
- Fixed Realtime DELETE sync: REPLICA IDENTITY FULL on clips table
- Fixed Windows single instance lock

### 2026-03-16
- Initial PROJECT_STATUS.md created
- v0.2.0 tagged and released
- Phase 1 + Phase 2 complete
