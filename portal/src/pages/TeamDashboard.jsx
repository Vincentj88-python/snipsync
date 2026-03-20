import { useState, useEffect } from 'react'
import MemberList from '../components/MemberList'
import InviteManager from '../components/InviteManager'
import ChannelManager from '../components/ChannelManager'
import GroupManager from '../components/GroupManager'
import CollectionManager from '../components/CollectionManager'
import TeamSettings from '../components/TeamSettings'
import { getTeamMembers, getMemberCount } from '../lib/supabase'

const TABS = [
  { id: 'members', label: 'Members' },
  { id: 'invites', label: 'Invites' },
  { id: 'channels', label: 'Channels' },
  { id: 'groups', label: 'Groups' },
  { id: 'collections', label: 'Collections' },
  { id: 'settings', label: 'Settings' },
]

export default function TeamDashboard({ team, myRole, user, onTeamUpdated }) {
  const [activeTab, setActiveTab] = useState('members')
  const [members, setMembers] = useState([])
  const [memberCount, setMemberCount] = useState(0)

  const isAdmin = myRole === 'owner' || myRole === 'admin'

  useEffect(() => {
    loadMembers()
  }, [team.id])

  const loadMembers = async () => {
    const data = await getTeamMembers(team.id)
    setMembers(data)
    const count = await getMemberCount(team.id)
    setMemberCount(count)
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">{team.name}</h1>
          <p className="dashboard-meta">{memberCount} member{memberCount !== 1 ? 's' : ''} · Created {new Date(team.created_at).toLocaleDateString()}</p>
        </div>
        <span className={`role-badge role-badge--${myRole}`}>{myRole}</span>
      </div>

      <div className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {activeTab === 'members' && (
          <MemberList members={members} isAdmin={isAdmin} currentUserId={user.id} teamOwnerId={team.owner_id} onMembersChanged={loadMembers} />
        )}
        {activeTab === 'invites' && (
          <InviteManager teamId={team.id} isAdmin={isAdmin} userId={user.id} />
        )}
        {activeTab === 'channels' && (
          <ChannelManager teamId={team.id} isAdmin={isAdmin} userId={user.id} />
        )}
        {activeTab === 'groups' && (
          <GroupManager teamId={team.id} isAdmin={isAdmin} userId={user.id} members={members} />
        )}
        {activeTab === 'collections' && (
          <CollectionManager teamId={team.id} isAdmin={isAdmin} userId={user.id} />
        )}
        {activeTab === 'settings' && (
          <TeamSettings team={team} isOwner={myRole === 'owner'} onTeamUpdated={onTeamUpdated} />
        )}
      </div>
    </div>
  )
}
