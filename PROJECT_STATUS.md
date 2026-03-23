# SnipSync (snipsync.xyz) — Project Status

**Last Updated**: 2026-03-23
**Current Version**: v0.3.1
**Status**: Active Development — Teams feature merged, production hardened, mobile Phase 1 in progress
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

### Tray Icon States
- Green tray icon: syncing / connected
- Gray tray icon: offline
- Red tray icon: error state

### Website Overhaul
- Comparison table added (SnipSync vs. competitors)
- Founder section added
- Dedicated security page
- Waitlist mode active (app not publicly listed yet)

### Free Tier Change
- Free tier now offers unlimited clips with 7-day history (was 30 clips/month)
- The 30 clips/month counter and reset logic removed
- Free tier still blocks image/file clips and limits to 2 devices

### Onboarding Flow
- First-time user onboarding added to app
- Guides new users through key features on first launch

### In-App Feedback
- Feedback button added to Settings
- Users can submit feedback without leaving the app

### Production Hardening
- 14 database indexes added for query performance
- Input sanitization on all user-supplied fields
- React error boundaries added throughout app
- Rate limiting added to all edge functions
- Health check endpoint added
- Env var validation at startup (skips during CI/CD tests — fixes CI breakage)

### Teams Feature (merged to main)
- 12 new database tables: teams, team_members, team_invites, channels, channel_clips, direct_clips, groups, group_members, clip_mentions, collections, collection_clips, plus team billing support
- Admin portal scaffolded at portal.snipsync.xyz
- Channels: create/delete channels, post clips, realtime sync per channel, #general default
- @mentions: autocomplete in clip input, clip_mentions records, unread badge, mentions filter
- Direct send: send a clip directly to a teammate, direct messages view
- Collections: team-shared persistent pinned clip sets
- Team billing: per-seat via Lemon Squeezy, owner manages seats
- Invite flow: owner generates invite link, recipient clicks and auto-joins
- Portal RLS fix: security definer functions used to avoid infinite recursion in RLS policies

### Security Hardening (from v0.3.1 release)
- JWT auth added to all edge functions (record-deletion, send-email, check-deleted)
- Electron sandbox and webSecurity enabled
- PBKDF2 iterations increased from 100K to 600K with backward compatibility
- Master key cleared from memory on sign-out, beforeunload, and 30-minute auto-lock
- File upload path sanitization; signed URL expiry reduced from 1 hour to 15 minutes
- Constant-time HMAC verification in ls-webhook (prevents timing attacks)
- Recovery phrase wordlist expanded from 64 to 256 words
- Vault unlock rate limiting with exponential backoff
- CSP hardened: object-src none, base-uri self, form-action self
- Vercel security headers: X-Frame-Options, HSTS, and others

### Dependency Upgrades (from v0.3.1 release)
- Electron 28 → 35, electron-builder 24 → 26, @sentry/electron 4 → 5
- Vite 5 → 6, Vitest 1 → 2, @vitejs/plugin-react 4 → 5
- Vulnerability audit: 16 vulns (5 high) reduced to 5 (all moderate, dev-only)

### Pricing Updates (from v0.3.1 release)
- Pro: $3.99/mo → $4.99/mo, $29/yr → $39/yr
- Team: $6.99/seat/mo → $8.99/seat/mo

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
- Algorithm: tweetnacl XSalsa20-Poly1305 (secretbox)
- Key derivation: PBKDF2 with 600K iterations (Web Crypto API), backward compat with 100K
- Vault password with confirmation field and 4-level strength indicator
- Show/hide toggle on all password inputs
- Recovery phrase: 12-word phrase displayed as numbered chips in 3x4 grid
- Recovery flow: "Forgot password?" — enter phrase, can unlock or decrypt+disable in one step
- Force reset: lost both password and phrase — wipe encrypted clips and disable encryption
- Vault overlay: when locked, password input appears directly over clip list
- Batch migration: existing clips encrypted/decrypted in place
- Zero-knowledge: server stores only encrypted blobs

### File and Image Clips (Pro-only)
- Image clips: paste screenshots or drag images (up to 10MB on Pro)
- File clips: drag and drop any file (up to 25MB on Pro)
- File display: contextual icon, filename, size, download button
- Image lightbox: click thumbnails to view full size
- Drag-and-drop zone with visual feedback
- Free tier: image and file clips blocked with upgrade toast

### Account Management and Abuse Prevention
- Account deletion: edge function handles everything — records deletion, deletes profile (cascade), deletes auth user, sends confirmation email
- deleted_accounts table: tracks email and machine_ids (service-role only)
- Re-signup detection: warning toast and welcome-back email
- Full auth cleanup: forces fresh Google OAuth on re-signup

### Transactional Emails (Resend)
- Welcome email on first signup
- Account deleted email after deletion
- Welcome back email on re-signup after deletion
- From: SnipSync noreply@updates.snipsync.xyz

### Browser Extension — Chrome
- Chrome extension working (loaded unpacked, not published)
- Google OAuth via chrome.identity API
- Same Supabase backend, same Realtime sync
- Counts as a device toward free tier limit

---

## Known Issues / Bugs

| # | Issue | Severity | Notes |
|---|-------|----------|-------|
| 1 | Mac DMG Gatekeeper warning | Medium | App is signed but not notarized. Users must go to System Settings → Privacy and Security → Open Anyway. Needs Apple Developer account ($99/yr). |
| 2 | GitHub Release duplicate .exe files | Low | Sometimes two .exe files appear from previous releases. Need clean release process. |
| 3 | Windows installer retry + multi-instance | Low | User reported needing to click "retry" during install. Single instance lock added but NSIS config may need tweaks. |
| 4 | Extension popup CSS | Cosmetic | Chrome popup has hard square corners (browser limitation). |
| 5 | Mobile vault unlock | In Testing | Vault unlock on physical iPhone being tested — PBKDF2 backward compat (600K/100K) may need verification against live encrypted clips. |

---

## Waiting On

| Item | Status | Blocker |
|------|--------|---------|
| Lemon Squeezy approval | Submitted, need to send demo video | Need to record video and submit |
| Apple Developer account | Not purchased | $99/yr, needed for Mac notarization and iOS App Store |
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
| Website | Live at snipsync.xyz with waitlist — waitlist mode, comparison table, founder section, security page |
| Teams portal | Scaffolded at portal.snipsync.xyz — all 12 tables merged to main |

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
10. Teams portal: complete Phase B (admin portal MVP) through Phase F (team billing)

---

## Tests

27 tests passing (Vitest):
- `src/lib/__tests__/utils.test.js` — detectType, mapPlatform
- `src/lib/__tests__/supabase.test.js` — CRUD helpers (mocked)
- `src/components/__tests__/Toast.test.jsx` — render, undo, dismiss

CI fix: env var validation now skips during test runs to prevent false failures.

---

## Key Files

```
/electron/main.js                        — Main process (tray, OAuth, clipboard watch, IPC, persistent UUID)
/electron/preload.js                     — IPC bridge to renderer (includes getLegacyMachineId)
/src/App.jsx                             — Root component (auth, device setup, clip sync, vault overlay, lightbox, onboarding)
/src/lib/supabase.js                     — Supabase client + all DB helpers + file/image upload + email
/src/lib/crypto.js                       — E2E encryption (key gen, vault password, encrypt/decrypt, recovery)
/src/lib/utils.js                        — detectType(), mapPlatform()
/src/components/                         — ClipCard, InputArea, FilterBar, SearchBar, Toast, SettingsView (feedback button), onboarding components
/src/styles.css                          — All styles + animations + context menu + vault overlay + lightbox
/website/                                — Landing page (index, privacy, terms, security page, styles, script)
/supabase/functions/                     — ls-webhook, record-deletion, check-deleted, send-email (all JWT-protected, rate-limited)
/supabase/migrations/                    — All DB migrations including 12 teams tables + 14 performance indexes
/.github/workflows/                      — CI (env var validation skips in test) + Release
/vite.config.mjs                         — Vite config (renamed from .js for ESM compat)
/portal/                                 — Teams admin portal (React + Vite, portal.snipsync.xyz)
/mobile/                                 — React Native iOS app (Phase 1 in progress)
/mobile/src/lib/supabase.js             — Supabase client adapted for React Native
/mobile/src/lib/crypto.js              — Crypto adapted: PBKDF2 via react-native-quick-crypto
/mobile/src/screens/SignInScreen.js    — Google OAuth sign-in screen
/mobile/src/screens/ClipListScreen.js  — Main clip list (realtime, vault unlock, compose, filters)
/mobile/src/components/ClipCard.js     — Clip card component
/mobile/src/navigation/AppNavigator.js — Auth-gated navigation stack
/PLAN.md                                 — Product roadmap
/TEAMS_PLAN.md                           — Teams feature schema and build phases
/ENCRYPTION_PLAN.md                      — Encryption architecture (implemented)
/mobile/PLAN.md                        — Mobile app phased plan
```

---

## Session Log

### 2026-03-23 (post-v0.3.1 — Teams, Production Hardening, Website Overhaul)

**Website Overhaul**
- Comparison table added to marketing site
- Founder section added to website
- Dedicated security page added
- Site now in waitlist mode (app not publicly listed)

**Free Tier Change**
- Unlimited clips with 7-day history replaces 30 clips/month cap
- 30-clip counter and monthly reset logic removed

**Onboarding Flow**
- First-time user onboarding added, guides users through key features on first launch

**In-App Feedback**
- Feedback button added to Settings view

**Tray Icon States**
- Three states: green (syncing), gray (offline), red (error)

**Production Hardening**
- 14 database indexes added for query performance
- Input sanitization on all user-supplied fields
- React error boundaries added throughout
- Rate limiting on all edge functions
- Health check endpoint added
- Env var validation skips during CI/CD tests (fixes CI breakage)

**Teams Feature — Merged to Main**
- 12 tables: teams, team_members, team_invites, channels, channel_clips, direct_clips, groups, group_members, clip_mentions, collections, collection_clips, team billing
- Admin portal scaffolded at portal.snipsync.xyz
- Channels, @mentions, direct send, collections, team billing all implemented
- Portal RLS fixed: security definer functions prevent recursion

### 2026-03-20 (v0.3.1 — Security Hardening, Dependency Upgrades, Mobile Phase 1)

**Logo Rebrand**
- New S-arrow hexagon logo integrated across app icon, tray icons, website nav/footer, favicon, OG image, email headers

**Security — Critical**
- JWT auth added to all 3 edge functions (record-deletion, send-email, check-deleted)
- send-email supports service-role bypass for internal calls

**Security — High**
- Electron sandbox + webSecurity enabled; permission denial handlers for camera/mic/geo
- PBKDF2 iterations increased 100K → 600K with backward compat
- Master key cleared on sign-out, beforeunload, and 30min auto-lock
- Constant-time HMAC in ls-webhook; recovery phrase wordlist expanded 64 → 256 words

**Security — Medium**
- Vault unlock rate limiting with exponential backoff
- CSP hardened; Vercel security headers added

**Dependency Upgrades**
- Electron 28→35, electron-builder 24→26, @sentry/electron 4→5
- Vite 5→6, Vitest 1→2, @vitejs/plugin-react 4→5

**Bug Fixes**
- OAuth: reverted custom state param — conflicted with Supabase's CSRF handling
- Encryption: re-check before enabling prevents master key overwrite on second device

**Pricing**
- Pro: $3.99→$4.99/mo, $29→$39/yr; Team: $6.99→$8.99/seat/mo

**Mobile — React Native Phase 1 (in progress)**
- Project scaffolded in mobile/ (bare workflow), all Phase 1 deps installed
- Built SignInScreen, ClipListScreen, ClipCard, AppNavigator
- Google OAuth via native SDK + Supabase signInWithIdToken; sign-in confirmed working on device
- PBKDF2 backward compat in mobile crypto.js (600K then 100K)
- Vault unlock on physical iPhone currently being tested

**Release**
- v0.3.1 tagged and released (Mac DMG + Windows EXE on GitHub Releases)

### 2026-03-18 (v0.3.0 — Production-Ready Overhaul)
- UI overhaul: text contrast, card polish, compact layout, type-colored borders
- Persistent UUID device ID (replaces hardware fingerprint), legacy migration
- Account deletion edge function, re-signup detection, transactional emails via Resend
- E2E encryption UX: password confirm, strength bar, recovery chips, vault overlay, force-reset
- File clips: drag-and-drop, storage bucket, contextual icons, download button (Pro-only)
- Image lightbox, right-click context menu, expandable clip content
- Enter to send, optimistic rendering, last synced time in footer
- Version bump to 0.3.0, all 27 tests passing
- Mac DMG + Windows EXE pushed to GitHub Releases v0.3.0

### 2026-03-17
- Built E2E encryption (tweetnacl, vault password, PBKDF2, recovery phrase)
- Built account deletion with cascade + ensureProfile auto-recreation
- Chrome extension OAuth working with chrome.identity API
- Fixed CI: Supabase env vars in GitHub Actions Vite build step
- Fixed Realtime DELETE sync: REPLICA IDENTITY FULL on clips table

### 2026-03-16
- Initial PROJECT_STATUS.md created
- v0.2.0 tagged and released
- Phase 1 + Phase 2 complete
