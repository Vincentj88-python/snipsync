// Encryption module for the Chrome extension
// Uses tweetnacl (loaded globally as window.nacl) + Web Crypto API for PBKDF2
;(function() {

// ── Base64 helpers ─────────────────────────────────

function encodeBase64(u8) {
  return btoa(String.fromCharCode.apply(null, u8))
}

function decodeBase64(s) {
  const raw = atob(s)
  const u8 = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) u8[i] = raw.charCodeAt(i)
  return u8
}

function decodeUTF8(s) {
  return new TextEncoder().encode(s)
}

function encodeUTF8(u8) {
  return new TextDecoder().decode(u8)
}

// ── Key derivation (PBKDF2 via Web Crypto) ─────────

async function deriveKey(password, salt, iterations = 600000) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    256
  )
  return new Uint8Array(bits)
}

// ── Unlock master key ──────────────────────────────

async function unlockMasterKey(vaultPassword, encryptedMasterKeyB64, saltB64, nonceB64) {
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

// ── Clip encryption/decryption ─────────────────────

function encryptClip(content, masterKey) {
  const nonce = nacl.randomBytes(24)
  const messageBytes = decodeUTF8(content)
  const encrypted = nacl.secretbox(messageBytes, nonce, masterKey)
  return {
    encryptedContent: encodeBase64(encrypted),
    nonce: encodeBase64(nonce),
  }
}

function decryptClip(encryptedContent, nonceB64, masterKey) {
  const encrypted = decodeBase64(encryptedContent)
  const nonce = decodeBase64(nonceB64)
  const decrypted = nacl.secretbox.open(encrypted, nonce, masterKey)
  if (!decrypted) {
    throw new Error('Decryption failed')
  }
  return encodeUTF8(decrypted)
}

// ── Export ──────────────────────────────────────────

window.SnipCrypto = {
  unlockMasterKey,
  encryptClip,
  decryptClip,
}

})();
