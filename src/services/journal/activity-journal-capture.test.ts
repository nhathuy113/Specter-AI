import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ScreenCaptureResult } from '../../shared/types'

const store = new Map<string, unknown>()
vi.mock('../settings/store', () => ({
  getSetting: vi.fn((key: string) => store.get(key) ?? (key === 'assistantMode' ? 'work' : undefined)),
  setSetting: vi.fn((key: string, value: unknown) => store.set(key, value))
}))

import { appendJournalFromCapture } from './activity-journal-capture'
import { getJournalEntries } from './activity-journal'

describe('appendJournalFromCapture', () => {
  beforeEach(() => store.clear())
  afterEach(() => vi.clearAllMocks())

  it('logs OCR snippet from smart-crop capture', () => {
    const capture: ScreenCaptureResult = {
      text: 'Cursor\nPERFORMANCE REVIEW\nfunction buildApp() {\n  return true\n}',
      timestamp: Date.now(),
      appName: 'Cursor',
      windowTitle: 'App.tsx',
      textSource: 'ocr'
    }

    appendJournalFromCapture(capture, { durationSec: 3, capturePlan: 'window-crop' })

    const entries = getJournalEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0].ocrChars).toBeGreaterThan(20)
    expect(entries[0].capturePlan).toBe('window-crop')
    expect(entries[0].appName).toBe('Cursor')
    expect(entries[0].snippet).toContain('PERFORMANCE')
  })

  it('dedupes repeated captures for same app/window (idle screen)', () => {
    const capture: ScreenCaptureResult = {
      text: 'Cursor\nPERFORMANCE REVIEW\nline one',
      timestamp: Date.now(),
      appName: 'Cursor',
      windowTitle: 'PERFORMANCE REVIEW',
      textSource: 'ocr'
    }
    const capture2: ScreenCaptureResult = {
      ...capture,
      text: 'Cursor\nPERFORMANCE REVIEW\nline two different ocr noise',
      timestamp: Date.now() + 60_000
    }

    appendJournalFromCapture(capture, { durationSec: 60, capturePlan: 'window-crop' })
    appendJournalFromCapture(capture2, { durationSec: 60, capturePlan: 'window-crop' })

    const entries = getJournalEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0].durationSec).toBe(120)
    expect(entries[0].fingerprint).toBeTruthy()
  })
})
