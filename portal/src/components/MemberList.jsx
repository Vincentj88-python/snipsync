import { useState } from 'react'
import { updateMemberRole, removeMember } from '../lib/supabase'

export default function MemberList({ members, isAdmin, currentUserId, teamOwnerId, onMembersChanged }) {
  const [loading, setLoading] = useState(null)

  const handleRoleChange = async (memberId, newRole) => {
    setLoading(memberId)
    await updateMemberRole(memberId, newRole)
    await onMembersChanged()
    setLoading(null)
  }

  const handleRemove = async (memberId, name) => {
    if (!confirm(`Remove ${name} from the team?`)) return
    setLoading(memberId)
    await removeMember(memberId)
    await onMembersChanged()
    setLoading(null)
  }

  return (
    <div className="member-list">
      <div className="section-header">
        <h3>Team members</h3>
        <span className="count-badge">{members.length}</span>
      </div>

      <div className="table">
        <div className="table-header">
          <span className="table-col table-col--grow">Member</span>
          <span className="table-col table-col--sm">Role</span>
          {isAdmin && <span className="table-col table-col--sm">Actions</span>}
        </div>

        {members.map((m) => {
          const profile = m.profiles
          const isOwner = m.role === 'owner'
          const isSelf = m.user_id === currentUserId
          const canManage = isAdmin && !isOwner && !isSelf

          return (
            <div key={m.id} className="table-row">
              <div className="table-col table-col--grow member-info">
                <div className="member-avatar">
                  {profile?.display_name?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <span className="member-name">{profile?.display_name || 'Unknown'}</span>
                  <span className="member-email">{profile?.email}</span>
                </div>
              </div>

              <div className="table-col table-col--sm">
                {canManage ? (
                  <select
                    className="role-select"
                    value={m.role}
                    onChange={(e) => handleRoleChange(m.id, e.target.value)}
                    disabled={loading === m.id}
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                ) : (
                  <span className={`role-badge role-badge--${m.role}`}>{m.role}</span>
                )}
              </div>

              {isAdmin && (
                <div className="table-col table-col--sm">
                  {canManage && (
                    <button
                      className="btn-danger-sm"
                      onClick={() => handleRemove(m.id, profile?.display_name || profile?.email)}
                      disabled={loading === m.id}
                    >
                      Remove
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
