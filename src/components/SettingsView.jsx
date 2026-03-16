import React from 'react'
import { PLAN_LIMITS } from '../lib/supabase'

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

export default function SettingsView({ subscription, usage, user, devices, clips, autoCapture, onToggleAutoCapture, openAtLogin, onToggleOpenAtLogin, onUpgrade }) {
  const plan = subscription?.plan || 'free'
  const limits = PLAN_LIMITS[plan]
  const isPro = plan === 'pro'

  const clipPercent = limits.maxClips === Infinity ? 0 : Math.min(100, (usage.clips / limits.maxClips) * 100)
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
                <span className="settings-meter-label">Clips</span>
                <span className="settings-meter-value">
                  {usage.clips}{limits.maxClips === Infinity ? '' : ` / ${limits.maxClips}`}
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
