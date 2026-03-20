import { useState, useEffect } from 'react'
import { getTeamInvites, createInvite, deleteInvite } from '../lib/supabase'

export default function InviteManager({ teamId, isAdmin, userId }) {
  const [invites, setInvites] = useState([])
  const [creating, setCreating] = useState(false)
  const [newRole, setNewRole] = useState('member')
  const [copied, setCopied] = useState(null)

  useEffect(() => {
    loadInvites()
  }, [teamId])

  const loadInvites = async () => {
    const data = await getTeamInvites(teamId)
    setInvites(data)
  }

  const handleCreate = async () => {
    setCreating(true)
    const { data } = await createInvite(teamId, userId, newRole)
    if (data) await loadInvites()
    setCreating(false)
  }

  const handleDelete = async (id) => {
    await deleteInvite(id)
    await loadInvites()
  }

  const handleCopy = (code) => {
    const url = `https://snipsync.xyz/join/${code}`
    navigator.clipboard.writeText(url)
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
  }

  const isExpired = (invite) => invite.expires_at && new Date(invite.expires_at) < new Date()
  const isMaxed = (invite) => invite.max_uses !== null && invite.use_count >= invite.max_uses

  return (
    <div className="invite-manager">
      <div className="section-header">
        <h3>Invite links</h3>
        {isAdmin && (
          <div className="invite-create">
            <select className="role-select" value={newRole} onChange={(e) => setNewRole(e.target.value)}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button className="btn-primary-sm" onClick={handleCreate} disabled={creating}>
              {creating ? '...' : 'Generate link'}
            </button>
          </div>
        )}
      </div>

      {invites.length === 0 ? (
        <p className="text-dim">No invite links yet. Generate one to invite team members.</p>
      ) : (
        <div className="invite-list">
          {invites.map((inv) => {
            const expired = isExpired(inv)
            const maxed = isMaxed(inv)
            const inactive = expired || maxed

            return (
              <div key={inv.id} className={`invite-card ${inactive ? 'invite-card--inactive' : ''}`}>
                <div className="invite-card-top">
                  <code className="invite-code">snipsync.xyz/join/{inv.invite_code}</code>
                  <span className={`role-badge role-badge--${inv.role}`}>{inv.role}</span>
                </div>
                <div className="invite-card-meta">
                  <span>Used {inv.use_count}{inv.max_uses ? ` / ${inv.max_uses}` : ''} times</span>
                  {inv.expires_at && <span>{expired ? 'Expired' : `Expires ${new Date(inv.expires_at).toLocaleDateString()}`}</span>}
                  {inactive && <span className="invite-inactive">Inactive</span>}
                </div>
                <div className="invite-card-actions">
                  <button
                    className="btn-ghost-sm"
                    onClick={() => handleCopy(inv.invite_code)}
                    disabled={inactive}
                  >
                    {copied === inv.invite_code ? '✓ Copied' : 'Copy link'}
                  </button>
                  {isAdmin && (
                    <button className="btn-danger-sm" onClick={() => handleDelete(inv.id)}>Revoke</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
