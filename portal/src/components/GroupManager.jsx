import { useState, useEffect } from 'react'
import { getGroups, createGroup, deleteGroup, addGroupMember, removeGroupMember } from '../lib/supabase'

export default function GroupManager({ teamId, isAdmin, userId, members }) {
  const [groups, setGroups] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [expandedGroup, setExpandedGroup] = useState(null)

  useEffect(() => {
    loadGroups()
  }, [teamId])

  const loadGroups = async () => {
    const data = await getGroups(teamId)
    setGroups(data)
  }

  const handleCreate = async () => {
    if (!name.trim() || creating) return
    setCreating(true)
    const { data } = await createGroup(teamId, name.trim(), userId)
    if (data) {
      setName('')
      setShowCreate(false)
      await loadGroups()
    }
    setCreating(false)
  }

  const handleDelete = async (id, groupName) => {
    if (!confirm(`Delete @${groupName}?`)) return
    await deleteGroup(id)
    await loadGroups()
  }

  const handleAddMember = async (groupId, memberId) => {
    await addGroupMember(groupId, memberId)
    await loadGroups()
  }

  const handleRemoveMember = async (groupId, memberId) => {
    await removeGroupMember(groupId, memberId)
    await loadGroups()
  }

  return (
    <div className="group-manager">
      <div className="section-header">
        <h3>Mention groups</h3>
        <span className="count-badge">{groups.length}</span>
        {isAdmin && !showCreate && (
          <button className="btn-primary-sm" onClick={() => setShowCreate(true)}>+ New group</button>
        )}
      </div>

      <p className="text-dim" style={{ marginBottom: 16 }}>
        Groups let you @mention multiple people at once. e.g. @design, @engineering
      </p>

      {showCreate && (
        <div className="create-form">
          <input className="input" placeholder="Group name (e.g. design)" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <div className="create-form-actions">
            <button className="btn-ghost" onClick={() => { setShowCreate(false); setName('') }}>Cancel</button>
            <button className="btn-primary-sm" onClick={handleCreate} disabled={!name.trim() || creating}>
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      )}

      <div className="group-list">
        {groups.map((g) => {
          const groupMembers = g.group_members || []
          const groupMemberIds = groupMembers.map((gm) => gm.user_id)
          const isExpanded = expandedGroup === g.id

          return (
            <div key={g.id} className="group-card">
              <div className="group-card-top" onClick={() => setExpandedGroup(isExpanded ? null : g.id)}>
                <span className="group-name">@{g.name}</span>
                <span className="count-badge">{groupMembers.length}</span>
                <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                {isAdmin && (
                  <button className="btn-danger-sm" onClick={(e) => { e.stopPropagation(); handleDelete(g.id, g.name) }}>Delete</button>
                )}
              </div>

              {isExpanded && (
                <div className="group-members">
                  {groupMembers.map((gm) => (
                    <div key={gm.user_id} className="group-member-row">
                      <span>{gm.profiles?.display_name || gm.profiles?.email || 'Unknown'}</span>
                      {isAdmin && (
                        <button className="btn-danger-sm" onClick={() => handleRemoveMember(g.id, gm.user_id)}>Remove</button>
                      )}
                    </div>
                  ))}

                  {isAdmin && (
                    <div className="group-add-member">
                      <select
                        className="role-select"
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) {
                            handleAddMember(g.id, e.target.value)
                            e.target.value = ''
                          }
                        }}
                      >
                        <option value="" disabled>Add member...</option>
                        {members
                          .filter((m) => !groupMemberIds.includes(m.user_id))
                          .map((m) => (
                            <option key={m.user_id} value={m.user_id}>
                              {m.profiles?.display_name || m.profiles?.email}
                            </option>
                          ))}
                      </select>
                    </div>
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
