export interface GameLogEntry {
  location: string
  manpower?: string
  armored?: string
  air?: string
  other?: string
  poolManpower?: string
  poolArmored?: string
}

const RELATIVE_TIME_LINE = /^\d+\s+(?:seconds?|minutes?|hours?|days?|weeks?|months?)\s+ago\.?$/i
const STAT_LINE = /^(Manpower|Armored|Air|Other):\s*(.+)$/i
export const GAME_LOG_SIGNAL = /\b(manpower|armored|air:|other:)\b/i
const LOCATION_LINE = /^[A-Z][a-zA-Z\s'.-]{2,40}$/

export function parseGameLogEntries(lines: string[]): GameLogEntry[] {
  const entries: GameLogEntry[] = []
  let current: Partial<GameLogEntry> | null = null

  const pushCurrent = (): void => {
    if (!current?.location) return
    if (current.manpower || current.armored || current.air || current.other || current.poolManpower) {
      entries.push(current as GameLogEntry)
    }
    current = null
  }

  for (const line of lines) {
    if (RELATIVE_TIME_LINE.test(line)) continue

    const statMatch = line.match(STAT_LINE)
    if (statMatch) {
      if (!current) current = { location: 'Unknown battle' }
      const key = statMatch[1].toLowerCase()
      const value = statMatch[2].trim()

      if (key === 'manpower') {
        if (!current.manpower) current.manpower = value
        else current.poolManpower = value
      } else if (key === 'armored') {
        if (!current.armored) current.armored = value
        else current.poolArmored = value
      } else if (key === 'air') {
        current.air = value
      } else if (key === 'other') {
        current.other = value
      }
      continue
    }

    if (LOCATION_LINE.test(line) && !GAME_LOG_SIGNAL.test(line)) {
      pushCurrent()
      current = { location: line }
    }
  }

  pushCurrent()
  return entries
}

export function formatGameLogEntries(entries: GameLogEntry[]): string {
  if (entries.length === 0) return ''

  return entries
    .map((entry, index) => {
      const parts = [`${index + 1}. ${entry.location}`]
      const losses: string[] = []
      if (entry.manpower) losses.push(`Manpower ${entry.manpower}`)
      if (entry.armored) losses.push(`Armored ${entry.armored}`)
      if (entry.air) losses.push(`Air ${entry.air}`)
      if (entry.other) losses.push(`Other ${entry.other}`)
      if (losses.length) parts.push(`Losses: ${losses.join(', ')}`)

      const pool: string[] = []
      if (entry.poolManpower) pool.push(`Manpower ${entry.poolManpower}`)
      if (entry.poolArmored) pool.push(`Armored ${entry.poolArmored}`)
      if (pool.length) parts.push(`Enemy pool (if shown): ${pool.join(', ')}`)

      return parts.join(' — ')
    })
    .join('\n')
}

export function detectGameLog(lines: string[]): { entries: GameLogEntry[]; focusedText: string } | null {
  const entries = parseGameLogEntries(lines)
  const hasStructure = entries.some((e) => e.manpower || e.armored)
  if (hasStructure && entries.length > 0) {
    return { entries, focusedText: formatGameLogEntries(entries) }
  }

  const body = lines.join('\n')
  if (GAME_LOG_SIGNAL.test(body) && entries.length > 0) {
    const focused = formatGameLogEntries(entries) || lines.filter((l) => GAME_LOG_SIGNAL.test(l)).join('\n')
    return { entries, focusedText: focused }
  }

  return null
}
