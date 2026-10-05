import { describe, expect, it } from 'vitest'
import {
  buildActivityHeatmap,
  formatPeakHours,
  summarizeHeatmap
} from './activity-journal-heatmap'
import type { ActivityJournalEntry } from '../../shared/types'

function entry(partial: Partial<ActivityJournalEntry> & Pick<ActivityJournalEntry, 'timestamp'>): ActivityJournalEntry {
  return {
    id: `aj-${partial.timestamp}`,
    minuteKey: '2026-07-22T09:00',
    appName: 'Cursor',
    windowTitle: 'test',
    screenKind: 'ide',
    snippet: '',
    fingerprint: 'fp',
    durationSec: partial.durationSec ?? 60,
    ...partial
  }
}

describe('activity-journal-heatmap', () => {
  it('aggregates focus time into hour buckets', () => {
    const d = new Date('2026-07-22T09:30:00')
    const cells = buildActivityHeatmap([
      entry({ timestamp: d.getTime(), durationSec: 1800 })
    ])
    const nine = cells.find((c) => c.dayOfWeek === d.getDay() && c.hour === 9)
    expect(nine?.totalSec).toBeGreaterThan(1700)
  })

  it('reports peak hour ranges', () => {
    const base = new Date('2026-07-22T10:00:00').getTime()
    const entries = [
      entry({ timestamp: base, durationSec: 3600 }),
      entry({ timestamp: base + 3_600_000, durationSec: 3600 }),
      entry({ timestamp: new Date('2026-07-22T22:00:00').getTime(), durationSec: 300 })
    ]
    const summary = summarizeHeatmap(entries)
    expect(summary.peakHours.length).toBeGreaterThan(0)
    expect(summary.peakLabel).toContain('Peak:')
  })

  it('formats contiguous peak hours', () => {
    expect(formatPeakHours([9, 10, 11])).toBe('Peak: 9–12h')
    expect(formatPeakHours([14])).toBe('Peak: 14h')
  })
})
