// Supabase client for the browser extension
// Uses the REST API directly — no npm dependencies needed
;(function() {

const SUPABASE_URL = 'https://kohwpkwcopkslbtkczag.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvaHdwa3djb3Brc2xidGtjemFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzkyNTAsImV4cCI6MjA4ODcxNTI1MH0.PrsQDtXSa8Y8vy-JgIfBk3l0iVtmedHPqr72fzhwd7k'

const PLAN_LIMITS = {
  free: { maxClips: 30, maxDevices: 2 },
  pro: { maxClips: Infinity, maxDevices: Infinity },
}

// ── Session management ──────────────────────────────

async function getSession() {
  const result = await chrome.storage.local.get(['sb_access_token', 'sb_refresh_token', 'sb_user'])
  return result.sb_access_token ? result : null
}

async function saveSession(accessToken, refreshToken, user) {
  await chrome.storage.local.set({
    sb_access_token: accessToken,
    sb_refresh_token: refreshToken,
    sb_user: user,
  })
}

async function clearSession() {
  await chrome.storage.local.remove(['sb_access_token', 'sb_refresh_token', 'sb_user'])
}

// ── API helpers ─────────────────────────────────────

async function apiRequest(path, options = {}) {
  const session = await getSession()
  const token = session?.sb_access_token || SUPABASE_ANON_KEY

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': options.prefer || 'return=representation',
      ...options.headers,
    },
    method: options.method || 'GET',
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `API error ${res.status}`)
  }

  const text = await res.text()
  return text ? JSON.parse(text) : null
}

// ── Auth ────────────────────────────────────────────

async function signInWithGoogle() {
  const redirectUrl = chrome.identity.getRedirectURL()

  // Build Supabase OAuth URL with the extension's redirect
  const authUrl = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectUrl)}`

  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: authUrl, interactive: true },
      async (responseUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }

        if (!responseUrl) {
          reject(new Error('No response URL'))
          return
        }

        try {
          // Tokens can be in the hash fragment or query params
          const url = new URL(responseUrl)
          let accessToken, refreshToken

          // Try hash first (Supabase implicit grant)
          const hash = url.hash.substring(1)
          if (hash) {
            const hashParams = new URLSearchParams(hash)
            accessToken = hashParams.get('access_token')
            refreshToken = hashParams.get('refresh_token')
          }

          // Fall back to query params
          if (!accessToken) {
            accessToken = url.searchParams.get('access_token')
            refreshToken = url.searchParams.get('refresh_token')
          }

          if (!accessToken) {
            reject(new Error('Sign in failed — no token received. Make sure the extension redirect URL is added to Supabase.'))
            return
          }

          // Get user info
          const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${accessToken}`,
            },
          })
          const user = await userRes.json()

          await saveSession(accessToken, refreshToken, user)
          resolve(user)
        } catch (err) {
          reject(err)
        }
      }
    )
  })
}

async function signOut() {
  const session = await getSession()
  if (session?.sb_access_token) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${session.sb_access_token}`,
      },
    }).catch(() => {})
  }
  await clearSession()
}

async function getUser() {
  const session = await getSession()
  return session?.sb_user || null
}

// ── Clips ───────────────────────────────────────────

async function getClips(userId, limit = 30) {
  return apiRequest(
    `clips?user_id=eq.${userId}&select=*,devices(name,platform),clip_tags(tag_id,tags(id,name,color))&order=created_at.desc&limit=${limit}`
  )
}

async function addClip(userId, deviceId, content, type) {
  if (content.length > 10000) {
    throw new Error('Clip too long (max 10,000 characters)')
  }
  const result = await apiRequest('clips?select=*,devices(name,platform)', {
    method: 'POST',
    body: { user_id: userId, device_id: deviceId, content, type },
  })
  return Array.isArray(result) ? result[0] : result
}

async function deleteClip(id) {
  await apiRequest(`clips?id=eq.${id}`, {
    method: 'DELETE',
    prefer: 'return=minimal',
  })
}

async function togglePinClip(id, pinned) {
  const result = await apiRequest(
    `clips?id=eq.${id}&select=*,devices(name,platform)`,
    { method: 'PATCH', body: { pinned } }
  )
  return Array.isArray(result) ? result[0] : result
}

// ── Devices ─────────────────────────────────────────

async function getDevices(userId) {
  return apiRequest(`devices?user_id=eq.${userId}&order=last_seen_at.desc`)
}

async function findDeviceByMachineId(userId, machineId) {
  const result = await apiRequest(
    `devices?user_id=eq.${userId}&machine_id=eq.${machineId}&limit=1`
  )
  return result?.[0] || null
}

async function registerDevice(userId, name, platform, machineId) {
  const result = await apiRequest('devices?select=*', {
    method: 'POST',
    body: { user_id: userId, name, platform, machine_id: machineId },
  })
  return Array.isArray(result) ? result[0] : result
}

async function updateDeviceLastSeen(deviceId) {
  await apiRequest(`devices?id=eq.${deviceId}`, {
    method: 'PATCH',
    body: { last_seen_at: new Date().toISOString() },
    prefer: 'return=minimal',
  })
}

// ── Subscription ────────────────────────────────────

async function getSubscription(userId) {
  const result = await apiRequest(
    `subscriptions?user_id=eq.${userId}&limit=1`
  )
  return result?.[0] || null
}

async function getClipCount(userId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/clips?user_id=eq.${userId}&select=id`,
    {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${(await getSession())?.sb_access_token}`,
        'Prefer': 'count=exact',
        'Range-Unit': 'items',
        'Range': '0-0',
      },
    }
  )
  const range = res.headers.get('content-range')
  return range ? parseInt(range.split('/')[1]) || 0 : 0
}

async function getDeviceCount(userId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/devices?user_id=eq.${userId}&select=id`,
    {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${(await getSession())?.sb_access_token}`,
        'Prefer': 'count=exact',
        'Range-Unit': 'items',
        'Range': '0-0',
      },
    }
  )
  const range = res.headers.get('content-range')
  return range ? parseInt(range.split('/')[1]) || 0 : 0
}

// ── Type detection (same as desktop) ────────────────

function detectType(text) {
  if (/^(https?:\/\/|www\.)\S+/i.test(text)) return 'link'
  if (/\d{1,5}\s+\w+.*(?:street|st|ave|avenue|rd|road|blvd|drive|dr|lane|ln)/i.test(text)) return 'address'
  if (/^[\s\S]*[{}\[\]();=><][\s\S]*$/.test(text) && text.length < 300) return 'code'
  return 'note'
}

// Export everything
window.SnipSync = {
  SUPABASE_URL,
  PLAN_LIMITS,
  signInWithGoogle,
  signOut,
  getUser,
  getSession,
  getClips,
  addClip,
  deleteClip,
  togglePinClip,
  getDevices,
  findDeviceByMachineId,
  registerDevice,
  updateDeviceLastSeen,
  getSubscription,
  getClipCount,
  getDeviceCount,
  detectType,
}

})();
