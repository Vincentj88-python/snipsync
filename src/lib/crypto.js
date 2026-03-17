import nacl from 'tweetnacl'
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util'
import { supabase } from './supabase'

// ── PBKDF2 key derivation (Web Crypto API) ──────────

async function deriveKey(password, salt) {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
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

  return {
    masterKey,
    encryptedMasterKey: encodeBase64(encryptedMasterKey),
    salt: encodeBase64(salt),
    nonce: encodeBase64(nonce),
  }
}

export async function unlockMasterKey(vaultPassword, encryptedMasterKeyB64, saltB64, nonceB64) {
  const salt = decodeBase64(saltB64)
  const wrappingKey = await deriveKey(vaultPassword, salt)
  const encryptedMasterKey = decodeBase64(encryptedMasterKeyB64)
  const nonce = decodeBase64(nonceB64)

  const masterKey = nacl.secretbox.open(encryptedMasterKey, nonce, wrappingKey)
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

// ── Profile encryption settings ─────────────────────

export async function saveEncryptionKeys(userId, encryptedMasterKey, salt, nonce) {
  return supabase.from('profiles').update({
    encrypted_master_key: encryptedMasterKey,
    key_salt: salt,
    key_nonce: nonce,
    encryption_enabled: true,
  }).eq('id', userId)
}

export async function getEncryptionSettings(userId) {
  const { data } = await supabase.from('profiles')
    .select('encryption_enabled, encrypted_master_key, key_salt, key_nonce')
    .eq('id', userId)
    .single()
  return data
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
      await supabase.from('clips').update({ encrypted: true, nonce: '' }).eq('id', clip.id)
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
    await supabase.from('clips').update({
      content: plaintext,
      encrypted: false,
      nonce: null,
    }).eq('id', clip.id)
    count++
  }
  return count
}
