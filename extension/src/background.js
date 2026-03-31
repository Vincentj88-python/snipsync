// ── Context menus ───────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'snip-selection',
    title: 'Send to SnipSync',
    contexts: ['selection'],
  })

  chrome.contextMenus.create({
    id: 'snip-link',
    title: 'Snip this link',
    contexts: ['link'],
  })
})

// ── Handle context menu clicks ──────────────────────

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  let text = ''

  if (info.menuItemId === 'snip-selection') {
    text = info.selectionText?.trim()
  } else if (info.menuItemId === 'snip-link') {
    text = info.linkUrl
  }

  if (!text) return
  await createClipFromBackground(text)
})

// ── Handle keyboard shortcut ────────────────────────

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'snip-selection') return

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return

  // Execute script to get selected text
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => window.getSelection()?.toString()?.trim(),
  })

  const text = results?.[0]?.result
  if (!text) return
  await createClipFromBackground(text)
})

// ── Create clip from background ─────────────────────

async function createClipFromBackground(text) {
  const session = await chrome.storage.local.get(['sb_access_token', 'sb_user', 'sb_device_id'])
  if (!session.sb_access_token || !session.sb_user || !session.sb_device_id) {
    chrome.action.setBadgeText({ text: '!' })
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' })
    return
  }

  const SUPABASE_URL = 'https://kohwpkwcopkslbtkczag.supabase.co'
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvaHdwa3djb3Brc2xidGtjemFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzkyNTAsImV4cCI6MjA4ODcxNTI1MH0.PrsQDtXSa8Y8vy-JgIfBk3l0iVtmedHPqr72fzhwd7k'

  // Detect type
  let type = 'note'
  if (/^(https?:\/\/|www\.)\S+/i.test(text)) type = 'link'
  else if (/\d{1,5}\s+\w+.*(?:street|st|ave|avenue|rd|road|blvd|drive|dr|lane|ln)/i.test(text)) type = 'address'
  else if (/^[\s\S]*[{}\[\]();=><][\s\S]*$/.test(text) && text.length < 300) type = 'code'

  // Check if user has encryption enabled — if so, skip from background
  // (background service worker can't prompt for vault password, so we
  //  only send plaintext if encryption is OFF; otherwise show badge hint)
  try {
    const encRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${session.sb_user.id}&select=encryption_enabled&limit=1`,
      { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${session.sb_access_token}` } }
    )
    const encData = await encRes.json()
    if (encData?.[0]?.encryption_enabled) {
      // Can't encrypt from background — prompt user to open popup
      chrome.action.setBadgeText({ text: '🔒' })
      chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' })
      setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000)
      return
    }
  } catch {
    // If check fails, proceed without encryption
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/clips`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${session.sb_access_token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        user_id: session.sb_user.id,
        device_id: session.sb_device_id,
        content: text.slice(0, 10000),
        type,
      }),
    })

    if (res.ok) {
      chrome.action.setBadgeText({ text: '✓' })
      chrome.action.setBadgeBackgroundColor({ color: '#22c55e' })
      setTimeout(() => chrome.action.setBadgeText({ text: '' }), 1500)
    }
  } catch {
    chrome.action.setBadgeText({ text: '!' })
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' })
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000)
  }
}
