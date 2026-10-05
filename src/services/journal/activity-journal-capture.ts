import { DEFAULT_SETTINGS } from '../../shared/constants'
import type { AssistantMode, ScreenCaptureResult } from '../../shared/types'
import { extractScreenContext } from '../context/context-router'
import { fingerprintJournalFocus } from '../capture/fingerprint'
import { appendJournalSnapshot } from './activity-journal'
import { getSetting } from '../settings/store'

/** Stable focus key for adaptive journal logging (app + window + kind). */
export function resolveJournalFocusFingerprint(capture: ScreenCaptureResult): string | null {
  if (!capture.text.trim()) return null
  const assistantMode = (getSetting<string>('assistantMode') || DEFAULT_SETTINGS.assistantMode) as AssistantMode
  const ctx = extractScreenContext(capture.text, assistantMode, {
    appName: capture.appName,
    windowTitle: capture.windowTitle,
    textSource: capture.textSource
  })
  return fingerprintJournalFocus(
    capture.appName || 'Unknown',
    capture.windowTitle || '',
    ctx.kind
  )
}

/** Log one journal row from a smart-crop screen capture (Watch pipeline). */
export function appendJournalFromCapture(
  capture: ScreenCaptureResult,
  opts: { durationSec?: number; capturePlan?: 'window-crop' | 'display-full' } = {}
): void {
  if (!capture.text.trim()) return

  const assistantMode = (getSetting<string>('assistantMode') || DEFAULT_SETTINGS.assistantMode) as AssistantMode
  const ctx = extractScreenContext(capture.text, assistantMode, {
    appName: capture.appName,
    windowTitle: capture.windowTitle,
    textSource: capture.textSource
  })

  const fingerprint = resolveJournalFocusFingerprint(capture)
  if (!fingerprint) return

  const entry = appendJournalSnapshot({
    appName: capture.appName || 'Unknown',
    windowTitle: capture.windowTitle || '',
    screenKind: ctx.kind,
    snippet: ctx.focusedText.slice(0, 400) || capture.text.slice(0, 400),
    fingerprint,
    durationSec: opts.durationSec,
    ocrChars: capture.text.length,
    textSource: capture.textSource,
    capturePlan: opts.capturePlan,
    timestamp: capture.timestamp
  })

  console.info(
    `[Specter] Journal ${entry.capturePlan || 'capture'}: ${entry.appName} | ${entry.windowTitle || '(no title)'} | ` +
      `${entry.ocrChars ?? 0} OCR chars | ${entry.screenKind} | ${entry.snippet.slice(0, 80).replace(/\s+/g, ' ')}`
  )
}
