import React, { useState } from 'react'
import { PLAN_LIMITS } from '../lib/supabase'
import {
  generateMasterKey,
  unlockMasterKey,
  saveEncryptionKeys,
  getEncryptionSettings,
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

export default function SettingsView({ subscription, usage, user, devices, clips, autoCapture, onToggleAutoCapture, openAtLogin, onToggleOpenAtLogin, encryptionEnabled, vaultLocked, onVaultUnlock, onEncryptionChange, onUpgrade }) {
  const plan = subscription?.plan || 'free'
  const limits = PLAN_LIMITS[plan]
  const isPro = plan === 'pro'
  const [vaultPassword, setVaultPassword] = useState('')
  const [vaultAction, setVaultAction] = useState(null) // 'setup' | 'unlock' | 'disable'
  const [vaultLoading, setVaultLoading] = useState(false)
  const [vaultError, setVaultError] = useState('')
  const [migrationProgress, setMigrationProgress] = useState(null)

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
            <span className="settings-price-amount">$3.99</span>
            <span className="settings-price-period">/month</span>
            <span className="settings-price-alt">or $29/year</span>
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
            <button className="settings-upgrade-btn" onClick={() => setVaultAction('setup')}>
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
            <input
              type="password"
              className="settings-vault-input"
              placeholder="Set a vault password (min 8 chars)"
              value={vaultPassword}
              onChange={(e) => { setVaultPassword(e.target.value); setVaultError('') }}
              autoFocus
            />
            {vaultError && <p className="settings-vault-error">{vaultError}</p>}
            {migrationProgress !== null && <p className="settings-toggle-desc">Encrypting clips... {migrationProgress}</p>}
            <div className="settings-vault-actions">
              <button
                className="settings-upgrade-btn"
                disabled={vaultLoading}
                onClick={async () => {
                  if (vaultPassword.length < 8) { setVaultError('Password must be at least 8 characters'); return }
                  setVaultLoading(true)
                  try {
                    const { masterKey, encryptedMasterKey, salt, nonce } = await generateMasterKey(vaultPassword)
                    await saveEncryptionKeys(user.id, encryptedMasterKey, salt, nonce)
                    setMigrationProgress('starting...')
                    const count = await encryptExistingClips(user.id, masterKey)
                    setMigrationProgress(`${count} clips encrypted`)
                    onEncryptionChange(true, masterKey)
                    setVaultAction(null)
                    setVaultPassword('')
                    setMigrationProgress(null)
                  } catch (err) {
                    setVaultError(err.message)
                  }
                  setVaultLoading(false)
                }}
              >
                {vaultLoading ? 'Encrypting...' : 'Enable encryption'}
              </button>
              <button className="settings-export-btn" onClick={() => { setVaultAction(null); setVaultPassword(''); setVaultError('') }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Unlock vault */}
        {vaultAction === 'unlock' && (
          <div className="settings-vault-form">
            <input
              type="password"
              className="settings-vault-input"
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
                  setVaultLoading(true)
                  try {
                    const settings = await getEncryptionSettings(user.id)
                    const masterKey = await unlockMasterKey(vaultPassword, settings.encrypted_master_key, settings.key_salt, settings.key_nonce)
                    onVaultUnlock(masterKey)
                    setVaultAction(null)
                    setVaultPassword('')
                  } catch (err) {
                    setVaultError('Wrong password')
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
          </div>
        )}

        {/* Disable encryption */}
        {vaultAction === 'disable' && (
          <div className="settings-vault-form">
            <p className="settings-toggle-desc" style={{ marginBottom: '8px' }}>Enter your vault password to decrypt all clips and disable encryption.</p>
            <input
              type="password"
              className="settings-vault-input"
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
                  setVaultLoading(true)
                  try {
                    const settings = await getEncryptionSettings(user.id)
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
                    setVaultError('Wrong password')
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

      {/* App info */}
      <div className="settings-section settings-section--footer">
        <span className="settings-app-version">SnipSync v0.2.0</span>
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
