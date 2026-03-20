import nacl from 'tweetnacl'
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util'
import { pbkdf2Sync } from 'react-native-quick-crypto'
import { supabase } from './supabase'

// PBKDF2 key derivation (react-native-quick-crypto)
function deriveKey(password, salt, iterations = 600000) {
  const derived = pbkdf2Sync(password, Buffer.from(salt), iterations, 32, 'sha256')
  return new Uint8Array(derived)
}

// Unlock master key with vault password
// Tries 600K iterations first (new), then 100K (legacy) for backward compatibility
export async function unlockMasterKey(vaultPassword, encryptedMasterKeyB64, saltB64, nonceB64) {
  const salt = decodeBase64(saltB64)
  const encryptedMasterKey = decodeBase64(encryptedMasterKeyB64)
  const nonce = decodeBase64(nonceB64)

  // Try current iteration count (600K)
  let wrappingKey = deriveKey(vaultPassword, salt, 600000)
  let masterKey = nacl.secretbox.open(encryptedMasterKey, nonce, wrappingKey)

  // Fall back to legacy iteration count (100K)
  if (!masterKey) {
    wrappingKey = deriveKey(vaultPassword, salt, 100000)
    masterKey = nacl.secretbox.open(encryptedMasterKey, nonce, wrappingKey)
  }

  if (!masterKey) {
    throw new Error('Wrong vault password')
  }
  return masterKey
}

// Clip encryption/decryption
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
  if (!decrypted) return '[decryption failed]'
  return encodeUTF8(decrypted)
}

// Encryption settings
export async function getEncryptionSettings(userId) {
  const { data } = await supabase.from('profiles')
    .select('encryption_enabled, encrypted_master_key, key_salt, key_nonce')
    .eq('id', userId).single()
  return data
}
