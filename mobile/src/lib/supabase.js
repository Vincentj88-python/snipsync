import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

// Auth — mobile uses signInWithIdToken (called from SignInScreen)
export const signOut = () => supabase.auth.signOut()

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
    return true
  }
  return false
}

// Device helpers
export const findDeviceByMachineId = async (userId, machineId) => {
  if (!machineId) return null
  const { data } = await supabase
    .from('devices').select('*')
    .eq('user_id', userId).eq('machine_id', machineId).single()
  return data
}

export const registerDevice = (userId, name, platform, machineId) =>
  supabase.from('devices').insert({ user_id: userId, name, platform, machine_id: machineId }).select().single()

export const updateDeviceName = (deviceId, name) =>
  supabase.from('devices').update({ name, last_seen_at: new Date().toISOString() }).eq('id', deviceId)

export const getDevices = (userId) =>
  supabase.from('devices').select('*').eq('user_id', userId).order('last_seen_at', { ascending: false })

export const updateDeviceLastSeen = (deviceId) =>
  supabase.from('devices').update({ last_seen_at: new Date().toISOString() }).eq('id', deviceId)

export const checkDeviceExists = async (deviceId) => {
  const { data } = await supabase.from('devices').select('id').eq('id', deviceId).single()
  return !!data
}

// Clip helpers
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
  return supabase.from('clips').insert({ user_id: userId, device_id: deviceId, content, type })
    .select('*, devices(name, platform), clip_tags(tag_id, tags(id, name, color))').single()
}

export const deleteClip = (id) => supabase.from('clips').delete().eq('id', id)

export const togglePinClip = (id, pinned) =>
  supabase.from('clips').update({ pinned }).eq('id', id)
    .select('*, devices(name, platform), clip_tags(tag_id, tags(id, name, color))').single()

// Subscription helpers
export const PLAN_LIMITS = {
  free: { maxClipsPerMonth: Infinity, maxDevices: 2, historyDays: 7, maxImageSize: 0, maxFileSize: 0 },
  pro:  { maxClipsPerMonth: Infinity, maxDevices: Infinity, historyDays: Infinity, maxImageSize: 10 * 1024 * 1024, maxFileSize: 25 * 1024 * 1024 },
}

export const getSubscription = async (userId) => {
  const { data } = await supabase.from('subscriptions').select('*').eq('user_id', userId).single()
  return data
}

export const getMonthlyClipCount = async (userId) => {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  const { count } = await supabase.from('clips')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId).gte('created_at', startOfMonth.toISOString())
  return count || 0
}

export const getDeviceCount = async (userId) => {
  const { count } = await supabase.from('devices')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
  return count || 0
}

// Realtime
export const subscribeToClips = (userId, onInsert, onDelete) => {
  const channel = supabase.channel(`clips:${userId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'clips', filter: `user_id=eq.${userId}` },
      (payload) => onInsert?.(payload.new))
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'clips', filter: `user_id=eq.${userId}` },
      (payload) => onDelete?.(payload.old.id))
    .subscribe()
  return () => supabase.removeChannel(channel)
}

// Image helpers
export const getImageUrl = async (imagePath) => {
  const { data } = await supabase.storage.from('clip-images').createSignedUrl(imagePath, 900)
  return data?.signedUrl || ''
}

// File helpers
export const getFileUrl = async (filePath) => {
  const { data } = await supabase.storage.from('clip-files').createSignedUrl(filePath, 900)
  return data?.signedUrl || ''
}
