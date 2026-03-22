import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { sanitizeName, sanitizeText } from '../lib/sanitize'

async function getCollections(teamId) {
  const { data } = await supabase
    .from('collections')
    .select('*, collection_clips(id)')
    .eq('team_id', teamId)
    .order('created_at')
  return (data || []).map((c) => ({ ...c, clipCount: c.collection_clips?.length || 0 }))
}

async function createCollection(teamId, name, description, createdBy) {
  return supabase.from('collections').insert({ team_id: teamId, name, description, created_by: createdBy }).select().single()
}

async function deleteCollection(collectionId) {
  return supabase.from('collections').delete().eq('id', collectionId)
}

export default function CollectionManager({ teamId, isAdmin, userId }) {
  const [collections, setCollections] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadCollections()
  }, [teamId])

  const loadCollections = async () => {
    const data = await getCollections(teamId)
    setCollections(data)
  }

  const handleCreate = async () => {
    if (!name.trim() || creating) return
    setCreating(true)
    const { data } = await createCollection(teamId, sanitizeName(name), sanitizeText(description) || null, userId)
    if (data) {
      setName('')
      setDescription('')
      setShowCreate(false)
      await loadCollections()
    }
    setCreating(false)
  }

  const handleDelete = async (id, colName) => {
    if (!confirm(`Delete "${colName}"? All clips in this collection will be unlinked.`)) return
    await deleteCollection(id)
    await loadCollections()
  }

  return (
    <div className="channel-manager">
      <div className="section-header">
        <h3>Collections</h3>
        <span className="count-badge">{collections.length}</span>
        {isAdmin && !showCreate && (
          <button className="btn-primary-sm" onClick={() => setShowCreate(true)}>+ New collection</button>
        )}
      </div>

      <p className="text-dim" style={{ marginBottom: 16 }}>
        Collections are shared pinned clip sets visible to the entire team. Members can add clips from any channel.
      </p>

      {showCreate && (
        <div className="create-form">
          <input className="input" placeholder="Collection name (e.g. Staging URLs)" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <input className="input" placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="create-form-actions">
            <button className="btn-ghost" onClick={() => { setShowCreate(false); setName(''); setDescription('') }}>Cancel</button>
            <button className="btn-primary-sm" onClick={handleCreate} disabled={!name.trim() || creating}>
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      )}

      <div className="channel-list">
        {collections.map((col) => (
          <div key={col.id} className="channel-card">
            <div className="channel-info">
              <span className="channel-name">📌 {col.name}</span>
              <span className="channel-desc">{col.description || `${col.clipCount} clips`}</span>
            </div>
            {isAdmin && (
              <button className="btn-danger-sm" onClick={() => handleDelete(col.id, col.name)}>Delete</button>
            )}
          </div>
        ))}
        {collections.length === 0 && <p className="text-dim">No collections yet.</p>}
      </div>
    </div>
  )
}
