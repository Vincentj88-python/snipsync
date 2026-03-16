# SnipSync — Product Plan

## Vision

The fastest way to move information between devices and people.

## Architecture Principles

- Performance is king — every feature must be evaluated for latency impact
- Keep the Electron bundle under 100MB
- Supabase Realtime for all sync — no polling
- Lazy load everything that isn't on the critical path
- Minimize re-renders in React — use refs over state where possible
- Client-side caching — don't hit the DB for data you already have
- Same Supabase backend for all clients (desktop, browser extension, future mobile)

## Tiers

### Free

- 2 devices (includes browser extension)
- 30 clips max
- 7-day history
- Text clips only

### Pro ($3.99/mo or $29/yr)

- Unlimited devices
- Unlimited clips
- Unlimited history
- Clipboard auto-capture
- Image & file clips (via Supabase Storage)
- Pinned clips & custom tags
- Export (CSV/JSON)

### Team ($6.99/seat/mo)

- Everything in Pro
- Channels (shared clip feeds — like #design-links, #staging-urls)
- Direct send (send a clip to a specific teammate instantly)
- Shared collections (persistent pinned clips for the whole team)
- Team management (invite via email, roles)
- Team billing (per-seat)

## Roadmap

### Phase 1: Monetization Foundation — COMPLETE (v0.2.0)

Everything below is shipped and working:

- [x] Supabase `subscriptions` table with auto-create trigger on new profiles
- [x] Free/Pro tier limit enforcement (30 clips, 2 devices)
- [x] Device tracking via hardware fingerprint (machine_id) — survives reinstalls
- [x] Legacy device backfill (name+platform match → sets machine_id)
- [x] Settings view with plan badge, usage meters, device list
- [x] Upgrade button → opens Lemon Squeezy checkout in browser
- [x] Lemon Squeezy webhook Edge Function (`supabase/functions/ls-webhook`)
- [x] Inline upgrade prompts when limits hit (toast, not modal)
- [x] Sentry error reporting (main + renderer)
- [x] Auto-updater via GitHub Releases
- [x] CI/CD: GitHub Actions for tests + release builds
- [x] Landing page live at snipsync.xyz with waitlist
- [x] Privacy policy + Terms of service
- [x] Vercel Analytics enabled
- [x] v0.2.0 tagged and released on GitHub

### Phase 2: Pro Features — COMPLETE (v0.2.0)

All shipped in v0.2.0:

- [x] Clipboard auto-capture (1.5s polling, MD5 dedup, toggleable in Settings)
- [x] Image clips (paste → Supabase Storage upload, lazy-loaded thumbnails)
- [x] Pinned clips (pin/unpin, sort to top, scroll-to-top on pin)
- [x] Custom tags (tags + clip_tags tables, tag filter buttons, filtering works)
- [x] Export (CSV + JSON from Settings, client-side generation)
- [x] Launch at login (toggle in Settings, openAsHidden)
- [x] Tray context menu (Open SnipSync, Quit)
- [x] URL detection includes www. domains (not just http/https)

### Phase 3: Browser Extension (v0.3.0)

Goal: Expand reach — browser extension is zero-friction install, works on any OS

Tasks:

1. Chrome Extension scaffold:
   - Manifest V3 (Chrome + Edge + Brave)
   - Small React popup (reuse existing component patterns + styles)
   - Same Supabase client, same auth, same Realtime subscriptions
   - Google OAuth works natively in extensions (chrome.identity API)
   - Register as device with platform "chrome"

2. Core features:
   - Popup shows clip list (same as desktop app)
   - Right-click context menu: "Send to SnipSync" on selected text
   - Right-click link: "Snip this link"
   - Keyboard shortcut (Alt+S) to snip selected text
   - Copy button on each clip
   - Real-time sync — new clips appear instantly

3. Tier enforcement:
   - Counts as a device toward free tier limit
   - Clip limits same as desktop
   - Pro features (image clips, auto-capture) not in extension v1

4. Firefox port:
   - Adapt Manifest V3 → Firefox WebExtensions API
   - Publish to Firefox Add-ons

5. Performance:
   - Extension popup must open in < 200ms
   - Lazy load clips on popup open, not on background
   - No background polling — only sync when popup is open
   - Service worker for badge notifications (new clips count)

### Phase 4: Team Features (v1.0.0)

Goal: Launch team tier — this is where real revenue comes from

Tasks:

1. Team infrastructure:
   - `teams` table (id, name, owner_id, created_at)
   - `team_members` table (team_id, user_id, role: 'owner'|'admin'|'member', invited_at, accepted_at)
   - `channels` table (id, team_id, name, description, created_by)
   - `channel_clips` table (id, channel_id, clip_id, sent_by, created_at)
   - Invite flow: owner sends invite email → recipient clicks link → joins team
   - RLS: team members can only see their team's channels and clips

2. Channels:
   - Create/delete channels within a team
   - Post clips to a channel (select channel when sending, or default channel)
   - Real-time updates via Supabase Realtime (subscribe to channel's clips)
   - Channel list in sidebar or tab UI
   - Performance: subscribe only to active channel, lazy-load channel history

3. Direct send:
   - "Send to..." button on any clip
   - Pick a teammate from the team roster
   - Recipient sees it appear instantly
   - Notification dot/badge for unread direct clips
   - Uses a `direct_clips` table (sender_id, receiver_id, clip_id)

4. Shared collections:
   - Persistent sets of pinned clips visible to entire team
   - `collections` table (id, team_id, name)
   - `collection_clips` table (collection_id, clip_id)

5. Team billing:
   - Per-seat pricing via Lemon Squeezy
   - Owner manages seats

### Phase 5: Expansion (v1.x+)

- Mobile companion app (React Native) — read-only at first, then full sync
- Global hotkey to summon SnipSync (Cmd+Shift+V or configurable)
- End-to-end encryption (client-side encrypt/decrypt, zero-knowledge)
- API access for Pro/Team (programmatic clip creation)
- Webhooks for Pro/Team (trigger external actions on new clips)

## Performance Budget

| Metric | Target |
|--------|--------|
| App launch to visible | < 500ms |
| Clip sync latency | < 200ms |
| Clip list render (50 items) | < 16ms (60fps) |
| Image thumbnail load | < 100ms (from cache) |
| Search filtering | < 5ms (client-side) |
| Desktop bundle size | < 100MB |
| Extension popup open | < 200ms |
| Memory usage (idle) | < 80MB |
| Memory usage (active, 50 clips) | < 120MB |

## Performance Rules

1. Never poll. Always use Realtime subscriptions.
2. Never block the main Electron process. Heavy work goes to renderer or workers.
3. Cache aggressively. Plan status, user profile, device list — cache locally, refresh in background.
4. Virtualize long lists. If clip count exceeds 100, use windowing (react-window or similar).
5. Lazy load images. Never load images that aren't visible.
6. Debounce search. Don't filter on every keystroke — wait 100ms.
7. Batch Supabase queries. Don't make 5 queries when 1 join will do.
8. Measure everything. Add performance marks for critical paths before shipping.

## Tech Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Payments | Lemon Squeezy | Merchant of record, handles global tax/VAT, no business registration needed, pays out to SA bank via Payoneer/Wise |
| Image storage | Supabase Storage | Already in the stack, S3-compatible, RLS support |
| Clipboard monitoring | Electron main process | Can't access system clipboard from renderer |
| List virtualization | react-window | Tiny bundle (6KB), proven, simple API |
| Browser extension | Manifest V3 | Required for Chrome Web Store, works in Edge/Brave too |
| E2E encryption (future) | tweetnacl-js | Small, audited, no native deps |

## Payment Integration Notes (Lemon Squeezy)

- Lemon Squeezy is a merchant of record — they handle VAT, tax compliance, invoicing, refunds
- No business registration required — sign up as an individual with ID verification
- Checkout via Lemon Squeezy overlay or hosted checkout page (opens in browser, like OAuth flow)
- Supports subscriptions in USD — settles to SA bank via Payoneer or Wise
- Webhooks for subscription events (created, updated, cancelled, payment_failed)
- Supabase Edge Function receives and verifies webhooks (HMAC signature)
- Store subscription_id and payment status in the subscriptions table
- Lemon Squeezy takes ~5-8% cut (worth it to avoid global tax compliance)
- Grace period: 3 days after failed payment before downgrading to free
- Customer portal: Lemon Squeezy provides a hosted portal for users to manage their subscription
- Status: Awaiting Lemon Squeezy account approval

## Current Status (as of March 2026)

### What's live
- Desktop app v0.2.0 (Mac + Windows) — GitHub Release published
- Website at snipsync.xyz with waitlist — deployed on Vercel
- GitHub repo is public: github.com/Vincentj88-python/snipsync
- Vercel Analytics enabled
- Sentry error reporting active
- 27 tests passing

### Waiting on
- Lemon Squeezy account approval (submitted, awaiting review)
- Apple Developer account ($99/yr) — needed for Mac code signing / notarization
- Google OAuth consent screen verification (100 user cap without it)

### Next up
- Phase 3: Browser extension (Chrome first, then Firefox)
- Connect Lemon Squeezy once approved (plug in checkout URL + deploy webhook)
- Submit Google OAuth for verification with privacy policy URL

## Launch Checklist (before each phase)

- [ ] All tests passing
- [ ] Performance budget met
- [ ] RLS policies reviewed for new tables
- [ ] Privacy policy updated if new data is collected
- [ ] UPDATES.md changelog written
- [ ] Git tagged with version
- [ ] GitHub Release created (triggers CI/CD build)
- [ ] Landing page updated with new features
- [ ] Lemon Squeezy products/variants configured (if billing changes)
