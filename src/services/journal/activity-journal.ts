import type { ScreenKind } from '../context/context-router'
import type { ActivityJournalEntry } from '../../shared/types'
import { getSetting, setSetting } from '../settings/store'

export type { ActivityJournalEntry } from '../../shared/types'

export const MAX_JOURNAL_ENTRIES = 10_080 // ~7 days at 1/min

export function minuteKeyFromDate(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d}T${h}:${min}`
}

export function getJournalEntries(): ActivityJournalEntry[] {
  return getSetting<ActivityJournalEntry[]>('activityJournalLog') || []
}

export function saveJournalEntries(entries: ActivityJournalEntry[]): void {
  setSetting('activityJournalLog', entries.slice(-MAX_JOURNAL_ENTRIES))
}

export interface JournalSnapshotInput {
  appName: string
  windowTitle: string
  screenKind: ScreenKind
  snippet: string
  fingerprint: string
  timestamp?: number
  durationSec?: number
  ocrChars?: number
  textSource?: ActivityJournalEntry['textSource']
  capturePlan?: 'window-crop' | 'display-full'
}

/** Merge consecutive same focus session (incl. idle/away), or append new row. */
export function appendJournalSnapshot(input: JournalSnapshotInput): ActivityJournalEntry {
  const timestamp = input.timestamp ?? Date.now()
  const minuteKey = minuteKeyFromDate(new Date(timestamp))
  const entries = getJournalEntries()
  const last = entries[entries.length - 1]
  const bumpSec = input.durationSec ?? 60

  if (last && last.fingerprint === input.fingerprint) {
    last.durationSec += bumpSec
    last.timestamp = timestamp
    if (input.snippet && input.snippet.length > last.snippet.length) {
      last.snippet = input.snippet.slice(0, 400)
    }
    if (input.ocrChars !== undefined) last.ocrChars = input.ocrChars
    if (input.textSource) last.textSource = input.textSource
    if (input.capturePlan) last.capturePlan = input.capturePlan
    saveJournalEntries(entries)
    return last
  }

  const entry: ActivityJournalEntry = {
    id: `aj-${timestamp}`,
    minuteKey,
    timestamp,
    appName: input.appName,
    windowTitle: input.windowTitle,
    screenKind: input.screenKind,
    snippet: input.snippet.slice(0, 400),
    fingerprint: input.fingerprint,
    durationSec: input.durationSec ?? 60,
    ocrChars: input.ocrChars,
    textSource: input.textSource,
    capturePlan: input.capturePlan
  }

  saveJournalEntries([...entries, entry])
  return entry
}

export function getRecentJournalContext(maxMinutes = 30): string {
  const entries = getJournalEntries()
  if (entries.length === 0) return ''

  const cutoff = Date.now() - maxMinutes * 60_000
  const recent = entries.filter((e) => e.timestamp >= cutoff)
  if (recent.length === 0) return ''

  const lines = recent.slice(-maxMinutes).map((e) => {
    const mins = Math.max(1, Math.round(e.durationSec / 60))
    const title = e.windowTitle ? `${e.appName} — ${e.windowTitle}` : e.appName
    const detail = e.snippet ? ` | ${e.snippet.slice(0, 120)}` : ''
    return `- ${e.minuteKey} (${mins}m, ${e.screenKind}): ${title}${detail}`
  })

  return ['[ACTIVITY JOURNAL — recent focus]', ...lines].join('\n')
}

export function exportJournalMarkdown(entries = getJournalEntries()): string {
  const byDay = new Map<string, ActivityJournalEntry[]>()
  for (const entry of entries) {
    const day = entry.minuteKey.slice(0, 10)
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day)!.push(entry)
  }

  const lines = ['# Specter Activity Journal', '', `Exported: ${new Date().toISOString()}`, '']

  for (const [day, dayEntries] of [...byDay.entries()].sort()) {
    lines.push(`## ${day}`, '')
    for (const e of dayEntries) {
      const mins = Math.max(1, Math.round(e.durationSec / 60))
      lines.push(
        `### ${e.minuteKey.slice(11)} — ${e.appName}`,
        `- Window: ${e.windowTitle || '(unknown)'}`,
        `- Kind: ${e.screenKind} · ${mins} min`,
        e.snippet ? `- Snippet: ${e.snippet.slice(0, 200)}` : '',
        ''
      )
    }
  }

  return lines.filter(Boolean).join('\n')
}

export function clearJournal(): void {
  saveJournalEntries([])
}
