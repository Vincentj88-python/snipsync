import { useState } from 'react'
import { updateTeam, deleteTeam } from '../lib/supabase'

export default function TeamSettings({ team, isOwner, onTeamUpdated }) {
  const [name, setName] = useState(team.name)
  const [maxSeats, setMaxSeats] = useState(team.max_seats || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await updateTeam(team.id, {
      name: name.trim(),
      max_seats: maxSeats ? parseInt(maxSeats) : null,
    })
    await onTeamUpdated()
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleDelete = async () => {
    if (!confirm(`Delete "${team.name}"? This will remove all channels, clips, and members. This cannot be undone.`)) return
    if (!confirm('Are you absolutely sure?')) return
    await deleteTeam(team.id)
    await onTeamUpdated()
  }

  return (
    <div className="team-settings">
      <h3>Team settings</h3>

      <div className="settings-group">
        <label className="settings-label">Team name</label>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={!isOwner}
        />
      </div>

      <div className="settings-group">
        <label className="settings-label">Max seats</label>
        <input
          className="input"
          type="number"
          placeholder="Unlimited"
          value={maxSeats}
          onChange={(e) => setMaxSeats(e.target.value)}
          disabled={!isOwner}
        />
        <span className="settings-hint">Leave empty for unlimited. Limits how many members can join via invite links.</span>
      </div>

      {isOwner && (
        <button className="btn-primary" onClick={handleSave} disabled={saving || !name.trim()}>
          {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save changes'}
        </button>
      )}

      {isOwner && (
        <div className="danger-zone">
          <h4 className="danger-title">Danger zone</h4>
          <p className="text-dim">Permanently delete this team and all its data.</p>
          <button className="btn-danger" onClick={handleDelete}>Delete team</button>
        </div>
      )}
    </div>
  )
}
