import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

export const signInWithGoogle = async () => {
  if (window.electronAPI) {
    // Build OAuth URL manually for Electron — redirect to local callback server
    const redirectTo = 'http://localhost:54321/callback'
    const url = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`
    await window.electronAPI.startOAuth(url)
  } else {
    // Browser fallback
    await supabase.auth.signInWithOAuth({ provider: 'google' })
  }
}

export const signOut = () => supabase.auth.signOut()

export const getUser = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export const registerDevice = (userId, name, platform) =>
  supabase.from('devices').insert({ user_id: userId, name, platform }).select().single()

export const getDevices = (userId) =>
  supabase.from('devices').select('*').eq('user_id', userId).order('last_seen_at', { ascending: false })

export const updateDeviceLastSeen = (deviceId) =>
  supabase.from('devices').update({ last_seen_at: new Date().toISOString() }).eq('id', deviceId)

export const getClips = (userId, limit = 50) =>
  supabase.from('clips')
    .select('*, devices(name, platform)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

const MAX_CLIP_LENGTH = 10000

export const addClip = (userId, deviceId, content, type) => {
  if (content.length > MAX_CLIP_LENGTH) {
    return { data: null, error: { message: `Clip too long (max ${MAX_CLIP_LENGTH} characters)` } }
  }
  return supabase.from('clips').insert({ user_id: userId, device_id: deviceId, content, type }).select('*, devices(name, platform)').single()
}

export const deleteClip = (id) =>
  supabase.from('clips').delete().eq('id', id)

export const togglePinClip = (id, pinned) =>
  supabase.from('clips').update({ pinned }).eq('id', id).select('*, devices(name, platform)').single()

export const checkDeviceExists = async (deviceId) => {
  const { data } = await supabase.from('devices').select('id').eq('id', deviceId).single()
  return !!data
}

// ── Subscription / plan helpers ──────────────────────

export const PLAN_LIMITS = {
  free: { maxClips: 50, maxDevices: 2, historyDays: 7 },
  pro:  { maxClips: Infinity, maxDevices: Infinity, historyDays: Infinity },
}

export const getSubscription = async (userId) => {
  const { data } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single()
  return data
}

export const getClipCount = async (userId) => {
  const { count } = await supabase
    .from('clips')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
  return count || 0
}

export const getDeviceCount = async (userId) => {
  const { count } = await supabase
    .from('devices')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
  return count || 0
}

export const subscribeToClips = (userId, onInsert, onDelete) => {
  const channel = supabase.channel(`clips:${userId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'clips', filter: `user_id=eq.${userId}` },
      (payload) => onInsert?.(payload.new))
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'clips', filter: `user_id=eq.${userId}` },
      (payload) => onDelete?.(payload.old.id))
    .subscribe()
  return () => supabase.removeChannel(channel)
}

// ── Image clip helpers ──────────────────────────────

const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB

export const uploadClipImage = async (userId, file) => {
  if (file.size > MAX_IMAGE_SIZE) {
    return { data: null, error: { message: 'Image too large (max 5MB)' } }
  }
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/gif' ? 'gif' : 'jpg'
  const path = `${userId}/${Date.now()}.${ext}`
  const { data, error } = await supabase.storage
    .from('clip-images')
    .upload(path, file, { contentType: file.type, upsert: false })
  if (error) return { data: null, error }
  return { data: { path: data.path }, error: null }
}

export const getImageUrl = async (imagePath) => {
  const { data } = await supabase.storage
    .from('clip-images')
    .createSignedUrl(imagePath, 3600)
  return data?.signedUrl || ''
}

export const addImageClip = async (userId, deviceId, imagePath, imageSize) => {
  return supabase.from('clips').insert({
    user_id: userId,
    device_id: deviceId,
    content: '[image]',
    type: 'image',
    image_path: imagePath,
    image_size: imageSize,
  }).select('*, devices(name, platform)').single()
}

export const deleteClipImage = async (imagePath) => {
  await supabase.storage.from('clip-images').remove([imagePath])
}

// ── Tag helpers ──────────────────────────────────────

export const getTags = (userId) =>
  supabase.from('tags').select('*').eq('user_id', userId).order('name')

export const createTag = (userId, name, color = '#22c55e') =>
  supabase.from('tags').insert({ user_id: userId, name, color }).select().single()

export const deleteTag = (id) =>
  supabase.from('tags').delete().eq('id', id)

export const addTagToClip = (clipId, tagId) =>
  supabase.from('clip_tags').insert({ clip_id: clipId, tag_id: tagId })

export const removeTagFromClip = (clipId, tagId) =>
  supabase.from('clip_tags').delete().eq('clip_id', clipId).eq('tag_id', tagId)

export const getClipTags = (clipId) =>
  supabase.from('clip_tags').select('tag_id, tags(*)').eq('clip_id', clipId)
