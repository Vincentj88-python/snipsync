import React, { useState, useRef, useEffect } from 'react'

export default function SearchBar({ searchQuery, setSearchQuery }) {
  const [expanded, setExpanded] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (expanded && inputRef.current) {
      inputRef.current.focus()
    }
  }, [expanded])

  const handleToggle = () => {
    if (expanded) {
      setSearchQuery('')
      setExpanded(false)
    } else {
      setExpanded(true)
    }
  }

  const handleClear = () => {
    setSearchQuery('')
    if (inputRef.current) inputRef.current.focus()
  }

  return (
    <div className={`search-bar ${expanded ? 'search-bar--expanded' : 'search-bar--collapsed'}`}>
      <button onClick={handleToggle} className="search-toggle" title="Search clips">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </button>

      {expanded && (
        <div className="search-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search clips..."
            className="search-input"
          />
          {searchQuery && (
            <button onClick={handleClear} className="search-clear">
              &#10005;
            </button>
          )}
        </div>
      )}
    </div>
  )
}
