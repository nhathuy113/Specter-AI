const THREAD_MARKER = '---THREAD---'

export function parseHourlyAiResponse(raw: string): { summary: string; sessionThread: string } {
  const idx = raw.indexOf(THREAD_MARKER)
  if (idx < 0) {
    return { summary: raw.trim(), sessionThread: raw.trim().slice(-500) }
  }
  const summary = raw.slice(0, idx).trim()
  const sessionThread = raw.slice(idx + THREAD_MARKER.length).trim()
  return { summary, sessionThread }
}
