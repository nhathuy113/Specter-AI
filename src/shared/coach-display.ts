function plainMath(raw: string): string {
  return raw
    .replace(/\\log/g, 'log')
    .replace(/\\min/g, 'min')
    .replace(/\\max/g, 'max')
    .replace(/\\cdot/g, '*')
    .replace(/\\times/g, '*')
    .replace(/\\,/g, '')
    .replace(/\\/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function stripThreadForDisplay(reply: string): string {
  const idx = reply.indexOf('---THREAD---')
  if (idx < 0) return reply.trim()
  return reply.slice(0, idx).trim()
}

/** Strip thread marker and LaTeX from coach text shown in overlay. */
export function sanitizeCoachDisplayText(reply: string): string {
  let text = stripThreadForDisplay(reply)
  text = text.replace(/\$\$([^$]+)\$\$/g, (_m, inner: string) => plainMath(inner))
  text = text.replace(/\$([^$\n]+)\$/g, (_m, inner: string) => plainMath(inner))
  text = text.replace(/\\\(([^)]+)\\\)/g, (_m, inner: string) => plainMath(inner))
  // Model sometimes writes bare \log, \min without $ delimiters
  text = text.replace(/\\log/g, 'log')
  text = text.replace(/\\min/g, 'min')
  text = text.replace(/\\max/g, 'max')
  return text.trim()
}
