import type { ActivityJournalEntry } from '../shared/types'

export interface HourlyReportAppStat {
  appName: string
  totalSec: number
  entryCount: number
}

export interface HourlyReportSummary {
  periodStartMs: number
  periodEndMs: number
  totalFocusSec: number
  entryCount: number
  apps: HourlyReportAppStat[]
  hoi4Sec: number
  highlights: string[]
}

function isHoi4Entry(e: ActivityJournalEntry): boolean {
  const app = (e.appName || '').toLowerCase()
  const win = (e.windowTitle || '').toLowerCase()
  return app.includes('hoi4') || win.includes('hearts of iron')
}

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

/** Entries whose end timestamp falls in [startMs, endMs). */
export function filterEntriesInPeriod(
  entries: ActivityJournalEntry[],
  startMs: number,
  endMs: number
): ActivityJournalEntry[] {
  return entries.filter((e) => {
    const end = e.timestamp
    return end >= startMs && end < endMs
  })
}

export function buildHourlyReportSummary(
  entries: ActivityJournalEntry[],
  periodStartMs: number,
  periodEndMs: number
): HourlyReportSummary {
  const inPeriod = filterEntriesInPeriod(entries, periodStartMs, periodEndMs)
  const byApp = new Map<string, { totalSec: number; entryCount: number }>()

  let totalFocusSec = 0
  let hoi4Sec = 0

  for (const e of inPeriod) {
    const dur = e.durationSec || 0
    totalFocusSec += dur
    if (isHoi4Entry(e)) hoi4Sec += dur

    const key = e.appName || 'Unknown'
    const cur = byApp.get(key) ?? { totalSec: 0, entryCount: 0 }
    cur.totalSec += dur
    cur.entryCount += 1
    byApp.set(key, cur)
  }

  const apps = [...byApp.entries()]
    .map(([appName, v]) => ({ appName, ...v }))
    .sort((a, b) => b.totalSec - a.totalSec)

  const highlights: string[] = []
  if (apps[0]) {
    highlights.push(`Most time: ${apps[0].appName} (${formatDuration(apps[0].totalSec)})`)
  }
  if (hoi4Sec > 0) {
    highlights.push(`HOI4: ${formatDuration(hoi4Sec)}`)
  }
  const topWindows = [...inPeriod]
    .sort((a, b) => b.durationSec - a.durationSec)
    .slice(0, 3)
    .map((e) => `${e.appName} — ${(e.windowTitle || '(no title)').slice(0, 40)} (${formatDuration(e.durationSec)})`)
  highlights.push(...topWindows)

  return {
    periodStartMs,
    periodEndMs,
    totalFocusSec,
    entryCount: inPeriod.length,
    apps,
    hoi4Sec,
    highlights
  }
}

export function formatHourlyReportMarkdown(summary: HourlyReportSummary): string {
  const start = new Date(summary.periodStartMs)
  const end = new Date(summary.periodEndMs)
  const pad = (n: number) => String(n).padStart(2, '0')
  const label = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())} ${pad(start.getHours())}:00–${pad(end.getHours())}:00`

  const lines = [
    `# Specter Hourly Report — ${label}`,
    '',
    `- **Total logged focus:** ${formatDuration(summary.totalFocusSec)}`,
    `- **Journal entries:** ${summary.entryCount}`,
    `- **HOI4:** ${summary.hoi4Sec > 0 ? formatDuration(summary.hoi4Sec) : '—'}`,
    '',
    '## By app',
    ''
  ]

  if (summary.apps.length === 0) {
    lines.push('_No activity in this hour (away / idle / Specter not logging)._')
  } else {
    for (const a of summary.apps) {
      lines.push(`- **${a.appName}** — ${formatDuration(a.totalSec)} (${a.entryCount} entries)`)
    }
  }

  lines.push('', '## Highlights', '')
  for (const h of summary.highlights) {
    lines.push(`- ${h}`)
  }

  lines.push('', `Generated: ${new Date().toISOString()}`)
  return lines.join('\n')
}

export function formatHourlyReportJson(summary: HourlyReportSummary): string {
  return JSON.stringify(
    {
      periodStart: new Date(summary.periodStartMs).toISOString(),
      periodEnd: new Date(summary.periodEndMs).toISOString(),
      totalFocusSec: summary.totalFocusSec,
      entryCount: summary.entryCount,
      hoi4Sec: summary.hoi4Sec,
      apps: summary.apps,
      highlights: summary.highlights
    },
    null,
    2
  )
}
