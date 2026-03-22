// Strip HTML tags and limit length to prevent XSS and abuse
export function sanitizeText(text, maxLength = 200) {
  if (!text) return ''
  return text
    .replace(/<[^>]*>/g, '')      // Strip HTML tags
    .replace(/[<>"'&]/g, '')      // Remove dangerous chars
    .trim()
    .slice(0, maxLength)
}

export function sanitizeName(name, maxLength = 50) {
  if (!name) return ''
  return name
    .replace(/<[^>]*>/g, '')
    .replace(/[<>"'&;]/g, '')
    .trim()
    .slice(0, maxLength)
}
