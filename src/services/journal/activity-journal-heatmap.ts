import type { ActivityJournalEntry } from '../../shared/types'

export interface HeatmapCell {
  dayOfWeek: number // 0 = Sunday … 6 = Saturday
  hour: number // 0–23
  totalSec: number
  entryCount: number
}

export interface HeatmapSummary {
  cells: HeatmapCell[]
  maxSec: number
  peakHours: number[]
  peakLabel: string
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function dayLabel(dayOfWeek: number): string {
  return DAY_LABELS[dayOfWeek] ?? '?'
}

/** Sum focus seconds + entry counts per (day-of-week, hour). */
export function buildActivityHeatmap(entries: ActivityJournalEntry[]): HeatmapCell[] {
  const grid = new Map<string, HeatmapCell>()

  for (const entry of entries) {
    const endMs = entry.timestamp
    const startMs = endMs - Math.max(0, entry.durationSec) * 1000
    distributeRangeToCells(grid, startMs, endMs, entry)
  }

  const cells: HeatmapCell[] = []
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      cells.push(grid.get(`${day}:${hour}`) ?? { dayOfWeek: day, hour, totalSec: 0, entryCount: 0 })
    }
  }
  return cells
}

function distributeRangeToCells(
  grid: Map<string, HeatmapCell>,
  startMs: number,
  endMs: number,
  entry: ActivityJournalEntry
): void {
  if (endMs <= startMs) {
    bumpCell(grid, new Date(endMs), endMs - startMs, entry, 1)
    return
  }

  let cursor = startMs
  while (cursor < endMs) {
    const d = new Date(cursor)
    const hourEnd = new Date(d)
    hourEnd.setMinutes(59, 59, 999)
    const sliceEnd = Math.min(endMs, hourEnd.getTime() + 1)
    const sliceSec = (sliceEnd - cursor) / 1000
    bumpCell(grid, d, sliceSec * 1000, entry, cursor === startMs ? 1 : 0)
    cursor = sliceEnd
  }
}

function bumpCell(
  grid: Map<string, HeatmapCell>,
  date: Date,
  sliceMs: number,
  _entry: ActivityJournalEntry,
  entryInc: number
): void {
  const key = `${date.getDay()}:${date.getHours()}`
  const cell = grid.get(key) ?? {
    dayOfWeek: date.getDay(),
    hour: date.getHours(),
    totalSec: 0,
    entryCount: 0
  }
  cell.totalSec += Math.max(0, sliceMs / 1000)
  cell.entryCount += entryInc
  grid.set(key, cell)
}

export function summarizeHeatmap(entries: ActivityJournalEntry[]): HeatmapSummary {
  const cells = buildActivityHeatmap(entries)
  const maxSec = cells.reduce((m, c) => Math.max(m, c.totalSec), 0)

  const byHour = new Map<number, number>()
  for (const c of cells) {
    byHour.set(c.hour, (byHour.get(c.hour) ?? 0) + c.totalSec)
  }

  const sorted = [...byHour.entries()].sort((a, b) => b[1] - a[1])
  const threshold = sorted[0]?.[1] ? sorted[0][1] * 0.6 : 0
  const peakHours = sorted.filter(([, sec]) => sec >= threshold && sec > 0).map(([h]) => h).slice(0, 6)

  return {
    cells,
    maxSec,
    peakHours,
    peakLabel: formatPeakHours(peakHours)
  }
}

export function formatPeakHours(hours: number[]): string {
  if (hours.length === 0) return 'No peak hours yet'
  const sorted = [...hours].sort((a, b) => a - b)
  const ranges: string[] = []
  let start = sorted[0]
  let prev = sorted[0]

  for (let i = 1; i <= sorted.length; i++) {
    const h = sorted[i]
    if (h === prev + 1) {
      prev = h
      continue
    }
    ranges.push(start === prev ? `${start}h` : `${start}–${prev + 1}h`)
    start = h
    prev = h
  }
  return `Peak: ${ranges.join(', ')}`
}

export function heatmapCellIntensity(totalSec: number, maxSec: number): number {
  if (maxSec <= 0 || totalSec <= 0) return 0
  return Math.min(1, totalSec / maxSec)
}
