# Snip — Product Plan

## Vision

One-line vision: the fastest way to move information between devices and people.

## Architecture Principles

- Performance is king — every feature must be evaluated for latency impact
- Keep the Electron bundle small (currently ~94MB, target: stay under 100MB)
- Supabase Realtime for all sync — no polling
- Lazy load everything that isn't on the critical path
- Minimize re-renders in React — use refs over state where possible
- Client-side caching — don't hit the DB for data you already have

## Tiers

### Free

- 2 devices
- 30 clips max
- 7-day history
- Text clips only

### Pro ($3.99/mo or $29/yr)

- Unlimited devices
- Unlimited clips
- Unlimited history
- Clipboard auto-capture (system clipboard monitoring)
- Image & file clips (via Supabase Storage)
- Favorites / pinned clips
- Custom tags
- Export (CSV/JSON)

### Team ($6.99/seat/mo)

- Everything in Pro
- Channels (shared clip feeds — like #design-links, #staging-urls)
- Direct send (send a clip to a specific teammate instantly)
- Shared collections (persistent pinned clips for the whole team)
- Team management (invite via email, roles)
- Team billing (per-seat)

## Roadmap

### Phase 1: Monetization Foundation (v0.2.0)

Goal: Start making money with free/pro tier limits

Tasks:

1. Supabase schema changes:
   - Add `plans` table (user_id, plan: 'free'|'pro'|'team', status, expires_at, lemonsqueezy_subscription_id)
   - Add `usage` tracking — clip count per user, device count per user
   - RLS policies for plan-gated features
2. Enforce limits in the app:
   - Device registration: check device count against plan limit
   - Clip creation: check clip count against plan limit
   - Show upgrade prompts when limits are hit (not annoying modals — subtle inline prompts)
3. Lemon Squeezy payment integration:
   - Lemon Squeezy popup checkout for subscriptions
   - Webhook endpoint (Supabase Edge Function) to handle payment events
   - Store subscription status in Supabase
   - Handle plan upgrades, downgrades, cancellation
4. Settings/account page in the app:
   - Current plan display
   - Usage stats (X/50 clips, 2/2 devices)
   - Upgrade button
   - Manage subscription (cancel, change plan)
5. Performance considerations:
   - Cache plan status locally (don't query on every clip creation)
   - Limit checks should be client-side first, server-side enforced via RLS/DB constraints

### Phase 2: Pro Features (v0.3.0)

Goal: Make Pro worth paying for

Tasks:

1. Clipboard auto-capture:
   - Use Electron's clipboard.readText() on an interval (every 1-2s)
   - Detect changes, auto-create clips
   - Must be toggleable (some people don't want everything captured)
   - Deduplicate — don't save the same content twice in a row
   - Performance: run in main process, debounce, skip if content unchanged (compare hashes not full strings)
2. Image clips:
   - Support clipboard images (screenshots, copied images)
   - Upload to Supabase Storage (with size limits — 5MB per image)
   - Show thumbnails in clip cards
   - Lazy load images — don't load thumbnails until they scroll into view
   - Performance: compress before upload, generate thumbnails client-side, use IntersectionObserver for lazy loading
3. Favorites / pinned clips:
   - Toggle pin on any clip (already have `pinned` column in DB)
   - Pinned clips show at top of list, persist across sessions
   - Minimal perf impact — just a filter/sort change
4. Custom tags:
   - User-defined tags beyond the auto-detected types
   - Tags table in Supabase, many-to-many with clips
   - Filterable in the filter bar
5. Export:
   - Download all clips as CSV or JSON
   - Client-side generation (no server round-trip)

### Phase 3: Team Features (v1.0.0)

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
   - Performance: lightweight notification via Realtime, don't re-fetch entire clip list
4. Shared collections:
   - Persistent sets of pinned clips visible to entire team
   - `collections` table (id, team_id, name)
   - `collection_clips` table (collection_id, clip_id)
   - Think: "Brand Assets", "Staging URLs", "Onboarding Links"
5. Team billing:
   - Per-seat pricing via Lemon Squeezy
   - Owner manages seats
   - Add/remove members adjusts billing
6. Team settings:
   - Team name, member management, role assignment
   - Audit log (who sent what, when) — nice to have

### Phase 4: Expansion (v1.x)

- Browser extension (Chrome/Firefox) — clip from any webpage
- Mobile companion app (React Native) — read-only at first, then full sync
- Global hotkey to summon Snip (Cmd+Shift+V or configurable)
- End-to-end encryption (client-side encrypt/decrypt, zero-knowledge)
- API access for Pro/Team (programmatic clip creation)

## Performance Budget

| Metric | Target |
|--------|--------|
| App launch to visible | < 500ms |
| Clip sync latency | < 200ms |
| Clip list render (50 items) | < 16ms (60fps) |
| Image thumbnail load | < 100ms (from cache) |
| Search filtering | < 5ms (client-side) |
| Bundle size | < 100MB |
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
| E2E encryption (future) | tweetnacl-js | Small, audited, no native deps |

## Payment Integration Notes (Lemon Squeezy)

- Lemon Squeezy is a merchant of record — they handle VAT, tax compliance, invoicing, refunds
- No business registration required — sign up as an individual with ID verification
- Checkout via Lemon Squeezy overlay or hosted checkout page (opens in browser, like OAuth flow)
- Supports subscriptions in USD — settles to SA bank via Payoneer or Wise
- Webhooks for subscription events (created, updated, cancelled, payment_failed)
- Need a Supabase Edge Function to receive and verify webhooks (HMAC signature)
- Store subscription_id and payment status in the plans table
- Lemon Squeezy takes ~5-8% cut (worth it to avoid global tax compliance)
- Grace period: 3 days after failed payment before downgrading to free
- Customer portal: Lemon Squeezy provides a hosted portal for users to manage their subscription (no need to build one)

## Launch Checklist (before each phase)

- [ ] All tests passing
- [ ] Performance budget met (check metrics table above)
- [ ] RLS policies reviewed for new tables
- [ ] Privacy policy updated if new data is collected
- [ ] UPDATES.md changelog written
- [ ] Git tagged with version
- [ ] GitHub Release created (triggers CI/CD build)
- [ ] Landing page updated with new features
- [ ] Lemon Squeezy products/variants configured (if billing changes)
