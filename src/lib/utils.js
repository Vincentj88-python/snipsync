export function detectType(text) {
  if (/^https?:\/\//i.test(text)) return 'link'
  if (/\d{1,5}\s+\w+.*(?:street|st|ave|avenue|rd|road|blvd|drive|dr|lane|ln)/i.test(text)) return 'address'
  if (/^[\s\S]*[{}\[\]();=><][\s\S]*$/.test(text) && text.length < 300) return 'code'
  return 'note'
}

export function mapPlatform(platform) {
  if (platform === 'darwin') return 'mac'
  if (platform === 'win32') return 'windows'
  return platform || 'mac'
}
