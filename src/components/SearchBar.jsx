import React, { useRef, useEffect } from 'react'

export default function SearchBar({ searchQuery, setSearchQuery }) {
  const inputRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        setSearchQuery('')
        inputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setSearchQuery])

  // Focus search on window focus
  useEffect(() => {
    const handler = () => {
      // Small delay to avoid interfering with other focus handlers
      setTimeout(() => {
        if (document.activeElement?.tagName !== 'TEXTAREA') {
          inputRef.current?.focus()
        }
      }, 100)
    }
    window.addEventListener('focus', handler)
    return () => window.removeEventListener('focus', handler)
  }, [])

  return (
    <div className="search-bar">
      <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>

      <input
        ref={inputRef}
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search clips..."
        className="search-input"
      />

      {searchQuery ? (
        <button onClick={() => { setSearchQuery(''); inputRef.current?.focus() }} className="search-clear">
          &#10005;
        </button>
      ) : (
        <span className="search-shortcut">/</span>
      )}
    </div>
  )
}
