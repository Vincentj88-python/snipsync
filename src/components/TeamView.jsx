import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  getMyTeams, getChannels, getChannelClips, getTeamMembers, getTeamGroups,
  postToChannel, subscribeToChannel, addClip, parseMentions, createMentions,
  getDirectClips, sendDirectClip, getUnreadMentionCount, getMyMentions,
  markMentionRead,
} from '../lib/supabase'
import { detectType } from '../lib/utils'
import ClipCard from './ClipCard'

export default function TeamView({ user, deviceId, subscription, onOpenUrl, onDownloadFile, onLightbox, encryptionEnabled, masterKeyRef }) {
  const [teams, setTeams] = useState([])
  const [activeTeam, setActiveTeam] = useState(null)
  const [channels, setChannels] = useState([])
  const [activeChannelId, setActiveChannelId] = useState(null)
  const [channelClips, setChannelClips] = useState([])
  const [teamMembers, setTeamMembers] = useState([])
  const [teamGroups, setTeamGroups] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [mentionSuggestions, setMentionSuggestions] = useState([])
  const [showMentions, setShowMentions] = useState(false)
  const [unreadMentions, setUnreadMentions] = useState(0)
  const [viewMode, setViewMode] = useState('channels') // 'channels' | 'mentions' | 'direct'
  const [mentions, setMentions] = useState([])
  const [directClips, setDirectClips] = useState([])
  const unsubChannelRef = useRef(null)

  // Load teams
  useEffect(() => {
    if (!user) return
    const load = async () => {
      const data = await getMyTeams(user.id)
      setTeams(data)
      if (data.length > 0) {
        setActiveTeam(data[0])
      }
    }
    load()
  }, [user])

  // Load channels + members when team changes
  useEffect(() => {
    if (!activeTeam) return
    const teamId = activeTeam.teams.id
    const load = async () => {
      const [chs, members, groups, mentionCount] = await Promise.all([
        getChannels(teamId),
        getTeamMembers(teamId),
        getTeamGroups(teamId),
        getUnreadMentionCount(user.id),
      ])
      setChannels(chs)
      setTeamMembers(members)
      setTeamGroups(groups)
      setUnreadMentions(mentionCount)
      if (chs.length > 0 && !activeChannelId) {
        setActiveChannelId(chs[0].id)
      }
    }
    load()
  }, [activeTeam])

  // Load channel clips + subscribe to realtime
  useEffect(() => {
    if (!activeChannelId) return

    const load = async () => {
      const data = await getChannelClips(activeChannelId)
      setChannelClips(data)
    }
    load()

    // Unsubscribe from previous channel
    if (unsubChannelRef.current) unsubChannelRef.current()

    // Subscribe to new channel
    unsubChannelRef.current = subscribeToChannel(
      activeChannelId,
      async (newChannelClip) => {
        // Reload to get full joined data
        const data = await getChannelClips(activeChannelId)
        setChannelClips(data)
      },
      (deletedId) => {
        setChannelClips((prev) => prev.filter((cc) => cc.id !== deletedId))
      }
    )

    return () => {
      if (unsubChannelRef.current) unsubChannelRef.current()
    }
  }, [activeChannelId])

  // Handle @mention autocomplete
  const handleInputChange = (e) => {
    const val = e.target.value
    setInput(val)

    // Check for @mention at cursor
    const cursorPos = e.target.selectionStart
    const textBefore = val.slice(0, cursorPos)
    const mentionMatch = textBefore.match(/@(\w*)$/)

    if (mentionMatch) {
      const query = mentionMatch[1].toLowerCase()
      const suggestions = []

      // Match members
      teamMembers.forEach((m) => {
        const name = m.profiles?.display_name || m.profiles?.email?.split('@')[0] || ''
        if (name.toLowerCase().startsWith(query) || query === '') {
          suggestions.push({ type: 'user', id: m.user_id, name, display: `👤 ${name}` })
        }
      })

      // Match groups
      teamGroups.forEach((g) => {
        if (g.name.toLowerCase().startsWith(query) || query === '') {
          suggestions.push({ type: 'group', id: g.id, name: g.name, display: `👥 @${g.name}` })
        }
      })

      setMentionSuggestions(suggestions.slice(0, 6))
      setShowMentions(suggestions.length > 0)
    } else {
      setShowMentions(false)
    }
  }

  const insertMention = (suggestion) => {
    const textBefore = input.slice(0, input.lastIndexOf('@'))
    const prefix = suggestion.type === 'group' ? `@${suggestion.name}` : `@${suggestion.name.split(' ')[0].toLowerCase()}`
    setInput(textBefore + prefix + ' ')
    setShowMentions(false)
  }

  // Send clip to channel
  const handleSend = async () => {
    if (!input.trim() || !activeChannelId || !deviceId || sending) return
    setSending(true)

    const type = detectType(input.trim())
    const { data: clipData } = await addClip(user.id, deviceId, input.trim(), type)

    if (clipData) {
      // Post to channel
      const { data: channelClipData } = await postToChannel(activeChannelId, clipData.id, user.id)

      // Parse and create mentions
      const foundMentions = parseMentions(input.trim(), teamMembers, teamGroups)
      if (foundMentions.length > 0 && channelClipData) {
        await createMentions(clipData.id, foundMentions, channelClipData.id)
      }

      setInput('')
    }
    setSending(false)
  }

  // Load mentions view
  const loadMentions = async () => {
    const data = await getMyMentions(user.id)
    setMentions(data)
    setUnreadMentions(0)
  }

  // Load direct messages
  const loadDirectClips = async () => {
    const data = await getDirectClips(user.id)
    setDirectClips(data)
  }

  if (teams.length === 0) {
    return (
      <div className="team-empty">
        <div className="team-empty-icon">👥</div>
        <span className="team-empty-title">No teams</span>
        <span className="team-empty-desc">
          Join a team via an invite link, or create one at{' '}
          <span className="team-empty-link" onClick={() => onOpenUrl?.('https://portal.snipsync.xyz')}>
            portal.snipsync.xyz
          </span>
        </span>
      </div>
    )
  }

  return (
    <div className="team-view">
      {/* Team selector (if multiple teams) */}
      {teams.length > 1 && (
        <div className="team-selector">
          {teams.map((t) => (
            <button
              key={t.teams.id}
              className={`team-selector-btn ${t.teams.id === activeTeam?.teams.id ? 'team-selector-btn--active' : ''}`}
              onClick={() => { setActiveTeam(t); setActiveChannelId(null) }}
            >
              {t.teams.name}
            </button>
          ))}
        </div>
      )}

      {/* View mode tabs */}
      <div className="team-tabs">
        <button className={`team-tab ${viewMode === 'channels' ? 'team-tab--active' : ''}`} onClick={() => setViewMode('channels')}>
          Channels
        </button>
        <button className={`team-tab ${viewMode === 'mentions' ? 'team-tab--active' : ''}`} onClick={() => { setViewMode('mentions'); loadMentions() }}>
          Mentions {unreadMentions > 0 && <span className="team-badge">{unreadMentions}</span>}
        </button>
        <button className={`team-tab ${viewMode === 'direct' ? 'team-tab--active' : ''}`} onClick={() => { setViewMode('direct'); loadDirectClips() }}>
          Direct
        </button>
      </div>

      {viewMode === 'channels' && (
        <>
          {/* Channel list */}
          <div className="channel-bar">
            {channels.map((ch) => (
              <button
                key={ch.id}
                className={`channel-btn ${ch.id === activeChannelId ? 'channel-btn--active' : ''}`}
                onClick={() => setActiveChannelId(ch.id)}
              >
                # {ch.name}
              </button>
            ))}
          </div>

          {/* Channel clips */}
          <div className="team-clip-list">
            {channelClips.length === 0 ? (
              <div className="team-clip-empty">No clips in this channel yet. Send one below.</div>
            ) : (
              channelClips.map((cc) => (
                <div key={cc.id} className="team-clip-wrapper">
                  <span className="team-clip-sender">{cc.profiles?.display_name || cc.profiles?.email || 'Unknown'}</span>
                  {cc.clips && (
                    <ClipCard
                      clip={cc.clips}
                      onCopy={() => navigator.clipboard.writeText(cc.clips.content)}
                      onOpenUrl={onOpenUrl}
                      onDownloadFile={onDownloadFile}
                      onLightbox={onLightbox}
                    />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Input with @mention autocomplete */}
          <div className="team-input-area">
            {showMentions && (
              <div className="mention-popup">
                {mentionSuggestions.map((s) => (
                  <button key={s.id} className="mention-option" onClick={() => insertMention(s)}>
                    {s.display}
                  </button>
                ))}
              </div>
            )}
            <div className="team-input-wrapper">
              <textarea
                className="team-input"
                placeholder={`Message #${channels.find((c) => c.id === activeChannelId)?.name || 'channel'}... Use @name to mention`}
                value={input}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                rows={1}
              />
              <button
                className={`team-send-btn ${input.trim() ? 'team-send-btn--active' : ''}`}
                onClick={handleSend}
                disabled={!input.trim() || sending}
              >
                {sending ? '...' : 'Send'}
              </button>
            </div>
          </div>
        </>
      )}

      {viewMode === 'mentions' && (
        <div className="team-clip-list">
          {mentions.length === 0 ? (
            <div className="team-clip-empty">No mentions yet. When someone @mentions you, it will appear here.</div>
          ) : (
            mentions.map((m) => (
              <div key={m.id} className="team-clip-wrapper" onClick={() => markMentionRead(m.id)}>
                {!m.read_at && <span className="mention-unread-dot" />}
                {m.clips && (
                  <ClipCard
                    clip={m.clips}
                    onCopy={() => navigator.clipboard.writeText(m.clips.content)}
                    onOpenUrl={onOpenUrl}
                  />
                )}
              </div>
            ))
          )}
        </div>
      )}

      {viewMode === 'direct' && (
        <div className="team-clip-list">
          {directClips.length === 0 ? (
            <div className="team-clip-empty">No direct messages yet.</div>
          ) : (
            directClips.map((dc) => (
              <div key={dc.id} className="team-clip-wrapper">
                <span className="team-clip-sender">
                  {dc.sender_id === user.id ? `To: ${dc.receiver?.display_name || dc.receiver?.email}` : `From: ${dc.sender?.display_name || dc.sender?.email}`}
                </span>
                {dc.clips && (
                  <ClipCard
                    clip={dc.clips}
                    onCopy={() => navigator.clipboard.writeText(dc.clips.content)}
                    onOpenUrl={onOpenUrl}
                  />
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
