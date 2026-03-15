import React from 'react'

const FILTERS = ['all', 'link', 'note', 'address', 'code']

export default function FilterBar({ filter, setFilter, clips }) {
  const getCount = (type) => {
    if (type === 'all') return clips.length
    return clips.filter((c) => c.type === type).length
  }

  return (
    <div className="filter-bar">
      {FILTERS.map((f) => {
        const isActive = filter === f
        const count = getCount(f)
        return (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`filter-btn ${isActive ? 'filter-btn--active' : 'filter-btn--inactive'}`}
          >
            {f}
            <span className="filter-count"> {count}</span>
          </button>
        )
      })}
    </div>
  )
}
