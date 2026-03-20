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
- 30 clips/month (resets 1st, deleting doesn't restore counter)
- 7-day history
- Text clips only (no images or files)

### Pro ($4.99/mo or $39/yr)

- Unlimited devices
- Unlimited clips
- Unlimited history
- Image clips (up to 10MB)
- File clips (up to 25MB, drag-and-drop)
- Clipboard auto-capture
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

### Phase 2.5: Production-Ready Overhaul — COMPLETE (v0.3.0)

Shipped 2026-03-18:

- [x] UI visual overhaul (text contrast, card polish, compact layout, type-colored borders)
- [x] Settings scroll fix, hover-to-reveal actions, persistent search with `/` shortcut
- [x] Sign-out moved to Settings, avatar removed from titlebar
- [x] Persistent UUID device ID (replaces hardware fingerprint), legacy migration
- [x] Account deletion via edge function (deletes profile + auth user + records deletion)
- [x] Re-signup detection with warning toast
- [x] Transactional emails via Resend (welcome, account-deleted, welcome-back)
- [x] Encryption UX: password confirm, strength bar, show/hide toggle, recovery phrase chips
- [x] Recovery phrase can decrypt + disable in one step, force-reset escape hatch
- [x] Vault overlay on main screen when locked
- [x] File clips: drag-and-drop, clip-files storage bucket, download button (Pro-only, up to 25MB)
- [x] Image lightbox, right-click context menu, expandable clip content
- [x] Enter to send, optimistic clip rendering, last synced time in footer
- [x] Strict file size limits (Pro: 10MB images, 25MB files; Free: blocked)
- [x] 3 new edge functions (record-deletion, check-deleted, send-email)
- [x] Website updated with v0.3.0 features and pricing
- [x] Mac DMG + Windows EXE built and pushed to GitHub Releases

### Phase 3: Browser Extension — IN PROGRESS

Goal: Expand reach — browser extension is zero-friction install, works on any OS

Completed:
- [x] Chrome Extension scaffold (Manifest V3)
- [x] Google OAuth via chrome.identity API
- [x] Same Supabase client, same Realtime subscriptions
- [x] Popup with clip list
- [x] Real-time sync
- [x] Counts as device toward free tier limit

Remaining:
- [ ] Right-click context menu: "Send to SnipSync" on selected text
- [ ] Right-click link: "Snip this link"
- [ ] Keyboard shortcut (Alt+S) to snip selected text
- [ ] Publish to Chrome Web Store
- [ ] Firefox port (Manifest V3 → Firefox WebExtensions API)
- [ ] Publish to Firefox Add-ons
- [ ] Extension popup CSS polish (hard square corners limitation)

Performance:
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
- ~~End-to-end encryption~~ — **DONE** (shipped 2026-03-17, polished 2026-03-18 with password confirm, strength bar, recovery chips, vault overlay, force-reset)
- API access for Pro/Team (programmatic clip creation)
- Webhooks for Pro/Team (trigger external actions on new clips)

### Phase 6: Future Expansion

#### Clip Templates / Snippets
- Save reusable text blocks: email signatures, code boilerplate, canned responses
- Assign keyboard shortcuts to frequently-used clips
- Variable insertion: `{{date}}`, `{{name}}`, `{{clipboard}}` — fills in on paste
- Competes with TextExpander ($3.33/mo) — bundle it into Pro

#### OCR — Copy Text from Images
- Screenshot a section of screen → SnipSync extracts text automatically
- Photo of whiteboard → searchable text clip
- Run locally via Tesseract.js (no API needed, works offline)
- Killer marketing feature — great for demos and social media

#### AI-Powered Clipboard
- Natural language search: "find that API key from last Tuesday"
- Auto-summarize long clips
- Auto-categorize with smart tags
- Use local LLM (Ollama) or cheap API (Claude Haiku) — no data leaves unless user opts in

#### Universal Paste Formats
- Copy URL on Mac → paste as clickable hyperlink in Word, markdown link in VS Code, plain URL in terminal
- Copy phone number → auto-format for the country you're in
- Copy code → paste into Slack and it auto-wraps in a code block
- Context-aware output formatting

#### Clip Actions / Automations
- Pattern-matched triggers on new clips:
  - URL → auto-shorten (Bitly)
  - Tracking number → show delivery status inline
  - Color hex → preview swatch
  - JSON → auto-pretty-print
  - Email address → LinkedIn profile preview
- User-defined rules: "If clip contains `JIRA-`, open in browser"

#### Clip API + Webhooks
- REST API: `POST /api/clips` for programmatic clip creation
- Webhooks: trigger external actions when clips are created
- CI/CD pipeline finishes → deploy URL appears on all devices
- Zapier/Make integration → connect to 5,000+ apps
- Turns SnipSync into a developer notification layer

#### Spaces (Shared Clipboard Rooms)
- Public spaces: `engineering.snipsync.xyz` — anyone with the link can push/pull clips
- Use cases: hackathons, classrooms, live events, pair programming
- Not chat, not docs — a shared clipboard. Fast, ephemeral, zero friction
- Viral growth mechanism — gets shared on social media

#### Cross-App Clipboard Protocol
- Open protocol: `snipsync://` that any app can implement
- VS Code extension syncing code selections
- Figma plugin sending design specs as clips
- Become the standard for cross-app data transfer

#### Offline-First with CRDTs
- Local SQLite database that syncs when online
- Works on planes, tunnels, bad connectivity
- Conflict-free merging via CRDTs when devices reconnect

#### SnipSync for Enterprise
- Self-hosted option (deploy your own Supabase instance)
- SSO (SAML/OIDC) instead of Google-only
- Admin dashboard: usage analytics, compliance controls, data retention
- DLP (Data Loss Prevention): block patterns like credit cards, SSNs
- Audit logs: who copied what, when, where
- SOC2 compliance
- Pricing: $10-20/user/month — 500 users = $5-10k/month

#### Multimodal Input
- Voice-to-clip: hold button, speak, creates text clip via Whisper
- Handwriting-to-clip: draw on phone, OCR converts to text
- Camera-to-clip: point phone camera at text, auto-creates clip

#### Prioritized Build Order (when ready)

| Priority | Feature | Effort | Revenue Impact |
|----------|---------|--------|----------------|
| 1 | Clip Templates / Snippets | Low | High — justifies Pro alone |
| 2 | OCR from screenshots | Medium | High — killer demo feature |
| 3 | AI search / auto-tag | Medium | Medium — Pro differentiator |
| 4 | Clip API + Webhooks | Medium | High — opens developer market |
| 5 | Spaces (shared rooms) | Medium | High — viral growth |
| 6 | Clip Actions | High | Medium |
| 7 | Enterprise / self-hosted | High | Very high — after PMF |

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
| E2E encryption | tweetnacl-js + Web Crypto PBKDF2 | Small, audited, no native deps. Shipped 2026-03-17, polished 2026-03-18. |
| Transactional email | Resend | Simple API, good deliverability, noreply@updates.snipsync.xyz |
| Device identity | Persistent UUID in userData | Survives hardware changes, replaces fragile SHA-256 fingerprint |

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

## Infrastructure Capacity

### Current: Supabase Free Plan

| Resource | Limit | Practical meaning |
|----------|-------|-------------------|
| Realtime connections | **200 concurrent** | **Primary bottleneck** — 200 users with app open at once |
| Database size | 500 MB | ~500,000 text clips |
| Storage | 1 GB | ~200 image clips (5MB each) |
| Auth users | 50,000 | Plenty |
| Bandwidth | 5 GB/month | ~5,000 app sessions |
| Edge Function invocations | 500,000/month | Plenty for webhooks |
| Auto-pause | After 1 week inactive | **Will kill the app if no activity** |

### Scaling Triggers

| User count | Action needed | Cost |
|------------|---------------|------|
| 0-50 | Free plan is fine | $0 |
| 50+ | **Upgrade to Supabase Pro** — no auto-pause, 500 Realtime connections, 8GB DB, 100GB bandwidth | $25/mo |
| 500+ | Supabase Team — unlimited connections, 100GB DB, 250GB bandwidth | $599/mo |

### Break-even

- Supabase Pro costs $25/mo
- SnipSync Pro is $4.99/mo per user
- **7 paying users covers infrastructure costs**
- Everything after that is profit (~95% margins)

### Key risk: Auto-pause

On the free plan, Supabase pauses the project after 1 week of no API calls. All users would see the app go dead. **Upgrade to Pro before any public launch.**

## Current Status (as of 2026-03-18)

### What's live
- Desktop app v0.3.0 (Mac + Windows) — GitHub Release published
- Production-ready UI with polished contrast, compact cards, hover actions
- E2E encryption with full UX (confirm, strength bar, recovery chips, vault overlay, force-reset)
- File clips (drag-and-drop, up to 25MB on Pro) + image clips (up to 10MB on Pro)
- Transactional emails via Resend (welcome, deletion, welcome-back)
- Account deletion with full cleanup (profile + auth user + abuse prevention record)
- Persistent UUID device identity (with legacy migration)
- Chrome extension working (loaded unpacked, OAuth via chrome.identity)
- Website at snipsync.xyz with waitlist — updated for v0.3.0
- Sentry, Vercel Analytics, GitHub Actions all active
- 27 tests passing

### Waiting on
- Lemon Squeezy account approval (need to record and send demo video)
- Apple Developer account ($99/yr) — needed for Mac notarization
- Google OAuth consent screen verification (100 user cap without it)
- Supabase upgrade (must upgrade before 50 users — auto-pause risk on free plan)

### Next up
- Record demo video for Lemon Squeezy
- Submit Google OAuth for verification with privacy policy URL
- Connect Lemon Squeezy once approved (plug in checkout URL)
- Browser extension: right-click context menu, Chrome Web Store publish
- Purchase Apple Developer account for notarization

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
