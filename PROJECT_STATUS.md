# Snip (snipsync.xyz) - Progress Tracker

**Last Updated**: 2026-03-15
**Project Status**: Active Development
**Current Version**: v0.1.0 (installed on developer MacBook, working)
**Repo**: github.com/Vincentj88-python/snipsync (private)
**Domain**: snipsync.xyz (purchased, configured in app + legal pages)
**Supabase Project ID**: kohwpkwcopkslbtkczag (EU region)

---

## Recent Changes

### 2026-03-15 — Production Readiness Sprint

- **Infrastructure**: Created private GitHub repo at github.com/Vincentj88-python/snipsync
- **Infrastructure**: Purchased and configured domain snipsync.xyz; updated all app references, OG tags, and legal pages
- **CI/CD**: Added GitHub Actions workflows — `ci.yml` (tests on push), `release.yml` (builds Mac DMG + Windows EXE on version tag)
- **Auto-updates**: Integrated `electron-updater`; app checks GitHub Releases for updates on launch
- **Error reporting**: Integrated `@sentry/electron` into both main and renderer processes; DSN is configured and active
- **Security**: Tightened Supabase RLS policies — per-operation policies with `WITH CHECK` clauses
- **Security**: Added DB constraint capping clip content at 10,000 characters
- **Security**: Added client-side clip size validation with error toast before the DB is touched
- **Testing**: Set up Vitest; 26 tests passing across `src/lib/utils.js`, `src/lib/supabase.js` helpers, and `Toast` component
- **Refactor**: Extracted `detectType` and `mapPlatform` functions from App.jsx into `src/lib/utils.js`
- **Landing page**: Built `website/` folder — canvas wave animations, app mockup, scroll reveals, OG tags
- **Legal**: Created `website/privacy.html` and `website/terms.html`
- **Planning**: Created `PLAN.md` with full product roadmap (Free/Pro/Team tiers, Yoco payments, performance budget)
- **Build**: Built and verified Mac DMG and Windows EXE installers via `npm run build`

### Prior Session — v0.2.0 Audit, Bug Fixes & UI Polish (see UPDATES.md for full detail)

- **Security**: Reworked Google OAuth for packaged Electron builds — local HTTP server on `127.0.0.1:54321` handles callback instead of redirecting BrowserWindow
- **Security**: Restricted `shell.openExternal()` to `http:` and `https:` protocols only
- **Security**: Added CSP meta tag to `index.html`
- **Security**: Removed unused `electron-store` dependency
- **Bugfix**: Fixed device registration race condition — `platformReady` state flag gates setup effect
- **Bugfix**: Fixed stale device ID — validates stored device ID exists in DB on launch; clears and re-registers if missing
- **Bugfix**: Fixed keyboard shortcut re-registering on every render — now uses a ref and `[platform]` dependency array
- **CSS**: Migrated all inline `style={{}}` attributes to CSS classes in `src/styles.css`
- **Feature**: Added collapsible search bar (`src/components/SearchBar.jsx`) — real-time content filtering
- **Feature**: Added delete-with-undo toast (`src/components/Toast.jsx`) — 3-second delay before actual Supabase deletion
- **Feature**: Per-type counts on filter bar buttons
- **UI**: Platform-aware titlebar (macOS traffic lights vs. Windows close button)
- **UI**: Sign-out avatar button in titlebar with hover-to-red hint
- **UI**: Clip content truncation with gradient fade overlay
- **UI**: Staggered sign-in screen animations, green loading spinner, clipboard empty state icon

---

## Task Tracking

### Done

- [x] Core Electron + React + Vite app scaffolded
- [x] Supabase auth (Google OAuth, session management)
- [x] Real-time clip sync via Supabase Realtime
- [x] Clip creation with `detectType` (link, code, note, etc.)
- [x] Copy-to-clipboard with "Copied!" feedback
- [x] Delete with undo toast (3-second delayed DB delete)
- [x] Collapsible search bar with real-time filtering
- [x] Filter bar with per-type counts
- [x] Platform-aware titlebar (Mac / Windows)
- [x] Sign-out with full state reset
- [x] CSS overhaul — all inline styles replaced with CSS classes
- [x] Micro-animations: clip in/out, button hover/active, toast, spinner, pulse indicator
- [x] Fixed OAuth for packaged Electron builds (local HTTP callback server)
- [x] Fixed stale device ID on launch
- [x] Fixed keyboard shortcut re-registering on every render
- [x] CSP meta tag on `index.html`
- [x] `shell.openExternal()` URL validation (http/https only)
- [x] Removed unused `electron-store` dependency
- [x] Supabase RLS policies tightened (per-operation + `WITH CHECK`)
- [x] DB constraint: max 10,000 chars per clip
- [x] Client-side clip size validation with error toast
- [x] Extracted `detectType` / `mapPlatform` to `src/lib/utils.js`
- [x] Vitest set up — 26 tests passing (utils, supabase helpers, Toast)
- [x] `electron-updater` integrated (checks GitHub Releases on launch)
- [x] Sentry integrated in main + renderer processes (DSN configured)
- [x] GitHub Actions CI workflow (tests on push)
- [x] GitHub Actions release workflow (Mac DMG + Windows EXE on tag)
- [x] Landing page built (`website/`) — canvas animations, mockup, scroll reveals
- [x] Privacy policy and terms of service pages (`website/privacy.html`, `website/terms.html`)
- [x] Mac DMG and Windows EXE installers built and verified
- [x] Private GitHub repo created (Vincentj88-python/snipsync)
- [x] Domain snipsync.xyz purchased and configured throughout app
- [x] `PLAN.md` written with full Free/Pro/Team roadmap, Yoco payment notes, performance budget

### In Progress

- [ ] Nothing actively in flight — session concluded with v0.1.0 working on developer machine

### Todo (Phase 1 — v0.2.0, Monetization Foundation)

- [ ] Supabase: add `plans` table (user_id, plan, status, expires_at, yoco_subscription_id) - *Priority: High*
- [ ] Supabase: add `usage` tracking (clip count per user, device count per user) - *Priority: High*
- [ ] Supabase: RLS policies for plan-gated features - *Priority: High*
- [ ] App: enforce device limit (2 devices on free tier) - *Priority: High*
- [ ] App: enforce clip count limit (50 clips on free tier) - *Priority: High*
- [ ] App: inline upgrade prompts when limits hit (not modal — subtle inline) - *Priority: High*
- [ ] Yoco: popup checkout integration for subscriptions - *Priority: High*
- [ ] Yoco: Supabase Edge Function to receive and process payment webhooks - *Priority: High*
- [ ] Yoco: store subscription status in `plans` table; handle upgrade/downgrade/cancel - *Priority: High*
- [ ] App: Settings/account page (current plan, X/50 clips, 2/2 devices, upgrade button) - *Priority: High*
- [ ] App: cache plan status locally (don't query on every clip creation) - *Priority: Medium*
- [ ] Apple code signing (requires Apple Developer account — $99/yr) - *Priority: Medium*
- [ ] Push website to live at snipsync.xyz - *Priority: Medium*
- [ ] Tag v0.2.0 in git to trigger release CI build - *Priority: Low (after monetization work)*

### Todo (Phase 2 — v0.3.0, Pro Features)

- [ ] Clipboard auto-capture (Electron main process polling, debounced, hash-deduped) - *Priority: Medium*
- [ ] Image clips (clipboard images → Supabase Storage, thumbnails, lazy load) - *Priority: Medium*
- [ ] Favorites / pinned clips (DB column `pinned` already exists) - *Priority: Medium*
- [ ] Custom tags (user-defined, many-to-many with clips in Supabase) - *Priority: Low*
- [ ] Export clips as CSV/JSON (client-side generation) - *Priority: Low*

### Todo (Phase 3 — v1.0.0, Team Features)

- [ ] Teams, channels, direct send, shared collections infrastructure in Supabase - *Priority: Low*
- [ ] Team billing via Yoco (per-seat pricing) - *Priority: Low*

---

## Quick Context

**Current Focus**: Phase 1 monetization foundation (Yoco payments + usage limits). The app is feature-complete enough for a free tier and needs a revenue model before any further feature work.

**Next Steps**:
1. Create the `plans` and `usage` tables in Supabase with RLS
2. Enforce free-tier limits (50 clips, 2 devices) in the app with upgrade prompts
3. Integrate Yoco checkout and webhook Edge Function
4. Build the in-app Settings/account page
5. When Phase 1 is done: tag v0.2.0 → CI builds installers automatically

**Known Issues / Gaps**:
- No Apple code signing — macOS users will see a Gatekeeper warning. Requires an Apple Developer account ($99/yr). This is a known gap, not a blocker for personal use.
- Website is built but not yet deployed to snipsync.xyz.
- Windows build is untested on a real Windows machine (only built via CI).
- No E2E tests — only unit tests exist (26 tests covering utils, supabase helpers, Toast).

**Key Architecture Notes**:
- OAuth callback goes through a local HTTP server on `127.0.0.1:54321` (required for packaged Electron builds — `file://` origin can't receive OAuth redirects).
- All sync is via Supabase Realtime — no polling anywhere.
- Clip size is enforced at two layers: client-side validation (error toast) and a DB constraint (10,000 char max).
- Sentry captures errors from both the main process and the renderer process.
- Auto-updates check GitHub Releases on app launch via `electron-updater`. Tagging a release in git triggers the CI workflow that uploads Mac DMG + Windows EXE.

**Dependencies / Blockers**:
- Yoco account needed before starting payment integration (sign up at yoco.com)
- Apple Developer account needed before shipping to non-developer Mac users ($99/yr)
- snipsync.xyz DNS needs to be pointed at hosting before the website goes live

**File Map (key files)**:
```
/electron/main.js          — Electron main process (OAuth server, IPC, auto-updater, Sentry)
/electron/preload.js       — Electron preload bridge (IPC API exposed to renderer)
/src/App.jsx               — Root React component (auth flow, device setup, clip sync)
/src/styles.css            — All component styles and animations
/src/lib/utils.js          — detectType(), mapPlatform() (pure functions, fully tested)
/src/lib/supabase.js       — Supabase client + auth helpers + checkDeviceExists()
/src/components/ClipCard.jsx
/src/components/InputArea.jsx
/src/components/FilterBar.jsx
/src/components/SearchBar.jsx
/src/components/Toast.jsx
/website/                  — Landing page (index.html, styles.css, script.js, privacy.html, terms.html)
/.github/workflows/ci.yml     — Run tests on every push
/.github/workflows/release.yml — Build Mac DMG + Windows EXE on version tag
/PLAN.md                   — Full product roadmap with pricing, Yoco notes, performance budget
/UPDATES.md                — Detailed changelog for v0.2.0
```
