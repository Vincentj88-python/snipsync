import { useState, useEffect } from 'react'
import { getChannels, createChannel, deleteChannel } from '../lib/supabase'
import { sanitizeName, sanitizeText } from '../lib/sanitize'

export default function ChannelManager({ teamId, isAdmin, userId }) {
  const [channels, setChannels] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadChannels()
  }, [teamId])

  const loadChannels = async () => {
    const data = await getChannels(teamId)
    setChannels(data)
  }

  const handleCreate = async () => {
    if (!name.trim() || creating) return
    setCreating(true)
    const { data } = await createChannel(teamId, sanitizeName(name), sanitizeText(description) || null, userId)
    if (data) {
      setName('')
      setDescription('')
      setShowCreate(false)
      await loadChannels()
    }
    setCreating(false)
  }

  const handleDelete = async (id, channelName) => {
    if (channelName === 'general') return
    if (!confirm(`Delete #${channelName}? All clips in this channel will be removed.`)) return
    await deleteChannel(id)
    await loadChannels()
  }

  return (
    <div className="channel-manager">
      <div className="section-header">
        <h3>Channels</h3>
        <span className="count-badge">{channels.length}</span>
        {isAdmin && !showCreate && (
          <button className="btn-primary-sm" onClick={() => setShowCreate(true)}>+ New channel</button>
        )}
      </div>

      {showCreate && (
        <div className="create-form">
          <input className="input" placeholder="Channel name (e.g. design-links)" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
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
        {channels.map((ch) => (
          <div key={ch.id} className="channel-card">
            <div className="channel-info">
              <span className="channel-name"># {ch.name}</span>
              {ch.description && <span className="channel-desc">{ch.description}</span>}
            </div>
            {isAdmin && ch.name !== 'general' && (
              <button className="btn-danger-sm" onClick={() => handleDelete(ch.id, ch.name)}>Delete</button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
