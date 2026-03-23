import { describe, it, expect } from 'vitest'
import nacl from 'tweetnacl'
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util'

// Recreate core encrypt/decrypt (same logic as crypto.js, no Supabase dependency)

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
  if (!decrypted) return '[decryption failed]'
  return encodeUTF8(decrypted)
}

describe('encryption', () => {
  it('encrypts and decrypts text correctly', () => {
    const masterKey = nacl.randomBytes(32)
    const text = 'Hello, World!'
    const { encryptedContent, nonce } = encryptClip(text, masterKey)

    expect(encryptedContent).not.toBe(text)
    expect(nonce).toBeTruthy()

    const decrypted = decryptClip(encryptedContent, nonce, masterKey)
    expect(decrypted).toBe(text)
  })

  it('encrypts and decrypts URLs correctly', () => {
    const masterKey = nacl.randomBytes(32)
    const url = 'https://figma.com/file/abc123/Dashboard-v2?node-id=0:1'
    const { encryptedContent, nonce } = encryptClip(url, masterKey)
    const decrypted = decryptClip(encryptedContent, nonce, masterKey)
    expect(decrypted).toBe(url)
  })

  it('encrypts and decrypts code correctly', () => {
    const masterKey = nacl.randomBytes(32)
    const code = 'const x = { foo: "bar", arr: [1, 2, 3] };\nconsole.log(x);'
    const { encryptedContent, nonce } = encryptClip(code, masterKey)
    const decrypted = decryptClip(encryptedContent, nonce, masterKey)
    expect(decrypted).toBe(code)
  })

  it('encrypts and decrypts unicode/emoji correctly', () => {
    const masterKey = nacl.randomBytes(32)
    const text = '🔒 encrypted clip with émojis and ñ characters 日本語'
    const { encryptedContent, nonce } = encryptClip(text, masterKey)
    const decrypted = decryptClip(encryptedContent, nonce, masterKey)
    expect(decrypted).toBe(text)
  })

  it('encrypts and decrypts empty string', () => {
    const masterKey = nacl.randomBytes(32)
    const { encryptedContent, nonce } = encryptClip('', masterKey)
    const decrypted = decryptClip(encryptedContent, nonce, masterKey)
    expect(decrypted).toBe('')
  })

  it('encrypts and decrypts long text (10K chars)', () => {
    const masterKey = nacl.randomBytes(32)
    const longText = 'a'.repeat(10000)
    const { encryptedContent, nonce } = encryptClip(longText, masterKey)
    const decrypted = decryptClip(encryptedContent, nonce, masterKey)
    expect(decrypted).toBe(longText)
  })

  it('fails to decrypt with wrong key', () => {
    const masterKey = nacl.randomBytes(32)
    const wrongKey = nacl.randomBytes(32)
    const { encryptedContent, nonce } = encryptClip('secret', masterKey)
    const result = decryptClip(encryptedContent, nonce, wrongKey)
    expect(result).toBe('[decryption failed]')
  })

  it('fails to decrypt with wrong nonce', () => {
    const masterKey = nacl.randomBytes(32)
    const { encryptedContent } = encryptClip('secret', masterKey)
    const wrongNonce = encodeBase64(nacl.randomBytes(24))
    const result = decryptClip(encryptedContent, wrongNonce, masterKey)
    expect(result).toBe('[decryption failed]')
  })

  it('produces different ciphertext for same content (random nonce)', () => {
    const masterKey = nacl.randomBytes(32)
    const text = 'same content'
    const enc1 = encryptClip(text, masterKey)
    const enc2 = encryptClip(text, masterKey)
    expect(enc1.encryptedContent).not.toBe(enc2.encryptedContent)
    expect(enc1.nonce).not.toBe(enc2.nonce)
  })

  it('different master keys produce different ciphertext', () => {
    const key1 = nacl.randomBytes(32)
    const key2 = nacl.randomBytes(32)
    const text = 'test content'
    const enc1 = encryptClip(text, key1)
    const enc2 = encryptClip(text, key2)
    expect(enc1.encryptedContent).not.toBe(enc2.encryptedContent)
  })
})
