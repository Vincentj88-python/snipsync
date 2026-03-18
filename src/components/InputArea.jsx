import React, { useState } from 'react'

export default function InputArea({ input, setInput, onSend, onImagePaste, onFileDrop, platform }) {
  const hasText = input.trim().length > 0
  const shortcutLabel = 'Shift+\u21B5 for newline'
  const [dragOver, setDragOver] = useState(false)

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  const handlePaste = (e) => {
    if (!onImagePaste) return
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) onImagePaste(file)
        return
      }
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const files = e.dataTransfer?.files
    if (!files || files.length === 0) return
    const file = files[0]
    if (file.type.startsWith('image/')) {
      onImagePaste?.(file)
    } else {
      onFileDrop?.(file)
    }
  }

  return (
    <div className="input-area">
      <div
        className="input-wrapper"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={dragOver ? { borderColor: '#22c55e', background: '#0e1a0e' } : undefined}
      >
        {dragOver ? (
          <div style={{
            padding: '20px 13px',
            textAlign: 'center',
            fontSize: '12px',
            color: '#22c55e',
          }}>
            Drop file here
          </div>
        ) : (
          <>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Paste a link, note, or drag a file..."
              rows={2}
              className="input-textarea"
            />
            <div className="input-toolbar">
              <span className="input-shortcut">{shortcutLabel}</span>
              <button
                onClick={onSend}
                className={`input-send-btn ${hasText ? 'input-send-btn--active' : 'input-send-btn--inactive'}`}
              >
                Send &rarr;
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
