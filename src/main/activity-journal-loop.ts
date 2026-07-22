import type { BrowserWindow } from 'electron'
import { DEFAULT_SETTINGS } from '../shared/constants'
import type { AssistantMode } from '../shared/types'
import { captureAccessibilityText } from '../services/accessibility-capture'
import { extractScreenContext } from '../services/context-router'
import { fingerprintScreenText } from '../services/fingerprint'
import { appendJournalSnapshot } from '../services/activity-journal'
import { getSetting } from '../services/store'

let journalTimer: ReturnType<typeof setInterval> | null = null

export async function recordActivityJournalTick(): Promise<void> {
  const ax = captureAccessibilityText()
  if (!ax?.available) return

  const assistantMode = (getSetting<string>('assistantMode') || DEFAULT_SETTINGS.assistantMode) as AssistantMode
  const ctx = extractScreenContext(ax.text, assistantMode, {
    appName: ax.appName,
    windowTitle: ax.windowTitle,
    textSource: 'accessibility'
  })

  const fingerprint = fingerprintScreenText(`${ax.appName}|${ax.windowTitle}|${ctx.focusedText.slice(0, 500)}`)

  appendJournalSnapshot({
    appName: ax.appName,
    windowTitle: ax.windowTitle,
    screenKind: ctx.kind,
    snippet: ctx.focusedText.slice(0, 300),
    fingerprint
  })
}

export function stopActivityJournal(): void {
  if (journalTimer) {
    clearInterval(journalTimer)
    journalTimer = null
  }
}

export function startActivityJournal(_overlayWindow?: BrowserWindow, intervalSec = 60): void {
  stopActivityJournal()
  const clamped = Math.max(30, Math.min(300, intervalSec))
  void recordActivityJournalTick()
  journalTimer = setInterval(() => {
    void recordActivityJournalTick()
  }, clamped * 1000)
}

export function syncActivityJournal(): void {
  const fullAuto = getSetting<boolean>('fullAutoMode')
  const journalEnabled = getSetting<boolean>('activityJournal') || fullAuto
  const intervalSec = getSetting<number>('journalIntervalSec') || DEFAULT_SETTINGS.journalIntervalSec

  if (journalEnabled) {
    startActivityJournal(undefined, intervalSec)
  } else {
    stopActivityJournal()
  }
}
