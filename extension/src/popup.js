;(async function() {

if (!window.SnipSync) {
  document.getElementById('app').innerHTML = '<div style="padding:20px;color:#ef4444;font-size:12px">Failed to load. Check console.</div>'
  return
}

const {
  signInWithGoogle, signOut, getUser, getSession,
  getClips, addClip, deleteClip, togglePinClip,
  getSubscription, getMonthlyClipCount, getDeviceCount,
  findDeviceByMachineId, registerDevice, updateDeviceLastSeen,
  detectType, PLAN_LIMITS,
} = window.SnipSync

const app = document.getElementById('app')
let state = {
  user: null,
  clips: [],
  deviceId: null,
  subscription: null,
  usage: { clips: 0, devices: 0 },
  filter: 'all',
  search: '',
  loading: true,
}

// ── Machine ID for extension ────────────────────────

function getExtensionMachineId() {
  // Use extension ID + user agent as a stable identifier
  return 'ext-' + chrome.runtime.id.slice(0, 16)
}

// ── Render ──────────────────────────────────────────

function render() {
  if (state.loading) {
    app.innerHTML = `<div class="loading"><div class="spinner"></div></div>`
    return
  }

  if (!state.user) {
    app.innerHTML = `
      <div class="signin">
        <div class="signin-header">
          <div class="logo-mark">${logoSvg}</div>
          <span class="logo-text">SnipSync</span>
        </div>
        <p class="signin-sub">Clipboard sync across all your devices</p>
        <button class="signin-btn" id="signin-btn">
          <svg width="14" height="14" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Sign in with Google
        </button>
      </div>`
    document.getElementById('signin-btn').addEventListener('click', handleSignIn)
    return
  }

  const plan = state.subscription?.plan || 'free'
  const limits = PLAN_LIMITS[plan]
  const filtered = state.clips
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      return new Date(b.created_at) - new Date(a.created_at)
    })
    .filter(c => state.filter === 'all' || c.type === state.filter)
    .filter(c => !state.search || c.content.toLowerCase().includes(state.search.toLowerCase()))

  app.innerHTML = `
    <div class="main">
      <!-- Header -->
      <div class="header">
        <div class="header-left">
          <div class="logo-mark logo-mark--sm">${logoSvg}</div>
          <span class="header-title">SnipSync</span>
          <span class="plan-badge plan-badge--${plan}">${plan.toUpperCase()}</span>
        </div>
        <div class="header-right">
          <span class="usage">${state.usage.clips}${limits.maxClipsPerMonth === Infinity ? '' : '/' + limits.maxClipsPerMonth}</span>
          <button class="signout-btn" id="signout-btn" title="Sign out">${state.user.email?.[0]?.toUpperCase() || '?'}</button>
        </div>
      </div>

      <!-- Input -->
      <div class="input-area">
        <textarea id="clip-input" class="clip-input" placeholder="Paste or type something..." rows="2"></textarea>
        <button class="send-btn" id="send-btn">Send</button>
      </div>

      <!-- Filters -->
      <div class="filters">
        ${['all', 'link', 'code', 'note', 'address'].map(f =>
          `<button class="filter-btn ${state.filter === f ? 'filter-btn--active' : ''}" data-filter="${f}">${f}</button>`
        ).join('')}
      </div>

      <!-- Search -->
      <div class="search-bar">
        <input type="text" class="search-input" id="search-input" placeholder="Search clips..." value="${state.search}" />
      </div>

      <!-- Clips -->
      <div class="clip-list">
        ${filtered.length === 0
          ? `<div class="empty">No clips${state.clips.length > 0 ? ' matching filter' : ' yet'}</div>`
          : filtered.map(clip => renderClip(clip)).join('')
        }
      </div>
    </div>`

  // Bind events
  document.getElementById('signout-btn').addEventListener('click', handleSignOut)
  document.getElementById('send-btn').addEventListener('click', handleSend)
  document.getElementById('clip-input').addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); handleSend() }
  })
  document.getElementById('search-input').addEventListener('input', (e) => {
    state.search = e.target.value
    render()
  })
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.filter = btn.dataset.filter
      render()
    })
  })
  document.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(btn.dataset.copy)
      btn.textContent = '✓ Copied'
      btn.classList.add('copied')
      setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied') }, 1500)
    })
  })
  document.querySelectorAll('[data-pin]').forEach(btn => {
    btn.addEventListener('click', () => handlePin(btn.dataset.pin, btn.dataset.pinned !== 'true'))
  })
  document.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => handleDelete(btn.dataset.delete))
  })
}

function renderClip(clip) {
  const colors = {
    link: { bg: '#1a2e1a', text: '#4ade80', dot: '#22c55e' },
    note: { bg: '#1e1e2e', text: '#a78bfa', dot: '#8b5cf6' },
    address: { bg: '#2e1a1a', text: '#f87171', dot: '#ef4444' },
    code: { bg: '#1a1e2e', text: '#60a5fa', dot: '#3b82f6' },
    image: { bg: '#2e2e1a', text: '#facc15', dot: '#eab308' },
  }
  const c = colors[clip.type] || { bg: '#1e1e1e', text: '#9ca3af', dot: '#6b7280' }
  const time = timeAgo(clip.created_at)
  const device = clip.devices?.name || 'Unknown'
  const isLink = clip.type === 'link'
  const isCode = clip.type === 'code'

  return `
    <div class="clip">
      <div class="clip-top">
        <span class="clip-badge" style="background:${c.bg};color:${c.text}">
          <span class="clip-dot" style="background:${c.dot}"></span>${clip.type}
        </span>
        ${clip.pinned ? '<span class="pin-icon">📌</span>' : ''}
        <span class="clip-time">${time}</span>
        <span class="clip-device">${device}</span>
      </div>
      <div class="clip-body ${isLink ? 'clip-body--link' : ''} ${isCode ? 'clip-body--code' : ''}">${escapeHtml(clip.content)}</div>
      <div class="clip-actions">
        <button class="action-btn action-btn--copy" data-copy="${escapeAttr(clip.content)}">Copy</button>
        <button class="action-btn action-btn--pin ${clip.pinned ? 'action-btn--pinned' : ''}" data-pin="${clip.id}" data-pinned="${clip.pinned}">${clip.pinned ? 'Unpin' : 'Pin'}</button>
        ${isLink ? `<a class="action-btn" href="${escapeAttr(clip.content)}" target="_blank">Open ↗</a>` : ''}
        <button class="action-btn action-btn--delete" data-delete="${clip.id}">✕</button>
      </div>
    </div>`
}

// ── Handlers ────────────────────────────────────────

async function handleSignIn() {
  try {
    state.loading = true
    render()
    const user = await signInWithGoogle()
    state.user = user
    await setupDevice()
    await loadClips()
    state.loading = false
    render()
  } catch (err) {
    state.loading = false
    render()
    showToast(err.message || 'Sign in failed')
  }
}

async function handleSignOut() {
  await signOut()
  await chrome.storage.local.remove('sb_device_id')
  state = { ...state, user: null, clips: [], deviceId: null, subscription: null, usage: { clips: 0, devices: 0 } }
  render()
}

async function handleSend() {
  const input = document.getElementById('clip-input')
  const text = input.value.trim()
  if (!text || !state.user || !state.deviceId) return

  const plan = state.subscription?.plan || 'free'
  const limits = PLAN_LIMITS[plan]
  if (state.usage.clips >= limits.maxClipsPerMonth) {
    showToast(`Monthly clip limit reached (${limits.maxClipsPerMonth}/month). Upgrade to Pro.`)
    return
  }

  const type = detectType(text)
  input.value = ''

  try {
    const clip = await addClip(state.user.id, state.deviceId, text, type)
    state.clips.unshift(clip)
    state.usage.clips++
    render()
  } catch (err) {
    input.value = text
    showToast(err.message)
  }
}

async function handlePin(id, pinned) {
  try {
    const updated = await togglePinClip(id, pinned)
    state.clips = state.clips.map(c => c.id === id ? { ...c, ...updated } : c)
    render()
  } catch {}
}

async function handleDelete(id) {
  state.clips = state.clips.filter(c => c.id !== id)
  state.usage.clips = Math.max(0, state.usage.clips - 1)
  render()
  try {
    await deleteClip(id)
  } catch {}
}

// ── Setup ───────────────────────────────────────────

async function setupDevice() {
  if (!state.user) return

  let deviceId = (await chrome.storage.local.get('sb_device_id')).sb_device_id
  const machineId = getExtensionMachineId()

  if (!deviceId) {
    // Check if this extension already registered
    const existing = await findDeviceByMachineId(state.user.id, machineId)
    if (existing) {
      deviceId = existing.id
      await chrome.storage.local.set({ sb_device_id: deviceId })
      updateDeviceLastSeen(deviceId)
    } else {
      // Check device limit
      const sub = await getSubscription(state.user.id)
      state.subscription = sub
      const limits = PLAN_LIMITS[sub?.plan || 'free']
      const deviceCount = await getDeviceCount(state.user.id)

      if (deviceCount >= limits.maxDevices) {
        showToast(`Device limit reached (${limits.maxDevices}). Upgrade to Pro.`)
        return
      }

      const device = await registerDevice(state.user.id, 'Chrome Extension', 'chrome', machineId)
      deviceId = device.id
      await chrome.storage.local.set({ sb_device_id: deviceId })
    }
  } else {
    updateDeviceLastSeen(deviceId)
  }

  state.deviceId = deviceId

  // Store for background script
  await chrome.storage.local.set({ sb_device_id: deviceId })
}

async function loadClips() {
  if (!state.user) return

  const [clips, sub, clipCount, deviceCount] = await Promise.all([
    getClips(state.user.id),
    getSubscription(state.user.id),
    getMonthlyClipCount(state.user.id),
    getDeviceCount(state.user.id),
  ])

  state.clips = clips || []
  state.subscription = sub
  state.usage = { clips: clipCount, devices: deviceCount }
}

// ── Helpers ─────────────────────────────────────────

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime()
  if (diff < 60000) return 'now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
  return `${Math.floor(diff / 86400000)}d`
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function showToast(msg) {
  const existing = document.querySelector('.toast')
  if (existing) existing.remove()
  const toast = document.createElement('div')
  toast.className = 'toast'
  toast.textContent = msg
  document.body.appendChild(toast)
  setTimeout(() => toast.remove(), 3000)
}

const logoSvg = `<svg width="20" height="20" viewBox="0 0 100 100" fill="none"><path d="M 15 55 C 35 55, 30 80, 50 80 C 70 80, 65 20, 85 20" stroke="url(#pg)" stroke-width="6" stroke-linecap="round"/><circle cx="15" cy="55" r="10" fill="#4ade80"/><circle cx="85" cy="20" r="10" fill="#22c55e"/><defs><linearGradient id="pg" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#4ade80"/><stop offset="100%" stop-color="#22c55e"/></linearGradient></defs></svg>`

// ── Init ────────────────────────────────────────────

async function init() {
  try {
    state.loading = true
    app.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:400px;color:#555;font-size:12px">Loading...</div>'

    const user = await getUser()
    state.user = user

    if (user) {
      await setupDevice()
      await loadClips()
    }

    state.loading = false
    render()
  } catch (err) {
    state.loading = false
    app.innerHTML = `<div style="padding:20px;color:#ef4444;font-size:12px">Error: ${err.message}<br><br><pre style="color:#666;font-size:10px;white-space:pre-wrap">${err.stack}</pre></div>`
  }
}

init()

})();
