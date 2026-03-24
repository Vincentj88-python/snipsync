# SnipSync — Outstanding Issues

**Audit Date:** 2026-03-24

---

## CRITICAL (fix before beta)

| # | Issue | Location | Status |
|---|-------|----------|--------|
| 1 | ~~Privacy policy says "we don't read your clipboard"~~ | `website/privacy.html` | FIXED |
| 2 | ~~Free tier limit inconsistency~~ — confirmed unlimited clips is correct, CLAUDE.md updated | `CLAUDE.md` | FIXED |
| 3 | **Webhook `JSON.parse` has no try-catch** — malformed body crashes the function | `ls-webhook/index.ts:39`, `ls-team-webhook/index.ts:37` | |
| 4 | **Webhook DB writes don't check errors** — returns 200 OK even if upsert fails, Lemon Squeezy won't retry | `ls-webhook`, `ls-team-webhook` | |
| 5 | **Biased recovery phrase generation** — `randomBytes(1)[0] % 232` creates non-uniform distribution, reducing entropy | `src/lib/crypto.js:96` | |

---

## HIGH

| # | Issue | Location | Status |
|---|-------|----------|--------|
| 6 | **Encrypted clip race condition** — clip inserted with `encrypted: false`, then updated separately. Other devices briefly see ciphertext as plaintext | `App.jsx:415-429` | |
| 7 | **`deleteAccount` doesn't check if edge function succeeded** — user gets signed out but data may not be deleted | `src/lib/supabase.js:28-40` | |
| 8 | ~~Terms of Service claims "SnipSync is free"~~ | `website/terms.html` | FIXED |
| 9 | **OAuth server has no request body size limit** — unbounded memory allocation on `/token` | `electron/main.js:209-227` | |
| 10 | **Invite accept has race condition** — `use_count` check + increment is non-atomic, seat limit check is TOCTOU | `accept-invite/index.ts:86,139` | |
| 11 | **Record-deletion doesn't check errors on any step** — can leave account in broken state | `record-deletion/index.ts:73-82` | |
| 12 | **Wildcard CORS (`*`) on authenticated endpoints** — should restrict to snipsync.xyz | `send-email`, `record-deletion`, `check-deleted`, `accept-invite` | |
| 13 | **Health endpoint uses service-role key with no auth** | `health/index.ts:10-13` | |
| 14 | **Channel subscription not cleaned up on team switch** | `TeamView.jsx:69-101` | |
| 15 | **Batch encrypt/decrypt is not atomic** — interruption leaves DB in mixed encrypted/plaintext state | `crypto.js:222-277` | |
| 16 | ~~Inconsistent logos across pages~~ | Website | FIXED |
| 17 | ~~Security disclosure uses personal Gmail~~ | `website/security.html` | FIXED |

---

## MEDIUM (should fix for beta)

| # | Issue | Location | Status |
|---|-------|----------|--------|
| 18 | ~~CLAUDE.md says PBKDF2 100K iterations, code uses 600K~~ | `CLAUDE.md` | FIXED |
| 19 | `detectType` too aggressive — `(yes)` or `2 > 1` detected as code | `utils.js:4` | |
| 20 | Signed URLs expire in 15 min, never refreshed | `supabase.js:210,244` | |
| 21 | Login-at-startup forced on every launch, overriding user preference | `electron/main.js:362-368` | |
| 22 | Window hides on any blur (DevTools, file picker, etc.) | `electron/main.js:86-88` | |
| 23 | Auto-capture doesn't re-run when encryption is enabled mid-session | `App.jsx:489` | |
| 24 | Browser fallback generates new machineId on every page load | `App.jsx:108` | |
| 25 | Collection clips in TeamView not decrypted | `TeamView.jsx:437` | |
| 26 | No loading state during initial setup after auth | `App.jsx:190-360` | |
| 27 | `lastSyncedAt` display never updates (no timer) | `App.jsx:1161` | |
| 28 | Force-reset deletes clips one at a time (no batch) | `SettingsView.jsx:658-666` | |
| 29 | CI Mac builds are unsigned (CSC_IDENTITY_AUTO_DISCOVERY: false) | `.github/workflows/release.yml` | |
| 30 | No tests in release workflow | `.github/workflows/release.yml` | |
| 31 | Electron 6 major versions behind (security risk) | `package.json` | |
| 32 | `plan` column stores status values in team webhook | `ls-team-webhook/index.ts:62` | |
| 33 | No webhook replay protection (no timestamp check) | `ls-webhook`, `ls-team-webhook` | |
| 34 | ~~No mobile nav (links hidden, no hamburger menu)~~ | Website | FIXED |
| 35 | ~~Waitlist form has no accessible label~~ | `website/index.html` | FIXED |
| 36 | Post-launch: no code swaps waitlist form for download buttons | `website/script.js:251` | PARTIAL — CTAs update text, but download section still shows waitlist form |

---

## LOW (nice to fix)

| # | Issue | Location | Status |
|---|-------|----------|--------|
| 37 | `sanitizeText` strips `&` (breaks URLs) and is never actually imported | `sanitize.js` | |
| 38 | Hardcoded version `v0.3.1` in Settings | `SettingsView.jsx:853` | |
| 39 | Hardcoded pricing `$4.99/month` | `SettingsView.jsx:270` | |
| 40 | Sentry DSN hardcoded in source | `main.jsx:10`, `main.js:34` | |
| 41 | ErrorBoundary doesn't report to Sentry | `ErrorBoundary.jsx:14` | |
| 42 | Mac build is arm64 only (no Intel support) | `package.json` | |
| 43 | No source maps uploaded to Sentry | Build config | |
| 44 | Context menu can render off-screen | `ClipCard.jsx:159` | |
| 45 | Toast timer resets on parent re-render | `Toast.jsx:13` | |
| 46 | ClipCard Pin/Delete throw in TeamView (missing props) | `ClipCard.jsx` | |
| 47 | `@mention` regex doesn't support hyphens in names | `supabase.js:425` | |
| 48 | ~~Legal pages missing meta/OG tags~~ | Website | FIXED |
| 49 | ~~No CSP header in Vercel config~~ | `website/vercel.json` | FIXED |
| 50 | ~~Privacy says "contact us to delete" but app has self-service deletion~~ | `privacy.html` | FIXED |

---

## WEBSITE EXTRAS FIXED

| Issue | Status |
|-------|--------|
| Privacy/terms footers missing Security link | FIXED |
| Privacy/terms nav missing cross-links | FIXED |
| Security page missing nav links | FIXED |
| Security page missing footer brand logo | FIXED |
| Security page missing Vercel analytics | FIXED |
| Legal pages missing canonical URLs | FIXED |
| Free pricing card missing divider | FIXED |
| Decorative SVGs missing aria-hidden | FIXED |
| Vercel clean URLs not enabled | FIXED |
| Countdown post-launch targets wrong elements | FIXED |
| Privacy policy missing Sentry/Lemon Squeezy/Resend in third-party table | FIXED |
| Privacy policy export claim outdated | FIXED |
| GitHub repo link removed (security page + footer) | FIXED |
| Last updated dates on legal pages | FIXED |

---

## TEST COVERAGE

**38 tests pass** across 4 files. Major gaps:

- **7 of 8 components have zero tests** (only Toast is tested)
- **`sanitize.js` has zero tests** (security-critical)
- **`crypto.test.js` re-implements functions** instead of importing from the real module — doesn't test actual app code
- **`supabase.test.js` assertions are weak** — only check table name, not arguments
- **Electron main process is completely untested**

---

## TOP REMAINING ACTIONS BEFORE APRIL 7 BETA LAUNCH

1. Add try-catch + error checking to webhook edge functions (#3, #4)
2. Fix encrypted clip race condition — atomic insert (#6)
3. Fix `deleteAccount` to check edge function response (#7)
4. Add body size limit to OAuth server (#9)
5. Fix biased recovery phrase generation (#5)
6. Fix invite accept race condition (#10)
7. Fix record-deletion error handling (#11)
8. Restrict CORS to snipsync.xyz (#12)
9. Fix forced login-at-startup overriding user preference (#21)
10. Fix channel subscription cleanup on team switch (#14)
