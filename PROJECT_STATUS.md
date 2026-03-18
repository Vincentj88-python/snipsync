# SnipSync (snipsync.xyz) — Project Status

**Last Updated**: 2026-03-18
**Current Version**: v0.3.0 (tag on commit 674470a)
**Status**: Production-ready — demo-ready for Lemon Squeezy video
**Repo**: github.com/Vincentj88-python/snipsync (public)
**Website**: snipsync.xyz (live on Vercel, waitlist active)
**Supabase**: kohwpkwcopkslbtkczag (EU region, free plan)
**Sentry**: Active (main + renderer, confirmed working)
**CI/CD**: GitHub Actions (tests on push, Mac+Win builds on tag)

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
| Mac + Windows builds | On GitHub Releases (v0.3.0) |
| Website | Live at snipsync.xyz with waitlist |

---

## What's Next

1. Record demo video for Lemon Squeezy
2. Submit demo video to Lemon Squeezy for approval
3. Submit Google OAuth for verification (with privacy policy URL)
4. Purchase Apple Developer account for Mac notarization
5. Upgrade Supabase before public launch
6. Browser extension: right-click context menu, Chrome Web Store publish

---

## Tests

27 tests passing (Vitest):
- `src/lib/__tests__/utils.test.js` — detectType, mapPlatform
- `src/lib/__tests__/supabase.test.js` — CRUD helpers (mocked)
- `src/components/__tests__/Toast.test.jsx` — render, undo, dismiss

---

## Key Files

```
/electron/main.js           — Main process (tray, OAuth, clipboard watch, IPC, persistent UUID)
/electron/preload.js        — IPC bridge to renderer (includes getLegacyMachineId)
/src/App.jsx                — Root component (auth, device setup, clip sync, vault overlay, lightbox)
/src/lib/supabase.js        — Supabase client + all DB helpers + file/image upload + email
/src/lib/crypto.js          — E2E encryption (key gen, vault password, encrypt/decrypt, recovery)
/src/lib/utils.js           — detectType(), mapPlatform()
/src/components/            — ClipCard (context menu, expand, lightbox), InputArea (drag-drop), FilterBar, SearchBar (persistent, / shortcut), Toast, SettingsView (sign-out, encryption UX)
/src/styles.css             — All styles + animations + context menu + vault overlay + lightbox
/website/                   — Landing page (index, privacy, terms, styles, script)
/supabase/functions/        — ls-webhook, record-deletion, check-deleted, send-email
/.github/workflows/         — CI + Release
/PLAN.md                    — Product roadmap
/ENCRYPTION_PLAN.md         — Encryption architecture (implemented)
```

---

## Session Log

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
