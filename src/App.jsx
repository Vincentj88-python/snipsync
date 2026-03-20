import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  supabase,
  signInWithGoogle,
  signOut,
  getUser,
  findDeviceByMachineId,
  findDeviceByName,
  backfillMachineId,
  registerDevice,
  updateDeviceName,
  getDevices,
  getClips,
  addClip,
  deleteClip,
  togglePinClip,
  checkDeviceExists,
  subscribeToClips,
  updateDeviceLastSeen,
  getSubscription,
  getMonthlyClipCount,
  getDeviceCount,
  PLAN_LIMITS,
  getTags,
  uploadClipImage,
  addImageClip,
  deleteClipImage,
  getImageUrl,
  uploadClipFile,
  addFileClip,
  deleteClipFile,
  getFileUrl,
  ensureProfile,
  checkDeletedAccount,
  sendEmail,
} from './lib/supabase'
import ClipCard, { PlatformIcon } from './components/ClipCard'
import InputArea from './components/InputArea'
import FilterBar from './components/FilterBar'
import SearchBar from './components/SearchBar'
import Toast from './components/Toast'
import SettingsView from './components/SettingsView'
import TeamView from './components/TeamView'
import { detectType, mapPlatform } from './lib/utils'
import {
  encryptClip,
  decryptClip,
  getEncryptionSettings,
  unlockMasterKey,
} from './lib/crypto'

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
  const [machineId, setMachineId] = useState(null)
  const [platformReady, setPlatformReady] = useState(false)
  const [isConnected, setIsConnected] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [removingId, setRemovingId] = useState(null)
  const [toast, setToast] = useState(null)
  const [updateReady, setUpdateReady] = useState(false)
  const [tags, setTags] = useState([])
  const [view, setView] = useState('clips') // 'clips' | 'teams' | 'settings'
  const [subscription, setSubscription] = useState(null)
  const [usage, setUsage] = useState({ clips: 0, devices: 0 })
  const [encryptionEnabled, setEncryptionEnabled] = useState(false)
  const [vaultLocked, setVaultLocked] = useState(false)
  const [lightboxSrc, setLightboxSrc] = useState(null)
  const [lastSyncedAt, setLastSyncedAt] = useState(null)
  const [vaultOverlayPassword, setVaultOverlayPassword] = useState('')
  const [vaultOverlayError, setVaultOverlayError] = useState('')
  const [vaultUnlockDisabled, setVaultUnlockDisabled] = useState(false)
  const vaultFailCountRef = useRef(0)
  const masterKeyRef = useRef(null)
  const [openAtLogin, setOpenAtLogin] = useState(true)
  const [autoCapture, setAutoCapture] = useState(() => {
    return localStorage.getItem('snip_auto_capture') === 'true'
  })
  const unsubRef = useRef(null)
  const handleSendRef = useRef(null)
  const pendingDeleteRef = useRef(null)
  const autoCaptureRef = useRef({ user: null, deviceId: null, subscription: null, usage: null })

  // Initialize platform info
  useEffect(() => {
    const init = async () => {
      if (window.electronAPI) {
        const p = await window.electronAPI.getPlatform()
        setPlatform(p)
        const name = await window.electronAPI.getDeviceName()
        setDeviceName(name)
        const mid = await window.electronAPI.getMachineId()
        setMachineId(mid)
        const loginSettings = await window.electronAPI.getLoginItemSettings()
        setOpenAtLogin(loginSettings?.openAtLogin ?? true)
      } else {
        setPlatform('darwin')
        setDeviceName('Browser')
        setMachineId('browser-' + Math.random().toString(36).slice(2))
      }
      setPlatformReady(true)
    }
    init()
  }, [])

  // Clear master key on page unload + auto-lock vault after 30min inactivity
  useEffect(() => {
    const clearMasterKey = () => {
      if (masterKeyRef.current && masterKeyRef.current instanceof Uint8Array) {
        masterKeyRef.current.fill(0)
      }
      masterKeyRef.current = null
    }
    window.addEventListener('beforeunload', clearMasterKey)

    let autoLockTimer = null
    const resetAutoLock = () => {
      if (autoLockTimer) clearTimeout(autoLockTimer)
      autoLockTimer = setTimeout(() => {
        if (masterKeyRef.current && encryptionEnabled) {
          clearMasterKey()
          setVaultLocked(true)
        }
      }, 30 * 60 * 1000) // 30 minutes
    }
    window.addEventListener('mousemove', resetAutoLock)
    window.addEventListener('keydown', resetAutoLock)
    resetAutoLock()

    return () => {
      window.removeEventListener('beforeunload', clearMasterKey)
      window.removeEventListener('mousemove', resetAutoLock)
      window.removeEventListener('keydown', resetAutoLock)
      if (autoLockTimer) clearTimeout(autoLockTimer)
    }
  }, [encryptionEnabled])

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
        // Ensure profile exists (handles re-login after account deletion)
        const isNewProfile = await ensureProfile(user)

        // Check if this account was previously deleted
        if (user.email) {
          const wasDeleted = await checkDeletedAccount(user.email)
          if (wasDeleted) {
            setToast({
              message: 'Welcome back! Your previous account data was deleted and cannot be restored.',
              onDismiss: () => setToast(null),
            })
            if (isNewProfile) sendEmail(user.email, 'welcome-back')
          } else if (isNewProfile) {
            sendEmail(user.email, 'welcome')
          }
        }

        let storedDeviceId = localStorage.getItem('snip_device_id')

        // Verify stored device still exists in Supabase
        if (storedDeviceId) {
          const exists = await checkDeviceExists(storedDeviceId)
          if (!exists) {
            localStorage.removeItem('snip_device_id')
            storedDeviceId = null
          }
        }

        // Fetch subscription early — needed for device limit check
        const sub = await getSubscription(user.id)
        if (sub) setSubscription(sub)
        const currentPlanLimits = PLAN_LIMITS[sub?.plan || 'free']

        if (!storedDeviceId) {
          const name = deviceName || 'Unknown Device'
          const plat = mapPlatform(platform)

          // 1. Look up by new persistent UUID
          let existingDevice = await findDeviceByMachineId(user.id, machineId)

          // 2. Try legacy hardware-hash based machine ID (one-time migration)
          if (!existingDevice && window.electronAPI?.getLegacyMachineId) {
            const legacyMachineId = await window.electronAPI.getLegacyMachineId()
            if (legacyMachineId && legacyMachineId !== machineId) {
              const legacyDevice = await findDeviceByMachineId(user.id, legacyMachineId)
              if (legacyDevice) {
                // Migrate: backfill with new persistent UUID
                await backfillMachineId(legacyDevice.id, machineId)
                existingDevice = legacyDevice
              }
            }
          }

          // 3. Fallback: match legacy device by name+platform (no machine_id yet)
          if (!existingDevice) {
            const legacyDevice = await findDeviceByName(user.id, name, plat)
            if (legacyDevice) {
              await backfillMachineId(legacyDevice.id, machineId)
              existingDevice = legacyDevice
            }
          }

          if (existingDevice) {
            storedDeviceId = existingDevice.id
            localStorage.setItem('snip_device_id', storedDeviceId)
            updateDeviceName(storedDeviceId, name)
          } else {
            // Genuinely new device — check limit
            const currentDeviceCount = await getDeviceCount(user.id)
            if (currentDeviceCount >= currentPlanLimits.maxDevices) {
              setToast({
                message: `Device limit reached (${currentPlanLimits.maxDevices}). Upgrade to Pro for unlimited devices.`,
                onDismiss: () => setToast(null),
              })
              return
            }

            const { data, error } = await registerDevice(user.id, name, plat, machineId)
            if (data && !error) {
              storedDeviceId = data.id
              localStorage.setItem('snip_device_id', storedDeviceId)
            }
          }
        } else {
          updateDeviceLastSeen(storedDeviceId)
        }
        setDeviceId(storedDeviceId)

        // Check encryption status
        const encSettings = await getEncryptionSettings(user.id)
        if (encSettings?.encryption_enabled) {
          setEncryptionEnabled(true)
          if (!masterKeyRef.current) {
            setVaultLocked(true)
          }
        }

        const { data: clipsData } = await getClips(user.id)
        if (clipsData) {
          // Decrypt clips if encryption is enabled and vault is unlocked
          if (masterKeyRef.current) {
            const decrypted = clipsData.map((clip) => {
              if (clip.encrypted && clip.nonce && clip.content !== '[image]') {
                return { ...clip, content: decryptClip(clip.content, clip.nonce, masterKeyRef.current) }
              }
              return clip
            })
            setClips(decrypted)
          } else {
            setClips(clipsData)
          }
        }

        const { data: devicesData } = await getDevices(user.id)
        if (devicesData) setDevices(devicesData)

        const { data: tagsData } = await getTags(user.id)
        if (tagsData) setTags(tagsData)
        const [clipCount, deviceCount] = await Promise.all([
          getMonthlyClipCount(user.id),
          getDeviceCount(user.id),
        ])
        setUsage({ clips: clipCount, devices: deviceCount })

        setIsConnected(true)

        const unsub = subscribeToClips(
          user.id,
          async (newClip) => {
            const { data } = await supabase
              .from('clips')
              .select('*, devices(name, platform), clip_tags(tag_id, tags(id, name, color))')
              .eq('id', newClip.id)
              .single()
            if (data) {
              // Decrypt if encrypted and vault is unlocked
              let clipData = data
              if (data.encrypted && data.nonce && data.content !== '[image]' && masterKeyRef.current) {
                clipData = { ...data, content: decryptClip(data.content, data.nonce, masterKeyRef.current) }
              }
              setClips((prev) => {
                if (prev.some((c) => c.id === clipData.id)) return prev
                return [clipData, ...prev]
              })
              setLastSyncedAt(new Date())
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
    if (usage.clips >= limits.maxClipsPerMonth) {
      setToast({
        message: `Monthly clip limit reached (${limits.maxClipsPerMonth}/month). Upgrade to Pro for unlimited.`,
        onDismiss: () => setToast(null),
      })
      return
    }

    const type = detectType(text)
    setInput('')

    // Encrypt if enabled and unlocked
    let contentToSave = text
    let clipEncrypted = false
    let clipNonce = null
    if (encryptionEnabled && masterKeyRef.current) {
      const enc = encryptClip(text, masterKeyRef.current)
      contentToSave = enc.encryptedContent
      clipNonce = enc.nonce
      clipEncrypted = true
    }

    const { data, error } = await addClip(user.id, deviceId, contentToSave, type)
    if (error) {
      setInput(text)
      setToast({ message: error.message, onDismiss: () => setToast(null) })
    } else if (data) {
      // Optimistically add clip to local state immediately
      const displayClip = clipEncrypted ? { ...data, content: text, encrypted: true } : data
      setClips((prev) => {
        if (prev.some((c) => c.id === data.id)) return prev
        return [displayClip, ...prev]
      })
      // Mark as encrypted in DB if needed
      if (clipEncrypted) {
        await supabase.from('clips').update({ encrypted: true, nonce: clipNonce }).eq('id', data.id)
      }
      setUsage((prev) => ({ ...prev, clips: prev.clips + 1 }))
      setLastSyncedAt(new Date())
    }
  }, [input, user, deviceId, subscription, usage, encryptionEnabled])

  handleSendRef.current = handleSend

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Enter' && !e.shiftKey && document.activeElement?.classList?.contains('input-textarea')) {
        e.preventDefault()
        handleSendRef.current?.()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [platform])

  // ── Clipboard auto-capture ──────────────────────────
  // Keep a ref with latest values so the listener doesn't go stale
  autoCaptureRef.current = { user, deviceId, subscription, usage }

  useEffect(() => {
    if (!autoCapture || !window.electronAPI?.startClipboardWatch) return

    window.electronAPI.startClipboardWatch()

    const handler = window.electronAPI.onClipboardChange(async (text) => {
      const { user: u, deviceId: d, subscription: sub, usage: usg } = autoCaptureRef.current
      if (!u || !d || !text) return

      // Check clip limit
      const plan = sub?.plan || 'free'
      const limits = PLAN_LIMITS[plan]
      if (usg && usg.clips >= limits.maxClipsPerMonth) return

      const type = detectType(text)
      let contentToSave = text
      if (masterKeyRef.current) {
        const enc = encryptClip(text, masterKeyRef.current)
        contentToSave = enc.encryptedContent
        // Note: encrypted/nonce flags set separately for auto-captured clips
      }
      const { error } = await addClip(u.id, d, contentToSave, type)
      if (!error) {
        setUsage((prev) => ({ ...prev, clips: prev.clips + 1 }))
      }
    })

    return () => {
      window.electronAPI.stopClipboardWatch()
      window.electronAPI.removeClipboardChangeListener(handler)
    }
  }, [autoCapture])

  // ── Global shortcut snip handlers ──────────────────
  useEffect(() => {
    if (!window.electronAPI?.onSnipText) return

    const textHandler = window.electronAPI.onSnipText(async (text) => {
      const { user: u, deviceId: d, subscription: sub, usage: usg } = autoCaptureRef.current
      if (!u || !d || !text) return
      const plan = sub?.plan || 'free'
      const limits = PLAN_LIMITS[plan]
      if (usg && usg.clips >= limits.maxClipsPerMonth) return

      const type = detectType(text)
      let contentToSave = text
      let clipEncrypted = false
      let clipNonce = null
      if (encryptionEnabled && masterKeyRef.current) {
        const enc = encryptClip(text, masterKeyRef.current)
        contentToSave = enc.encryptedContent
        clipEncrypted = true
        clipNonce = enc.nonce
      }
      const { data } = await addClip(u.id, d, contentToSave, type)
      if (data) {
        const displayClip = clipEncrypted ? { ...data, content: text, encrypted: true } : data
        setClips((prev) => {
          if (prev.some((c) => c.id === data.id)) return prev
          return [displayClip, ...prev]
        })
        if (clipEncrypted) {
          await supabase.from('clips').update({ encrypted: true, nonce: clipNonce }).eq('id', data.id)
        }
        setUsage((prev) => ({ ...prev, clips: prev.clips + 1 }))
        setLastSyncedAt(new Date())
      }
    })

    const imageHandler = window.electronAPI.onSnipImage(async (base64) => {
      const { user: u, deviceId: d, subscription: sub } = autoCaptureRef.current
      if (!u || !d) return
      const plan = sub?.plan || 'free'
      if (plan === 'free') return // Images are Pro-only

      // Convert base64 to blob and upload
      const byteString = atob(base64)
      const ab = new ArrayBuffer(byteString.length)
      const ia = new Uint8Array(ab)
      for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i)
      const blob = new Blob([ab], { type: 'image/png' })
      const file = new File([blob], `snip-${Date.now()}.png`, { type: 'image/png' })

      const { data: uploadData, error } = await uploadClipImage(u.id, file)
      if (!error && uploadData) {
        await addImageClip(u.id, d, uploadData.path, file.size)
      }
    })

    const fileHandler = window.electronAPI.onSnipFile(async (filePath) => {
      const { user: u, deviceId: d, subscription: sub } = autoCaptureRef.current
      if (!u || !d) return
      const plan = sub?.plan || 'free'
      if (plan === 'free') return // Files are Pro-only

      // Read file from disk via fetch (works for local file:// in Electron)
      try {
        const response = await fetch(`file://${filePath}`)
        const blob = await response.blob()
        const fileName = filePath.split('/').pop()
        const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' })

        if (file.type.startsWith('image/')) {
          const { data: uploadData, error } = await uploadClipImage(u.id, file)
          if (!error && uploadData) await addImageClip(u.id, d, uploadData.path, file.size)
        } else {
          const { data: uploadData, error } = await uploadClipFile(u.id, file)
          if (!error && uploadData) await addFileClip(u.id, d, uploadData.path, fileName, file.size)
        }
      } catch {
        // File read failed — silently ignore
      }
    })

    return () => {
      window.electronAPI.removeSnipTextListener(textHandler)
      window.electronAPI.removeSnipImageListener(imageHandler)
      window.electronAPI.removeSnipFileListener(fileHandler)
    }
  }, [encryptionEnabled])

  const handleToggleAutoCapture = useCallback((enabled) => {
    setAutoCapture(enabled)
    localStorage.setItem('snip_auto_capture', String(enabled))
  }, [])

  const handleToggleOpenAtLogin = useCallback((enabled) => {
    setOpenAtLogin(enabled)
    window.electronAPI?.setOpenAtLogin(enabled)
  }, [])

  const handleVaultUnlock = useCallback((masterKey) => {
    masterKeyRef.current = masterKey
    setVaultLocked(false)
    // Re-fetch and decrypt clips
    if (user) {
      getClips(user.id).then(({ data }) => {
        if (data) {
          const decrypted = data.map((clip) => {
            if (clip.encrypted && clip.nonce && clip.content !== '[image]') {
              return { ...clip, content: decryptClip(clip.content, clip.nonce, masterKey) }
            }
            return clip
          })
          setClips(decrypted)
        }
      })
    }
  }, [user])

  const handleEncryptionChange = useCallback((enabled, masterKey) => {
    setEncryptionEnabled(enabled)
    if (enabled && masterKey) {
      masterKeyRef.current = masterKey
      setVaultLocked(false)
    } else if (!enabled) {
      masterKeyRef.current = null
      setVaultLocked(false)
      // Re-fetch plaintext clips
      if (user) {
        getClips(user.id).then(({ data }) => {
          if (data) setClips(data)
        })
      }
    }
  }, [user])

  const handleImagePaste = useCallback(async (file) => {
    if (!user || !deviceId) return
    const plan = subscription?.plan || 'free'
    const limits = PLAN_LIMITS[plan]
    if (plan === 'free') {
      setToast({ message: 'Image clips are a Pro feature. Upgrade to upload images.', onDismiss: () => setToast(null) })
      return
    }
    if (usage.clips >= limits.maxClipsPerMonth) {
      setToast({ message: `Monthly clip limit reached (${limits.maxClipsPerMonth}/month). Upgrade to Pro.`, onDismiss: () => setToast(null) })
      return
    }
    if (file.size > limits.maxImageSize) {
      const maxMB = Math.round(limits.maxImageSize / (1024 * 1024))
      setToast({ message: `Image too large (max ${maxMB}MB).`, onDismiss: () => setToast(null) })
      return
    }
    const { data: uploadData, error: uploadError } = await uploadClipImage(user.id, file)
    if (uploadError) {
      setToast({ message: uploadError.message, onDismiss: () => setToast(null) })
      return
    }
    const { data, error } = await addImageClip(user.id, deviceId, uploadData.path, file.size)
    if (error) {
      setToast({ message: 'Failed to save image clip', onDismiss: () => setToast(null) })
    } else if (data) {
      setClips((prev) => {
        if (prev.some((c) => c.id === data.id)) return prev
        return [data, ...prev]
      })
      setUsage((prev) => ({ ...prev, clips: prev.clips + 1 }))
      setLastSyncedAt(new Date())
    }
  }, [user, deviceId, subscription, usage])

  const handleFileDrop = useCallback(async (file) => {
    if (!user || !deviceId) return
    const plan = subscription?.plan || 'free'
    const limits = PLAN_LIMITS[plan]
    if (limits.maxFileSize === 0) {
      setToast({ message: 'File clips are a Pro feature. Upgrade to upload files.', onDismiss: () => setToast(null) })
      return
    }
    if (usage.clips >= limits.maxClipsPerMonth) {
      setToast({ message: `Monthly clip limit reached (${limits.maxClipsPerMonth}/month). Upgrade to Pro.`, onDismiss: () => setToast(null) })
      return
    }
    if (file.size > limits.maxFileSize) {
      const maxMB = Math.round(limits.maxFileSize / (1024 * 1024))
      setToast({ message: `File too large (max ${maxMB}MB). Current plan allows up to ${maxMB}MB.`, onDismiss: () => setToast(null) })
      return
    }
    const { data: uploadData, error: uploadError } = await uploadClipFile(user.id, file)
    if (uploadError) {
      setToast({ message: uploadError.message, onDismiss: () => setToast(null) })
      return
    }
    const { data, error } = await addFileClip(user.id, deviceId, uploadData.path, file.name, file.size)
    if (error) {
      setToast({ message: error.message || 'Failed to save file clip', onDismiss: () => setToast(null) })
    } else if (data) {
      setClips((prev) => {
        if (prev.some((c) => c.id === data.id)) return prev
        return [data, ...prev]
      })
      setUsage((prev) => ({ ...prev, clips: prev.clips + 1 }))
      setLastSyncedAt(new Date())
    }
  }, [user, deviceId, subscription, usage])

  const openUrlSafely = useCallback((url) => {
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return
      if (window.electronAPI) {
        window.electronAPI.openUrl(url)
      } else {
        window.open(url, '_blank', 'noopener,noreferrer')
      }
    } catch {
      // Invalid URL — ignore
    }
  }, [])

  const handleDownloadFile = useCallback((url) => {
    openUrlSafely(url)
  }, [openUrlSafely])

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
        if (clipToDelete.image_path) {
          if (clipToDelete.type === 'file') {
            await deleteClipFile(clipToDelete.image_path)
          } else {
            await deleteClipImage(clipToDelete.image_path)
          }
        }
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

  const clipListRef = useRef(null)

  const handlePin = useCallback(async (id, pinned) => {
    const { data, error } = await togglePinClip(id, pinned)
    if (error) {
      setToast({ message: 'Failed to pin clip', onDismiss: () => setToast(null) })
      return
    }
    if (data) {
      setClips((prev) => prev.map((c) => (c.id === id ? data : c)))
      if (pinned && clipListRef.current) {
        setTimeout(() => clipListRef.current.scrollTo({ top: 0, behavior: 'smooth' }), 100)
      }
    }
  }, [])

  const handleOpenUrl = useCallback((url) => {
    openUrlSafely(url)
  }, [openUrlSafely])

  const handleSignOut = useCallback(async () => {
    if (unsubRef.current) unsubRef.current()
    // Securely clear master key from memory
    if (masterKeyRef.current && masterKeyRef.current instanceof Uint8Array) {
      masterKeyRef.current.fill(0)
    }
    masterKeyRef.current = null
    localStorage.removeItem('snip_device_id')
    setClips([])
    setDevices([])
    setDeviceId(null)
    setFilter('all')
    setSearchQuery('')
    setEncryptionEnabled(false)
    setVaultLocked(false)
    await signOut()
  }, [])

  const handleHideWindow = useCallback(() => {
    if (window.electronAPI) {
      window.electronAPI.hideWindow()
    }
  }, [])

  // Sort pinned first, then by created_at; then filter by type and search
  const filteredClips = [...clips]
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      return new Date(b.created_at) - new Date(a.created_at)
    })
    .filter((c) => {
      if (filter === 'all') return true
      if (filter.startsWith('tag:')) {
        const tagName = filter.slice(4)
        return c.clip_tags?.some((ct) => ct.tags?.name === tagName)
      }
      return c.type === filter
    })
    .filter((c) => {
      if (!searchQuery) return true
      return c.content.toLowerCase().includes(searchQuery.toLowerCase())
    })

  const currentDevicePlatform = mapPlatform(platform)

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
          <img className="signin-logo-img" src="app-icon.png" alt="SnipSync" />
          <span className="signin-logo-text">SnipSync</span>
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

          <img className="titlebar-logo-img" src="app-icon.png" alt="SnipSync" />
          <span className="titlebar-name">SnipSync</span>
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

          {/* Teams */}
          <button
            className={`titlebar-gear ${view === 'teams' ? 'titlebar-gear--active' : ''}`}
            onClick={() => setView(view === 'teams' ? 'clips' : 'teams')}
            title="Teams"
          >
            &#128101;
          </button>

          {/* Settings gear */}
          <button
            className={`titlebar-gear ${view === 'settings' ? 'titlebar-gear--active' : ''}`}
            onClick={() => setView(view === 'settings' ? 'clips' : 'settings')}
            title="Settings"
          >
            &#9881;
          </button>
        </div>
      </div>

      {view === 'teams' ? (
        <TeamView
          user={user}
          deviceId={deviceId}
          subscription={subscription}
          onOpenUrl={handleOpenUrl}
          onDownloadFile={handleDownloadFile}
          onLightbox={setLightboxSrc}
          encryptionEnabled={encryptionEnabled}
          masterKeyRef={masterKeyRef}
        />
      ) : view === 'settings' ? (
        <SettingsView
          subscription={subscription}
          usage={usage}
          user={user}
          devices={devices}
          clips={clips}
          autoCapture={autoCapture}
          onToggleAutoCapture={handleToggleAutoCapture}
          encryptionEnabled={encryptionEnabled}
          vaultLocked={vaultLocked}
          onVaultUnlock={handleVaultUnlock}
          onEncryptionChange={handleEncryptionChange}
          openAtLogin={openAtLogin}
          onToggleOpenAtLogin={handleToggleOpenAtLogin}
          onSignOut={handleSignOut}
          onUpgrade={() => {
            const checkoutUrl = import.meta.env.VITE_LS_CHECKOUT_URL
            if (checkoutUrl) {
              const url = `${checkoutUrl}?checkout[email]=${encodeURIComponent(user.email)}&checkout[custom][user_id]=${user.id}`
              openUrlSafely(url)
            } else {
              setToast({ message: 'Upgrade not available yet', onDismiss: () => setToast(null) })
            }
          }}
        />
      ) : encryptionEnabled && vaultLocked && view === 'clips' ? (
        /* Vault locked overlay */
        <div className="vault-overlay">
          <div className="vault-overlay-icon">&#128274;</div>
          <span className="vault-overlay-title">Vault locked</span>
          <span className="vault-overlay-desc">Enter your vault password to decrypt and view your clips.</span>
          <div className="vault-overlay-form">
            <input
              type="password"
              className="vault-overlay-input"
              placeholder="Vault password"
              value={vaultOverlayPassword}
              onChange={(e) => { setVaultOverlayPassword(e.target.value); setVaultOverlayError('') }}
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && vaultOverlayPassword && !vaultUnlockDisabled) {
                  try {
                    const settings = await getEncryptionSettings(user.id)
                    const masterKey = await unlockMasterKey(vaultOverlayPassword, settings.encrypted_master_key, settings.key_salt, settings.key_nonce)
                    vaultFailCountRef.current = 0
                    handleVaultUnlock(masterKey)
                    setVaultOverlayPassword('')
                  } catch {
                    vaultFailCountRef.current++
                    const delay = Math.min(vaultFailCountRef.current * 2, 30) // 2s, 4s, 6s... max 30s
                    setVaultOverlayError(`Wrong password. Try again in ${delay}s.`)
                    setVaultUnlockDisabled(true)
                    setTimeout(() => setVaultUnlockDisabled(false), delay * 1000)
                  }
                }
              }}
              autoFocus
            />
            <button
              className="input-send-btn input-send-btn--active"
              style={{ padding: '8px 14px' }}
              disabled={vaultUnlockDisabled}
              onClick={async () => {
                if (!vaultOverlayPassword || vaultUnlockDisabled) return
                try {
                  const settings = await getEncryptionSettings(user.id)
                  const masterKey = await unlockMasterKey(vaultOverlayPassword, settings.encrypted_master_key, settings.key_salt, settings.key_nonce)
                  vaultFailCountRef.current = 0
                  handleVaultUnlock(masterKey)
                  setVaultOverlayPassword('')
                } catch {
                  vaultFailCountRef.current++
                  const delay = Math.min(vaultFailCountRef.current * 2, 30)
                  setVaultOverlayError(`Wrong password. Try again in ${delay}s.`)
                  setVaultUnlockDisabled(true)
                  setTimeout(() => setVaultUnlockDisabled(false), delay * 1000)
                }
              }}
            >
              Unlock
            </button>
          </div>
          {vaultOverlayError && <span className="vault-overlay-error">{vaultOverlayError}</span>}
          <button className="vault-overlay-link" onClick={() => setView('settings')}>
            Forgot password? Go to Settings
          </button>
        </div>
      ) : (
        <>
          {/* Input */}
          <InputArea
            input={input}
            setInput={setInput}
            onSend={handleSend}
            onImagePaste={handleImagePaste}
            onFileDrop={handleFileDrop}
            platform={platform}
          />

          {/* Filter */}
          <FilterBar
            filter={filter}
            setFilter={setFilter}
            clips={clips}
            tags={tags}
          />

          {/* Search */}
          <SearchBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />

          {/* Clip list */}
          <div className="clip-list" ref={clipListRef}>
            {filteredClips.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">&#128203;</div>
                {clips.length === 0 ? (
                  <>
                    Your clipboard is empty. Copy something on any device to see it here.
                    <div className="empty-state-actions">
                      <button className="empty-state-btn" onClick={() => setView('settings')}>
                        Settings
                      </button>
                      <button className="empty-state-btn" onClick={() => {
                        const text = platform === 'darwin' ? '\u2318\u21B5 to send' : 'Ctrl+\u21B5 to send'
                        setToast({ message: `Type above and press ${text}. Or just copy something — it syncs!`, onDismiss: () => setToast(null) })
                      }}>
                        Quick tips
                      </button>
                    </div>
                  </>
                ) : searchQuery
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
                  onPin={handlePin}
                  onDelete={handleDelete}
                  onOpenUrl={handleOpenUrl}
                  removing={removingId === clip.id}
                  onLightbox={setLightboxSrc}
                  onDownloadFile={handleDownloadFile}
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

        <span className="footer-sync">
          {lastSyncedAt
            ? `Synced ${Math.floor((Date.now() - lastSyncedAt.getTime()) / 1000) < 5 ? 'just now' : Math.floor((Date.now() - lastSyncedAt.getTime()) / 60000) + 'm ago'}`
            : `${clips.length} clip${clips.length !== 1 ? 's' : ''}`
          }
        </span>
      </div>

      {/* Image lightbox */}
      {lightboxSrc && (
        <div className="lightbox-overlay" onClick={() => setLightboxSrc(null)}>
          <img src={lightboxSrc} alt="Full size" className="lightbox-img" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

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
