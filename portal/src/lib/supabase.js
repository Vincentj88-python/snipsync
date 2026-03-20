import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ── Auth ─────────────────────────────────────

export const signInWithGoogle = () =>
  supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })

export const signOut = () => supabase.auth.signOut()

// ── Teams ────────────────────────────────────

export const createTeam = async (name, ownerId) => {
  return supabase.from('teams').insert({ name, owner_id: ownerId }).select().single()
}

export const getMyTeams = async (userId) => {
  const { data } = await supabase
    .from('team_members')
    .select('team_id, role, teams(id, name, owner_id, avatar_url, max_seats, created_at)')
    .eq('user_id', userId)
  return data || []
}

export const getTeam = async (teamId) => {
  const { data } = await supabase.from('teams').select('*').eq('id', teamId).single()
  return data
}

export const updateTeam = async (teamId, updates) => {
  return supabase.from('teams').update(updates).eq('id', teamId)
}

export const deleteTeam = async (teamId) => {
  return supabase.from('teams').delete().eq('id', teamId)
}

// ── Members ──────────────────────────────────

export const getTeamMembers = async (teamId) => {
  const { data } = await supabase
    .from('team_members')
    .select('*, profiles(id, email, display_name, avatar_url)')
    .eq('team_id', teamId)
    .order('joined_at')
  return data || []
}

export const updateMemberRole = async (memberId, role) => {
  return supabase.from('team_members').update({ role }).eq('id', memberId)
}

export const removeMember = async (memberId) => {
  return supabase.from('team_members').delete().eq('id', memberId)
}

export const getMemberCount = async (teamId) => {
  const { count } = await supabase
    .from('team_members')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', teamId)
  return count || 0
}

// ── Invites ──────────────────────────────────

export const createInvite = async (teamId, createdBy, role = 'member', maxUses = null, expiresAt = null) => {
  const code = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  return supabase.from('team_invites').insert({
    team_id: teamId,
    invite_code: code,
    created_by: createdBy,
    role,
    max_uses: maxUses,
    expires_at: expiresAt,
  }).select().single()
}

export const getTeamInvites = async (teamId) => {
  const { data } = await supabase
    .from('team_invites')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })
  return data || []
}

export const deleteInvite = async (inviteId) => {
  return supabase.from('team_invites').delete().eq('id', inviteId)
}

// ── Channels ─────────────────────────────────

export const getChannels = async (teamId) => {
  const { data } = await supabase
    .from('channels')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at')
  return data || []
}

export const createChannel = async (teamId, name, description, createdBy) => {
  return supabase.from('channels').insert({ team_id: teamId, name, description, created_by: createdBy }).select().single()
}

export const deleteChannel = async (channelId) => {
  return supabase.from('channels').delete().eq('id', channelId)
}

// ── Groups ───────────────────────────────────

export const getGroups = async (teamId) => {
  const { data } = await supabase
    .from('groups')
    .select('*, group_members(user_id, profiles(id, email, display_name))')
    .eq('team_id', teamId)
    .order('created_at')
  return data || []
}

export const createGroup = async (teamId, name, createdBy) => {
  return supabase.from('groups').insert({ team_id: teamId, name, created_by: createdBy }).select().single()
}

export const deleteGroup = async (groupId) => {
  return supabase.from('groups').delete().eq('id', groupId)
}

export const addGroupMember = async (groupId, userId) => {
  return supabase.from('group_members').insert({ group_id: groupId, user_id: userId })
}

export const removeGroupMember = async (groupId, userId) => {
  return supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId)
}
