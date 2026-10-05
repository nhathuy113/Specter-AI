import type { AssistantMode } from '../../shared/types'
import type { ScreenMetadata } from '../../shared/types'
import { detectGameLog, GAME_LOG_SIGNAL } from './skills/game-log'
import { detectCodeErrors } from './skills/code-error'
import { extractEditorCodeText } from '../work/work-coach-snippet'
import { resolveWorkProblemProfile, type WorkProblemProfile } from '../work/work-problem-profile'

export type ScreenKind = 'empty' | 'ide' | 'code' | 'game-log' | 'browser' | 'general'

export interface ScreenContext {
  kind: ScreenKind
  focusedText: string
  instantReply?: string
  actionable: boolean
}

const IDE_SIGNAL =
  /\b(cursor|vscode|visual studio|webpack|typescript|javascript|node_modules|pnpm|npm|github|\.env|gemini api|openrouter|electron|specter ai|google ai studio|settings\.json|package\.json|file edit selection view|terminal|debug console)\b/i
const CODE_SIGNAL =
  /\b(error TS\d+|eslint|syntaxerror|typeerror|referenceerror|stack trace|at .+\(.+:\d+:\d+\)|failed to compile|cannot find module|unexpected token)\b/i
const BROWSER_SIGNAL = /\b(https?:\/\/|www\.|chrome|firefox|safari|google search)\b/i
const MENU_NOISE = /^(file|edit|selection|view|go|run|terminal|window|help|specter ai)$/i
const SPECTER_SETTINGS_SIGNAL = /\b(gemini api key|openrouter api|coach system prompt|continuous coach|smart crop|perception)\b/i

function cleanOcrLines(rawText: string): string[] {
  return rawText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      if (line.length < 2) return false
      if (MENU_NOISE.test(line)) return false
      const letters = (line.match(/[a-zA-Z]/g) || []).length
      if (letters / line.length < 0.25 && line.length < 24) return false
      return true
    })
}

function formatMetadataHeader(metadata?: ScreenMetadata): string {
  if (metadata?.windowTitle === 'watch-frame') return ''
  if (!metadata?.appName && !metadata?.windowTitle) return ''
  const parts = [
    metadata.appName ? `[ACTIVE APP] ${metadata.appName}` : '',
    metadata.windowTitle ? `[WINDOW] ${metadata.windowTitle}` : ''
  ].filter(Boolean)
  return parts.join('\n')
}

function isIdeOnly(body: string, lower: string, hasGameLog: boolean): boolean {
  return IDE_SIGNAL.test(lower) && !hasGameLog && !CODE_SIGNAL.test(body)
}

function isSpecterSettingsOnly(lower: string): boolean {
  return SPECTER_SETTINGS_SIGNAL.test(lower) && IDE_SIGNAL.test(lower)
}

const GAME_IDE_REPLY =
  'This screen shows your IDE or dev tools. Switch assistant mode to General or Work for coding help, or focus your game window first.'

const GAME_SETTINGS_REPLY =
  'This screen shows Specter or API settings. Switch to General or Work mode for setup help, or focus your game window first.'

export function extractScreenContext(
  rawText: string,
  mode: AssistantMode = 'general',
  metadata?: ScreenMetadata
): ScreenContext {
  const trimmed = rawText.trim()
  if (!trimmed) {
    return {
      kind: 'empty',
      focusedText: '',
      actionable: false,
      instantReply:
        "I can't read anything on screen. Check Screen Recording permission and make sure your target app is visible on the monitor."
    }
  }

  const lines = cleanOcrLines(trimmed)
  const body = lines.join('\n')
  const lower = body.toLowerCase()

  const gameLog = detectGameLog(lines)
  const hasGameLog = !!gameLog
  const codeErrors = detectCodeErrors(body)

  if (gameLog) {
    return {
      kind: 'game-log',
      focusedText: prependMetadata(gameLog.focusedText, metadata),
      actionable: true
    }
  }

  if (codeErrors || CODE_SIGNAL.test(body) || (IDE_SIGNAL.test(lower) && /\b(error|exception|failed|warning)\b/i.test(body))) {
    const errorPart =
      codeErrors?.focusedText ||
      lines.filter((line) => CODE_SIGNAL.test(line) || /^\s*at /.test(line) || /error/i.test(line)).join('\n') ||
      body
    const editorCode = extractEditorCodeText(body)
    let focused =
      mode === 'work' && editorCode.trim()
        ? [errorPart.trim().slice(0, 800), '', '[EDITOR CODE — xem block riêng phía trên trong coach context]'].join('\n')
        : errorPart.slice(0, 4000)
    return {
      kind: 'code',
      focusedText: prependMetadata(focused, metadata),
      actionable: true
    }
  }

  if (isSpecterSettingsOnly(lower)) {
    return {
      kind: 'ide',
      focusedText: prependMetadata(body.slice(0, 2000), metadata),
      actionable: mode !== 'game',
      instantReply: mode === 'game' ? GAME_SETTINGS_REPLY : undefined
    }
  }

  if (isIdeOnly(body, lower, hasGameLog)) {
    const actionable = mode !== 'game'
    return {
      kind: 'ide',
      focusedText: prependMetadata(body.slice(0, 4000), metadata),
      actionable,
      instantReply: actionable ? undefined : GAME_IDE_REPLY
    }
  }

  if (BROWSER_SIGNAL.test(lower)) {
    return {
      kind: 'browser',
      focusedText: prependMetadata(body.slice(0, 4000), metadata),
      actionable: true
    }
  }

  if (GAME_LOG_SIGNAL.test(body)) {
    return {
      kind: 'game-log',
      focusedText: prependMetadata(
        lines.filter((l) => GAME_LOG_SIGNAL.test(l)).join('\n').slice(0, 2500),
        metadata
      ),
      actionable: true
    }
  }

  return {
    kind: 'general',
    focusedText: prependMetadata(body.slice(0, 4000), metadata),
    actionable: true
  }
}

function prependMetadata(text: string, metadata?: ScreenMetadata): string {
  const header = formatMetadataHeader(metadata)
  if (!header) return text
  return `${header}\n\n${text}`
}

export interface AssistantRequest {
  kind: ScreenKind
  userMessage: string
  instantReply?: string
  actionable: boolean
  workProblem?: WorkProblemProfile
}

function taskForMode(mode: AssistantMode, kind: ScreenKind, profile?: WorkProblemProfile): string[] {
  const base = [
    'Recommend what the user should consider doing next based only on what you see.',
    'Use 1-3 short bullets when helpful. Never claim you clicked or typed anything.'
  ]

  if (mode === 'work' && profile?.taskHints.length) {
    return profile.taskHints
  }

  if (mode === 'work' || (mode === 'general' && kind === 'code')) {
    const workFormat = [
      'Reply format block is appended separately (full 6 sections first time, short 4 sections on continuation).',
      'LeetCode first visit: teach ONE step — median example before partition. If editor already has while/if/return logic, review bugs in place — do NOT restart with brute force merge.'
    ]
    if (mode === 'work' && kind === 'browser') {
      return [
        'User is studying in a browser (video, article, slides, LeetCode, lecture).',
        'For LeetCode/coding problems: Giải pháp = exact algorithm steps + edge cases + what to code next — not vague "use binary search".',
        ...workFormat
      ]
    }
    return [
      'Focus on work visible on screen: homework, LeetCode, exercises, quizzes, coding, debugging.',
      ...workFormat
    ]
  }

  if (mode === 'game') {
    if (kind === 'game-log') {
      return [
        'Give 2-3 tactical bullets: battle read using visible numbers → concrete in-game action → optional risk.',
        'Quote specific stats from the log. Never mention API keys or IDE setup.'
      ]
    }
    return [
      'Focus on in-game next steps from what is visible.',
      ...base
    ]
  }

  if (kind === 'code') {
    return [
      'If an error is visible, suggest the most likely fix and one next debug step.',
      ...base
    ]
  }

  return [
    'Nhìn screenshot. Giúp tôi với những gì đang hiện trên màn hình, rồi giải thích vì sao.',
    'Trả lời tiếng Việt, ngắn, markdown:',
    '**Giúp:** việc nên làm, hoặc đáp án nếu màn hình đang hỏi một câu.',
    '**Vì sao:** 1-2 câu, dựa trên chữ hoặc hình đang thấy.',
    'Không nói bạn đã click hay gõ.'
  ]
}

function buildWorkCoachUserMessage(
  ctx: ScreenContext,
  metadata?: ScreenMetadata,
  profile?: WorkProblemProfile
): string {
  const header = formatMetadataHeader(metadata)
  const ocrLimit = 3000
  const ocrBlock =
    profile?.snippetTracking && ctx.focusedText.trim()
      ? ['', '[OCR — supplementary only]', ctx.focusedText.slice(0, ocrLimit)]
      : []

  return [
    header,
    profile ? `[PROBLEM] ${profile.kind}` : '',
    '',
    '[TASK]',
    'Screenshot attached — cropped active work window. Read the image and answer.',
    'Reply in Vietnamese with a concrete answer or next step visible on screen.',
    ...(profile?.taskHints.slice(0, 2) ?? []),
    ...ocrBlock
  ]
    .filter(Boolean)
    .join('\n')
}

export function resolveAssistantRequest(
  screenText: string,
  mode: AssistantMode = 'general',
  metadata?: ScreenMetadata
): AssistantRequest {
  const ctx = extractScreenContext(screenText, mode, metadata)
  const workProblem =
    mode === 'work' && ctx.kind !== 'empty'
      ? resolveWorkProblemProfile(screenText, metadata, ctx.kind)
      : undefined

  if (ctx.instantReply) {
    return {
      kind: ctx.kind,
      userMessage: '',
      instantReply: ctx.instantReply,
      actionable: ctx.actionable,
      workProblem
    }
  }

  if (ctx.kind === 'empty') {
    return {
      kind: ctx.kind,
      userMessage: '',
      instantReply: ctx.instantReply,
      actionable: false,
      workProblem
    }
  }

  if (mode === 'work' && workProblem) {
    return {
      kind: ctx.kind,
      actionable: ctx.actionable,
      workProblem,
      userMessage: buildWorkCoachUserMessage(ctx, metadata, workProblem)
    }
  }

  const typeLabels: Record<ScreenKind, string> = {
    'game-log': 'Game combat log (structured OCR)',
    code: 'Code / IDE / error output',
    ide: 'IDE / developer tools',
    browser: 'Browser / web page',
    general: 'General screen content',
    empty: 'Empty screen'
  }

  const contentLabel = ctx.kind === 'game-log' ? '[ENTRIES — newest first]' : '[CONTENT]'

  return {
    kind: ctx.kind,
    actionable: ctx.actionable,
    workProblem,
    userMessage: [
      `[SCREEN TYPE] ${typeLabels[ctx.kind]}`,
      workProblem ? `[PROBLEM TYPE] ${workProblem.kind} (confidence ${workProblem.confidence.toFixed(2)})` : '',
      contentLabel,
      ctx.focusedText,
      '',
      '[TASK]',
      ...taskForMode(mode, ctx.kind, workProblem)
    ]
      .filter(Boolean)
      .join('\n')
  }
}

/** @deprecated Use extractScreenContext */
export function extractCoachContext(rawText: string): ScreenContext {
  return extractScreenContext(rawText, 'game')
}
