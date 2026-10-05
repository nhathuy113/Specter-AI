import { describe, expect, it } from 'vitest'
import {
  buildHourlyReportSummary,
  formatHourlyReportMarkdown,
  filterEntriesInPeriod
} from './activity-journal-hourly-report'
import type { ActivityJournalEntry } from '../../shared/types'

function entry(partial: Partial<ActivityJournalEntry> & { timestamp: number }): ActivityJournalEntry {
  return {
    id: `aj-${partial.timestamp}`,
    minuteKey: '2026-07-23T10:00',
    appName: 'Cursor',
    windowTitle: 'test',
    screenKind: 'ide',
    snippet: '',
    fingerprint: 'fp',
    durationSec: 600,
    ...partial
  }
}

describe('activity-journal-hourly-report', () => {
  it('filters entries by period end timestamp', () => {
    const start = Date.parse('2026-07-23T10:00:00')
    const end = Date.parse('2026-07-23T11:00:00')
    const entries = [
      entry({ timestamp: Date.parse('2026-07-23T10:30:00'), appName: 'hoi4', windowTitle: 'Hearts of Iron IV' }),
      entry({ timestamp: Date.parse('2026-07-23T11:30:00'), appName: 'Chrome' })
    ]
    expect(filterEntriesInPeriod(entries, start, end)).toHaveLength(1)
  })

  it('builds app breakdown and HOI4 time', () => {
    const start = Date.parse('2026-07-23T10:00:00')
    const end = Date.parse('2026-07-23T11:00:00')
    const summary = buildHourlyReportSummary(
      [
        entry({ timestamp: Date.parse('2026-07-23T10:20:00'), appName: 'hoi4', windowTitle: 'Hearts of Iron IV', durationSec: 3600 }),
        entry({ timestamp: Date.parse('2026-07-23T10:50:00'), appName: 'Cursor', durationSec: 600 })
      ],
      start,
      end
    )
    expect(summary.hoi4Sec).toBe(3600)
    expect(summary.apps[0].appName).toBe('hoi4')
    const md = formatHourlyReportMarkdown(summary)
    expect(md).toContain('HOI4')
    expect(md).toContain('1h 0m')
  })
})
