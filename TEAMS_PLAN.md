# SnipSync Teams — Implementation Plan

## Overview

Team tier ($8.99/seat/mo) — shared clipboard for teams. Includes all Pro features plus channels, direct send, @mentions, shared collections, and a web admin portal.

## Decisions

- **Portal**: `portal.snipsync.xyz` — React + Vite, deployed on Vercel
- **Invite flow**: Invite link (no email required — owner generates a link, shares it however they want)
- **Billing**: Team owner pays for all seats. Per-seat pricing via Lemon Squeezy.
- **Stack**: Same as desktop — React + Vite + Supabase. No new infrastructure.

## Database Schema

### `teams`
```sql
CREATE TABLE teams (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  owner_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS: team members can read their team, owner can update
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
```

### `team_members`
```sql
CREATE TABLE team_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at timestamptz DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- RLS: members can read their own team's members
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
```

### `team_invites`
```sql
CREATE TABLE team_invites (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  invite_code text UNIQUE NOT NULL,
  created_by uuid REFERENCES profiles(id) NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  max_uses int DEFAULT NULL,  -- NULL = unlimited
  use_count int DEFAULT 0,
  expires_at timestamptz DEFAULT NULL,  -- NULL = never expires
  created_at timestamptz DEFAULT now()
);

-- RLS: team admins/owners can create, anyone with the code can read
ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;
```

### `channels`
```sql
CREATE TABLE channels (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  created_by uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Default channel "#general" created when team is created
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
```

### `channel_clips`
```sql
CREATE TABLE channel_clips (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id uuid REFERENCES channels(id) ON DELETE CASCADE NOT NULL,
  clip_id uuid REFERENCES clips(id) ON DELETE CASCADE NOT NULL,
  sent_by uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE channel_clips ENABLE ROW LEVEL SECURITY;
```

### `direct_clips`
```sql
CREATE TABLE direct_clips (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES profiles(id) NOT NULL,
  receiver_id uuid REFERENCES profiles(id) NOT NULL,
  clip_id uuid REFERENCES clips(id) ON DELETE CASCADE NOT NULL,
  read_at timestamptz DEFAULT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE direct_clips ENABLE ROW LEVEL SECURITY;
```

### `groups` (for @group mentions)
```sql
CREATE TABLE groups (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,  -- e.g. "design", "engineering", "marketing"
  created_by uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
```

### `group_members`
```sql
CREATE TABLE group_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  UNIQUE(group_id, user_id)
);

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
```

### `clip_mentions`
```sql
CREATE TABLE clip_mentions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clip_id uuid REFERENCES clips(id) ON DELETE CASCADE NOT NULL,
  channel_clip_id uuid REFERENCES channel_clips(id) ON DELETE CASCADE,
  direct_clip_id uuid REFERENCES direct_clips(id) ON DELETE CASCADE,
  mentioned_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  mentioned_group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  read_at timestamptz DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  CHECK (mentioned_user_id IS NOT NULL OR mentioned_group_id IS NOT NULL)
);

ALTER TABLE clip_mentions ENABLE ROW LEVEL SECURITY;
```

### `collections`
```sql
CREATE TABLE collections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  created_by uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
```

### `collection_clips`
```sql
CREATE TABLE collection_clips (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  collection_id uuid REFERENCES collections(id) ON DELETE CASCADE NOT NULL,
  clip_id uuid REFERENCES clips(id) ON DELETE CASCADE NOT NULL,
  added_by uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE collection_clips ENABLE ROW LEVEL SECURITY;
```

## RLS Policies Summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| teams | Members of team | Any authenticated user | Owner only | Owner only |
| team_members | Members of same team | Via invite acceptance (edge function) | Owner/admin (role changes) | Owner/admin (remove member) |
| team_invites | Anyone with code (for joining) | Owner/admin | Owner/admin | Owner/admin |
| channels | Members of team | Owner/admin | Owner/admin | Owner/admin |
| channel_clips | Members of team | Members of team | — | Sender or admin |
| direct_clips | Sender or receiver | Any team member | Receiver (read_at) | Sender |
| groups | Members of team | Owner/admin | Owner/admin | Owner/admin |
| group_members | Members of team | Owner/admin | — | Owner/admin |
| clip_mentions | Mentioned user | Any team member | Mentioned user (read_at) | — |
| collections | Members of team | Owner/admin | Owner/admin | Owner/admin |
| collection_clips | Members of team | Members of team | — | Added_by or admin |

## Build Phases

### Phase A: Database + Team CRUD
1. Migration: create all tables above
2. RLS policies
3. Edge function: `accept-invite` — validates invite code, adds user to team
4. Supabase helpers: createTeam, getTeam, getTeamMembers, generateInviteLink, acceptInvite, removeMember, updateMemberRole
5. Auto-create `#general` channel on team creation (database trigger)

### Phase B: Admin Portal MVP
1. Scaffold React + Vite app in `portal/` directory
2. Vercel config for `portal.snipsync.xyz`
3. Google sign-in (same Supabase auth)
4. Dashboard: team name, member list with roles
5. Invite management: generate link, view active invites, revoke
6. Member management: change role, remove from team
7. Team settings: rename, delete team

### Phase C: Channels in Desktop App
1. Channel list in app (sidebar or tab view)
2. Create/delete channels (admin/owner)
3. Post clip to a channel (select channel when sending)
4. Realtime subscription per channel
5. Channel switching — subscribe to active channel only
6. `#general` shown by default

### Phase D: @Mentions + Direct Send
1. `@` autocomplete in clip input — shows team members + groups
2. Parse mentions from clip content before saving
3. Create clip_mentions records
4. "Mentions" filter — "Clips that mention me"
5. Unread badge count for mentions
6. Direct send: "Send to @vincent" — creates direct_clip
7. Direct messages view in app

### Phase E: Collections
1. Create/manage collections (admin portal + desktop app)
2. Add clips to collections
3. Browse collections in desktop app
4. Pinned/persistent shared clips

### Phase F: Team Billing
1. Lemon Squeezy product for Team tier ($8.99/seat/mo)
2. Seat management in portal (add/remove seats)
3. Webhook: `team_subscription_created`, `team_subscription_updated`
4. Edge function: validate team subscription, enforce seat limits
5. Grace period on seat removal (end of billing cycle)

## Portal Structure

```
portal/
  package.json
  vite.config.mjs
  vercel.json
  index.html
  src/
    lib/
      supabase.js        # Same Supabase client + team helpers
      config.js           # Supabase URL + anon key
    components/
      TeamDashboard.jsx   # Overview: name, member count, plan
      MemberList.jsx      # List with role badges, remove/promote actions
      InviteManager.jsx   # Generate link, active invites, revoke
      ChannelManager.jsx  # Phase C: manage channels
      GroupManager.jsx    # Phase D: manage groups
      BillingView.jsx     # Phase F: seats, subscription status
      Sidebar.jsx         # Nav: Dashboard, Members, Channels, Groups, Billing
    pages/
      SignIn.jsx
      Dashboard.jsx
      Settings.jsx
    App.jsx
    main.jsx
    styles.css
```

## @Mentions UX

### In the clip input
```
Type: @vi|
        ┌──────────────────┐
        │ 👤 Vincent Jacobs │
        │ 👤 Victoria Smith │
        │ 👥 @design        │
        │ 👥 @engineering   │
        └──────────────────┘
```

### In a clip card
```
┌─────────────────────────────────────────┐
│ link · just now · MacBook Pro           │
│                                         │
│ https://figma.com/file/abc/Dashboard-v2 │
│ @vincent @design check this mockup      │
│                                         │
│ [Copy] [Pin] [Open ↗]                   │
│ 📢 → #design                            │
└─────────────────────────────────────────┘
```

### Mentions are highlighted in green, clickable (filters to that user's clips)

## Invite Flow

1. Owner opens portal → Members → "Create invite link"
2. Chooses role (member or admin) and optional expiry/max uses
3. Gets link: `https://snipsync.xyz/join/abc123def456`
4. Shares link via Slack, email, whatever
5. Recipient clicks link → signs in with Google → auto-joins team
6. Their subscription upgrades to Team tier (owner pays for the seat)

## Subscription Logic

- When a user joins a team, their personal subscription is paused (they're covered by the team plan)
- If they leave the team, their personal subscription resumes (or they fall back to free)
- Team owner sees total seats used in portal
- Lemon Squeezy charges per seat: `seat_count * $8.99/mo`
- Owner can set a max seat limit to control costs
