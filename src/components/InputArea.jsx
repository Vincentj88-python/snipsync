import React from 'react'

export default function InputArea({ input, setInput, onSend, onImagePaste, platform }) {
  const hasText = input.trim().length > 0
  const shortcutLabel = platform === 'darwin' ? '\u2318\u21B5 to send' : 'Ctrl+\u21B5 to send'

  const handleKeyDown = (e) => {
    const isMod = platform === 'darwin' ? e.metaKey : e.ctrlKey
    if (isMod && e.key === 'Enter') {
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

  return (
    <div className="input-area">
      <div className="input-wrapper">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Paste a link, note, image, anything..."
          rows={3}
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
      </div>
    </div>
  )
}
