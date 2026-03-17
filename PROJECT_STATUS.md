# SnipSync (snipsync.xyz) — Project Status

**Last Updated**: 2026-03-17
**Current Version**: v0.2.0 (tag on commit b562620)
**Status**: Active Development — Encryption shipped, browser extension working, stabilizing
**Repo**: github.com/Vincentj88-python/snipsync (public)
**Website**: snipsync.xyz (live on Vercel, waitlist active)
**Supabase**: kohwpkwcopkslbtkczag (EU region, free plan)
**Sentry**: Active (main + renderer, confirmed working)
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
- Realtime DELETE sync working (REPLICA IDENTITY FULL on clips table)
- Single instance lock on Windows (prevents multiple instances)

### End-to-End Encryption (NEW — 2026-03-17)
- **Algorithm**: tweetnacl XSalsa20-Poly1305 (secretbox)
- **Key derivation**: PBKDF2 with 100,000 iterations (Web Crypto API)
- **Vault password**: User sets a separate encryption password; derives wrapping key to encrypt/decrypt master key
- **Recovery phrase**: 12-word phrase generated on setup, stored encrypted with its own PBKDF2-derived key
- **Recovery flow**: "Forgot password? Use recovery phrase" to unlock vault
- **Batch migration**: Existing clips encrypted in place when encryption is enabled
- **Disable flow**: Enter vault password to decrypt all clips back to plaintext
- **Zero-knowledge**: Server stores only encrypted blobs; SnipSync cannot read user clips
- **Module**: `src/lib/crypto.js` — all encryption logic (key gen, encrypt/decrypt clips, batch ops, recovery)

### Pro Features (built, gated behind Pro tier)
- Clipboard auto-capture (1.5s interval, MD5 dedup, toggleable)
- Image clips (paste → Supabase Storage, lazy-loaded thumbnails)
- Pinned clips (sort to top, scroll-to-top on pin)
- Custom tags (tags table, clip_tags junction, filter bar integration)
- CSV/JSON export from Settings

### Monthly Clip Limit (NEW — 2026-03-17)
- Free tier: 30 clips per month (resets 1st of each month)
- Deleting clips does NOT restore the counter — prevents gaming
- Pro tier: unlimited

### Account Management (NEW — 2026-03-17)
- **Account deletion**: Settings → Danger zone → cascades all user data (profile, clips, devices, subscriptions)
- **ensureProfile**: Auto-recreates profile on sign-in if profile was deleted (handles the re-signup edge case)

### Infrastructure
- Free/Pro tier enforcement (30 clips/month free, 2 devices free, unlimited Pro)
- Subscriptions table with auto-create trigger
- Lemon Squeezy webhook Edge Function (ready, awaiting LS approval)
- Settings view: plan badge, usage meters, device list, toggles, danger zone
- Auto-updates via electron-updater + GitHub Releases
- Sentry error reporting (both processes)
- Launch at login (toggleable, openAsHidden)
- Tray context menu (Open / Quit)
- Vercel Analytics on website

### Browser Extension — Chrome (NEW — 2026-03-17)
- Chrome extension working (loaded unpacked, not published)
- Google OAuth via chrome.identity API
- Same Supabase backend, same Realtime sync
- Counts as a device toward free tier limit

### Website
- Landing page with canvas wave animation, app mockup, typed text effect
- Pricing section (Free / Pro / Team)
- Waitlist signup form (stores in Supabase waitlist table)
- Privacy policy + Terms of service (updated with encryption details)
- Encryption section with visual demo (NEW — 2026-03-17)
- SnipSync branding with SVG logo mark
- Favicon

### CI/CD
- `ci.yml`: tests + build on push to main / PRs
- `release.yml`: Mac DMG + Windows x64 EXE on version tags
- Supabase env vars added to Vite build step in GitHub Actions (fixed 2026-03-17)
- Code signing skipped (no Apple Developer account yet)

---

## Known Issues / Bugs

| # | Issue | Severity | Notes |
|---|-------|----------|-------|
| 1 | **Settings view doesn't scroll on Mac** | High | "Danger zone" section below the fold. CSS fix (`height: 0; flex: 1 1 0; overflow-y: scroll`) applied but not fully resolved. **Priority #1 for next session.** |
| 2 | **GitHub Release duplicate .exe files** | Low | Sometimes two .exe files appear (dashes vs dots naming). Leftover artifacts from previous releases. Need clean release process. |
| 3 | **Account deletion cascade edge case** | Medium | Encrypted clips survived FK cascade in one instance. `clips_user_id_fkey` has CASCADE but clips created between profile deletion and recreation can become orphaned. ensureProfile mitigates but edge case remains. |
| 4 | **Auto-updater doesn't work during dev** | Expected | Re-tagging same version (v0.2.0) means updater thinks it's current. Need to increment versions. Dev workflow issue, not a bug. |
| 5 | **Windows installer retry + multi-instance** | Low | User reported needing to click "retry" during install, then 3 instances opened. Single instance lock added but NSIS installer config may need tweaks. |
| 6 | **Extension popup CSS** | Cosmetic | Chrome popup has hard square corners (browser limitation). Current workaround is solid dark background. |

---

## Waiting On

| Item | Status | Blocker |
|------|--------|---------|
| Lemon Squeezy approval | Submitted, awaiting review | Need to send pricing info + demo video |
| Apple Developer account | Not purchased | $99/yr, needed for Mac code signing |
| Google OAuth verification | Not submitted | 100 user cap without it, needs privacy policy URL |
| Supabase upgrade | On free plan | Must upgrade before 50 users (auto-pause risk) |

---

## Current Account / Service State

| Service | State |
|---------|-------|
| User account | Free plan (was set to Pro for testing, reset after account deletion) |
| Sentry | Confirmed working |
| Vercel Analytics | Enabled |
| Supabase | Free plan (EU region) |
| Lemon Squeezy | Awaiting approval |
| Chrome extension | Working (loaded unpacked) |
| Mac + Windows builds | On GitHub Releases (v0.2.0) |
| Website | Live at snipsync.xyz with waitlist |

---

## What's Next

1. **Fix settings scroll on Mac** — priority #1 bug
2. Set user back to Pro for testing
3. Test encryption flow end-to-end on both devices (Mac + Windows)
4. Wait for Lemon Squeezy approval
5. Consider version bump to v0.3.0 for next release
6. Submit Google OAuth for verification (with privacy policy URL)
7. Purchase Apple Developer account for code signing

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
/src/lib/crypto.js          — E2E encryption (key gen, vault password, encrypt/decrypt, recovery)
/src/lib/utils.js           — detectType(), mapPlatform()
/src/components/            — ClipCard, InputArea, FilterBar, SearchBar, Toast, SettingsView
/src/styles.css             — All styles + animations
/website/                   — Landing page (index, privacy, terms, styles, script)
/supabase/functions/        — Lemon Squeezy webhook
/.github/workflows/         — CI + Release
/PLAN.md                    — Product roadmap
/ENCRYPTION_PLAN.md         — Encryption architecture (implemented)
```

---

## Session Log

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
