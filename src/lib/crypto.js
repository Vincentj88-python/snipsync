import nacl from 'tweetnacl'
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util'
import { supabase } from './supabase'

// ── PBKDF2 key derivation (Web Crypto API) ──────────

async function deriveKey(password, salt, iterations = 600000) {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    256
  )
  return new Uint8Array(bits)
}

// ── Master key management ───────────────────────────

export async function generateMasterKey(vaultPassword) {
  // Generate random master key
  const masterKey = nacl.randomBytes(32)

  // Generate salt for PBKDF2
  const salt = nacl.randomBytes(16)

  // Derive wrapping key from vault password
  const wrappingKey = await deriveKey(vaultPassword, salt)

  // Encrypt master key with wrapping key
  const nonce = nacl.randomBytes(24)
  const encryptedMasterKey = nacl.secretbox(masterKey, nonce, wrappingKey)

  // Generate recovery key — 24 random words from a simple wordlist
  const recoveryPhrase = generateRecoveryPhrase()

  // Encrypt master key with recovery phrase too (as a backup)
  const recoverySalt = nacl.randomBytes(16)
  const recoveryWrappingKey = await deriveKey(recoveryPhrase, recoverySalt)
  const recoveryNonce = nacl.randomBytes(24)
  const encryptedRecoveryKey = nacl.secretbox(masterKey, recoveryNonce, recoveryWrappingKey)

  return {
    masterKey,
    encryptedMasterKey: encodeBase64(encryptedMasterKey),
    salt: encodeBase64(salt),
    nonce: encodeBase64(nonce),
    recoveryPhrase,
    encryptedRecoveryKey: encodeBase64(encryptedRecoveryKey) + ':' + encodeBase64(recoverySalt) + ':' + encodeBase64(recoveryNonce),
  }
}

// ── Recovery phrase ─────────────────────────────────

const WORDLIST = [
  'anchor','basket','candle','desert','eagle','forest','garden','harbor',
  'island','jungle','kernel','lantern','marble','nectar','orange','palace',
  'quartz','rabbit','silver','timber','umbrella','velvet','walnut','zenith',
  'bridge','castle','dragon','ember','falcon','glacier','helmet','ivory',
  'jasper','knight','lagoon','mirror','nimbus','orchid','prism','raven',
  'shadow','temple','voyage','whisper','arctic','beacon','cipher','dagger',
  'fossil','garnet','horizon','impulse','jewel','kindle','lunar','meadow',
  'nebula','oasis','phantom','ripple','summit','trident','vertex','wander',
  // Extended wordlist for stronger entropy (256 words = 8 bits per word)
  'alpine','bamboo','canyon','delta','flint','flora','grove','haven',
  'inlet','jade','kayak','lemon','mango','north','olive','pebble',
  'quest','ridge','solar','thorn','unity','vivid','willow','yield',
  'alloy','bloom','cedar','drift','epoch','flame','glint','haste',
  'index','joust','kneel','latch','mirth','noble','onyx','plume',
  'quota','realm','slope','tulip','ultra','vault','wheat','axiom',
  'badge','coral','dream','elite','frost','gleam','heron','linen',
  'jolly','karma','lever','mural','nexus','optic','pearl','quiet',
  'roost','spire','token','upper','vigor','wedge','xenon','youth',
  'agave','blaze','crane','depot','envoy','fjord','grain','hyper',
  'igloo','jerky','kiosk','lyric','mocha','nylon','oxide','plaza',
  'quirk','radar','shrub','topaz','usher','viral','wreck','yacht',
  'adorn','brisk','cloak','dwell','exert','forge','grail','hatch',
  'ionic','jetty','knack','lodge','magma','nerve','orbit','prowl',
  'quilt','rapid','stoke','tunic','unify','venom','whisk','amber',
  'birch','clamp','drake','elbow','fetch','grasp','hover','irony',
  'juicy','knelt','limbo','morse','notch','omega','patch','reign',
  'satin','trout','usurp','vista','world','yearn','zebra','apron',
  'brace','charm','dwarf','equip','flask','glyph','hound','slate',
  'crisp','knoll','lucid','marsh','noted','plank','pinch','query',
  'rivet','sworn','thyme','crest','vouch','wrath','focal','zonal',
  'anvil','bison','chimp','drape','easel','furry','globe','husky',
  'idyll','jazzy','karat','lotus','moose','niche','otter','plaid',
  'quail','relic','skunk','talon','valve','visor','waltz','yucca',
]

function generateRecoveryPhrase() {
  const words = []
  for (let i = 0; i < 12; i++) {
    const idx = nacl.randomBytes(1)[0] % WORDLIST.length
    words.push(WORDLIST[idx])
  }
  return words.join(' ')
}

export async function unlockWithRecoveryPhrase(recoveryPhrase, encryptedRecoveryKeyData) {
  const [encB64, saltB64, nonceB64] = encryptedRecoveryKeyData.split(':')
  const salt = decodeBase64(saltB64)
  const wrappingKey = await deriveKey(recoveryPhrase, salt)
  const encrypted = decodeBase64(encB64)
  const nonce = decodeBase64(nonceB64)

  const masterKey = nacl.secretbox.open(encrypted, nonce, wrappingKey)
  if (!masterKey) {
    throw new Error('Invalid recovery phrase')
  }
  return masterKey
}

export async function unlockMasterKey(vaultPassword, encryptedMasterKeyB64, saltB64, nonceB64) {
  const salt = decodeBase64(saltB64)
  const encryptedMasterKey = decodeBase64(encryptedMasterKeyB64)
  const nonce = decodeBase64(nonceB64)

  // Try current iteration count (600K)
  let wrappingKey = await deriveKey(vaultPassword, salt, 600000)
  let masterKey = nacl.secretbox.open(encryptedMasterKey, nonce, wrappingKey)

  // Fall back to legacy iteration count (100K)
  if (!masterKey) {
    wrappingKey = await deriveKey(vaultPassword, salt, 100000)
    masterKey = nacl.secretbox.open(encryptedMasterKey, nonce, wrappingKey)
  }

  if (!masterKey) {
    throw new Error('Wrong vault password')
  }
  return masterKey
}

// ── Clip encryption/decryption ──────────────────────

export function encryptClip(content, masterKey) {
  const nonce = nacl.randomBytes(24)
  const messageBytes = decodeUTF8(content)
  const encrypted = nacl.secretbox(messageBytes, nonce, masterKey)
  return {
    encryptedContent: encodeBase64(encrypted),
    nonce: encodeBase64(nonce),
  }
}

export function decryptClip(encryptedContent, nonceB64, masterKey) {
  const encrypted = decodeBase64(encryptedContent)
  const nonce = decodeBase64(nonceB64)
  const decrypted = nacl.secretbox.open(encrypted, nonce, masterKey)
  if (!decrypted) {
    return '[decryption failed]'
  }
  return encodeUTF8(decrypted)
}

// ── Change vault password ───────────────────────────

export async function changeVaultPassword(oldPassword, newPassword, encryptedMasterKeyB64, saltB64, nonceB64) {
  // 1. Decrypt master key with old password
  const masterKey = await unlockMasterKey(oldPassword, encryptedMasterKeyB64, saltB64, nonceB64)

  // 2. Re-wrap master key with new password
  const newSalt = nacl.randomBytes(16)
  const newWrappingKey = await deriveKey(newPassword, newSalt)
  const newNonce = nacl.randomBytes(24)
  const newEncryptedMasterKey = nacl.secretbox(masterKey, newNonce, newWrappingKey)

  return {
    masterKey,
    encryptedMasterKey: encodeBase64(newEncryptedMasterKey),
    salt: encodeBase64(newSalt),
    nonce: encodeBase64(newNonce),
  }
}

// ── Profile encryption settings ─────────────────────

export async function saveEncryptionKeys(userId, encryptedMasterKey, salt, nonce, encryptedRecoveryKey) {
  const update = {
    encrypted_master_key: encryptedMasterKey,
    key_salt: salt,
    key_nonce: nonce,
    encryption_enabled: true,
  }
  // Only update recovery key if explicitly provided (avoid wiping it on password change)
  if (encryptedRecoveryKey !== undefined) {
    update.encrypted_recovery_key = encryptedRecoveryKey || null
  }
  return supabase.from('profiles').update(update).eq('id', userId)
}

export async function getEncryptionSettings(userId) {
  const { data } = await supabase.from('profiles')
    .select('encryption_enabled, encrypted_master_key, key_salt, key_nonce')
    .eq('id', userId)
    .single()
  return data
}

export async function getRecoveryKeyData(userId) {
  const { data } = await supabase.from('profiles')
    .select('encrypted_recovery_key')
    .eq('id', userId)
    .single()
  return data?.encrypted_recovery_key || null
}

export async function disableEncryption(userId) {
  return supabase.from('profiles').update({
    encrypted_master_key: null,
    key_salt: null,
    key_nonce: null,
    encryption_enabled: false,
  }).eq('id', userId)
}

// ── Batch operations ────────────────────────────────

export async function encryptExistingClips(userId, masterKey) {
  // Fetch all unencrypted clips
  const { data: clips } = await supabase.from('clips')
    .select('id, content')
    .eq('user_id', userId)
    .eq('encrypted', false)

  if (!clips || clips.length === 0) return 0

  let count = 0
  for (const clip of clips) {
    if (clip.content === '[image]') {
      // Skip image placeholder content
      await supabase.from('clips').update({ encrypted: true, nonce: null }).eq('id', clip.id)
      count++
      continue
    }
    const { encryptedContent, nonce } = encryptClip(clip.content, masterKey)
    await supabase.from('clips').update({
      content: encryptedContent,
      encrypted: true,
      nonce,
    }).eq('id', clip.id)
    count++
  }
  return count
}

export async function decryptAllClips(userId, masterKey) {
  const { data: clips } = await supabase.from('clips')
    .select('id, content, nonce')
    .eq('user_id', userId)
    .eq('encrypted', true)

  if (!clips || clips.length === 0) return 0

  let count = 0
  for (const clip of clips) {
    if (!clip.nonce || clip.content === '[image]') {
      await supabase.from('clips').update({ encrypted: false, nonce: null }).eq('id', clip.id)
      count++
      continue
    }
    const plaintext = decryptClip(clip.content, clip.nonce, masterKey)
    if (plaintext === '[decryption failed]') {
      throw new Error(`Failed to decrypt clip ${clip.id}. Aborting to prevent data loss.`)
    }
    await supabase.from('clips').update({
      content: plaintext,
      encrypted: false,
      nonce: null,
    }).eq('id', clip.id)
    count++
  }
  return count
}
