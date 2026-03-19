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

export const deleteAccount = async (userId) => {
  // Record deletion + delete profile + delete auth user via edge function (service role)
  const { data: userData } = await supabase.auth.getUser()
  const email = userData?.user?.email
  const { data: devicesData } = await supabase.from('devices').select('machine_id').eq('user_id', userId)
  const machineIds = (devicesData || []).map((d) => d.machine_id).filter(Boolean)

  await supabase.functions.invoke('record-deletion', {
    body: { user_id: userId, email, machine_ids: machineIds },
  })

  await supabase.auth.signOut()
}

export const sendEmail = async (to, template) => {
  try {
    await supabase.functions.invoke('send-email', {
      body: { to, template },
    })
  } catch {
    // Non-blocking
  }
}

export const checkDeletedAccount = async (email) => {
  try {
    const { data } = await supabase.functions.invoke('check-deleted', {
      body: { email },
    })
    return data?.was_deleted || false
  } catch {
    return false
  }
}

export const getUser = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export const ensureProfile = async (user) => {
  if (!user) return false
  const { data } = await supabase.from('profiles').select('id').eq('id', user.id).single()
  if (!data) {
    await supabase.from('profiles').insert({
      id: user.id,
      email: user.email,
      display_name: user.user_metadata?.full_name || null,
      avatar_url: user.user_metadata?.avatar_url || null,
    })
    return true // new profile created
  }
  return false // existing profile
}

export const findDeviceByMachineId = async (userId, machineId) => {
  if (!machineId) return null
  const { data } = await supabase
    .from('devices')
    .select('*')
    .eq('user_id', userId)
    .eq('machine_id', machineId)
    .single()
  return data
}

export const registerDevice = (userId, name, platform, machineId) =>
  supabase.from('devices').insert({ user_id: userId, name, platform, machine_id: machineId }).select().single()

export const updateDeviceName = (deviceId, name) =>
  supabase.from('devices').update({ name, last_seen_at: new Date().toISOString() }).eq('id', deviceId)

export const findDeviceByName = async (userId, name, platform) => {
  const { data } = await supabase
    .from('devices')
    .select('*')
    .eq('user_id', userId)
    .eq('name', name)
    .eq('platform', platform)
    .is('machine_id', null)
    .limit(1)
    .single()
  return data
}

export const backfillMachineId = (deviceId, machineId) =>
  supabase.from('devices').update({ machine_id: machineId, last_seen_at: new Date().toISOString() }).eq('id', deviceId)

export const getDevices = (userId) =>
  supabase.from('devices').select('*').eq('user_id', userId).order('last_seen_at', { ascending: false })

export const updateDeviceLastSeen = (deviceId) =>
  supabase.from('devices').update({ last_seen_at: new Date().toISOString() }).eq('id', deviceId)

export const getClips = (userId, limit = 50) =>
  supabase.from('clips')
    .select('*, devices(name, platform), clip_tags(tag_id, tags(id, name, color))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

const MAX_CLIP_LENGTH = 10000

export const addClip = (userId, deviceId, content, type) => {
  if (content.length > MAX_CLIP_LENGTH) {
    return { data: null, error: { message: `Clip too long (max ${MAX_CLIP_LENGTH} characters)` } }
  }
  return supabase.from('clips').insert({ user_id: userId, device_id: deviceId, content, type }).select('*, devices(name, platform), clip_tags(tag_id, tags(id, name, color))').single()
}

export const deleteClip = (id) =>
  supabase.from('clips').delete().eq('id', id)

export const togglePinClip = (id, pinned) =>
  supabase.from('clips').update({ pinned }).eq('id', id).select('*, devices(name, platform), clip_tags(tag_id, tags(id, name, color))').single()

export const checkDeviceExists = async (deviceId) => {
  const { data } = await supabase.from('devices').select('id').eq('id', deviceId).single()
  return !!data
}

// ── Subscription / plan helpers ──────────────────────

export const PLAN_LIMITS = {
  free: { maxClipsPerMonth: 30, maxDevices: 2, historyDays: 7, maxImageSize: 2 * 1024 * 1024, maxFileSize: 0 },
  pro:  { maxClipsPerMonth: Infinity, maxDevices: Infinity, historyDays: Infinity, maxImageSize: 10 * 1024 * 1024, maxFileSize: 25 * 1024 * 1024 },
}

export const getSubscription = async (userId) => {
  const { data } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single()
  return data
}

export const getMonthlyClipCount = async (userId) => {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  const { count } = await supabase
    .from('clips')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', startOfMonth.toISOString())
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

export const uploadClipImage = async (userId, file) => {
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
    .createSignedUrl(imagePath, 900)
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
  }).select('*, devices(name, platform), clip_tags(tag_id, tags(id, name, color))').single()
}

export const deleteClipImage = async (imagePath) => {
  await supabase.storage.from('clip-images').remove([imagePath])
}

// ── File clip helpers ────────────────────────────────

export const uploadClipFile = async (userId, file) => {
  // Sanitize filename: remove path separators and special characters, limit length
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)
  const path = `${userId}/${Date.now()}-${safeName}`
  const { data, error } = await supabase.storage
    .from('clip-files')
    .upload(path, file, { contentType: file.type, upsert: false })
  if (error) return { data: null, error }
  return { data: { path: data.path }, error: null }
}

export const getFileUrl = async (filePath) => {
  const { data } = await supabase.storage
    .from('clip-files')
    .createSignedUrl(filePath, 900)
  return data?.signedUrl || ''
}

export const addFileClip = async (userId, deviceId, filePath, fileName, fileSize) => {
  return supabase.from('clips').insert({
    user_id: userId,
    device_id: deviceId,
    content: fileName,
    type: 'file',
    image_path: filePath,
    image_size: fileSize,
  }).select('*, devices(name, platform), clip_tags(tag_id, tags(id, name, color))').single()
}

export const deleteClipFile = async (filePath) => {
  await supabase.storage.from('clip-files').remove([filePath])
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
