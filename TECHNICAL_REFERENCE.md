# SnipSync — Technical Reference

> Comprehensive technical document for developers and AI analysis.
> Last updated: 2026-03-23 | Version: v0.3.1

## What It Is

Cross-device clipboard sync desktop app. Copy on Mac, paste on Windows (or vice versa). Lives in the system tray, syncs in real time via Supabase Realtime. Supports text, links, images, files, and end-to-end encryption.

**Repository**: github.com/Vincentj88-python/snipsync
**Website**: snipsync.xyz (waitlist active, not yet public)
**Author**: Vincent Jacobs

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Desktop framework | Electron | 35 |
| Frontend | React | 18.2 |
| Build tool | Vite | 6.4.1 |
| Test framework | Vitest | 2.1.9 |
| Database | Supabase (Postgres) | EU region |
| Auth | Supabase Auth (Google OAuth) | |
| Realtime sync | Supabase Realtime (WebSockets) | |
| File storage | Supabase Storage (S3-backed) | |
| Encryption | tweetnacl-js (XSalsa20-Poly1305) | 1.0.3 |
| Key derivation | Web Crypto API (PBKDF2 600K iterations) | |
| Payments | Lemon Squeezy (pending approval) | |
| Emails | Resend | |
| Error tracking | Sentry | 5.12.0 |
| CI/CD | GitHub Actions | |
| Website hosting | Vercel | |
| Desktop packaging | electron-builder | 26.8.2 |
| Mobile | React Native | 0.84.1 |

---

## Project Structure

```
/
├── src/                           # React frontend (desktop app)
│   ├── App.jsx                    # Root: auth, device setup, clip sync, vault, lightbox
│   ├── main.jsx                   # Entry point + Sentry init + ErrorBoundary
│   ├── styles.css                 # All styles + animations
│   ├── components/
│   │   ├── ClipCard.jsx           # Clip display: type badge, copy, pin, delete, expand, context menu
│   │   ├── SettingsView.jsx       # Plan info, encryption UI, export, account deletion
│   │   ├── TeamView.jsx           # Channels, mentions, direct send, collections
│   │   ├── InputArea.jsx          # Text input + drag-drop files
│   │   ├── SearchBar.jsx          # Persistent search, / shortcut
│   │   ├── FilterBar.jsx          # Type filters with counts
│   │   ├── Toast.jsx              # Undo toast, auto-dismiss
│   │   └── ErrorBoundary.jsx      # Crash recovery UI
│   └── lib/
│       ├── supabase.js            # Supabase client, all CRUD, team queries, mentions
│       ├── crypto.js              # E2E encryption: PBKDF2, tweetnacl, recovery phrases
│       ├── utils.js               # detectType(), mapPlatform()
│       └── sanitize.js            # HTML/injection sanitization
│
├── electron/
│   ├── main.js                    # Window, tray, clipboard watch, OAuth server, IPC, auto-updater
│   └── preload.js                 # IPC bridge (contextBridge), 20+ exposed APIs
│
├── supabase/
│   ├── functions/
│   │   ├── ls-webhook/            # Lemon Squeezy payment webhook (HMAC verified)
│   │   ├── ls-team-webhook/       # Team subscription webhook
│   │   ├── record-deletion/       # Account deletion (JWT + rate limited)
│   │   ├── send-email/            # Transactional emails via Resend (JWT or service-role)
│   │   ├── check-deleted/         # Re-signup detection (JWT + rate limited)
│   │   ├── accept-invite/         # Team invite acceptance (JWT + rate limited)
│   │   └── health/                # Health check endpoint
│   └── migrations/
│       ├── 20260318000000_deleted_accounts.sql
│       └── 20260320000000_teams.sql
│
├── website/                       # Landing page (snipsync.xyz, Vercel)
│   ├── index.html                 # Hero, features, pricing, comparison, founder, waitlist
│   ├── security.html              # Encryption flow, algorithms, what we can/cannot see
│   ├── privacy.html               # Privacy policy
│   ├── terms.html                 # Terms of service
│   ├── styles.css                 # Dark theme, responsive
│   ├── script.js                  # Waitlist form, animations
│   └── vercel.json                # Security headers (HSTS, X-Frame-Options, etc.)
│
├── portal/                        # Team admin portal (portal.snipsync.xyz)
│   ├── src/
│   │   ├── App.jsx                # Auth, team selector, create team
│   │   ├── pages/TeamDashboard.jsx # Tabs: Members, Invites, Channels, Groups, Collections, Billing, Settings
│   │   ├── components/
│   │   │   ├── MemberList.jsx     # Roles, promote/demote, remove
│   │   │   ├── InviteManager.jsx  # Generate links, copy, revoke
│   │   │   ├── ChannelManager.jsx # Create/delete channels
│   │   │   ├── GroupManager.jsx   # @mention groups, add/remove members
│   │   │   ├── CollectionManager.jsx # Shared pinned clip sets
│   │   │   ├── BillingView.jsx    # Seats, cost, subscription status
│   │   │   └── TeamSettings.jsx   # Rename, max seats, delete team
│   │   └── lib/
│   │       ├── supabase.js        # Team CRUD, member management, invites
│   │       └── sanitize.js        # Input sanitization
│   └── vercel.json                # SPA routing + security headers
│
├── mobile/                        # React Native companion (Phase 1 in progress)
│   ├── src/
│   │   ├── screens/SignInScreen.js # Google OAuth via PKCE flow
│   │   ├── screens/ClipListScreen.js # FlatList, realtime, vault unlock, compose
│   │   ├── components/ClipCard.js # Mobile clip card
│   │   ├── navigation/AppNavigator.js # Auth gating + deep link handling
│   │   └── lib/
│   │       ├── supabase.js        # Adapted for AsyncStorage
│   │       └── crypto.js          # PBKDF2 via react-native-quick-crypto
│   ├── ios/                       # Xcode project
│   └── android/                   # Android Studio project
│
├── .github/workflows/
│   ├── ci.yml                     # Tests + build on push/PR
│   └── release.yml                # Mac DMG + Windows EXE on version tags
│
├── public/                        # Tray icons (default, sync, offline, error) + app icon
├── Logos/                          # Brand assets (PNG + SVG)
├── CLAUDE.md                      # AI developer guide
├── PLAN.md                        # Product roadmap
├── TEAMS_PLAN.md                  # Team feature architecture
├── ENCRYPTION_PLAN.md             # Encryption design (implemented)
├── PROJECT_STATUS.md              # Current status + session log
└── UPDATES.md                     # Changelog
```

---

## Database Schema

### Core Tables

| Table | Purpose | Key columns |
|---|---|---|
| `profiles` | User accounts | id, email, display_name, encryption_enabled, encrypted_master_key, key_salt, key_nonce, encrypted_recovery_key |
| `devices` | Registered devices | id, user_id, name, platform, machine_id (persistent UUID) |
| `clips` | Clipboard entries | id, user_id, device_id, content, type, encrypted, nonce, image_path, image_size, pinned |
| `subscriptions` | Plan status | user_id, plan (free/pro), status, ls_subscription_id, current_period_end |
| `tags` | Custom clip tags | id, user_id, name, color |
| `clip_tags` | Clip-tag junction | clip_id, tag_id |
| `deleted_accounts` | Abuse prevention | email, machine_ids (service-role only) |

### Team Tables

| Table | Purpose | Key columns |
|---|---|---|
| `teams` | Team metadata | id, name, owner_id, max_seats |
| `team_members` | Membership | team_id, user_id, role (owner/admin/member) |
| `team_invites` | Invite links | team_id, invite_code, role, max_uses, use_count, expires_at |
| `channels` | Shared clip feeds | team_id, name, description |
| `channel_clips` | Clips in channels | channel_id, clip_id, sent_by |
| `direct_clips` | Direct messages | team_id, sender_id, receiver_id, clip_id, read_at |
| `groups` | @mention groups | team_id, name |
| `group_members` | Group membership | group_id, user_id |
| `clip_mentions` | @mention tracking | clip_id, mentioned_user_id, mentioned_group_id, read_at |
| `collections` | Shared pinned sets | team_id, name, description |
| `collection_clips` | Clips in collections | collection_id, clip_id, added_by |
| `team_subscriptions` | Team billing | team_id, plan, seat_count, ls_subscription_id |

### Database Triggers

| Trigger | Table | Action |
|---|---|---|
| `on_team_created` | teams INSERT | Auto-add owner to team_members with role 'owner' |
| `on_team_created_channel` | teams INSERT | Auto-create #general channel |
| `on_team_created_subscription` | teams INSERT | Auto-create team_subscription (trial, 1 seat) |
| `on_member_added` | team_members INSERT | Increment team_subscriptions.seat_count |
| `on_member_removed` | team_members DELETE | Decrement team_subscriptions.seat_count |
| `on_team_updated` | teams UPDATE | Set updated_at = now() |

### Database Functions (Security Definer)

| Function | Purpose |
|---|---|
| `get_user_team_ids(uid)` | Returns team IDs for a user (avoids RLS recursion) |
| `is_team_admin(uid, tid)` | Checks if user is owner/admin of team |

### Indexes (14 total)

```sql
idx_clips_user_id, idx_clips_created_at, idx_clips_user_created
idx_devices_user_id, idx_deleted_accounts_email, idx_subscriptions_user_id
idx_team_members_user_id, idx_team_members_team_id
idx_channel_clips_channel_id, idx_direct_clips_sender, idx_direct_clips_receiver
idx_clip_mentions_user, idx_clip_mentions_group, idx_team_invites_code
```

### RLS Policy Pattern

All tables use Row Level Security. Core pattern:
- **SELECT**: `user_id = auth.uid()` or `team_id IN (SELECT get_user_team_ids(auth.uid()))`
- **INSERT**: `auth.uid() = owner_id` or team membership check
- **UPDATE/DELETE**: Owner/admin check via `is_team_admin(auth.uid(), team_id)`
- **Service-role bypass**: Edge functions use service-role key for privileged operations

---

## Edge Functions (7 total)

| Function | Auth | Rate Limit | Purpose |
|---|---|---|---|
| `ls-webhook` | HMAC signature | None (webhook) | Lemon Squeezy payment events → update subscriptions |
| `ls-team-webhook` | HMAC signature | None (webhook) | Team subscription events → update team_subscriptions |
| `record-deletion` | JWT + user_id match | 3/min | Delete account: record, cascade delete, send email |
| `send-email` | JWT or service-role | 5/min (user only) | Send transactional email via Resend (welcome, deleted, welcome-back) |
| `check-deleted` | JWT + email match | 10/min | Check if email was previously deleted (re-signup detection) |
| `accept-invite` | JWT | 10/min | Validate invite code, add user to team |
| `health` | None | None | Returns { status: 'ok', timestamp, db: 'connected' } |

---

## Authentication Flow

### Desktop (Electron)

```
User clicks "Sign in with Google"
  → Local HTTP server starts on 127.0.0.1:54321
  → Default browser opens Supabase OAuth URL
  → Google sign-in in browser
  → Supabase redirects to localhost:54321/callback#access_token=...
  → HTML page reads hash, POSTs tokens to /token endpoint
  → IPC sends tokens to Electron renderer
  → supabase.auth.setSession() → user authenticated
  → Realtime subscriptions activate
```

### Mobile (React Native)

```
User taps "Sign in with Google"
  → supabase.auth.signInWithOAuth({ provider: 'google', skipBrowserRedirect: true })
  → Opens Safari with Supabase PKCE flow URL
  → Google sign-in in Safari
  → Redirect to snipsync://auth/callback?code=xxx
  → App receives deep link → exchangeCodeForSession(code)
  → User authenticated
```

### Portal (Web)

```
User clicks "Sign in with Google"
  → supabase.auth.signInWithOAuth({ provider: 'google', redirectTo: window.location.origin })
  → Standard OAuth redirect flow
  → Supabase handles callback
```

---

## Encryption Architecture

### Flow

```
Vault password → PBKDF2 (600K iterations, SHA-256) → wrapping key
  → encrypts random 256-bit master key → stored in profiles table

Each clip: content → XSalsa20-Poly1305(content, random_nonce, master_key) → base64 blob
  → stored in clips.content with encrypted=true, nonce=base64(nonce)

Other device: vault password → PBKDF2 → wrapping key → decrypt master key
  → decrypt each clip locally
```

### Algorithms

| Component | Algorithm |
|---|---|
| Symmetric encryption | XSalsa20-Poly1305 (tweetnacl secretbox) |
| Key derivation | PBKDF2-SHA256, 600K iterations (backward compat: tries 600K then 100K) |
| Master key | 256-bit random (nacl.randomBytes(32)) |
| Per-clip nonce | 192-bit random (24 bytes) |
| Recovery phrase | 12 words from 256-word list (96-bit entropy) |
| Transport | TLS 1.3 (Supabase enforced) |

### What the server can see

| Data | Visible to server? |
|---|---|
| Clip content | No — encrypted blob only |
| Vault password | No — never leaves device |
| Master key | No — never leaves device |
| Clip type (link, note, code) | Yes — needed for filtering |
| Timestamps | Yes — needed for sorting |
| Device name | Yes — needed for badges |

### Memory Safety

- Master key stored as `Uint8Array` in React ref
- Cleared with `fill(0)` on: sign-out, page unload, 30-min inactivity auto-lock
- Vault unlock rate limited: exponential backoff (2s, 4s, 6s... max 30s)

---

## Subscription Tiers

| Feature | Free | Pro ($4.99/mo) | Team ($8.99/seat/mo) |
|---|---|---|---|
| Devices | 2 | Unlimited | Unlimited |
| Clips | Unlimited | Unlimited | Unlimited |
| History | 7 days | Unlimited | Unlimited |
| Image clips | No | Up to 10MB | Up to 10MB |
| File clips | No | Up to 25MB | Up to 25MB |
| Auto-capture | No | Yes | Yes |
| Encryption | Yes | Yes | Yes |
| Channels | No | No | Yes |
| @Mentions | No | No | Yes |
| Direct send | No | No | Yes |
| Collections | No | No | Yes |
| Admin portal | No | No | Yes |

---

## Realtime Sync

```javascript
supabase.channel(`clips:${userId}`)
  .on('postgres_changes', { event: 'INSERT', table: 'clips', filter: `user_id=eq.${userId}` }, onInsert)
  .on('postgres_changes', { event: 'DELETE', table: 'clips', filter: `user_id=eq.${userId}` }, onDelete)
  .subscribe()
```

- DELETE sync requires `REPLICA IDENTITY FULL` on clips table
- Target latency: <200ms
- Deduplication: optimistic local insert + realtime dedup
- Channel clips also use Realtime (separate subscription per active channel)

---

## Global Keyboard Shortcut

`Cmd+Shift+V` (Mac) / `Ctrl+Shift+V` (Windows) — snips clipboard from anywhere:

| Clipboard content | Action |
|---|---|
| Text | Creates clip (type auto-detected), notification "Clip snipped!" |
| Image (screenshot) | Uploads to clip-images bucket (Pro only) |
| File (Finder selection) | Reads file, uploads to storage (Pro only) |

Respects encryption (encrypts if vault unlocked) and plan limits.

---

## Tray Icon States

| State | Icon Color | Tooltip |
|---|---|---|
| Default (connected) | Black (template) | "SnipSync" |
| Syncing | Green | "SnipSync — Syncing..." |
| Offline | Gray | "SnipSync — Offline" |
| Error | Red | "SnipSync — Error" |

---

## Security Measures

### Application

- Electron sandbox mode + webSecurity enabled
- contextIsolation: true, nodeIntegration: false
- Permission denial (camera, mic, geolocation auto-denied)
- URL validation: only http/https allowed in shell.openExternal
- CSP: script-src 'self', connect-src limited to Supabase domain
- Error boundaries on all React apps (desktop, portal)

### Edge Functions

- JWT verification on all user-facing functions
- Rate limiting: 3-10 requests/min per user (429 + Retry-After)
- HMAC constant-time verification on webhooks (crypto.subtle.verify)
- Error messages sanitized (no internal details leaked)
- Service-role key for internal function-to-function calls

### Database

- RLS on every table (20+ tables)
- Security definer functions to avoid self-referencing RLS recursion
- 14 indexes for query performance
- Signed URLs with 15-minute expiry
- Input sanitization on all user-supplied names/descriptions

### Dependencies

- Electron 28→35 (ASAR integrity bypass fix)
- electron-builder 24→26 (tar path traversal fixes)
- @sentry/electron 4→5 (prototype pollution fix)
- Audit: 16 vulns (5 high) → 5 (moderate, dev-only)

---

## CI/CD

### ci.yml (push to main, PRs)

```
Checkout → Node 20 → npm ci → npm test (27 tests) → npx vite build
```

### release.yml (version tags)

```
Matrix: [macOS, Windows]
  → npm ci → vite build (with env vars) → electron-builder
  → Upload artifacts → Create GitHub Release with DMG + EXE
```

Auto-updater checks GitHub Releases for newer versions.

---

## Environment Variables

### Required (.env)

```
VITE_SUPABASE_URL=https://kohwpkwcopkslbtkczag.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

### Optional

```
VITE_LS_CHECKOUT_URL=<lemon-squeezy-checkout-url>
```

### Supabase Edge Function Secrets

```
RESEND_API_KEY=<resend-api-key>
LS_WEBHOOK_SECRET=<lemon-squeezy-webhook-secret>
LS_TEAM_WEBHOOK_SECRET=<team-webhook-secret>
```

---

## Local Development

```bash
npm install           # Install dependencies
npm run dev           # Vite + Electron concurrently
npm test              # Vitest (27 tests)
npm run build         # Vite build + electron-builder

# Portal
cd portal && npm install && npm run dev   # localhost:5173

# Mobile
cd mobile && npm install
npx react-native run-ios                  # iOS simulator
npx react-native run-ios --udid=<id>      # Physical device
```

---

## Outstanding Before Launch

| Item | Blocker? | Status |
|---|---|---|
| Supabase upgrade to Pro ($25/mo) | Yes | On free plan, auto-pause risk |
| Google OAuth verification | Yes | 100 user cap without it |
| Apple Developer account ($99/yr) | Yes | Mac notarization + iOS App Store |
| Lemon Squeezy approval | Yes | Need demo video |
| Deploy portal to Vercel | No | Ready to deploy |
| Mobile vault unlock testing | No | In progress on physical iPhone |
| End-to-end team testing | No | Database ready, needs integration testing |

---

## Version History

| Version | Date | Highlights |
|---|---|---|
| v0.2.0 | 2026-03-16 | OAuth rework, CSP, bug fixes, CSS migration, search, toast |
| v0.3.0 | 2026-03-18 | UI overhaul, encryption UX, file clips, account deletion, emails |
| v0.3.1 | 2026-03-20 | Security hardening, dep upgrades, PBKDF2 600K, logo rebrand |
| main | 2026-03-23 | Teams, portal, production hardening, free tier change, website overhaul |
