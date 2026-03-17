# SnipSync — End-to-End Encryption Plan

## The Problem

All clip content is stored as **plain text** in the Supabase Postgres database. Anyone with database access (Supabase dashboard, DB admins, a breach) can read every user's clips. For a clipboard app that handles passwords, API keys, personal messages, code, and business information — this is a critical privacy failure.

## The Goal

**Zero-knowledge encryption** — the server stores only encrypted blobs. SnipSync (the company) cannot read user clips, even if compelled to. Only the user's own devices can decrypt.

## Architecture

### How it works

```
User's device                          Supabase
─────────────                          ────────

"my secret text"
       │
       ▼
  encrypt(masterKey, plaintext)
       │
       ▼
  "x8f2k9...encrypted blob"  ──────►  stores encrypted blob
                                       (cannot read it)

  On another device:

  "x8f2k9...encrypted blob"  ◄──────  sends encrypted blob
       │
       ▼
  decrypt(masterKey, blob)
       │
       ▼
  "my secret text"
```

### Key Management

**Master Key** — a random 256-bit key that encrypts/decrypts all clips. Generated once per user.

**The hard question: How do multiple devices get the master key?**

Two options:

---

### Option A: Vault Password (Recommended)

User sets a separate "vault password" when enabling encryption.

```
vault password  ──►  PBKDF2 (100,000 iterations)  ──►  derived key
                                                            │
                                                            ▼
                                                   decrypt(master key)
                                                            │
                                                            ▼
                                                   use master key to
                                                   encrypt/decrypt clips
```

**Flow:**
1. User enables encryption in Settings
2. User sets a vault password (e.g., "correct horse battery staple")
3. App generates a random 256-bit master key
4. App derives a wrapping key from the vault password via PBKDF2
5. App encrypts the master key with the wrapping key
6. Encrypted master key + PBKDF2 salt stored in `profiles` table
7. On each new device, user enters vault password → derives wrapping key → decrypts master key
8. Master key cached in memory (never written to disk)

**Pros:**
- True zero-knowledge — server never sees the password or derived key
- Industry standard (1Password, Bitwarden, Standard Notes all do this)
- PBKDF2 is slow by design — brute force is impractical

**Cons:**
- User must remember vault password
- Must enter it on each new device
- If forgotten, ALL encrypted clips are irrecoverably lost (this is the point)

**Recovery:**
- No recovery by design (zero-knowledge means we can't help)
- User can export clips before enabling encryption
- Optional: recovery key (random 24-word phrase) shown once during setup, user writes it down

---

### Option B: Automatic Key Sync (Convenient, less secure)

No vault password — key is generated automatically and synced between devices.

```
Google OAuth session  ──►  derive key from auth token  ──►  decrypt master key
```

**Pros:**
- Zero friction — encryption is invisible to the user
- No password to remember

**Cons:**
- NOT true zero-knowledge — the auth token exists on the server, so Supabase could theoretically derive the key
- If Google account is compromised, clips are compromised
- Doesn't protect against a Supabase breach

**Verdict:** This is "encryption at rest" but not true E2E. Better than nothing, but doesn't solve the core problem.

---

### Recommendation: Option A (Vault Password)

It's the only way to achieve true zero-knowledge. The UX friction is worth it — users who care about encryption (and they will) expect a vault password.

## Implementation Plan

### Phase 1: Core encryption

**Library:** `tweetnacl-js` (already in PLAN.md)
- 8KB minified, zero dependencies
- NaCl secretbox (XSalsa20-Poly1305) for symmetric encryption
- Audited, battle-tested

**Schema changes:**
```sql
ALTER TABLE profiles ADD COLUMN encrypted_master_key text;
ALTER TABLE profiles ADD COLUMN key_salt text;
ALTER TABLE profiles ADD COLUMN encryption_enabled boolean DEFAULT false;
```

**New columns on clips:**
```sql
ALTER TABLE clips ADD COLUMN encrypted boolean DEFAULT false;
ALTER TABLE clips ADD COLUMN nonce text;  -- per-clip random nonce
```

### Phase 2: Client-side implementation

**Key generation (first time):**
```js
import nacl from 'tweetnacl'
import { pbkdf2Sync } from 'pbkdf2'  // or Web Crypto API

// 1. Generate master key
const masterKey = nacl.randomBytes(32)

// 2. Derive wrapping key from vault password
const salt = nacl.randomBytes(16)
const wrappingKey = pbkdf2Sync(vaultPassword, salt, 100000, 32, 'sha256')

// 3. Encrypt master key
const nonce = nacl.randomBytes(24)
const encryptedMasterKey = nacl.secretbox(masterKey, nonce, wrappingKey)

// 4. Store encrypted master key + salt in profiles table
// Server never sees masterKey or vaultPassword
```

**Encrypting a clip:**
```js
const nonce = nacl.randomBytes(24)
const encrypted = nacl.secretbox(
  new TextEncoder().encode(clipContent),
  nonce,
  masterKey
)
// Store: base64(encrypted) + base64(nonce)
// Content field becomes the encrypted blob
```

**Decrypting a clip:**
```js
const decrypted = nacl.secretbox.open(encrypted, nonce, masterKey)
const plaintext = new TextDecoder().decode(decrypted)
```

### Phase 3: UX flow

**Enabling encryption:**
1. Settings → "Enable end-to-end encryption"
2. Warning: "Your clips will be encrypted. Only you can read them. If you forget your vault password, your clips cannot be recovered."
3. User sets vault password (min 8 chars, strength meter)
4. Show recovery key (24 words) — user must confirm they saved it
5. Encrypt all existing clips (migration, show progress bar)
6. Done — all future clips auto-encrypted

**On new device:**
1. Sign in with Google (as normal)
2. App detects encryption is enabled for this user
3. Prompt: "Enter your vault password to decrypt your clips"
4. If correct → master key decrypted, clips readable
5. If wrong → error, retry
6. Master key cached in memory for the session

**Disabling encryption:**
1. Enter vault password to confirm
2. Decrypt all clips back to plaintext
3. Remove encrypted_master_key from profile
4. Clips stored as plaintext going forward

### Phase 4: Edge cases

**Search:**
- Encrypted clips can't be searched server-side
- All search must be client-side (already is — no change needed)
- Filter by type still works if `type` is stored unencrypted (metadata vs content)

**Realtime sync:**
- Encrypted clips arrive as blobs via Realtime
- Decrypted on the client before display
- No change to Realtime infrastructure

**Image clips:**
- Images encrypted before upload to Supabase Storage
- Stored as encrypted blobs (not viewable in dashboard)
- Decrypted client-side before displaying thumbnail

**Browser extension:**
- Same encryption, same vault password prompt
- Web Crypto API for PBKDF2 (no Node.js dependency)
- tweetnacl-js works in browser

**Export:**
- CSV/JSON export always exports decrypted content
- User must have vault password entered (master key in memory)

**Team features (future):**
- Each team has a team key
- Team key encrypted per-member with their master key
- When a clip is shared to a channel, it's re-encrypted with the team key
- More complex, but same principles

### Phase 5: What stays unencrypted

These fields remain plaintext (metadata, not content):
- `type` (link, code, note, etc.) — needed for filtering
- `created_at`, `updated_at`
- `device_id` — needed for device badge display
- `pinned` — needed for sorting
- `user_id` — needed for RLS

Only `content` and `image_path` data are encrypted.

## Security Properties

| Property | Status |
|----------|--------|
| Server can read clips | **No** (zero-knowledge) |
| Supabase admin can read clips | **No** |
| Database breach exposes clips | **No** (only encrypted blobs) |
| Google account compromise exposes clips | **No** (vault password separate) |
| SnipSync (the company) can read clips | **No** |
| User forgets vault password | **Clips are lost** (by design) |
| MITM attack | **Protected** (TLS + encryption) |
| Device theft | **Protected** (key only in memory, not on disk) |

## Privacy Policy Update

When encryption ships, update privacy.html:
- "SnipSync offers optional end-to-end encryption. When enabled, your clip content is encrypted on your device before being transmitted. We cannot read, access, or recover your encrypted clips. Only you hold the decryption key."

## Timeline

This is a **Phase 5 feature** (after team features). Estimated effort: 2-3 sessions.

### Build order:
1. Add tweetnacl-js dependency
2. Schema migration (encrypted_master_key, key_salt, nonce columns)
3. Key generation + vault password UI in Settings
4. Encrypt/decrypt functions in supabase.js
5. Migrate existing clips (encrypt in batches)
6. Update ClipCard to decrypt on render
7. Update browser extension with same encryption
8. Recovery key flow
9. Tests for encrypt/decrypt round-trip
10. Update privacy policy

## Cost

- tweetnacl-js: 0 (MIT license, 8KB)
- No server-side changes needed (just stores blobs)
- No extra Supabase cost
- No external API calls
