export function detectType(text) {
  if (/^(https?:\/\/|www\.)\S+/i.test(text)) return 'link'
  if (/\d{1,5}\s+\w+.*(?:street|st|ave|avenue|rd|road|blvd|drive|dr|lane|ln)/i.test(text)) return 'address'
  if (/^[\s\S]*[{}\[\]();=><][\s\S]*$/.test(text) && text.length < 300) return 'code'
  return 'note'
}

export function mapPlatform(platform) {
  if (platform === 'darwin') return 'mac'
  if (platform === 'win32') return 'windows'
  if (platform === 'ios') return 'iOS'
  if (platform === 'android') return 'Android'
  return platform || 'mac'
}

export function timeAgo(timestamp) {
  const diff = Date.now() - new Date(timestamp).getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

export function formatFileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function getFileIcon(filename) {
  const ext = (filename || '').split('.').pop()?.toLowerCase()
  if (['pdf'].includes(ext)) return '📄'
  if (['doc', 'docx', 'txt', 'rtf', 'md'].includes(ext)) return '📝'
  if (['xls', 'xlsx', 'csv'].includes(ext)) return '📊'
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return '📦'
  if (['mp3', 'wav', 'aac', 'flac', 'ogg'].includes(ext)) return '🎵'
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return '🎬'
  if (['js', 'ts', 'py', 'rb', 'go', 'rs', 'java', 'json', 'html', 'css'].includes(ext)) return '💻'
  return '📎'
}
