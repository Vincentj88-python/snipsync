# SnipSync Mobile — React Native App Plan

## Overview

React Native companion app for SnipSync. Same Supabase backend, same account, same clips. No in-app purchases, no pricing UI — the app simply respects the user's subscription status from the database.

## Monetization Approach

- **No IAP, no pricing, no upgrade prompts in the mobile app**
- Free users get the same free limits as desktop (2 devices, 30 clips/month, 7-day history, text only)
- Pro users get full access (unlimited everything, images, files)
- Users upgrade via the desktop app or snipsync.xyz — the mobile app never mentions money
- Apple/Google get zero commission
- Compliant with App Store Guideline 3.1.3(b) "Multiplatform Services" and 4.2 (Minimum Functionality — free tier provides real utility)

## Tech Stack

- React Native (bare workflow, not Expo managed — needed for share extensions)
- Same Supabase backend (Postgres + Auth + Realtime + Storage)
- `react-native-quick-crypto` for PBKDF2 (replaces Web Crypto API)
- `@react-native-google-signin/google-signin` + `supabase.auth.signInWithIdToken`

## Code Reuse from Desktop

| Module | Reuse | Adaptation |
|---|---|---|
| `src/lib/supabase.js` | 90% | Swap env vars, replace auth with `signInWithIdToken`, remove `window.electronAPI` |
| `src/lib/crypto.js` | 80% | Replace `crypto.subtle` PBKDF2 with `react-native-quick-crypto` |
| `src/lib/utils.js` | 100% | Copy directly, extend `mapPlatform` for ios/android |
| `src/App.jsx` state logic | 70% | Extract into shared hooks |
| All React components | 0% | Rewrite with React Native primitives |

## Project Structure

```
mobile/
  package.json
  app.json
  index.js

  src/
    lib/
      supabase.js          # Adapted from desktop
      crypto.js             # Adapted: PBKDF2 via quick-crypto
      utils.js              # Direct copy + mapPlatform extension
      config.js             # Supabase URL, keys, constants
      storage.js            # AsyncStorage wrappers (replaces localStorage)

    hooks/
      useAuth.js            # Auth state, sign-in, sign-out
      useDeviceRegistration.js
      useClipSync.js        # CRUD, realtime, optimistic UI, decrypt
      useEncryption.js      # Vault state, master key, auto-lock
      useSubscription.js    # Plan, usage, limits

    screens/
      SignInScreen.js
      ClipListScreen.js     # Main screen — FlatList, pull-to-refresh, realtime
      VaultUnlockScreen.js  # Modal for encrypted vaults
      SettingsScreen.js
      ComposeScreen.js      # Phase 2

    components/
      ClipCard.js
      PlatformIcon.js
      Toast.js
      FilterBar.js
      SearchBar.js
      ImageThumbnail.js     # Phase 2
      FileThumbnail.js      # Phase 3

    navigation/
      AppNavigator.js       # React Navigation stack

    theme/
      colors.js             # Dark theme (from existing CSS values)
      spacing.js

  ios/
    SnipSync/
      ShareExtension/       # Phase 2

  android/
    app/src/main/java/.../
      ShareActivity.java    # Phase 2
```

## Phases

### Phase 1 — Read + Copy (MVP)

**Goal:** Sign in, see clips in real time, tap to copy, vault unlock.

**Features:**
- Google Sign-In (native SDK → `signInWithIdToken` → same Supabase user)
- Clip list with real-time sync (Supabase Realtime)
- Tap to copy any clip
- Pull-to-refresh
- Device registration (counts toward device limit)
- Vault password unlock for encrypted clips
- Clip type badges, device badges, time ago
- Dark theme matching desktop app
- Offline cache (last-fetched clips in AsyncStorage, "Last synced X ago")

**Dependencies:**
```
@supabase/supabase-js
tweetnacl + tweetnacl-util
react-native-quick-crypto
@react-native-google-signin/google-signin
@react-native-clipboard/clipboard
@react-native-async-storage/async-storage
@react-navigation/native + native-stack
react-native-device-info
react-native-svg
react-native-url-polyfill
```

**Supabase changes:** None. Just add iOS/Android Google OAuth client IDs to the Google provider config in the Supabase dashboard.

**Implementation order:**
1. Init React Native project (bare workflow)
2. Set up config with Supabase URL + anon key
3. Copy + adapt `supabase.js`, `crypto.js`, `utils.js`
4. Create AsyncStorage wrapper (`storage.js`)
5. Extract hooks from App.jsx logic
6. Build SignInScreen
7. Build ClipListScreen with FlatList + Realtime
8. Build ClipCard component
9. Build VaultUnlockScreen modal
10. Build basic SettingsScreen (account info, sign out, device list)
11. Test end-to-end: sign in on phone, see desktop clips in real time, tap to copy

### Phase 2 — Send from Phone

**Goal:** Create clips, share sheet integration, photo → image clip.

**Features:**
- Compose screen (text input + send)
- iOS Share Extension ("Share to SnipSync" from Safari, Notes, etc.)
- Android Share Intent receiver
- Camera roll → image clip
- Encrypt outbound clips if vault is unlocked

**Dependencies (additional):**
```
react-native-share-menu
react-native-image-picker
```

**Supabase changes:** None. Same `addClip`, `uploadClipImage` functions.

### Phase 3 — Full Parity

**Goal:** Files, tags, push notifications, full encryption setup.

**Features:**
- File upload via document picker
- Tags and filtering
- Push notifications ("New clip received")
- Full encryption setup (set vault password, recovery phrase)
- Biometric unlock (Face ID / Touch ID) for vault

**Dependencies (additional):**
```
react-native-document-picker
react-native-blob-util
@react-native-firebase/app + messaging
react-native-biometrics
```

**Supabase changes:**
- New table: `push_tokens` (user_id, device_id, token, platform)
- New edge function: `send-push-notification` (triggered on clip INSERT)
- RLS: users can only read/write their own push tokens

## Crypto Approach

Desktop uses `crypto.subtle.deriveBits` (Web Crypto API) for PBKDF2. React Native doesn't have Web Crypto.

**Solution:** `react-native-quick-crypto` — native C++ PBKDF2 via JSI. 600K iterations in ~200ms (native speed). The adaptation in `crypto.js`:

```javascript
// Desktop (Web Crypto):
const bits = await crypto.subtle.deriveBits(
  { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
  keyMaterial, 256
)

// Mobile (quick-crypto):
import { pbkdf2Sync } from 'react-native-quick-crypto'
const bits = pbkdf2Sync(password, salt, 600000, 32, 'sha256')
```

Everything else in `crypto.js` (tweetnacl, encryptClip, decryptClip, recovery phrase) works unchanged.

## Auth Approach

Desktop uses a local HTTP server for Google OAuth redirect. Mobile uses native Google Sign-In:

```javascript
import { GoogleSignin } from '@react-native-google-signin/google-signin'

const { idToken } = await GoogleSignin.signIn()
const { data, error } = await supabase.auth.signInWithIdToken({
  provider: 'google',
  token: idToken,
})
```

Same Supabase user, same `user.id`, same data. Just a different auth entry point.

## Device Identity

- Generate UUID on first launch, store in AsyncStorage (or `expo-secure-store`)
- Register with platform `ios` or `android`
- Extend `mapPlatform()`: `ios` → `iOS`, `android` → `Android`

## App Store Requirements

### iOS
- Apple Developer account ($99/yr — already needed for Mac notarization)
- Privacy nutrition labels: clipboard access, network usage, Google Sign-In
- No IAP — app provides free utility, Pro checked server-side

### Android
- Google Play Developer account ($25 one-time)
- Target SDK 34+
- Permissions: INTERNET, READ_EXTERNAL_STORAGE (for image/file picking)
- No Google Play Billing — subscription managed server-side

### Both
- Privacy policy: snipsync.xyz/privacy.html (already exists)
- Terms of service: snipsync.xyz/terms.html (already exists)
- App icons at all required sizes (already have in Logos/ folder)
