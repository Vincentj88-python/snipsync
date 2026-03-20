-- ============================================
-- SnipSync Teams — Database Migration
-- ============================================

-- ── Teams ────────────────────────────────────

CREATE TABLE teams (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  owner_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  avatar_url text,
  max_seats int DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- Members of a team can read it
CREATE POLICY "Team members can view their team"
  ON teams FOR SELECT
  USING (id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));

-- Any authenticated user can create a team
CREATE POLICY "Authenticated users can create teams"
  ON teams FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- Only owner can update
CREATE POLICY "Owner can update team"
  ON teams FOR UPDATE
  USING (owner_id = auth.uid());

-- Only owner can delete
CREATE POLICY "Owner can delete team"
  ON teams FOR DELETE
  USING (owner_id = auth.uid());

-- ── Team Members ─────────────────────────────

CREATE TABLE team_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at timestamptz DEFAULT now(),
  UNIQUE(team_id, user_id)
);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Members can see other members of their team
CREATE POLICY "Team members can view members"
  ON team_members FOR SELECT
  USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));

-- Owner/admin can update roles
CREATE POLICY "Owner/admin can update member roles"
  ON team_members FOR UPDATE
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Owner/admin can remove members
CREATE POLICY "Owner/admin can remove members"
  ON team_members FOR DELETE
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Insert handled by accept-invite edge function (service role)
-- and by create-team trigger (auto-adds owner)

-- ── Team Invites ─────────────────────────────

CREATE TABLE team_invites (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  invite_code text UNIQUE NOT NULL,
  created_by uuid REFERENCES profiles(id) NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  max_uses int DEFAULT NULL,
  use_count int DEFAULT 0,
  expires_at timestamptz DEFAULT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;

-- Anyone can read an invite by code (for joining)
CREATE POLICY "Anyone can read invite by code"
  ON team_invites FOR SELECT
  USING (true);

-- Owner/admin can create invites
CREATE POLICY "Owner/admin can create invites"
  ON team_invites FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Owner/admin can update invites
CREATE POLICY "Owner/admin can update invites"
  ON team_invites FOR UPDATE
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Owner/admin can delete invites
CREATE POLICY "Owner/admin can delete invites"
  ON team_invites FOR DELETE
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ── Channels ─────────────────────────────────

CREATE TABLE channels (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  created_by uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view channels"
  ON channels FOR SELECT
  USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));

CREATE POLICY "Owner/admin can create channels"
  ON channels FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Owner/admin can update channels"
  ON channels FOR UPDATE
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Owner/admin can delete channels"
  ON channels FOR DELETE
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ── Channel Clips ────────────────────────────

CREATE TABLE channel_clips (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id uuid REFERENCES channels(id) ON DELETE CASCADE NOT NULL,
  clip_id uuid REFERENCES clips(id) ON DELETE CASCADE NOT NULL,
  sent_by uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE channel_clips ENABLE ROW LEVEL SECURITY;

-- Team members can view clips in their channels
CREATE POLICY "Team members can view channel clips"
  ON channel_clips FOR SELECT
  USING (
    channel_id IN (
      SELECT c.id FROM channels c
      JOIN team_members tm ON tm.team_id = c.team_id
      WHERE tm.user_id = auth.uid()
    )
  );

-- Team members can post clips to channels
CREATE POLICY "Team members can post to channels"
  ON channel_clips FOR INSERT
  WITH CHECK (
    sent_by = auth.uid()
    AND channel_id IN (
      SELECT c.id FROM channels c
      JOIN team_members tm ON tm.team_id = c.team_id
      WHERE tm.user_id = auth.uid()
    )
  );

-- Sender or admin can delete
CREATE POLICY "Sender or admin can delete channel clips"
  ON channel_clips FOR DELETE
  USING (
    sent_by = auth.uid()
    OR channel_id IN (
      SELECT c.id FROM channels c
      JOIN team_members tm ON tm.team_id = c.team_id
      WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
  );

-- ── Direct Clips ─────────────────────────────

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

-- Sender or receiver can view
CREATE POLICY "Sender or receiver can view direct clips"
  ON direct_clips FOR SELECT
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- Team members can send direct clips
CREATE POLICY "Team members can send direct clips"
  ON direct_clips FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    AND receiver_id IN (SELECT user_id FROM team_members WHERE team_id = direct_clips.team_id)
  );

-- Receiver can mark as read
CREATE POLICY "Receiver can update direct clips"
  ON direct_clips FOR UPDATE
  USING (receiver_id = auth.uid());

-- Sender can delete
CREATE POLICY "Sender can delete direct clips"
  ON direct_clips FOR DELETE
  USING (sender_id = auth.uid());

-- ── Groups (@mention groups) ─────────────────

CREATE TABLE groups (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  created_by uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view groups"
  ON groups FOR SELECT
  USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));

CREATE POLICY "Owner/admin can manage groups"
  ON groups FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Owner/admin can update groups"
  ON groups FOR UPDATE
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Owner/admin can delete groups"
  ON groups FOR DELETE
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ── Group Members ────────────────────────────

CREATE TABLE group_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  UNIQUE(group_id, user_id)
);

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view group members"
  ON group_members FOR SELECT
  USING (
    group_id IN (
      SELECT g.id FROM groups g
      JOIN team_members tm ON tm.team_id = g.team_id
      WHERE tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Owner/admin can manage group members"
  ON group_members FOR INSERT
  WITH CHECK (
    group_id IN (
      SELECT g.id FROM groups g
      JOIN team_members tm ON tm.team_id = g.team_id
      WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Owner/admin can remove group members"
  ON group_members FOR DELETE
  USING (
    group_id IN (
      SELECT g.id FROM groups g
      JOIN team_members tm ON tm.team_id = g.team_id
      WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
  );

-- ── Clip Mentions ────────────────────────────

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

-- Users can see mentions that reference them (directly or via group)
CREATE POLICY "Users can view their mentions"
  ON clip_mentions FOR SELECT
  USING (
    mentioned_user_id = auth.uid()
    OR mentioned_group_id IN (
      SELECT group_id FROM group_members WHERE user_id = auth.uid()
    )
  );

-- Team members can create mentions
CREATE POLICY "Team members can create mentions"
  ON clip_mentions FOR INSERT
  WITH CHECK (true);  -- Validated at application level

-- Mentioned user can mark as read
CREATE POLICY "Mentioned user can update read status"
  ON clip_mentions FOR UPDATE
  USING (
    mentioned_user_id = auth.uid()
    OR mentioned_group_id IN (
      SELECT group_id FROM group_members WHERE user_id = auth.uid()
    )
  );

-- ── Collections ──────────────────────────────

CREATE TABLE collections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  created_by uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view collections"
  ON collections FOR SELECT
  USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));

CREATE POLICY "Owner/admin can manage collections"
  ON collections FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Owner/admin can update collections"
  ON collections FOR UPDATE
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Owner/admin can delete collections"
  ON collections FOR DELETE
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ── Collection Clips ─────────────────────────

CREATE TABLE collection_clips (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  collection_id uuid REFERENCES collections(id) ON DELETE CASCADE NOT NULL,
  clip_id uuid REFERENCES clips(id) ON DELETE CASCADE NOT NULL,
  added_by uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE collection_clips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view collection clips"
  ON collection_clips FOR SELECT
  USING (
    collection_id IN (
      SELECT co.id FROM collections co
      JOIN team_members tm ON tm.team_id = co.team_id
      WHERE tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can add to collections"
  ON collection_clips FOR INSERT
  WITH CHECK (
    added_by = auth.uid()
    AND collection_id IN (
      SELECT co.id FROM collections co
      JOIN team_members tm ON tm.team_id = co.team_id
      WHERE tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Adder or admin can remove from collections"
  ON collection_clips FOR DELETE
  USING (
    added_by = auth.uid()
    OR collection_id IN (
      SELECT co.id FROM collections co
      JOIN team_members tm ON tm.team_id = co.team_id
      WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
  );

-- ── Triggers ─────────────────────────────────

-- Auto-add owner as team member when team is created
CREATE OR REPLACE FUNCTION add_owner_to_team()
RETURNS trigger AS $$
BEGIN
  INSERT INTO team_members (team_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_team_created
  AFTER INSERT ON teams
  FOR EACH ROW
  EXECUTE FUNCTION add_owner_to_team();

-- Auto-create #general channel when team is created
CREATE OR REPLACE FUNCTION create_default_channel()
RETURNS trigger AS $$
BEGIN
  INSERT INTO channels (team_id, name, description, created_by)
  VALUES (NEW.id, 'general', 'General team channel', NEW.owner_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_team_created_channel
  AFTER INSERT ON teams
  FOR EACH ROW
  EXECUTE FUNCTION create_default_channel();

-- Update teams.updated_at on changes
CREATE OR REPLACE FUNCTION update_team_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_team_updated
  BEFORE UPDATE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION update_team_timestamp();

-- Enable REPLICA IDENTITY FULL for realtime on channel_clips and direct_clips
ALTER TABLE channel_clips REPLICA IDENTITY FULL;
ALTER TABLE direct_clips REPLICA IDENTITY FULL;
ALTER TABLE clip_mentions REPLICA IDENTITY FULL;
