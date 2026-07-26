import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import type { ScreenMetadata } from '../shared/types'
import type { WorkCoachCodeReview } from './work-coach-session'
import type { WorkProblemKind } from './work-problem-registry'

export function isCoachDebugEnabled(): boolean {
  const v = process.env.COACH_DEBUG?.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

export function getCoachDebugDir(): string {
  const base =
    typeof app?.getPath === 'function'
      ? app.getPath('userData')
      : path.join(process.env.HOME ?? '/tmp', 'Library/Application Support/specter-ai')
  return path.join(base, 'coach-debug')
}

export interface CoachDebugEntry {
  ts: string
  query: string
  assistantMode: string
  effectiveCoachMode: boolean
  screenMetadata?: ScreenMetadata
  screenTextChars: number
  screenText: string
  workCoachCodeReview: WorkCoachCodeReview
  workCoachEscalation: number | null
  workProblemKind?: WorkProblemKind
  useVision: boolean
  systemPrompt: string
  userPrompt: string
  completion?: string
}

function preview(text: string, max = 12000): string {
  return text.length <= max ? text : `${text.slice(0, max)}\n\n… [truncated ${text.length - max} chars]`
}

function toMarkdown(entry: CoachDebugEntry): string {
  return [
    `# Coach debug ${entry.ts}`,
    '',
    `- query: \`${entry.query}\``,
    `- mode: ${entry.assistantMode} | coach: ${entry.effectiveCoachMode} | vision: ${entry.useVision}`,
    `- review: ${entry.workCoachCodeReview.status} / ${entry.workCoachCodeReview.replyMode}`,
    `- problem: ${entry.workProblemKind ?? 'unknown'}`,
    `- escalation: ${entry.workCoachEscalation ?? 'none'}`,
    `- screen: ${entry.screenTextChars} chars`,
    entry.screenMetadata?.appName ? `- app: ${entry.screenMetadata.appName}` : '',
    entry.screenMetadata?.windowTitle ? `- window: ${entry.screenMetadata.windowTitle}` : '',
    '',
    '## Screen OCR',
    '```',
    preview(entry.screenText, 8000),
    '```',
    '',
    '## System prompt',
    '```',
    preview(entry.systemPrompt, 4000),
    '```',
    '',
    '## User prompt (sent to model)',
    '```',
    preview(entry.userPrompt, 12000),
    '```',
    entry.completion
      ? ['', '## Model reply', '```', preview(entry.completion, 8000), '```'].join('\n')
      : ''
  ]
    .filter(Boolean)
    .join('\n')
}

export function writeCoachDebug(entry: CoachDebugEntry): string | null {
  if (!isCoachDebugEnabled()) return null
  const dir = getCoachDebugDir()
  fs.mkdirSync(dir, { recursive: true })
  const stamp = entry.ts.replace(/[:.]/g, '-')
  const jsonPath = path.join(dir, `${stamp}.json`)
  const mdPath = path.join(dir, 'latest.md')
  const payload = {
    ...entry,
    screenText: preview(entry.screenText, 16000),
    userPrompt: preview(entry.userPrompt, 24000),
    systemPrompt: preview(entry.systemPrompt, 8000),
    completion: entry.completion ? preview(entry.completion, 12000) : undefined
  }
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2))
  fs.writeFileSync(mdPath, toMarkdown(entry))
  console.info(`[Specter] COACH_DEBUG → ${mdPath}`)
  return jsonPath
}

export function patchCoachDebugCompletion(jsonPath: string | null, completion: string): void {
  if (!jsonPath || !isCoachDebugEnabled()) return
  try {
    const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as CoachDebugEntry
    raw.completion = completion
    fs.writeFileSync(jsonPath, JSON.stringify({ ...raw, completion: preview(completion, 12000) }, null, 2))
    fs.writeFileSync(path.join(getCoachDebugDir(), 'latest.md'), toMarkdown(raw as CoachDebugEntry))
  } catch {
    /* ignore patch errors */
  }
}
