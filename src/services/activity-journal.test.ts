import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const store = new Map<string, unknown>()

vi.mock('./store', () => ({
  getSetting: vi.fn((key: string) => store.get(key)),
  setSetting: vi.fn((key: string, value: unknown) => {
    store.set(key, value)
  })
}))

import {
  appendJournalSnapshot,
  exportJournalMarkdown,
  getJournalEntries,
  getRecentJournalContext,
  minuteKeyFromDate
} from './activity-journal'

describe('activity-journal', () => {
  beforeEach(() => {
    store.clear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('formats minute keys', () => {
    const key = minuteKeyFromDate(new Date('2026-07-22T14:05:00'))
    expect(key).toBe('2026-07-22T14:05')
  })

  it('merges consecutive same fingerprint across minutes (idle / away)', () => {
    appendJournalSnapshot({
      appName: 'Cursor',
      windowTitle: 'App.tsx',
      screenKind: 'ide',
      snippet: 'function build()',
      fingerprint: 'fp-idle',
      timestamp: Date.parse('2026-07-22T14:05:30'),
      durationSec: 60
    })
    appendJournalSnapshot({
      appName: 'Cursor',
      windowTitle: 'App.tsx',
      screenKind: 'ide',
      snippet: 'function buildApp()',
      fingerprint: 'fp-idle',
      timestamp: Date.parse('2026-07-22T14:06:30'),
      durationSec: 60
    })

    const entries = getJournalEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0].durationSec).toBe(120)
  })

  it('appends and merges same focus session within a minute', () => {
    const ts = Date.parse('2026-07-22T14:05:30')
    appendJournalSnapshot({
      appName: 'Cursor',
      windowTitle: 'App.tsx',
      screenKind: 'ide',
      snippet: 'function build()',
      fingerprint: 'fp-1',
      timestamp: ts
    })
    appendJournalSnapshot({
      appName: 'Cursor',
      windowTitle: 'App.tsx',
      screenKind: 'ide',
      snippet: 'function buildApp()',
      fingerprint: 'fp-1',
      timestamp: ts + 10_000
    })

    const entries = getJournalEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0].durationSec).toBe(120)
    expect(entries[0].snippet).toContain('buildApp')
  })

  it('builds recent context block', () => {
    appendJournalSnapshot({
      appName: 'Cursor',
      windowTitle: 'test.ts',
      screenKind: 'code',
      snippet: 'error TS2304',
      fingerprint: 'fp-a',
      timestamp: Date.now()
    })

    const ctx = getRecentJournalContext(15)
    expect(ctx).toContain('[ACTIVITY JOURNAL')
    expect(ctx).toContain('Cursor')
  })

  it('exports markdown by day', () => {
    appendJournalSnapshot({
      appName: 'Chrome',
      windowTitle: 'Docs',
      screenKind: 'browser',
      snippet: 'Performance review notes',
      fingerprint: 'fp-b',
      timestamp: Date.parse('2026-07-22T09:00:00')
    })

    const md = exportJournalMarkdown()
    expect(md).toContain('# Specter Activity Journal')
    expect(md).toContain('## 2026-07-22')
    expect(md).toContain('Chrome')
  })
})
