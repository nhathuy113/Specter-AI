import { createHash } from 'crypto'
import type { ScreenMetadata } from '../shared/types'
import { parseHourlyAiResponse } from './game-hourly-ai'
import { getSetting, setSetting } from './store'

export interface WorkCoachSessionState {
  sessionKey: string
  thread: string
  updatedAt: number
}

/** Stable key for the same video/page on pinned work display — resets when content changes. */
export function workSessionKey(screenText: string, metadata?: ScreenMetadata): string {
  const area = metadata?.appName?.startsWith('Work:')
    ? `work-area:${metadata.appName}`
    : `${metadata?.appName || ''}|${metadata?.windowTitle || ''}`

  const contentId = extractStableContentId(screenText)
  return createHash('sha256').update(`${area}|${contentId}`).digest('hex').slice(0, 16)
}

export function extractStableContentId(screenText: string): string {
  const lines = screenText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  for (const line of lines) {
    if (/youtube|youtu\.be|coursera|udemy|pdf|bài giảng|phân tích/i.test(line) && line.length > 12) {
      return line.replace(/\s+/g, ' ').slice(0, 160).toLowerCase()
    }
  }

  const substantial = lines.find((l) => l.length > 24 && !/^(brave|chrome|safari|http|www\.)/i.test(l))
  return (substantial || lines.slice(0, 3).join(' ')).slice(0, 160).toLowerCase()
}

export function loadWorkCoachSession(): WorkCoachSessionState | null {
  const raw = getSetting<WorkCoachSessionState | null>('workCoachSession')
  if (!raw?.sessionKey || typeof raw.thread !== 'string') return null
  return raw
}

export function saveWorkCoachSession(state: WorkCoachSessionState): void {
  setSetting('workCoachSession', state)
}

export function getWorkCoachThread(screenText: string, metadata?: ScreenMetadata): string {
  const key = workSessionKey(screenText, metadata)
  const saved = loadWorkCoachSession()
  if (!saved || saved.sessionKey !== key) return ''
  return saved.thread
}

export function updateWorkCoachThread(
  screenText: string,
  metadata: ScreenMetadata | undefined,
  assistantReply: string
): WorkCoachSessionState {
  const key = workSessionKey(screenText, metadata)
  const { sessionThread } = parseHourlyAiResponse(assistantReply)
  const next: WorkCoachSessionState = {
    sessionKey: key,
    thread: sessionThread.slice(0, 1200),
    updatedAt: Date.now()
  }
  saveWorkCoachSession(next)
  return next
}

export function appendWorkCoachContext(userMessage: string, thread: string): string {
  if (!thread.trim()) {
    return [
      userMessage,
      '',
      'End with ---THREAD--- and 2-3 sentences: topic + key facts covered on this screen so far.'
    ].join('\n')
  }
  return [
    '[SESSION ON THIS SCREEN SO FAR — continue the narrative, do not repeat earlier points]',
    thread.trim(),
    '',
    userMessage,
    '',
    'Describe ONLY what is new on screen now. Update ---THREAD--- at the end.'
  ].join('\n')
}

/** Strip thread marker from text shown in overlay chat. */
export function stripThreadForDisplay(reply: string): string {
  const idx = reply.indexOf('---THREAD---')
  if (idx < 0) return reply.trim()
  return reply.slice(0, idx).trim()
}
