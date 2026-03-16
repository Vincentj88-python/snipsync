# SnipSync (snipsync.xyz) — Project Status

**Last Updated**: 2026-03-16
**Current Version**: v0.2.0
**Status**: Active Development — Phase 2 complete, Phase 3 (browser extension) next
**Repo**: github.com/Vincentj88-python/snipsync (public)
**Website**: snipsync.xyz (live on Vercel, waitlist active)
**Supabase**: kohwpkwcopkslbtkczag (EU region)
**Sentry**: Active (main + renderer)
**CI/CD**: GitHub Actions (tests on push, Mac+Win builds on tag)

---

## What's Shipped (v0.2.0)

### Core
- Real-time clipboard sync across Mac and Windows via Supabase Realtime
- Google OAuth sign-in (local callback server for Electron)
- Device tracking via hardware fingerprint (survives reinstalls)
- Smart type detection (link, code, address, note, image) — includes www. URLs
- Search and filter (by type and custom tags)
- Clip CRUD: create, copy, pin, delete with 3s undo

### Pro Features (built, gated behind Pro tier)
- Clipboard auto-capture (1.5s interval, MD5 dedup, toggleable)
- Image clips (paste → Supabase Storage, lazy-loaded thumbnails)
- Pinned clips (sort to top, scroll-to-top on pin)
- Custom tags (tags table, clip_tags junction, filter bar integration)
- CSV/JSON export from Settings

### Infrastructure
- Free/Pro tier enforcement (30 clips / 2 devices free, unlimited Pro)
- Subscriptions table with auto-create trigger
- Lemon Squeezy webhook Edge Function (ready, awaiting LS approval)
- Settings view: plan badge, usage meters, device list, toggles
- Auto-updates via electron-updater + GitHub Releases
- Sentry error reporting (both processes)
- Launch at login (toggleable, openAsHidden)
- Tray context menu (Open / Quit)
- Vercel Analytics on website

### Website
- Landing page with canvas wave animation, app mockup, typed text effect
- Pricing section (Free / Pro / Team)
- Waitlist signup form (stores in Supabase waitlist table)
- Privacy policy + Terms of service
- SnipSync branding with SVG logo mark
- Favicon

### CI/CD
- `ci.yml`: tests + build on push to main / PRs
- `release.yml`: Mac DMG + Windows x64 EXE on version tags
- Code signing skipped (no Apple Developer account yet)

---

## Waiting On

| Item | Status | Blocker |
|------|--------|---------|
| Lemon Squeezy approval | Submitted, awaiting review | Need to send pricing info + demo video |
| Apple Developer account | Not purchased | $99/yr, needed for Mac code signing |
| Google OAuth verification | Not submitted | 100 user cap without it, needs privacy policy URL |

---

## Next: Phase 3 — Browser Extension

Chrome extension (Manifest V3) that connects to the same Supabase backend:
- Popup with clip list
- Right-click context menu: "Send to SnipSync"
- Keyboard shortcut (Alt+S) to snip selected text
- Google OAuth via chrome.identity API
- Real-time sync
- Counts as a device toward free tier limit
- Then port to Firefox

---

## Tests

27 tests passing (Vitest):
- `src/lib/__tests__/utils.test.js` — detectType, mapPlatform
- `src/lib/__tests__/supabase.test.js` — CRUD helpers (mocked)
- `src/components/__tests__/Toast.test.jsx` — render, undo, dismiss

---

## Key Files

```
/electron/main.js           — Main process (tray, OAuth, clipboard watch, IPC)
/electron/preload.js        — IPC bridge to renderer
/src/App.jsx                — Root component (auth, device setup, clip sync, state)
/src/lib/supabase.js        — Supabase client + all DB helpers
/src/lib/utils.js           — detectType(), mapPlatform()
/src/components/            — ClipCard, InputArea, FilterBar, SearchBar, Toast, SettingsView
/src/styles.css             — All styles + animations
/website/                   — Landing page (index, privacy, terms, styles, script)
/supabase/functions/        — Lemon Squeezy webhook
/.github/workflows/         — CI + Release
/PLAN.md                    — Product roadmap
```
