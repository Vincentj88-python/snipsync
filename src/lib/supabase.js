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

export const checkDeviceExists = async (deviceId) => {
  const { data } = await supabase.from('devices').select('id').eq('id', deviceId).single()
  return !!data
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
