import React, { useState, useEffect, useRef } from 'react'
import { getImageUrl } from '../lib/supabase'

const TYPE_STYLES = {
  link:    { bg: '#1a2e1a', text: '#4ade80', dot: '#22c55e' },
  note:    { bg: '#1e1e2e', text: '#a78bfa', dot: '#8b5cf6' },
  address: { bg: '#2e1a1a', text: '#f87171', dot: '#ef4444' },
  code:    { bg: '#1a1e2e', text: '#60a5fa', dot: '#3b82f6' },
  image:   { bg: '#2e2e1a', text: '#facc15', dot: '#eab308' },
  other:   { bg: '#1e1e1e', text: '#9ca3af', dot: '#6b7280' },
}

function ImageThumbnail({ imagePath }) {
  const [src, setSrc] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    if (!imagePath) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const url = getImageUrl(imagePath)
          if (url) setSrc(url)
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [imagePath])

  return (
    <div ref={ref} className="clip-image-wrapper">
      {src ? (
        <img src={src} alt="Clip image" className="clip-image" loading="lazy" />
      ) : (
        <div className="clip-image-placeholder">Loading...</div>
      )}
    </div>
  )
}

function PlatformIcon({ platform, size = 12, color = '#555' }) {
  if (platform === 'mac' || platform === 'darwin') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
      </svg>
    )
  }
  if (platform === 'windows' || platform === 'win32') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <path d="M3 12V6.75l6-1.32v6.48H3zM20.25 12H11.25V5.07l9-1.57V12zM3 13h6v6.43l-6-1.33V13zm8.25 0h9V19.5l-9-1.57V13z"/>
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z"/>
    </svg>
  )
}

function timeAgo(timestamp) {
  const diff = Date.now() - new Date(timestamp).getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

export default function ClipCard({ clip, copied, onCopy, onPin, onDelete, onOpenUrl, removing }) {
  const typeStyle = TYPE_STYLES[clip.type] || TYPE_STYLES.other
  const isCopied = copied === clip.id
  const isLink = clip.type === 'link'
  const isCode = clip.type === 'code'
  const isImage = clip.type === 'image'
  const deviceName = clip.devices?.name || 'Unknown'
  const devicePlatform = clip.devices?.platform || 'mac'

  const cardClass = `clip-card${removing ? ' clip-card--removing' : ''}`

  return (
    <div className={cardClass}>
      {/* Top row */}
      <div className="clip-card-top">
        <span
          className="clip-type-badge"
          style={{ background: typeStyle.bg, color: typeStyle.text }}
        >
          <span className="clip-type-dot" style={{ background: typeStyle.dot }} />
          {clip.type}
        </span>

        {clip.pinned && (
          <span className="clip-pin-indicator" title="Pinned">&#128204;</span>
        )}

        <span className="clip-time">{timeAgo(clip.created_at)}</span>

        <span className="clip-device-badge">
          <PlatformIcon platform={devicePlatform} />
          {deviceName}
        </span>
      </div>

      {/* Content */}
      {isImage && clip.image_path ? (
        <ImageThumbnail imagePath={clip.image_path} />
      ) : (
        <div className="clip-content-wrapper">
          <div className={`clip-content ${isLink ? 'clip-content--link' : 'clip-content--text'} ${isCode ? 'clip-content--code' : ''}`}>
            {clip.content}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="clip-actions">
        <button
          onClick={() => onCopy(clip)}
          className={`clip-btn clip-btn--copy ${isCopied ? 'clip-btn--copied' : ''}`}
        >
          {isCopied ? '\u2713 Copied!' : 'Copy'}
        </button>

        <button
          onClick={() => onPin(clip.id, !clip.pinned)}
          className={`clip-btn clip-btn--pin ${clip.pinned ? 'clip-btn--pinned' : ''}`}
        >
          {clip.pinned ? 'Unpin' : 'Pin'}
        </button>

        {isLink && (
          <button
            onClick={() => onOpenUrl(clip.content)}
            className="clip-btn"
          >
            Open &#8599;
          </button>
        )}

        <button
          onClick={() => onDelete(clip.id)}
          className="clip-btn clip-btn--delete"
        >
          &#10005;
        </button>
      </div>
    </div>
  )
}

export { PlatformIcon }
