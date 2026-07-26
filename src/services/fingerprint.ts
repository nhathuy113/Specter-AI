import { createHash } from 'crypto'
import { extractScreenContext } from './context-router'
import { extractEditorCodeFingerprint, workSessionKey } from './work-coach-session'
import { resolveWorkProblemProfile } from './work-problem-profile'
import type { ScreenMetadata } from '../shared/types'

export function hashScreenshotBase64(base64?: string): string {
  if (!base64?.trim()) return ''
  return createHash('sha256').update(base64.trim()).digest('hex').slice(0, 16)
}

const RELATIVE_TIME_PATTERN = /\b\d+\s+(?:seconds?|minutes?|hours?|days?|weeks?|months?)\s+ago\.?\b/gi

/**
 * Normalize OCR text so minor formatting differences do not retrigger the coach.
 * Keeps numeric battle stats intact — only strips noisy relative timestamps.
 */
export function normalizeScreenText(rawText: string): string {
  return rawText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(RELATIVE_TIME_PATTERN, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .toLowerCase()
}

export function fingerprintScreenText(rawText: string): string {
  const normalized = normalizeScreenText(rawText)
  if (!normalized) return ''
  return createHash('sha256').update(normalized).digest('hex')
}

/** Fingerprint combat-relevant OCR so IDE chrome or timestamps do not retrigger the coach. */
export function fingerprintCoachScreenText(rawText: string): string {
  const ctx = extractScreenContext(rawText)
  if (ctx.kind === 'game-log' && ctx.focusedText.trim()) {
    return fingerprintScreenText(ctx.focusedText)
  }
  return fingerprintScreenText(rawText)
}

/** Work mode: same LeetCode page / video title = same fingerprint (ignore OCR noise). */
export function fingerprintWorkCoachScreen(rawText: string, metadata?: ScreenMetadata): string {
  return workSessionKey(rawText, metadata)
}

/** Work mode trigger key: session topic + editor code snapshot (typing = new step). */
export function fingerprintWorkCoachProgress(
  rawText: string,
  metadata?: ScreenMetadata,
  screenshotHash?: string
): string {
  const session = workSessionKey(rawText, metadata)
  const screenKind = extractScreenContext(rawText, 'work', metadata).kind
  const profile = resolveWorkProblemProfile(rawText, metadata, screenKind)

  if (!profile.snippetTracking) {
    if (screenshotHash) return `${session}:${screenshotHash}`
    return session
  }

  const code = extractEditorCodeFingerprint(rawText)
  return `${session}:${code}`
}

/** Stable session key for journal dedup — ignores volatile OCR (clock, cursor, etc.). */
export function fingerprintJournalFocus(
  appName: string,
  windowTitle: string,
  screenKind: string
): string {
  const key = `${appName}|${windowTitle}|${screenKind}`.toLowerCase().trim()
  return createHash('sha256').update(key).digest('hex').slice(0, 16)
}
