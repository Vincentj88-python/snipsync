# Cross-Snip Updates

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
