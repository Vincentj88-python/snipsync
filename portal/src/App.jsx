import { useState, useEffect } from 'react'
import { supabase, signInWithGoogle, signOut, getMyTeams, createTeam } from './lib/supabase'
import TeamDashboard from './pages/TeamDashboard'
import './styles.css'

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [teams, setTeams] = useState([])
  const [activeTeamId, setActiveTeamId] = useState(null)
  const [showCreateTeam, setShowCreateTeam] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
      setLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) return
    loadTeams()
  }, [user])

  const loadTeams = async () => {
    const data = await getMyTeams(user.id)
    setTeams(data)
    if (data.length > 0 && !activeTeamId) {
      setActiveTeamId(data[0].teams.id)
    }
  }

  const handleCreateTeam = async () => {
    if (!newTeamName.trim() || creating) return
    setCreating(true)
    const { data } = await createTeam(newTeamName.trim(), user.id)
    if (data) {
      setNewTeamName('')
      setShowCreateTeam(false)
      await loadTeams()
      setActiveTeamId(data.id)
    }
    setCreating(false)
  }

  if (loading) {
    return <div className="loading"><div className="spinner" /></div>
  }

  if (!user) {
    return (
      <div className="signin">
        <div className="signin-card">
          <div className="signin-logo">SnipSync</div>
          <h1 className="signin-title">Team Portal</h1>
          <p className="signin-desc">Manage your team, members, channels, and settings.</p>
          <button className="btn-primary" onClick={signInWithGoogle}>Sign in with Google</button>
        </div>
      </div>
    )
  }

  const activeTeam = teams.find((t) => t.teams.id === activeTeamId)

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="sidebar-logo">SnipSync</span>
          <span className="sidebar-badge">Teams</span>
        </div>
        <div className="sidebar-section">
          <span className="sidebar-label">Your teams</span>
          {teams.map((t) => (
            <button
              key={t.teams.id}
              className={`sidebar-team ${t.teams.id === activeTeamId ? 'sidebar-team--active' : ''}`}
              onClick={() => setActiveTeamId(t.teams.id)}
            >
              <span className="sidebar-team-name">{t.teams.name}</span>
              <span className="sidebar-team-role">{t.role}</span>
            </button>
          ))}
          <button className="sidebar-add" onClick={() => setShowCreateTeam(true)}>+ Create team</button>
        </div>
        <div className="sidebar-footer">
          <span className="sidebar-user-email">{user.email}</span>
          <button className="sidebar-signout" onClick={signOut}>Sign out</button>
        </div>
      </aside>

      <main className="main">
        {showCreateTeam ? (
          <div className="create-team">
            <h2>Create a new team</h2>
            <p className="text-dim">Your team gets a #general channel automatically.</p>
            <div className="create-team-form">
              <input
                className="input"
                placeholder="Team name"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateTeam()}
                autoFocus
              />
              <div className="create-team-actions">
                <button className="btn-ghost" onClick={() => { setShowCreateTeam(false); setNewTeamName('') }}>Cancel</button>
                <button className="btn-primary" onClick={handleCreateTeam} disabled={!newTeamName.trim() || creating}>
                  {creating ? 'Creating...' : 'Create team'}
                </button>
              </div>
            </div>
          </div>
        ) : activeTeam ? (
          <TeamDashboard team={activeTeam.teams} myRole={activeTeam.role} user={user} onTeamUpdated={loadTeams} />
        ) : (
          <div className="empty-state">
            <h2>No teams yet</h2>
            <p className="text-dim">Create a team to get started with shared clipboard.</p>
            <button className="btn-primary" onClick={() => setShowCreateTeam(true)}>Create your first team</button>
          </div>
        )}
      </main>
    </div>
  )
}
