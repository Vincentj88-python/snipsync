import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  supabase,
  signInWithGoogle,
  signOut,
  getUser,
  registerDevice,
  getDevices,
  getClips,
  addClip,
  deleteClip,
  checkDeviceExists,
  subscribeToClips,
  updateDeviceLastSeen,
  getSubscription,
  getClipCount,
  getDeviceCount,
  PLAN_LIMITS,
} from './lib/supabase'
import ClipCard, { PlatformIcon } from './components/ClipCard'
import InputArea from './components/InputArea'
import FilterBar from './components/FilterBar'
import SearchBar from './components/SearchBar'
import Toast from './components/Toast'
import SettingsView from './components/SettingsView'
import { detectType, mapPlatform } from './lib/utils'

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [clips, setClips] = useState([])
  const [devices, setDevices] = useState([])
  const [filter, setFilter] = useState('all')
  const [input, setInput] = useState('')
  const [copied, setCopied] = useState(null)
  const [deviceId, setDeviceId] = useState(null)
  const [platform, setPlatform] = useState('darwin')
  const [deviceName, setDeviceName] = useState('')
  const [platformReady, setPlatformReady] = useState(false)
  const [isConnected, setIsConnected] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [removingId, setRemovingId] = useState(null)
  const [toast, setToast] = useState(null)
  const [updateReady, setUpdateReady] = useState(false)
  const [view, setView] = useState('clips') // 'clips' | 'settings'
  const [subscription, setSubscription] = useState(null)
  const [usage, setUsage] = useState({ clips: 0, devices: 0 })
  const unsubRef = useRef(null)
  const handleSendRef = useRef(null)
  const pendingDeleteRef = useRef(null)

  // Initialize platform info
  useEffect(() => {
    const init = async () => {
      if (window.electronAPI) {
        const p = await window.electronAPI.getPlatform()
        setPlatform(p)
        const name = await window.electronAPI.getDeviceName()
        setDeviceName(name)
      } else {
        setPlatform('darwin')
        setDeviceName('Browser')
      }
      setPlatformReady(true)
    }
    init()
  }, [])

  // Auth listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
      setLoading(false)
    })

    getUser().then((u) => {
      setUser(u)
      setLoading(false)
    }).catch(() => setLoading(false))

    return () => subscription.unsubscribe()
  }, [])

  // Listen for auto-update status
  useEffect(() => {
    if (!window.electronAPI?.onUpdateStatus) return
    const handler = window.electronAPI.onUpdateStatus((update) => {
      if (update.status === 'downloaded') setUpdateReady(true)
    })
    return () => window.electronAPI.removeUpdateStatusListener(handler)
  }, [])

  // Listen for OAuth tokens from Electron IPC
  useEffect(() => {
    if (!window.electronAPI) return

    const handler = window.electronAPI.onAuthTokens(async (tokens) => {
      if (tokens.access_token) {
        await supabase.auth.setSession({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
        })
      }
    })

    return () => {
      window.electronAPI.removeAuthTokensListener(handler)
    }
  }, [])

  // Setup data + realtime when user is available AND platform is ready
  useEffect(() => {
    if (!user || !platformReady) return

    const setup = async () => {
      try {
        let storedDeviceId = localStorage.getItem('snip_device_id')

        // Verify stored device still exists in Supabase
        if (storedDeviceId) {
          const exists = await checkDeviceExists(storedDeviceId)
          if (!exists) {
            localStorage.removeItem('snip_device_id')
            storedDeviceId = null
          }
        }

        if (!storedDeviceId) {
          // Check device limit before registering
          const currentDeviceCount = await getDeviceCount(user.id)
          const sub = await getSubscription(user.id)
          const limits = PLAN_LIMITS[sub?.plan || 'free']
          if (currentDeviceCount >= limits.maxDevices) {
            setToast({
              message: `Device limit reached (${limits.maxDevices}). Upgrade to Pro for unlimited devices.`,
              onDismiss: () => setToast(null),
            })
            return
          }

          const name = deviceName || 'Unknown Device'
          const plat = mapPlatform(platform)
          const { data, error } = await registerDevice(user.id, name, plat)
          if (data && !error) {
            storedDeviceId = data.id
            localStorage.setItem('snip_device_id', storedDeviceId)
          }
        } else {
          updateDeviceLastSeen(storedDeviceId)
        }
        setDeviceId(storedDeviceId)

        const { data: clipsData } = await getClips(user.id)
        if (clipsData) setClips(clipsData)

        const { data: devicesData } = await getDevices(user.id)
        if (devicesData) setDevices(devicesData)

        // Fetch subscription and usage
        const sub = await getSubscription(user.id)
        if (sub) setSubscription(sub)
        const [clipCount, deviceCount] = await Promise.all([
          getClipCount(user.id),
          getDeviceCount(user.id),
        ])
        setUsage({ clips: clipCount, devices: deviceCount })

        setIsConnected(true)

        const unsub = subscribeToClips(
          user.id,
          async (newClip) => {
            const { data } = await supabase
              .from('clips')
              .select('*, devices(name, platform)')
              .eq('id', newClip.id)
              .single()
            if (data) {
              setClips((prev) => {
                if (prev.some((c) => c.id === data.id)) return prev
                return [data, ...prev]
              })
            }
          },
          (deletedId) => {
            setClips((prev) => prev.filter((c) => c.id !== deletedId))
          }
        )
        unsubRef.current = unsub
      } catch {
        setIsConnected(false)
      }
    }

    setup()

    return () => {
      if (unsubRef.current) unsubRef.current()
    }
  }, [user, platformReady])

  // Global keyboard shortcut — register once with ref
  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || !user || !deviceId) return

    // Check clip limit
    const plan = subscription?.plan || 'free'
    const limits = PLAN_LIMITS[plan]
    if (usage.clips >= limits.maxClips) {
      setToast({
        message: `Clip limit reached (${limits.maxClips}). Upgrade to Pro for unlimited clips.`,
        onDismiss: () => setToast(null),
      })
      return
    }

    const type = detectType(text)
    setInput('')
    const { error } = await addClip(user.id, deviceId, text, type)
    if (error) {
      setInput(text)
      setToast({ message: error.message, onDismiss: () => setToast(null) })
    } else {
      setUsage((prev) => ({ ...prev, clips: prev.clips + 1 }))
    }
  }, [input, user, deviceId, subscription, usage])

  handleSendRef.current = handleSend

  useEffect(() => {
    const handler = (e) => {
      const isMod = platform === 'darwin' ? e.metaKey : e.ctrlKey
      if (isMod && e.key === 'Enter') {
        e.preventDefault()
        handleSendRef.current?.()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [platform])

  const handleCopy = useCallback((clip) => {
    navigator.clipboard.writeText(clip.content)
    setCopied(clip.id)
    setTimeout(() => setCopied(null), 2000)
  }, [])

  const handleDelete = useCallback((id) => {
    // Find the clip to potentially undo
    const clipToDelete = clips.find((c) => c.id === id)
    if (!clipToDelete) return

    // Animate out
    setRemovingId(id)

    setTimeout(() => {
      // Remove from UI
      setClips((prev) => prev.filter((c) => c.id !== id))
      setRemovingId(null)

      // Show toast and delay actual deletion
      const timeoutId = setTimeout(async () => {
        await deleteClip(id)
        setUsage((prev) => ({ ...prev, clips: Math.max(0, prev.clips - 1) }))
        setToast(null)
      }, 3000)

      pendingDeleteRef.current = { id, clip: clipToDelete, timeoutId }

      setToast({
        message: 'Clip deleted',
        onUndo: () => {
          // Cancel the pending delete
          if (pendingDeleteRef.current?.timeoutId) {
            clearTimeout(pendingDeleteRef.current.timeoutId)
          }
          // Re-insert the clip
          setClips((prev) => {
            if (prev.some((c) => c.id === clipToDelete.id)) return prev
            return [clipToDelete, ...prev].sort(
              (a, b) => new Date(b.created_at) - new Date(a.created_at)
            )
          })
          setToast(null)
          pendingDeleteRef.current = null
        },
        onDismiss: () => {
          setToast(null)
        },
      })
    }, 200)
  }, [clips])

  const handleOpenUrl = useCallback((url) => {
    if (window.electronAPI) {
      window.electronAPI.openUrl(url)
    } else {
      window.open(url, '_blank')
    }
  }, [])

  const handleSignOut = useCallback(async () => {
    if (unsubRef.current) unsubRef.current()
    localStorage.removeItem('snip_device_id')
    setClips([])
    setDevices([])
    setDeviceId(null)
    setFilter('all')
    setSearchQuery('')
    await signOut()
  }, [])

  const handleHideWindow = useCallback(() => {
    if (window.electronAPI) {
      window.electronAPI.hideWindow()
    }
  }, [])

  // Filter clips by type then by search query
  const filteredClips = clips
    .filter((c) => filter === 'all' || c.type === filter)
    .filter((c) => {
      if (!searchQuery) return true
      return c.content.toLowerCase().includes(searchQuery.toLowerCase())
    })

  const currentDevicePlatform = mapPlatform(platform)
  const userInitial = user?.email?.[0]?.toUpperCase() || '?'

  // Loading screen
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
      </div>
    )
  }

  // Sign-in screen
  if (!user) {
    return (
      <div className="signin-screen">
        <div className="signin-logo">
          <div className="signin-logo-icon">&#9986;</div>
          <span className="signin-logo-text">Snip</span>
        </div>

        <p className="signin-subtitle">
          Clipboard sync across all your devices
        </p>

        <button onClick={signInWithGoogle} className="signin-btn">
          <svg width="16" height="16" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </button>
      </div>
    )
  }

  // Main app
  return (
    <div className="app-container">
      {/* Titlebar */}
      <div className="titlebar">
        <div className="titlebar-left">
          {/* Platform-aware window controls */}
          {platform === 'darwin' ? (
            <div className="titlebar-traffic-lights">
              <span className="titlebar-dot titlebar-dot--close" />
              <span className="titlebar-dot titlebar-dot--minimize" />
              <span className="titlebar-dot titlebar-dot--maximize" />
            </div>
          ) : (
            <button className="titlebar-close-btn" onClick={handleHideWindow} title="Close">
              &#10005;
            </button>
          )}

          <div className="titlebar-logo">&#9986;</div>
          <span className="titlebar-name">Snip</span>
        </div>

        <div className="titlebar-right">
          <div className="titlebar-live">
            <span className={`titlebar-live-dot ${isConnected ? 'titlebar-live-dot--on' : 'titlebar-live-dot--off'}`} />
            <span className="titlebar-live-label">
              {isConnected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>

          <div className="titlebar-device-badge">
            <PlatformIcon platform={currentDevicePlatform} size={12} color="#555" />
            {deviceName}
          </div>

          {/* Settings gear */}
          <button
            className={`titlebar-gear ${view === 'settings' ? 'titlebar-gear--active' : ''}`}
            onClick={() => setView(view === 'settings' ? 'clips' : 'settings')}
            title="Settings"
          >
            &#9881;
          </button>

          {/* Sign-out avatar */}
          <button className="titlebar-avatar" onClick={handleSignOut} title="Sign out">
            {userInitial}
          </button>
        </div>
      </div>

      {view === 'settings' ? (
        <SettingsView
          subscription={subscription}
          usage={usage}
          user={user}
          devices={devices}
          onUpgrade={() => {
            const checkoutUrl = import.meta.env.VITE_LS_CHECKOUT_URL
            if (checkoutUrl) {
              const url = `${checkoutUrl}?checkout[email]=${encodeURIComponent(user.email)}&checkout[custom][user_id]=${user.id}`
              if (window.electronAPI) {
                window.electronAPI.openUrl(url)
              } else {
                window.open(url, '_blank')
              }
            } else {
              setToast({ message: 'Upgrade not available yet', onDismiss: () => setToast(null) })
            }
          }}
        />
      ) : (
        <>
          {/* Input */}
          <InputArea
            input={input}
            setInput={setInput}
            onSend={handleSend}
            platform={platform}
          />

          {/* Filter */}
          <FilterBar
            filter={filter}
            setFilter={setFilter}
            clips={clips}
          />

          {/* Search */}
          <SearchBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />

          {/* Clip list */}
          <div className="clip-list">
            {filteredClips.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">&#128203;</div>
                {clips.length === 0
                  ? 'No clips yet. Paste something above!'
                  : searchQuery
                    ? 'No clips match your search.'
                    : `No ${filter} clips found.`
                }
              </div>
            ) : (
              filteredClips.map((clip) => (
                <ClipCard
                  key={clip.id}
                  clip={clip}
                  copied={copied}
                  onCopy={handleCopy}
                  onDelete={handleDelete}
                  onOpenUrl={handleOpenUrl}
                  removing={removingId === clip.id}
                />
              ))
            )}
          </div>
        </>
      )}

      {/* Update banner */}
      {updateReady && (
        <div className="update-banner">
          <span>Update ready</span>
          <button onClick={() => window.electronAPI?.installUpdate()} className="update-btn">
            Restart
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="footer">
        <div className="footer-devices">
          {devices.slice(0, 3).map((device) => {
            const isOnline = device.last_seen_at &&
              (Date.now() - new Date(device.last_seen_at).getTime()) < 5 * 60 * 1000
            return (
              <div
                key={device.id}
                className={`footer-device ${isOnline ? 'footer-device--online' : 'footer-device--offline'}`}
              >
                <span className={`footer-device-dot ${isOnline ? 'footer-device-dot--online' : 'footer-device-dot--offline'}`} />
                {device.name}
              </div>
            )
          })}
        </div>

        <span className="footer-count">
          {clips.length} clip{clips.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          onUndo={toast.onUndo}
          onDismiss={toast.onDismiss}
        />
      )}
    </div>
  )
}
