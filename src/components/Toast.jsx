import React, { useState, useEffect } from 'react'

export default function Toast({ message, onUndo, onDismiss, duration = 3000 }) {
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setLeaving(true)
      setTimeout(onDismiss, 200)
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onDismiss])

  const handleUndo = () => {
    setLeaving(true)
    setTimeout(() => {
      onUndo()
    }, 100)
  }

  return (
    <div className={`toast ${leaving ? 'toast--leaving' : ''}`}>
      <span>{message}</span>
      {onUndo && (
        <button onClick={handleUndo} className="toast-undo">
          Undo
        </button>
      )}
    </div>
  )
}
