import React, { useState, useMemo } from 'react'
import { supabase, PLAN_LIMITS, deleteAccount } from '../lib/supabase'
import {
  generateMasterKey,
  unlockMasterKey,
  unlockWithRecoveryPhrase,
  saveEncryptionKeys,
  getEncryptionSettings,
  getRecoveryKeyData,
  encryptExistingClips,
  decryptAllClips,
  disableEncryption,
} from '../lib/crypto'

function escapeCsvField(value) {
  const str = String(value ?? '')
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

function triggerDownload(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function getPasswordStrength(password) {
  if (!password || password.length < 8) return 0
  let score = 1 // weak
  if (password.length >= 12) score = 2 // fair
  if (password.length >= 12 && /[a-z]/.test(password) && /[A-Z]/.test(password)) score = 3 // good
  if (password.length >= 16 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^a-zA-Z0-9]/.test(password)) score = 4 // strong
  return score
}

const strengthLevels = ['', 'weak', 'fair', 'good', 'strong']

function PasswordStrengthBar({ password }) {
  const strength = getPasswordStrength(password)
  if (!password) return null
  return (
    <div className="password-strength">
      {[1, 2, 3, 4].map((level) => (
        <div
          key={level}
          className={`password-strength-segment ${strength >= level ? `password-strength-segment--${strengthLevels[level]}` : ''}`}
        />
      ))}
    </div>
  )
}

function PasswordInput({ value, onChange, placeholder, autoFocus, onKeyDown }) {
  const [visible, setVisible] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={visible ? 'text' : 'password'}
        className="settings-vault-input"
        style={{ paddingRight: '36px' }}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoFocus={autoFocus}
        onKeyDown={onKeyDown}
      />
      <button
        style={{
          position: 'absolute',
          right: '8px',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          color: '#666',
          fontSize: '13px',
          padding: '2px',
          cursor: 'pointer',
        }}
        onClick={() => setVisible(!visible)}
        type="button"
        tabIndex={-1}
      >
        {visible ? '◉' : '○'}
      </button>
    </div>
  )
}

function RecoveryPhraseDisplay({ phrase, onDone }) {
  const words = phrase.split(' ')
  return (
    <div className="settings-vault-form" style={{ background: '#0e1a0e', border: '1px solid #1a3a1a', borderRadius: '8px', padding: '12px' }}>
      <p className="settings-toggle-label" style={{ color: '#22c55e', marginBottom: '6px' }}>Save your recovery phrase</p>
      <p className="settings-toggle-desc" style={{ marginBottom: '8px' }}>
        Write this down and keep it safe. If you forget your vault password, this is the only way to recover your clips.
      </p>
      <div className="recovery-phrase-grid">
        {words.map((word, i) => (
          <div key={i} className="recovery-phrase-chip">
            <span className="recovery-phrase-chip-num">{i + 1}.</span>
            {word}
          </div>
        ))}
      </div>
      <button
        className="settings-export-btn recovery-phrase-copy"
        onClick={() => navigator.clipboard.writeText(phrase)}
      >
        Copy phrase
      </button>
      <button className="settings-upgrade-btn" style={{ marginTop: '4px' }} onClick={onDone}>
        I've saved it
      </button>
    </div>
  )
}

export default function SettingsView({ subscription, usage, user, devices, clips, autoCapture, onToggleAutoCapture, openAtLogin, onToggleOpenAtLogin, encryptionEnabled, vaultLocked, onVaultUnlock, onEncryptionChange, onSignOut, onUpgrade }) {
  const plan = subscription?.plan || 'free'
  const limits = PLAN_LIMITS[plan]
  const isPro = plan === 'pro'
  const [vaultPassword, setVaultPassword] = useState('')
  const [vaultPasswordConfirm, setVaultPasswordConfirm] = useState('')
  const [vaultAction, setVaultAction] = useState(null) // 'setup' | 'unlock' | 'recover' | 'disable' | 'force-reset'
  const [recoverToDisable, setRecoverToDisable] = useState(false)
  const [vaultLoading, setVaultLoading] = useState(false)
  const [vaultError, setVaultError] = useState('')
  const [migrationProgress, setMigrationProgress] = useState(null)
  const [recoveryPhrase, setRecoveryPhrase] = useState(null)
  const [recoveryInput, setRecoveryInput] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const clipPercent = limits.maxClipsPerMonth === Infinity ? 0 : Math.min(100, (usage.clips / limits.maxClipsPerMonth) * 100)
  const devicePercent = limits.maxDevices === Infinity ? 0 : Math.min(100, (usage.devices / limits.maxDevices) * 100)

  return (
    <div className="settings-view">
      {/* Plan card */}
      <div className="settings-section">
        <div className="settings-plan-card">
          <div className="settings-plan-header">
            <div className="settings-plan-name">
              <span className={`settings-plan-badge settings-plan-badge--${plan}`}>
                {isPro ? 'PRO' : 'FREE'}
              </span>
              <span className="settings-plan-email">{user?.email}</span>
            </div>
            {!isPro && (
              <button className="settings-upgrade-btn" onClick={onUpgrade}>
                Upgrade to Pro
              </button>
            )}
          </div>

          {/* Usage meters */}
          <div className="settings-usage">
            <div className="settings-meter">
              <div className="settings-meter-header">
                <span className="settings-meter-label">Clips this month</span>
                <span className="settings-meter-value">
                  {usage.clips}{limits.maxClipsPerMonth === Infinity ? '' : ` / ${limits.maxClipsPerMonth}`}
                </span>
              </div>
              {!isPro && (
                <div className="settings-meter-bar">
                  <div
                    className={`settings-meter-fill ${clipPercent > 80 ? 'settings-meter-fill--warn' : ''}`}
                    style={{ width: `${clipPercent}%` }}
                  />
                </div>
              )}
            </div>

            <div className="settings-meter">
              <div className="settings-meter-header">
                <span className="settings-meter-label">Devices</span>
                <span className="settings-meter-value">
                  {usage.devices}{limits.maxDevices === Infinity ? '' : ` / ${limits.maxDevices}`}
                </span>
              </div>
              {!isPro && (
                <div className="settings-meter-bar">
                  <div
                    className={`settings-meter-fill ${devicePercent > 80 ? 'settings-meter-fill--warn' : ''}`}
                    style={{ width: `${devicePercent}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Pro benefits (show only on free) */}
      {!isPro && (
        <div className="settings-section">
          <h3 className="settings-section-title">Pro includes</h3>
          <ul className="settings-pro-list">
            <li>Unlimited clips &amp; devices</li>
            <li>Unlimited history</li>
            <li>Image &amp; file clips </li>
            <li>Clipboard auto-capture </li>
            <li>Priority support</li>
          </ul>
          <div className="settings-price">
            <span className="settings-price-amount">$4.99</span>
            <span className="settings-price-period">/month</span>
            <span className="settings-price-alt">or $39/year</span>
          </div>
        </div>
      )}

      {/* Devices list */}
      <div className="settings-section">
        <h3 className="settings-section-title">Your devices</h3>
        <div className="settings-devices">
          {devices.map((device) => {
            const isOnline = device.last_seen_at &&
              (Date.now() - new Date(device.last_seen_at).getTime()) < 5 * 60 * 1000
            return (
              <div key={device.id} className="settings-device">
                <span className={`settings-device-dot ${isOnline ? 'settings-device-dot--on' : 'settings-device-dot--off'}`} />
                <span className="settings-device-name">{device.name}</span>
                <span className="settings-device-platform">{device.platform}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Auto-capture toggle */}
      <div className="settings-section">
        <h3 className="settings-section-title">Clipboard auto-capture</h3>
        <div className="settings-toggle-row">
          <div className="settings-toggle-info">
            <span className="settings-toggle-label">Auto-save clipboard changes</span>
            <span className="settings-toggle-desc">
              Automatically saves new clipboard content as clips. Checks every 1.5 seconds.
            </span>
          </div>
          <button
            className={`settings-toggle ${autoCapture ? 'settings-toggle--on' : ''}`}
            onClick={() => onToggleAutoCapture(!autoCapture)}
          >
            <span className="settings-toggle-knob" />
          </button>
        </div>
      </div>

      {/* Launch at startup */}
      <div className="settings-section">
        <h3 className="settings-section-title">Startup</h3>
        <div className="settings-toggle-row">
          <div className="settings-toggle-info">
            <span className="settings-toggle-label">Launch at login</span>
            <span className="settings-toggle-desc">
              Start SnipSync automatically when you turn on your computer.
            </span>
          </div>
          <button
            className={`settings-toggle ${openAtLogin ? 'settings-toggle--on' : ''}`}
            onClick={() => onToggleOpenAtLogin(!openAtLogin)}
          >
            <span className="settings-toggle-knob" />
          </button>
        </div>
      </div>

      {/* Encryption */}
      <div className="settings-section">
        <h3 className="settings-section-title">End-to-end encryption</h3>

        {!encryptionEnabled && !vaultAction && (
          <div className="settings-toggle-row">
            <div className="settings-toggle-info">
              <span className="settings-toggle-label">Encrypt all clips</span>
              <span className="settings-toggle-desc">
                Your clips will be encrypted before leaving this device. Only you can read them.
              </span>
            </div>
            <button className="settings-upgrade-btn" onClick={async () => {
              // Re-check if encryption was enabled on another device
              const settings = await getEncryptionSettings(user.id)
              if (settings?.encryption_enabled) {
                onEncryptionChange(true, null) // Update local state — vault is locked
                setVaultAction('unlock')
              } else {
                setVaultAction('setup')
              }
            }}>
              Enable
            </button>
          </div>
        )}

        {encryptionEnabled && !vaultLocked && !vaultAction && (
          <div>
            <div className="settings-toggle-row">
              <div className="settings-toggle-info">
                <span className="settings-toggle-label" style={{ color: '#22c55e' }}>Encryption active</span>
                <span className="settings-toggle-desc">
                  All clips are encrypted end-to-end. Only your devices can read them.
                </span>
              </div>
              <button className="settings-export-btn" onClick={() => setVaultAction('disable')} style={{ color: '#ef4444', borderColor: '#3a1a1a' }}>
                Disable
              </button>
            </div>
          </div>
        )}

        {vaultLocked && !vaultAction && (
          <div>
            <p className="settings-toggle-desc" style={{ marginBottom: '8px' }}>Vault is locked. Enter your vault password to decrypt your clips.</p>
            <button className="settings-upgrade-btn" onClick={() => setVaultAction('unlock')}>
              Unlock vault
            </button>
          </div>
        )}

        {/* Setup new vault */}
        {vaultAction === 'setup' && (
          <div className="settings-vault-form">
            <p className="settings-toggle-desc" style={{ marginBottom: '8px', color: '#f59e0b' }}>
              If you forget this password, your clips cannot be recovered.
            </p>
            <PasswordInput
              placeholder="Set a vault password (min 8 chars)"
              value={vaultPassword}
              onChange={(e) => { setVaultPassword(e.target.value); setVaultError('') }}
              autoFocus
            />
            <PasswordStrengthBar password={vaultPassword} />
            <PasswordInput
              placeholder="Confirm vault password"
              value={vaultPasswordConfirm}
              onChange={(e) => { setVaultPasswordConfirm(e.target.value); setVaultError('') }}
            />
            {vaultError && <p className="settings-vault-error">{vaultError}</p>}
            {migrationProgress !== null && <p className="settings-toggle-desc">Encrypting clips... {migrationProgress}</p>}
            <div className="settings-vault-actions">
              <button
                className="settings-upgrade-btn"
                disabled={vaultLoading}
                onClick={async () => {
                  if (vaultPassword.length < 8) { setVaultError('Password must be at least 8 characters'); return }
                  if (vaultPassword !== vaultPasswordConfirm) { setVaultError('Passwords do not match'); return }
                  setVaultLoading(true)
                  try {
                    // Guard: re-check if another device already enabled encryption
                    const existing = await getEncryptionSettings(user.id)
                    if (existing?.encryption_enabled) {
                      onEncryptionChange(true, null)
                      setVaultAction('unlock')
                      setVaultPassword('')
                      setVaultPasswordConfirm('')
                      setVaultLoading(false)
                      return
                    }
                    const result = await generateMasterKey(vaultPassword)
                    await saveEncryptionKeys(user.id, result.encryptedMasterKey, result.salt, result.nonce, result.encryptedRecoveryKey)
                    setMigrationProgress('starting...')
                    const count = await encryptExistingClips(user.id, result.masterKey)
                    setMigrationProgress(`${count} clips encrypted`)
                    onEncryptionChange(true, result.masterKey)
                    setRecoveryPhrase(result.recoveryPhrase)
                    setVaultPassword('')
                    setVaultPasswordConfirm('')
                    setMigrationProgress(null)
                  } catch (err) {
                    setVaultError(err.message)
                  }
                  setVaultLoading(false)
                }}
              >
                {vaultLoading ? 'Encrypting...' : 'Enable encryption'}
              </button>
              <button className="settings-export-btn" onClick={() => { setVaultAction(null); setVaultPassword(''); setVaultPasswordConfirm(''); setVaultError('') }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Unlock vault */}
        {vaultAction === 'unlock' && (
          <div className="settings-vault-form">
            <PasswordInput
              placeholder="Enter vault password"
              value={vaultPassword}
              onChange={(e) => { setVaultPassword(e.target.value); setVaultError('') }}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') document.getElementById('unlock-btn')?.click()
              }}
            />
            {vaultError && <p className="settings-vault-error">{vaultError}</p>}
            <div className="settings-vault-actions">
              <button
                id="unlock-btn"
                className="settings-upgrade-btn"
                disabled={vaultLoading}
                onClick={async () => {
                  if (!vaultPassword) { setVaultError('Please enter your vault password'); return }
                  setVaultLoading(true)
                  try {
                    const settings = await getEncryptionSettings(user.id)
                    if (!settings?.encrypted_master_key) {
                      setVaultError('Encryption settings not found')
                      setVaultLoading(false)
                      return
                    }
                    const masterKey = await unlockMasterKey(vaultPassword, settings.encrypted_master_key, settings.key_salt, settings.key_nonce)
                    onVaultUnlock(masterKey)
                    setVaultAction(null)
                    setVaultPassword('')
                  } catch (err) {
                    setVaultError(err.message || 'Wrong password')
                  }
                  setVaultLoading(false)
                }}
              >
                {vaultLoading ? 'Unlocking...' : 'Unlock'}
              </button>
              <button className="settings-export-btn" onClick={() => { setVaultAction(null); setVaultPassword(''); setVaultError('') }}>
                Cancel
              </button>
            </div>
            <button
              style={{ marginTop: '4px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', padding: 0, textAlign: 'left', fontFamily: 'inherit', color: '#22c55e' }}
              onClick={() => { setVaultAction('recover'); setVaultPassword(''); setVaultError('') }}
            >
              Forgot password? Use recovery phrase
            </button>
          </div>
        )}

        {/* Disable encryption */}
        {vaultAction === 'disable' && (
          <div className="settings-vault-form">
            <p className="settings-toggle-desc" style={{ marginBottom: '8px' }}>Enter your vault password to decrypt all clips and disable encryption.</p>
            <PasswordInput
              placeholder="Enter vault password"
              value={vaultPassword}
              onChange={(e) => { setVaultPassword(e.target.value); setVaultError('') }}
              autoFocus
            />
            {vaultError && <p className="settings-vault-error">{vaultError}</p>}
            {migrationProgress !== null && <p className="settings-toggle-desc">Decrypting clips... {migrationProgress}</p>}
            <div className="settings-vault-actions">
              <button
                className="settings-export-btn"
                style={{ color: '#ef4444', borderColor: '#3a1a1a' }}
                disabled={vaultLoading}
                onClick={async () => {
                  if (!vaultPassword) { setVaultError('Please enter your vault password'); return }
                  setVaultLoading(true)
                  try {
                    const settings = await getEncryptionSettings(user.id)
                    if (!settings?.encrypted_master_key) {
                      setVaultError('Encryption settings not found')
                      setVaultLoading(false)
                      return
                    }
                    const masterKey = await unlockMasterKey(vaultPassword, settings.encrypted_master_key, settings.key_salt, settings.key_nonce)
                    setMigrationProgress('starting...')
                    const count = await decryptAllClips(user.id, masterKey)
                    setMigrationProgress(`${count} clips decrypted`)
                    await disableEncryption(user.id)
                    onEncryptionChange(false, null)
                    setVaultAction(null)
                    setVaultPassword('')
                    setMigrationProgress(null)
                  } catch (err) {
                    setVaultError(err.message || 'Wrong password')
                  }
                  setVaultLoading(false)
                }}
              >
                {vaultLoading ? 'Decrypting...' : 'Disable encryption'}
              </button>
              <button className="settings-export-btn" onClick={() => { setVaultAction(null); setVaultPassword(''); setVaultError('') }}>
                Cancel
              </button>
            </div>
            <button
              style={{ marginTop: '4px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', padding: 0, textAlign: 'left', fontFamily: 'inherit', color: '#22c55e' }}
              onClick={() => { setRecoverToDisable(true); setVaultAction('recover'); setVaultPassword(''); setVaultError('') }}
            >
              Forgot password? Use recovery phrase
            </button>
          </div>
        )}

        {/* Force reset — lost both password and recovery phrase */}
        {vaultAction === 'force-reset' && (
          <div className="settings-vault-form">
            <p className="settings-toggle-desc" style={{ color: '#ef4444', marginBottom: '8px' }}>
              This will permanently delete all your encrypted clips and disable encryption. Your clips cannot be recovered. This cannot be undone.
            </p>
            <div className="settings-vault-actions">
              <button
                className="settings-export-btn"
                style={{ color: '#ef4444', borderColor: '#ef4444' }}
                disabled={vaultLoading}
                onClick={async () => {
                  setVaultLoading(true)
                  try {
                    // Delete all encrypted clips
                    const { data: encClips } = await supabase.from('clips')
                      .select('id')
                      .eq('user_id', user.id)
                      .eq('encrypted', true)
                    if (encClips) {
                      for (const clip of encClips) {
                        await supabase.from('clips').delete().eq('id', clip.id)
                      }
                    }
                    await disableEncryption(user.id)
                    onEncryptionChange(false, null)
                    setVaultAction(null)
                  } catch (err) {
                    setVaultError(err.message)
                  }
                  setVaultLoading(false)
                }}
              >
                {vaultLoading ? 'Resetting...' : 'Yes, delete encrypted clips and reset'}
              </button>
              <button className="settings-export-btn" onClick={() => { setVaultAction(null); setVaultError('') }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Recovery phrase display (shown after setup) */}
        {recoveryPhrase && (
          <RecoveryPhraseDisplay
            phrase={recoveryPhrase}
            onDone={() => { setRecoveryPhrase(null); setVaultAction(null) }}
          />
        )}

        {/* Recover with phrase */}
        {vaultAction === 'recover' && (
          <div className="settings-vault-form">
            <p className="settings-toggle-desc" style={{ marginBottom: '8px' }}>
              {recoverToDisable
                ? 'Enter your 12-word recovery phrase to decrypt all clips and disable encryption.'
                : 'Enter your 12-word recovery phrase to unlock your vault.'}
            </p>
            <textarea
              className="settings-vault-input"
              placeholder="word1 word2 word3 ..."
              value={recoveryInput}
              onChange={(e) => { setRecoveryInput(e.target.value); setVaultError('') }}
              rows={2}
              style={{ resize: 'none' }}
              autoFocus
            />
            {vaultError && <p className="settings-vault-error">{vaultError}</p>}
            {migrationProgress !== null && <p className="settings-toggle-desc">Decrypting clips... {migrationProgress}</p>}
            <div className="settings-vault-actions">
              <button
                className="settings-upgrade-btn"
                disabled={vaultLoading}
                onClick={async () => {
                  setVaultLoading(true)
                  try {
                    const recoveryKeyData = await getRecoveryKeyData(user.id)
                    if (!recoveryKeyData) { setVaultError('No recovery key found'); setVaultLoading(false); return }
                    const masterKey = await unlockWithRecoveryPhrase(recoveryInput.trim().toLowerCase(), recoveryKeyData)
                    if (recoverToDisable) {
                      setMigrationProgress('starting...')
                      const count = await decryptAllClips(user.id, masterKey)
                      setMigrationProgress(`${count} clips decrypted`)
                      await disableEncryption(user.id)
                      onEncryptionChange(false, null)
                      setMigrationProgress(null)
                    } else {
                      onVaultUnlock(masterKey)
                    }
                    setVaultAction(null)
                    setRecoveryInput('')
                    setRecoverToDisable(false)
                  } catch {
                    setVaultError('Invalid recovery phrase')
                  }
                  setVaultLoading(false)
                }}
              >
                {vaultLoading ? (recoverToDisable ? 'Decrypting...' : 'Unlocking...') : (recoverToDisable ? 'Recover & disable' : 'Recover')}
              </button>
              <button className="settings-export-btn" onClick={() => { setVaultAction(null); setRecoveryInput(''); setVaultError(''); setRecoverToDisable(false) }}>
                Cancel
              </button>
            </div>
            <button
              style={{ marginTop: '4px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', padding: 0, textAlign: 'left', fontFamily: 'inherit', color: '#ef4444' }}
              onClick={() => { setVaultAction('force-reset'); setRecoveryInput(''); setVaultError(''); setRecoverToDisable(false) }}
            >
              Lost recovery phrase too? Reset encryption
            </button>
          </div>
        )}
      </div>

      {/* Export */}
      <div className="settings-section settings-export">
        <h3 className="settings-section-title">Export</h3>
        <div className="settings-export-actions">
          <button
            className="settings-export-btn"
            onClick={() => {
              const headers = 'content,type,device,created_at,pinned'
              const rows = (clips || []).map((c) =>
                [
                  escapeCsvField(c.content),
                  escapeCsvField(c.type),
                  escapeCsvField(c.devices?.name || 'Unknown'),
                  escapeCsvField(c.created_at),
                  escapeCsvField(c.pinned ? 'true' : 'false'),
                ].join(',')
              )
              triggerDownload([headers, ...rows].join('\n'), 'snip-clips.csv', 'text/csv')
            }}
          >
            Export CSV
          </button>
          <button
            className="settings-export-btn"
            onClick={() => {
              const data = (clips || []).map((c) => ({
                content: c.content,
                type: c.type,
                device: c.devices?.name || 'Unknown',
                created_at: c.created_at,
                pinned: !!c.pinned,
              }))
              triggerDownload(JSON.stringify(data, null, 2), 'snip-clips.json', 'application/json')
            }}
          >
            Export JSON
          </button>
        </div>
      </div>

      {/* Sign out */}
      <div className="settings-section">
        <h3 className="settings-section-title">Account</h3>
        <div className="settings-signout-section">
          <span className="settings-signout-email">{user?.email}</span>
          <button className="settings-signout-btn" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </div>

      {/* Delete account */}
      <div className="settings-section">
        <h3 className="settings-section-title">Danger zone</h3>
        {!deleteConfirm ? (
          <button
            className="settings-export-btn"
            style={{ color: '#ef4444', borderColor: '#3a1a1a' }}
            onClick={() => setDeleteConfirm(true)}
          >
            Delete my account
          </button>
        ) : (
          <div className="settings-vault-form">
            <p className="settings-toggle-desc" style={{ color: '#ef4444', marginBottom: '8px' }}>
              This will permanently delete your account, all clips, all devices, and all data. This cannot be undone.
            </p>
            <div className="settings-vault-actions">
              <button
                className="settings-export-btn"
                style={{ color: '#ef4444', borderColor: '#ef4444' }}
                disabled={deleteLoading}
                onClick={async () => {
                  setDeleteLoading(true)
                  try {
                    await deleteAccount(user.id)
                    localStorage.removeItem('snip_device_id')
                    localStorage.removeItem('snip_auto_capture')
                    window.location.reload()
                  } catch {
                    setDeleteLoading(false)
                  }
                }}
              >
                {deleteLoading ? 'Deleting...' : 'Yes, delete everything'}
              </button>
              <button className="settings-export-btn" onClick={() => setDeleteConfirm(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* App info */}
      <div className="settings-section settings-section--footer">
        <span className="settings-app-version">SnipSync v0.3.1</span>
        <a
          className="settings-link settings-link--feedback"
          href="#"
          onClick={(e) => {
            e.preventDefault()
            const url = 'mailto:vincentjacobs7@gmail.com?subject=SnipSync Feedback'
            window.electronAPI ? window.electronAPI.openUrl(url) : window.open(url, '_blank')
          }}
        >
          Send feedback
        </a>
        <a
          className="settings-link"
          href="#"
          onClick={(e) => {
            e.preventDefault()
            const url = 'https://snipsync.xyz/privacy.html'
            window.electronAPI ? window.electronAPI.openUrl(url) : window.open(url, '_blank')
          }}
        >
          Privacy
        </a>
        <a
          className="settings-link"
          href="#"
          onClick={(e) => {
            e.preventDefault()
            const url = 'https://snipsync.xyz/terms.html'
            window.electronAPI ? window.electronAPI.openUrl(url) : window.open(url, '_blank')
          }}
        >
          Terms
        </a>
      </div>
    </div>
  )
}
