# Cross-Snip Updates

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
