import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  SafeAreaView, StatusBar, TouchableOpacity, TextInput,
} from 'react-native'
import { colors } from '../theme/colors'
import {
  supabase, getClips, deleteClip, togglePinClip,
  subscribeToClips, getSubscription, getMonthlyClipCount,
  getDevices, findDeviceByMachineId, registerDevice,
  updateDeviceLastSeen, ensureProfile, addClip,
} from '../lib/supabase'
import { getEncryptionSettings, unlockMasterKey, decryptClip, encryptClip } from '../lib/crypto'
import { detectType, mapPlatform, timeAgo } from '../lib/utils'
import { storage } from '../lib/storage'
import ClipCard from '../components/ClipCard'
import DeviceInfo from 'react-native-device-info'
import { Platform } from 'react-native'

export default function ClipListScreen({ user, onSignOut }) {
  const [clips, setClips] = useState([])
  const [refreshing, setRefreshing] = useState(false)
  const [deviceId, setDeviceId] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [encryptionEnabled, setEncryptionEnabled] = useState(false)
  const [vaultLocked, setVaultLocked] = useState(false)
  const [vaultPassword, setVaultPassword] = useState('')
  const [vaultError, setVaultError] = useState('')
  const [lastSynced, setLastSynced] = useState(null)
  const [showCompose, setShowCompose] = useState(false)
  const [composeText, setComposeText] = useState('')
  const [sending, setSending] = useState(false)
  const [filter, setFilter] = useState('all')
  const masterKeyRef = useRef(null)
  const unsubRef = useRef(null)

  // Setup device + load data
  useEffect(() => {
    if (!user) return

    const setup = async () => {
      // Ensure profile exists
      await ensureProfile(user)

      // Get or create device ID
      let machineId = await storage.getItem('snipsync_device_id')
      if (!machineId) {
        machineId = DeviceInfo.getUniqueIdSync()
        await storage.setItem('snipsync_device_id', machineId)
      }

      // Find or register device
      let device = await findDeviceByMachineId(user.id, machineId)
      if (!device) {
        const deviceName = await DeviceInfo.getDeviceName()
        const platform = mapPlatform(Platform.OS)
        const { data } = await registerDevice(user.id, deviceName, platform, machineId)
        device = data
      }
      if (device) {
        setDeviceId(device.id)
        updateDeviceLastSeen(device.id)
      }

      // Load subscription
      const sub = await getSubscription(user.id)
      setSubscription(sub)

      // Check encryption
      const encSettings = await getEncryptionSettings(user.id)
      if (encSettings?.encryption_enabled) {
        setEncryptionEnabled(true)
        setVaultLocked(true)
      }

      // Load clips
      await loadClips()

      // Subscribe to realtime
      unsubRef.current = subscribeToClips(
        user.id,
        (newClip) => {
          setClips((prev) => {
            if (prev.some((c) => c.id === newClip.id)) return prev
            return [newClip, ...prev]
          })
          setLastSynced(new Date())
        },
        (deletedId) => {
          setClips((prev) => prev.filter((c) => c.id !== deletedId))
        }
      )
    }

    setup()

    return () => {
      if (unsubRef.current) unsubRef.current()
    }
  }, [user])

  const loadClips = async () => {
    const { data } = await getClips(user.id)
    if (data) {
      setClips(data)
      setLastSynced(new Date())
    }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadClips()
    setRefreshing(false)
  }, [user])

  const handleDelete = useCallback(async (id) => {
    setClips((prev) => prev.filter((c) => c.id !== id))
    await deleteClip(id)
  }, [])

  const handlePin = useCallback(async (id, pinned) => {
    const { data } = await togglePinClip(id, pinned)
    if (data) {
      setClips((prev) => prev.map((c) => (c.id === id ? data : c)))
    }
  }, [])

  const handleVaultUnlock = async () => {
    if (!vaultPassword) return
    try {
      const settings = await getEncryptionSettings(user.id)
      const masterKey = await unlockMasterKey(
        vaultPassword, settings.encrypted_master_key, settings.key_salt, settings.key_nonce
      )
      masterKeyRef.current = masterKey
      setVaultLocked(false)
      setVaultPassword('')
      setVaultError('')
    } catch {
      setVaultError('Wrong password')
    }
  }

  const handleSend = async () => {
    if (!composeText.trim() || !deviceId || sending) return
    setSending(true)
    const type = detectType(composeText.trim())
    let content = composeText.trim()

    if (encryptionEnabled && masterKeyRef.current) {
      const enc = encryptClip(content, masterKeyRef.current)
      content = enc.encryptedContent
    }

    const { data } = await addClip(user.id, deviceId, content, type)
    if (data) {
      setClips((prev) => [data, ...prev])
      setComposeText('')
      setShowCompose(false)
    }
    setSending(false)
  }

  // Decrypt clips for display
  const decryptedClips = clips.map((clip) => {
    if (clip.encrypted && clip.nonce && masterKeyRef.current) {
      try {
        return { ...clip, content: decryptClip(clip.content, clip.nonce, masterKeyRef.current) }
      } catch {
        return { ...clip, content: '[encrypted]' }
      }
    }
    if (clip.encrypted && !masterKeyRef.current) {
      return { ...clip, content: '[encrypted]' }
    }
    return clip
  })

  // Sort: pinned first
  const sortedClips = [...decryptedClips].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    return 0
  })

  const filteredClips = filter === 'all'
    ? sortedClips
    : sortedClips.filter((c) => c.type === filter)

  // Vault locked overlay
  if (encryptionEnabled && vaultLocked) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>SnipSync</Text>
          <TouchableOpacity onPress={onSignOut}>
            <Text style={styles.headerBtn}>Sign out</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.vaultOverlay}>
          <Text style={{ fontSize: 32, marginBottom: 12 }}>🔒</Text>
          <Text style={styles.vaultTitle}>Vault locked</Text>
          <Text style={styles.vaultDesc}>Enter your vault password to decrypt your clips.</Text>
          <TextInput
            style={styles.vaultInput}
            placeholder="Vault password"
            placeholderTextColor="#555"
            secureTextEntry
            value={vaultPassword}
            onChangeText={(t) => { setVaultPassword(t); setVaultError('') }}
            onSubmitEditing={handleVaultUnlock}
            autoFocus
          />
          {vaultError ? <Text style={styles.vaultError}>{vaultError}</Text> : null}
          <TouchableOpacity style={styles.vaultBtn} onPress={handleVaultUnlock} activeOpacity={0.8}>
            <Text style={styles.vaultBtnText}>Unlock</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const FILTERS = ['all', 'link', 'note', 'code', 'image', 'file']

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SnipSync</Text>
        <View style={styles.headerRight}>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
          <TouchableOpacity onPress={onSignOut}>
            <Text style={styles.headerBtn}>⚙</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter bar */}
      <View style={styles.filterBar}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'All' : f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Clip list */}
      <FlatList
        data={filteredClips}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ClipCard clip={item} onDelete={handleDelete} onPin={handlePin} />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No clips yet</Text>
            <Text style={styles.emptyDesc}>Clips from your devices will appear here in real time.</Text>
          </View>
        }
      />

      {/* Compose FAB */}
      {showCompose ? (
        <View style={styles.composeBar}>
          <TextInput
            style={styles.composeInput}
            placeholder="Type a clip..."
            placeholderTextColor="#555"
            value={composeText}
            onChangeText={setComposeText}
            multiline
            autoFocus
          />
          <View style={styles.composeActions}>
            <TouchableOpacity onPress={() => { setShowCompose(false); setComposeText('') }}>
              <Text style={styles.composeCancel}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sendBtn, !composeText.trim() && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!composeText.trim() || sending}
              activeOpacity={0.8}
            >
              <Text style={styles.sendBtnText}>{sending ? '...' : 'Send'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowCompose(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {lastSynced ? `Synced ${timeAgo(lastSynced)}` : 'Connecting...'}
        </Text>
        <Text style={styles.footerText}>{filteredClips.length} clips</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.cardBorder,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.green, letterSpacing: -0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerBtn: { fontSize: 18, color: colors.textSecondary },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.green },
  liveText: { fontSize: 9, fontWeight: '700', color: colors.textDim, letterSpacing: 1 },
  filterBar: {
    flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 6,
    borderBottomWidth: 1, borderBottomColor: colors.cardBorder,
  },
  filterBtn: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'transparent',
  },
  filterBtnActive: { borderColor: colors.green, backgroundColor: 'rgba(34,197,94,0.08)' },
  filterText: { fontSize: 11, color: colors.textDim, fontWeight: '500', textTransform: 'capitalize' },
  filterTextActive: { color: colors.green },
  list: { padding: 12 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 36, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: colors.textDim, textAlign: 'center', paddingHorizontal: 40 },
  fab: {
    position: 'absolute', bottom: 60, right: 20,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.green, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
  },
  fabText: { fontSize: 28, color: '#000', fontWeight: '600', marginTop: -2 },
  composeBar: {
    borderTopWidth: 1, borderTopColor: colors.cardBorder,
    padding: 12, backgroundColor: colors.card,
  },
  composeInput: {
    backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder,
    borderRadius: 10, padding: 12, color: colors.text, fontSize: 14, maxHeight: 100,
  },
  composeActions: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8,
  },
  composeCancel: { fontSize: 13, color: colors.textDim },
  sendBtn: {
    backgroundColor: colors.green, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { fontSize: 13, fontWeight: '600', color: '#000' },
  footer: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: colors.cardBorder,
  },
  footerText: { fontSize: 10, color: colors.textDim },
  vaultOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  vaultTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 8 },
  vaultDesc: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginBottom: 24 },
  vaultInput: {
    width: '100%', backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder,
    borderRadius: 10, padding: 14, color: colors.text, fontSize: 15, marginBottom: 8,
  },
  vaultError: { color: colors.error, fontSize: 12, marginBottom: 8 },
  vaultBtn: {
    backgroundColor: colors.green, paddingVertical: 12, paddingHorizontal: 32,
    borderRadius: 10, marginTop: 8, width: '100%', alignItems: 'center',
  },
  vaultBtnText: { fontSize: 15, fontWeight: '600', color: '#000' },
})
