# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Project: SnipSync

## What it is
Cross-device clipboard sync desktop app. Copy on Mac, paste on Windows (or vice versa). Lives in the system tray, syncs in real time via Supabase Realtime.

## Stack
- Electron 28 + React 18 + Vite 5
- Supabase (Postgres + Auth + Realtime + Storage)
- Desktop app (Mac/Windows) + Landing page (static HTML)
- Payments: Lemon Squeezy (pending approval)
- Error tracking: Sentry
- CI/CD: GitHub Actions
- Hosting: Vercel (website at snipsync.xyz)

## Local Dev
- `npm run dev` — starts Vite + Electron concurrently
- `npm test` — runs Vitest (27 tests)
- `npm run build` — vite build + electron-builder (Mac DMG)
- `npx electron-builder --win --x64` — Windows EXE (cross-compiled)
- Env vars in `.env` (loaded via direnv)
- Required env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Optional: `VITE_LS_CHECKOUT_URL` (Lemon Squeezy checkout)

## Structure
- `/src` — React frontend (components, lib, styles)
- `/electron` — Electron main process + preload
- `/website` — Landing page (deployed to snipsync.xyz via Vercel)
- `/supabase/functions` — Edge Functions (Lemon Squeezy webhook)
- `/dist` — Vite build output
- `/release` — Electron builder output (DMGs, EXEs)
- `/.github/workflows` — CI + Release workflows

## Key Architecture
- OAuth uses a local HTTP server on port 54321 (Electron can't receive OAuth redirects on file:// origins)
- All sync is Supabase Realtime — never poll. DELETE sync requires REPLICA IDENTITY FULL on clips table.
- Device identity uses SHA-256 hardware fingerprint (hostname + platform + arch + CPU + RAM + homedir) — survives reinstalls
- Clips loaded with `clip_tags(tag_id, tags(*))` join for tag filtering
- Image clips stored in Supabase Storage `clip-images` bucket, lazy-loaded via IntersectionObserver
- Clipboard auto-capture runs in Electron main process (1.5s interval, MD5 hash dedup)
- Free tier: 30 clips/month (resets 1st, deleting clips doesn't restore counter), 2 devices, 7-day history. Pro: unlimited.
- Account deletion: Settings → Danger zone → cascades all data. ensureProfile auto-recreates profile on next sign-in.
- Single instance lock on Windows (prevents multiple Electron instances)

## Encryption Architecture
- **Module**: `src/lib/crypto.js` — all encryption logic lives here
- **Algorithm**: tweetnacl XSalsa20-Poly1305 (`nacl.secretbox`)
- **Key derivation**: PBKDF2 100,000 iterations via Web Crypto API (`crypto.subtle`)
- **Flow**:
  1. User enables encryption in Settings, sets a vault password
  2. Random 256-bit master key generated (`nacl.randomBytes(32)`)
  3. Vault password → PBKDF2 → wrapping key → encrypts master key
  4. Encrypted master key + salt + nonce stored in `profiles` table
  5. 12-word recovery phrase generated, also used to encrypt master key separately
  6. On each device, user enters vault password → derives wrapping key → decrypts master key → cached in memory
- **Clip encryption**: Each clip gets its own random nonce. `content` field stores base64 encrypted blob. `encrypted` boolean + `nonce` column on clips table.
- **Recovery**: 12-word phrase from a 64-word wordlist. Stored as `encrypted_recovery_key` in profiles (format: `base64(encrypted):base64(salt):base64(nonce)`).
- **Recovery unlock flow**: "Forgot password?" → enter 12-word phrase → derives key → decrypts master key
- **Batch ops**: `encryptExistingClips()` and `decryptAllClips()` for enabling/disabling encryption
- **Zero-knowledge**: Server stores only encrypted blobs. Image placeholders (`[image]`) marked encrypted but not re-encrypted.
- **Profile columns**: `encrypted_master_key`, `key_salt`, `key_nonce`, `encryption_enabled`, `encrypted_recovery_key`
- **Clip columns**: `encrypted` (boolean), `nonce` (text)

## Conventions
- Never commit .env
- Brand name is "SnipSync" everywhere (not "Snip")
- App ID: xyz.snipsync.app
- Domain: snipsync.xyz
- Supabase project: kohwpkwcopkslbtkczag (EU region)
