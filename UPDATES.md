# Cross-Snip Updates

## v0.3.1 Post-Release — Encryption Fixes, Password Change, Shortcut Picker (2026-03-24)

### Encryption — Critical Bug Fixes

- **Auto-capture data-loss fix** — When the vault was unlocked and auto-capture created a new clip, the `encrypted` flag and `nonce` were not being saved to the database. The clip content was encrypted in memory but stored as an unencrypted row. Fixed: both fields now correctly persist on every auto-captured clip.
- **Mobile compose data-loss fix** — Same class of bug in the mobile compose path: nonce was not written to the DB. Fixed.
- **Batch decrypt hardened** — `decryptAllClips()` previously caught decryption exceptions and replaced the clip content with the literal string `'[decryption failed]'`, then wrote that corrupted value back to the database. It now throws on failure so the caller can surface the error without touching clip data.
- **Image clip nonce consistency** — Image clip nonce was stored as an empty string `''` rather than `null` when unencrypted. Changed to `null` to match all other clip types.

### Password Change Flow

- **`changeVaultPassword()` in `src/lib/crypto.js`** — New function: takes old and new password, derives the old wrapping key, decrypts the master key to verify the old password is correct, derives a new wrapping key from the new password, re-encrypts the master key, and saves to the profiles table.
- **"Change password" in Settings** — When encryption is enabled, Settings now shows a "Change password" button. Opens an inline form: old password field, new password field with strength indicator, confirm field. On submit calls `changeVaultPassword()`.
- **`saveEncryptionKeys()` recovery key preservation** — Previously, calling `saveEncryptionKeys()` without passing a recovery key would write `null` over the existing `encrypted_recovery_key` column, destroying it. Now only updates the recovery key column if a new value is explicitly provided.

### Bug Fixes (from user testing)

- **Feedback button `mailto:` blocked** — The Electron `shell.openExternal()` wrapper previously only allowed `http:` and `https:` protocols, silently dropping `mailto:` links. The feedback button was broken for all users. Fixed: `mailto:` is now explicitly allowed.
- **Configurable global shortcut** — The global shortcut (previously hardcoded to `Cmd+Shift+V` / `Ctrl+Shift+V`) is now user-configurable. The chosen shortcut is stored in `userData/shortcut.txt` and loaded at startup. A `ShortcutPicker` component in Settings lets users record a new shortcut by pressing the desired key combination. Display is platform-aware (`⌘ ⇧` symbols on Mac, `Ctrl+Shift` text on Windows).
- **Team messages delayed** — Channel clips posted by the current user were not appearing until a Realtime event arrived. Fixed with optimistic insert into local state, deduplicated when the Realtime event fires.
- **Encryption state out of sync across devices** — If Device A enabled or disabled encryption, Device B had no mechanism to detect the change and would remain in the wrong state (e.g., trying to decrypt when encryption was disabled, or showing unencrypted clips without a vault prompt). Fixed: the app now polls the `profiles` table every 30 seconds for `encryption_enabled` state. If the state has changed, the app auto-locks or unlocks accordingly and notifies the user.

### Team Encryption Clarification

- **Channel posts are plaintext** — Team channel clips are explicitly never encrypted, even when the user's vault is unlocked. This is intentional: other team members must be able to read clips without knowing your vault password.
- **`tryDecryptClip()` helper** — New helper function that wraps clip display decryption. If the clip is marked `encrypted` and the vault key is available, it decrypts transparently. If the vault is locked, it returns `[encrypted — unlock vault to view]`. Applied to all team render paths: channels, collections, mentions, and direct messages views.

### Test Suite

- **11 new encryption tests** (`src/lib/__tests__/encryption.test.js`):
  - Round-trip: encrypt then decrypt returns original plaintext
  - Wrong key rejection: decryption with wrong key throws
  - Wrong nonce rejection: decryption with wrong nonce throws
  - Nonce randomness: two encryptions of same content produce different nonces
  - Password change: `changeVaultPassword()` round-trip — new password unlocks, old password fails
  - Batch decrypt error propagation: confirms failure throws instead of corrupting

- **Total: 38 tests** (was 27)

### Files Changed

| File | What changed |
|------|-------------|
| `src/lib/crypto.js` | `changeVaultPassword()` added; `saveEncryptionKeys()` recovery key preservation fix; batch decrypt throw on failure |
| `src/lib/supabase.js` | Auto-capture and mobile compose paths: `encrypted` + `nonce` now correctly saved |
| `src/components/SettingsView.jsx` | "Change password" button + ShortcutPicker component |
| `electron/main.js` | `mailto:` allowed in URL handler; configurable shortcut loaded from userData/shortcut.txt |
| `src/App.jsx` | Encryption state polling (30s); tryDecryptClip() integrated on team render paths |
| `src/lib/__tests__/encryption.test.js` | **New** — 11 encryption tests |

---

## v0.3.1 Post-Release — Teams, Production Hardening, Website Overhaul (2026-03-23)

### Free Tier Change

- **Unlimited clips with 7-day history** — Free tier no longer has a 30 clips/month cap. All free users now get unlimited clips, but only the last 7 days of history are kept. This removes friction for new users and simplifies the value proposition.
- **30-clip counter removed** — The monthly clip counter, reset-on-1st logic, and counter-display UI have been removed from Settings and all enforcement logic.

### Website Overhaul

- **Comparison table** — New section on the marketing site comparing SnipSync to alternatives (clipboard managers, manual sharing, etc.)
- **Founder section** — Personal founder story added to the homepage
- **Security page** — Dedicated `/security` page covering encryption architecture, zero-knowledge design, and responsible disclosure
- **Waitlist mode** — App not publicly listed yet; website is in waitlist mode with CTA to join waitlist rather than download

### Onboarding Flow

- **First-time user onboarding** — New users see a guided onboarding sequence on first launch, walking through core features: sending a clip, syncing across devices, encryption, and the tray icon

### In-App Feedback

- **Feedback button in Settings** — Users can submit feedback without leaving the app. Feedback goes to a configured endpoint/form.

### Tray Icon States

- **Three distinct states**: green dot (connected and syncing), gray (offline / no connection), red (error state — auth failure, sync error, etc.)
- **Real-time state changes**: icon updates reactively when connectivity or auth status changes

### Production Hardening

- **14 database indexes** — Performance indexes added across all high-traffic query paths: clips (user_id, created_at, type, encrypted), devices (user_id, machine_id), subscriptions (user_id), and all 12 teams tables
- **Input sanitization** — All user-supplied text fields sanitized before write (clips content, team names, channel names, collection names)
- **React error boundaries** — Added at app root and around key sections (clip list, settings, channels view) so a component crash does not take down the whole app
- **Rate limiting on all edge functions** — All 4 edge functions (ls-webhook, record-deletion, check-deleted, send-email) now enforce per-IP and per-user rate limits
- **Health check endpoint** — GET `/health` on the main Supabase edge function deployment returns 200 with uptime info; used for monitoring
- **Env var validation skips in CI** — Startup env var validation now detects test/CI environment and skips; fixes GitHub Actions build failures when Supabase keys are not available during unit test runs

### Teams Feature — Merged to Main

All Teams work merged from feature branch to main. Not yet publicly released but fully present on main.

**Database — 12 new tables:**

| Table | Purpose |
|-------|---------|
| `teams` | Team name, owner, metadata |
| `team_members` | Users in a team with roles (owner/admin/member) |
| `team_invites` | Invite links with optional expiry and use limits |
| `channels` | Named clip feeds within a team (#general auto-created) |
| `channel_clips` | Clips posted to a channel |
| `direct_clips` | Clips sent directly to a specific teammate |
| `groups` | Named groups within a team (e.g. @design, @engineering) |
| `group_members` | Users in a group |
| `clip_mentions` | @user and @group mentions on clips |
| `collections` | Shared persistent pinned clip sets |
| `collection_clips` | Clips added to a collection |
| team billing support | Per-seat subscription tracking |

**Portal (`portal.snipsync.xyz`):**
- React + Vite app scaffolded in `/portal` directory
- Vercel deployment configured for portal.snipsync.xyz
- Google sign-in (same Supabase auth as desktop app)
- Dashboard: team overview, member list with role badges
- Invite management: generate link, view active invites, revoke
- Member management: promote/demote roles, remove from team
- Channel and group management views
- Billing view: seat count, subscription status

**Channels:**
- Create and delete channels (admin/owner only)
- Post a clip to a channel (select when sending, or default to #general)
- Realtime subscription per channel via Supabase Realtime
- Subscribes only to the active channel — no unnecessary subscriptions
- #general channel auto-created via database trigger on team creation

**@Mentions:**
- `@` in clip input triggers autocomplete showing team members and groups
- Parsed before save: creates `clip_mentions` records per mention
- Mentions filter in clip list: "Clips that mention me"
- Unread badge count for unread mentions

**Direct Send:**
- "Send to..." action on any clip
- Teammate picker from team roster
- Recipient sees clip appear in real time via Realtime subscription
- Read receipt: `read_at` timestamp updated when receiver opens
- Direct messages view in app

**Collections:**
- Create named collections (admin/owner)
- Add any clip to one or more collections
- Collections browsable in desktop app
- Persistent — not tied to history window

**Team Billing:**
- Lemon Squeezy product configured for Team tier ($8.99/seat/mo)
- Owner manages seat count
- Webhook: subscription created/updated/cancelled/payment_failed
- Edge function: validates team subscription, enforces seat limits
- When user joins team, personal subscription paused (covered by team plan)
- If user leaves team, personal subscription resumes or falls to free

**RLS Fix:**
- Portal RLS policies initially caused infinite recursion (policy on teams table read from team_members which in turn checked teams)
- Fixed by wrapping membership checks in `SECURITY DEFINER` functions that bypass RLS, called from policies

### CI Fix

- Env var validation at app startup now detects `NODE_ENV=test` and skips the check, preventing GitHub Actions from failing when Supabase keys are absent during unit test runs

---

## v0.3.1 — Security Hardening, Dependency Upgrades, Logo Rebrand (2026-03-20)

### Logo Rebrand

- New SnipSync logo (S-arrow hexagon design) integrated across entire project
- App icon, tray icons, website nav/footer, favicon, OG image, and email headers all updated
- Tray icons regenerated with proper transparency via sharp

### Security — Critical

- JWT auth added to all 3 edge functions (record-deletion, send-email, check-deleted)
- Users can only delete own account / email own address / check own deletion status
- send-email supports dual-mode: user JWT or service-role key (for internal calls)
- URL protocol validation added in browser mode

### Security — High

- Electron sandbox and webSecurity enabled
- Permission denial handlers for camera, microphone, and geolocation
- PBKDF2 iterations increased from 100K to 600K with backward compatibility (tries 600K then 100K)
- Master key cleared from memory on sign-out, on beforeunload, and after 30-minute auto-lock
- File upload path sanitization
- Signed URL expiry reduced from 1 hour to 15 minutes
- Constant-time HMAC verification in ls-webhook (prevents timing attacks)
- Recovery phrase wordlist expanded from 64 to 256 words (increased entropy)

### Security — Medium

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

### Pricing

- Pro: $3.99/mo → $4.99/mo, $29/yr → $39/yr
- Team: $6.99/seat/mo → $8.99/seat/mo
- Website pricing section redesigned: Pro hero card, cleaner layout structure
- Upgrade note added to website: "Upgrade to Pro from inside the app via Settings"

### Bug Fixes

- **OAuth**: Reverted custom state parameter — it conflicted with Supabase's internal CSRF state handling. Simple callback approach adopted; Supabase handles CSRF internally.
- **Encryption**: Added re-check before enabling encryption to prevent master key overwrite when enabling on a second device.

### Mobile — React Native Phase 1 (in progress)

- React Native project scaffolded in `mobile/` folder (bare workflow)
- All Phase 1 dependencies installed: Supabase, tweetnacl, react-native-quick-crypto, Google Sign-In, etc.
- Adapted lib files from desktop: supabase.js, crypto.js, utils.js ported for React Native
- Built screens: SignInScreen (with app icon), ClipListScreen (realtime, vault unlock, compose, filters)
- Built ClipCard component
- Navigation: AppNavigator with auth gating (signed-out vs signed-in stack)
- Google OAuth: configured with iOS client ID, PKCE flow via Supabase signInWithIdToken
- Deep linking: snipsync:// URL scheme registered, AppDelegate bridged for RCTLinkingManager
- Sign-in flow working end-to-end on physical device
- PBKDF2 backward compatibility: tries 600K iterations first, falls back to 100K for legacy keys
- Vault unlock on physical iPhone currently being tested

### Files Changed

| File | What changed |
|------|-------------|
| `electron/main.js` | Sandbox + webSecurity, permission handlers, tray icon states |
| `electron/preload.js` | No changes |
| `src/lib/crypto.js` | PBKDF2 600K with backward compat, auto-lock timer, key clear on sign-out |
| `src/lib/supabase.js` | JWT-authenticated edge function calls |
| `src/components/SettingsView.jsx` | Pricing display, v0.3.1 |
| `supabase/functions/record-deletion/index.ts` | JWT auth added |
| `supabase/functions/send-email/index.ts` | Dual-mode auth (JWT or service-role) |
| `supabase/functions/check-deleted/index.ts` | JWT auth added |
| `supabase/functions/ls-webhook/index.ts` | Constant-time HMAC |
| `website/index.html` | Pricing update, logo |
| `website/vercel.json` | Security headers (X-Frame-Options, HSTS, etc.) |
| `vite.config.mjs` | Renamed from .js for ESM compat |
| `package.json` | All dependency upgrades |
| `mobile/` | New directory — full React Native Phase 1 scaffold |

---

## v0.3.0 — Production-Ready Overhaul

### UI/UX

- **Text contrast overhaul** — All secondary/tertiary text colors bumped for WCAG AA compliance on dark backgrounds (#555→#8b8b8b, #444→#666, etc.)
- **Card polish** — Subtle blue undertone (#121315), softer borders (#1f2024), type-colored 3px left border matching clip type (green for links, blue for code, cyan for files, etc.)
- **Compact layout** — Reduced card padding (12→10px vertical), tighter margins (8→6px gap)
- **Hover-to-reveal actions** — Copy/Pin/Delete buttons hidden by default, appear on hover
- **Persistent search bar** — Always visible with search icon, `/` keyboard shortcut to focus, `Esc` to clear
- **Right-click context menu** — Copy, Pin/Unpin, Open link, Delete actions on any clip
- **Expandable content** — "Show more"/"Show less" toggle for clips exceeding max-height
- **Image lightbox** — Click any image thumbnail to view full size in dark overlay
- **Settings scroll fix** — Removed `height: 0` hack, using `flex: 1 1 0; min-height: 0; overflow-y: auto`
- **Enhanced empty state** — Actionable "Settings" and "Quick tips" buttons
- **Enter to send** — Plain Enter sends clips, Shift+Enter for newline (was Cmd+Enter)
- **Optimistic rendering** — Clips appear in local state immediately after send, realtime deduplicates
- **Last synced time** — Footer shows "Synced just now" / "Synced Xm ago"

### Sign-Out & Titlebar

- **Avatar removed** — Removed user initial avatar button from titlebar
- **Sign-out in Settings** — New "Account" section in Settings with email display + "Sign out" button
- **Gear icon only** — Titlebar right side: LIVE indicator, device badge, gear icon

### Device Identity

- **Persistent UUID** — Device ID now stored in `userData/device-id.txt` using `crypto.randomUUID()`. Survives hardware changes, OS upgrades, RAM swaps.
- **Legacy migration** — On first launch with new UUID, checks for old SHA-256 hardware fingerprint match in Supabase and backfills with new UUID. Existing users seamlessly migrate.
- **Preload API** — Added `getLegacyMachineId()` for one-time migration

### Account Deletion & Abuse Prevention

- **Full deletion via edge function** — `record-deletion` function handles everything with service role: records in `deleted_accounts`, deletes profile (cascades all data), deletes auth user
- **Auth user cleanup** — Google OAuth no longer auto-signs back in after deletion
- **deleted_accounts table** — Tracks email + machine_ids. RLS with no policies = service-role only access
- **Re-signup detection** — `check-deleted` edge function called on sign-in. If found, shows warning toast + sends welcome-back email
- **Profiles INSERT policy** — Added missing RLS INSERT policy on profiles table

### Transactional Emails (Resend)

- **3 email templates**: `welcome`, `account-deleted`, `welcome-back`
- **Design**: Dark header with green "SNIPSYNC" wordmark, white card body, color-coded info boxes (green for welcome, red for deletion, amber for welcome-back), CTA buttons, footer with privacy/terms links
- **send-email edge function**: Template-based, reusable for future templates
- **Triggers**: Welcome on first profile creation, deletion email from record-deletion function, welcome-back when re-signing up after deletion

### Encryption UX Polish

- **Password confirmation** — "Confirm vault password" field on encryption setup
- **Password strength indicator** — 4-segment bar (weak/fair/good/strong) based on length + character diversity
- **Show/hide toggle** — Eye icon button on all password inputs
- **Recovery phrase chips** — 12 words displayed as numbered chips in 3x4 grid with "Copy phrase" button
- **Recovery + disable** — From the "Disable encryption" → "Forgot password?" flow, recovery phrase now decrypts all clips and disables encryption in one step
- **Force reset** — When both password and phrase are lost: deletes all encrypted clips, wipes encryption keys, user starts clean
- **Vault overlay** — When vault is locked, centered password input appears directly over the clip list area with Enter to unlock. "Forgot password? Go to Settings" link below.
- **Better error handling** — Shows actual error messages instead of generic "Wrong password", validates empty password and missing settings

### File Clips (Pro-only)

- **Drag and drop** — Drag any file onto the input area. Green highlight + "Drop file here" on hover.
- **Smart routing** — Images go to clip-images bucket, non-images go to clip-files bucket
- **clip-files storage bucket** — New Supabase Storage bucket with RLS (users access own files only)
- **File display** — Contextual icon by type (📄 PDF, 📊 spreadsheet, 📦 archive, 🎵 audio, 🎬 video, 💻 code, 📎 other), filename, file size, download button
- **Download** — Signed URL opened in browser/shell
- **Size limits** — Pro: images up to 10MB, files up to 25MB. Free: blocked with upgrade toast.
- **Filter** — `image` and `file` filter buttons in FilterBar
- **Type constraint** — `file` added to clips table check constraint
- **Cleanup** — File storage cleaned up on clip deletion

### Website Updates

- Version badge: v0.3.0
- Meta descriptions: mention images, files, encryption
- Hero: "text, links, images, and files", use cases updated
- Features bento: "Image & file clips" card replaces "Undo everything"
- Encryption section: "12-word recovery phrase" replaces "No performance hit"
- How it works: Enter to send, drag files
- Pricing: split into "Image clips (up to 10MB)" and "File clips (up to 25MB)" under Pro
- Mockup: "Snip" → "SnipSync", shortcut updated

### Infrastructure

- **4 edge functions**: ls-webhook, record-deletion, check-deleted, send-email
- **Supabase migration**: `deleted_accounts` table
- **Storage**: `clip-files` bucket with RLS policies
- **Secrets**: `RESEND_API_KEY` set via Supabase CLI
- **Version**: 0.2.0 → 0.3.0 (package.json + SettingsView)

### Files Changed

| File | What changed |
|---|---|
| `electron/main.js` | Persistent UUID device ID, legacy hash handler, fs import |
| `electron/preload.js` | `getLegacyMachineId` exposed |
| `package.json` | Version bump to 0.3.0 |
| `src/App.jsx` | Avatar removed, vault overlay, lightbox, device migration, deleted account check, email triggers, file drop handler, optimistic rendering, Enter to send |
| `src/components/ClipCard.jsx` | Type-colored left border, context menu, expandable content, file thumbnail, image lightbox click |
| `src/components/FilterBar.jsx` | Added image + file filters, removed address + code |
| `src/components/InputArea.jsx` | Drag-and-drop zone, Enter to send, onFileDrop prop |
| `src/components/SearchBar.jsx` | Rewritten: always visible, / shortcut, Esc to clear, auto-focus on window focus |
| `src/components/SettingsView.jsx` | Sign-out section, password confirm + strength bar, show/hide toggle, recovery chips, recover+disable, force-reset, v0.3.0 |
| `src/lib/supabase.js` | File upload/download helpers, sendEmail, checkDeletedAccount, ensureProfile returns boolean, deleteAccount via edge function, plan limits with file sizes |
| `src/styles.css` | Complete overhaul — contrast fixes, compact cards, hover actions, search bar, context menu, vault overlay, lightbox, empty state, password strength, recovery chips |
| `website/index.html` | v0.3.0 version, updated features/pricing/descriptions/meta |
| `supabase/functions/record-deletion/index.ts` | **New** — deletion recording + profile/auth cleanup + email |
| `supabase/functions/check-deleted/index.ts` | **New** — re-signup detection |
| `supabase/functions/send-email/index.ts` | **New** — template-based transactional emails via Resend |
| `supabase/migrations/20260318000000_deleted_accounts.sql` | **New** — deleted_accounts table |

---

## v0.2.0 — Audit, Bug Fixes & UI Polish

### Security & Stability

- **OAuth reworked for Electron** — The previous `signInWithOAuth` approach redirected the BrowserWindow directly, which breaks in packaged builds (`file://` origin can't receive callbacks). Now a temporary local HTTP server starts on `127.0.0.1:54321`, the user's default browser opens for Google sign-in, and tokens are received via a `/callback` page that POSTs them back. The server auto-closes after receiving tokens or after a 120s timeout. Tokens are forwarded to the renderer via IPC and set with `supabase.auth.setSession()`.

- **URL validation** — `shell.openExternal()` previously accepted any string. Now URLs are parsed with `new URL()` and only `http:` / `https:` protocols are allowed. Blocks `javascript:`, `file:`, `data:` schemes silently.

- **Content Security Policy** — Added a CSP meta tag to `index.html` restricting scripts to `self`, styles to `self` + Google Fonts, connections to the Supabase domain (HTTPS + WSS), and images to `self` + `data:`.

- **Removed `electron-store`** — Was listed as a dependency but never imported anywhere. Removed from `package.json`.

---

### Bug Fixes

- **Device registration race condition** — On launch, the data setup effect fired immediately with default values (`platform='darwin'`, `deviceName=''`) before the Electron IPC calls returned real values. Added a `platformReady` state flag that gates the setup effect, ensuring device registration uses the correct platform and hostname.

- **Stale device ID** — If a device was deleted from Supabase but `snip_device_id` remained in localStorage, all clip creation would silently fail (foreign key constraint). Now after reading the stored ID, a quick `SELECT` verifies it still exists. If not, localStorage is cleared and a new device is registered.

- **Keyboard shortcut re-registering every render** — The `useEffect` for the global Cmd/Ctrl+Enter shortcut had no dependency array, so it added and removed a listener on every single render. Now uses a ref for the handler and registers the listener once with `[platform]` as the dependency.

---

### CSS Migration

All inline `style={{...}}` attributes across every component have been replaced with CSS classes in `src/styles.css`. This was a prerequisite for hover states, focus states, transitions, and keyframe animations — none of which work with React inline styles.

**Class groups added:**
- `.loading-screen`, `.loading-spinner`
- `.signin-screen`, `.signin-logo`, `.signin-btn`
- `.titlebar`, `.titlebar-left`, `.titlebar-right`, `.titlebar-avatar`
- `.input-area`, `.input-wrapper`, `.input-textarea`, `.input-send-btn`
- `.filter-bar`, `.filter-btn`, `.filter-count`
- `.search-bar`, `.search-toggle`, `.search-input`
- `.clip-card`, `.clip-btn`, `.clip-content-wrapper`
- `.footer`, `.footer-device`, `.footer-count`
- `.toast`, `.toast-undo`
- `.empty-state`, `.app-container`

---

### UI Polish

- **Platform-aware titlebar** — macOS shows the red/yellow/green traffic light dots. Windows shows a minimal `x` close button that hides the window. No more non-functional macOS dots on Windows.

- **Sign-out button** — A user initial avatar button sits in the titlebar. Hovering turns it red to hint at the action. Clicking signs out, clears all local state, and removes the stored device ID.

- **Content truncation indicator** — Clip content is capped at 60px height. A `::after` pseudo-element applies a `linear-gradient(transparent, #111111)` fade overlay so truncated content blends naturally into the card background instead of cutting off abruptly.

- **Loading screen** — Replaced the plain "Loading..." text with a green animated spinner.

- **Sign-in screen** — Added a subtle radial gradient background (`#0f1a0f` center fading to `#0a0a0a`). Logo, subtitle, and button each have staggered `fadeInUp` animations (0ms, 100ms, 200ms delays).

- **Empty state** — Added a clipboard icon above the text for better visual weight.

- **Footer** — Clip count color changed from nearly invisible `#2a2a2a` to readable `#555`. Section borders bumped from `#161616` to `#1e1e1e`.

---

### New Features

#### Search Bar (`src/components/SearchBar.jsx`)
A collapsible search bar rendered between the filter bar and the clip list. Click the magnifying glass icon to expand it into a full text input. Typing filters clips in real time (case-insensitive match on content). A clear button appears when there's text. Clicking the magnifying glass again collapses and resets the search.

#### Delete with Undo Toast (`src/components/Toast.jsx`)
Deleting a clip now shows a slide-out animation (200ms `clipOut`), removes it from the UI immediately, and displays a toast bar at the bottom: "Clip deleted · **Undo**". The actual Supabase deletion is delayed by 3 seconds. Clicking Undo cancels the delete and re-inserts the clip in its original position. The toast auto-dismisses after 3 seconds with a slide-down animation.

#### Filter Bar Counts
Each filter button now shows its count (e.g., `link 3`, `note 7`), not just the "All" tab.

---

### Animations & Micro-Interactions

| Animation | Where | Details |
|---|---|---|
| `clipIn` | New clip cards | Fade + slide up (250ms) |
| `clipOut` | Deleted clip cards | Fade + slide right (200ms) |
| `checkPop` | Copy button | Scale bounce on "Copied!" state (300ms) |
| `fadeInUp` | Sign-in screen | Staggered entrance for logo, subtitle, button |
| `spin` | Loading screen | Green spinner rotation (700ms) |
| `toastIn` / `toastOut` | Delete toast | Slide up/down (200ms) |
| `pulse` | Live indicator dot | Slow opacity pulse (4s) |
| Hover glow | Clip cards | Faint green `box-shadow` on hover |
| Button hover | All buttons | `brightness(1.1)` + subtle `scale(1.02)` |
| Button active | All buttons | `scale(0.97)` press-down |
| Delete hover | Delete button | Turns red with dark red background |
| Avatar hover | Sign-out button | Border and text turn red |
| Focus-within | Input wrapper | Border brightens to `#333` |

---

### Files Changed

| File | What changed |
|---|---|
| `electron/main.js` | OAuth local server, URL validation, `hide-window` IPC |
| `electron/preload.js` | `startOAuth`, `onAuthTokens`, `removeAuthTokensListener`, `hideWindow` |
| `src/lib/supabase.js` | OAuth rewrite for Electron, `checkDeviceExists` helper |
| `src/App.jsx` | Auth flow, platform-ready guard, stale device check, keyboard fix, sign-out, search state, CSS classes, platform titlebar, toast integration |
| `src/styles.css` | Complete overhaul — all component classes, animations, hover/focus states |
| `src/components/ClipCard.jsx` | CSS classes, truncation fade, delete animation, `removing` prop |
| `src/components/InputArea.jsx` | CSS classes |
| `src/components/FilterBar.jsx` | CSS classes, per-type counts |
| `src/components/SearchBar.jsx` | **New** — collapsible search input |
| `src/components/Toast.jsx` | **New** — undo delete toast |
| `index.html` | CSP meta tag |
| `package.json` | Removed `electron-store` |
