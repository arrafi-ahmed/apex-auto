// Short, locale-aware "2 h ago" style labels for news cards
export function relativeTime(iso) {
  const then = new Date(iso).getTime()
  if (!then) return ''
  const diffMin = Math.max(0, Math.round((Date.now() - then) / 60000))
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin} min ago`
  const h = Math.round(diffMin / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  if (d < 7) return `${d} d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function fullDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}
