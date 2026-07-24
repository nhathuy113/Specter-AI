import type { BrowserWindow } from 'electron'
import { DEFAULT_SETTINGS } from '../shared/constants'
import type { PerceptionMode } from '../shared/constants'
import { captureAccessibilityText } from '../services/accessibility-capture'
import { appendJournalFromCapture } from '../services/activity-journal-capture'
import { appendJournalSnapshot } from '../services/activity-journal'
import { extractScreenContext } from '../services/context-router'
import { fingerprintJournalFocus } from '../services/fingerprint'
import { getSetting } from '../services/store'
import { captureScreenText } from './screen-capture'
import { syncOverlayBackgroundMode } from './overlay-window'

let journalTimer: ReturnType<typeof setInterval> | null = null

/** Standalone journal tick — smart crop + OCR when journalSmartCrop enabled. */
export async function recordActivityJournalTick(): Promise<void> {
  const smartCrop = getSetting<boolean>('journalSmartCrop') ?? DEFAULT_SETTINGS.journalSmartCrop
  const useSmartCrop = smartCrop && (getSetting<boolean>('smartCrop') ?? DEFAULT_SETTINGS.smartCrop)

  if (useSmartCrop) {
    try {
      const capture = await captureScreenText(true, 'ocr', { skipAccessibility: true })
      appendJournalFromCapture(capture, { durationSec: 60, capturePlan: 'window-crop' })
      return
    } catch (err) {
      console.warn('[Specter] Journal smart-crop capture failed, falling back to AX:', err)
    }
  }

  const ax = captureAccessibilityText()
  if (!ax?.available) return

  const assistantMode = (getSetting<string>('assistantMode') || DEFAULT_SETTINGS.assistantMode) as import('../shared/types').AssistantMode
  const ctx = extractScreenContext(ax.text, assistantMode, {
    appName: ax.appName,
    windowTitle: ax.windowTitle,
    textSource: 'accessibility'
  })

  appendJournalSnapshot({
    appName: ax.appName,
    windowTitle: ax.windowTitle,
    screenKind: ctx.kind,
    snippet: ctx.focusedText.slice(0, 300),
    fingerprint: fingerprintJournalFocus(ax.appName, ax.windowTitle, ctx.kind),
    durationSec: 60,
    textSource: 'accessibility'
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

/** When Watch is on + journal enabled, Watch loop logs each capture — skip duplicate timer. */
export function syncActivityJournal(): void {
  const fullAuto = getSetting<boolean>('fullAutoMode')
  const journalEnabled = getSetting<boolean>('activityJournal') || fullAuto
  const watchEnabled = getSetting<boolean>('continuousCoach') || fullAuto
  const intervalSec = getSetting<number>('journalIntervalSec') || DEFAULT_SETTINGS.journalIntervalSec

  if (!journalEnabled) {
    stopActivityJournal()
    syncOverlayBackgroundMode()
    return
  }

  if (watchEnabled) {
    stopActivityJournal()
    console.info('[Specter] Activity journal: logging via Watch + smart crop (no separate timer)')
    syncOverlayBackgroundMode()
    return
  }

  syncOverlayBackgroundMode()
  startActivityJournal(undefined, intervalSec)
}

export { appendJournalFromCapture } from '../services/activity-journal-capture'
