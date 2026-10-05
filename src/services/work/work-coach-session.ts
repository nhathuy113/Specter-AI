import { createHash } from 'crypto'
import type { ScreenMetadata } from '../../shared/types'
import {
  WORK_COACH_CODE_REVIEW_VI,
  WORK_COACH_CONTINUATION_FORMAT_VI,
  WORK_COACH_NOT_UNDERSTOOD_VI,
  WORK_COACH_OVERLAY_FEEDBACK_VI,
  WORK_COACH_REPLY_FORMAT_VI,
  WORK_COACH_SNIPPET_REJECTED_VI,
  WORK_COACH_STUCK_REEXPLAIN_VI
} from '../../shared/constants'
import { parseHourlyAiResponse } from '../game/game-hourly-ai'
import { getSetting, setSetting } from '../settings/store'
import { extractScreenContext } from '../context/context-router'
import {
  extractEditorCodeText,
  extractSuggestedSnippets,
  hasUserWrittenLogic,
  isEditorStillStub,
  isUserConfusionFeedback,
  snippetApproved
} from './work-coach-snippet'
import { resolveWorkProblemProfile, type WorkProblemProfile } from './work-problem-profile'

export interface WorkCoachSessionState {
  sessionKey: string
  thread: string
  updatedAt: number
  codeFingerprintAtLastCoach?: string
  stuckRetryCount?: number
  /** Cached Cursor SDK reply (coding sessions only). */
  cursorCoachReply?: string
  /** Last fenced code block from coach — approve/reject detection. */
  lastSuggestedSnippet?: string
  /** One-line summary of the step being taught — do not skip on re-explain. */
  lastCoachStepSummary?: string
  lastReviewOutcome?: 'unchanged' | 'approved' | 'rejected'
}

const CODE_LINE =
  /^\s*(def |class |import |from |return |if |elif |else:|for |while |public |private |void |int |#include|function |const |let |var |nums|self\.|\}|\{|\)|\(.*=>)/i
const SKIP_LINE =
  /^(file|edit|selection|view|run|terminal|submit|acceptance|submissions|description|solution|console|output)$/i
const UI_NOISE = /leetcode|easy|medium|hard|acceptance rate|memory|runtime|beats \d/i

/** Hash editor-like OCR lines so unchanged code = user has not applied the last hint. */
export function extractEditorCodeFingerprint(screenText: string): string {
  const lines = screenText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !SKIP_LINE.test(l) && !UI_NOISE.test(l))

  const codeLines = lines.filter(
    (l) =>
      CODE_LINE.test(l) ||
      (/[=<>+\-*\/\[\]{}();]/.test(l) && l.length > 5 && /[a-zA-Z_]/.test(l))
  )

  const normalized = codeLines
    .slice(-48)
    .map((l) => l.replace(/\s+/g, ' '))
    .join('\n')
    .toLowerCase()

  if (!normalized) return 'no-code'
  return createHash('sha256').update(normalized).digest('hex').slice(0, 12)
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

  const quizProgress = screenText.match(/\bquestion\s+(\d+)\s+of\s+(\d+)\b/i)
  if (quizProgress) {
    return `quiz-${quizProgress[1]}-of-${quizProgress[2]}`
  }

  for (const line of lines) {
    const numbered = line.match(/^\d+\.\s*(.+)/)
    if (numbered && numbered[1].length > 8) {
      return numbered[1].replace(/\s+/g, ' ').slice(0, 160).toLowerCase()
    }
  }

  for (const line of lines) {
    if (/youtube|youtu\.be|coursera|udemy|pdf|bài giảng|phân tích|leetcode/i.test(line) && line.length > 12) {
      return line.replace(/\s+/g, ' ').slice(0, 160).toLowerCase()
    }
  }

  const problemTitle = lines.find(
    (l) =>
      l.length > 16 &&
      l.length < 120 &&
      !/^(brave|chrome|safari|firefox|http|www\.|easy|medium|hard|acceptance|submissions|solution|description)$/i.test(l) &&
      !/^\d+$/.test(l)
  )
  if (problemTitle) {
    return problemTitle.replace(/\s+/g, ' ').slice(0, 160).toLowerCase()
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
  assistantReply: string,
  options?: { triggerReview?: WorkCoachCodeReviewStatus }
): WorkCoachSessionState {
  const key = workSessionKey(screenText, metadata)
  const codeFp = extractEditorCodeFingerprint(screenText)
  const saved = loadWorkCoachSession()
  const sameSession = saved?.sessionKey === key
  const sameCode = sameSession && saved?.codeFingerprintAtLastCoach === codeFp
  const { sessionThread } = parseHourlyAiResponse(assistantReply)
  const snippets = extractSuggestedSnippets(assistantReply)
  const trigger = options?.triggerReview ?? 'baseline'

  const next: WorkCoachSessionState = {
    sessionKey: key,
    thread: sessionThread.slice(0, 1200),
    updatedAt: Date.now(),
    codeFingerprintAtLastCoach: codeFp,
    stuckRetryCount: trigger === 'unchanged' ? (saved?.stuckRetryCount ?? 0) + 1 : 0,
    cursorCoachReply: trigger === 'unchanged' ? saved?.cursorCoachReply : undefined,
    lastSuggestedSnippet: (snippets[0] ?? saved?.lastSuggestedSnippet)?.slice(0, 2000),
    lastCoachStepSummary: extractCoachStepSummary(assistantReply) || saved?.lastCoachStepSummary,
    lastReviewOutcome:
      trigger === 'approved'
        ? 'approved'
        : trigger === 'rejected' || trigger === 'rejected-unchanged'
          ? 'rejected'
          : trigger === 'unchanged'
            ? 'unchanged'
            : sameCode
              ? saved?.lastReviewOutcome
              : undefined
  }
  saveWorkCoachSession(next)
  return next
}

/** Persist Cursor reply — coding sessions only. */
export function saveWorkCoachCursorReply(
  screenText: string,
  metadata: ScreenMetadata | undefined,
  reply: string
): void {
  const key = workSessionKey(screenText, metadata)
  const saved = loadWorkCoachSession()
  const base: WorkCoachSessionState =
    saved?.sessionKey === key
      ? saved
      : { sessionKey: key, thread: '', updatedAt: Date.now() }
  saveWorkCoachSession({
    ...base,
    cursorCoachReply: reply.slice(0, 8000),
    updatedAt: Date.now()
  })
}

export type WorkCoachReplyMode = 'normal' | 'stuck-reexplain' | 'snippet-rejected' | 'code-review'

export type WorkCoachCodeReviewStatus =
  | 'baseline'
  | 'unchanged'
  | 'approved'
  | 'rejected'
  | 'rejected-unchanged'

export interface WorkCoachCodeReview {
  status: WorkCoachCodeReviewStatus
  replyMode: WorkCoachReplyMode
}

/** Approve = editor matches last snippet; reject = typed but different; unchanged = no typing. */
export function evaluateWorkCoachCodeReview(
  screenText: string,
  metadata?: ScreenMetadata
): WorkCoachCodeReview {
  const screenKind = extractScreenContext(screenText, 'work', metadata).kind
  const profile = resolveWorkProblemProfile(screenText, metadata, screenKind)
  if (!profile.snippetTracking) {
    return { status: 'baseline', replyMode: 'normal' }
  }

  const saved = loadWorkCoachSession()
  const key = workSessionKey(screenText, metadata)
  const userHasLogic = hasUserWrittenLogic(screenText)

  if (!saved?.codeFingerprintAtLastCoach || saved.sessionKey !== key) {
    if (userHasLogic) {
      return { status: 'baseline', replyMode: 'code-review' }
    }
    return { status: 'baseline', replyMode: 'normal' }
  }

  const currentFp = extractEditorCodeFingerprint(screenText)

  if (currentFp === saved.codeFingerprintAtLastCoach) {
    if (saved.lastReviewOutcome === 'rejected') {
      return { status: 'rejected-unchanged', replyMode: 'snippet-rejected' }
    }
    return { status: 'unchanged', replyMode: 'stuck-reexplain' }
  }

  if (userHasLogic) {
    if (saved.lastSuggestedSnippet && snippetApproved(saved.lastSuggestedSnippet, screenText)) {
      return { status: 'approved', replyMode: 'code-review' }
    }
    return { status: 'rejected', replyMode: 'code-review' }
  }

  if (saved.lastSuggestedSnippet && snippetApproved(saved.lastSuggestedSnippet, screenText)) {
    return { status: 'approved', replyMode: 'normal' }
  }

  if (saved.lastSuggestedSnippet) {
    return { status: 'rejected', replyMode: 'snippet-rejected' }
  }

  return { status: 'baseline', replyMode: 'normal' }
}

/** @deprecated Use evaluateWorkCoachCodeReview */
export function isWorkCoachStuck(screenText: string, metadata?: ScreenMetadata): boolean {
  return evaluateWorkCoachCodeReview(screenText, metadata).status === 'unchanged'
}

export function getWorkCoachReplyMode(screenText: string, metadata?: ScreenMetadata): WorkCoachReplyMode {
  return evaluateWorkCoachCodeReview(screenText, metadata).replyMode
}

export function buildWorkCoachEditorContext(screenText: string): string {
  const editor = extractEditorCodeText(screenText).slice(0, 2500)
  if (!editor.trim()) return ''
  return [
    '[EDITOR CODE ON SCREEN — bắt buộc đọc trước khi trả lời]',
    '```',
    editor,
    '```'
  ].join('\n')
}

export function buildWorkCoachCodeReviewContext(): string {
  return WORK_COACH_CODE_REVIEW_VI
}

export function buildWorkCoachSnippetRejectedContext(
  suggestedSnippet: string,
  screenText: string
): string {
  const editor = extractEditorCodeText(screenText).slice(0, 1200)
  return [
    WORK_COACH_SNIPPET_REJECTED_VI,
    '',
    'Snippet coach đã gợi ý (user chưa làm đúng):',
    '```',
    suggestedSnippet.trim(),
    '```',
    '',
    'Code user đang có trên màn hình (OCR):',
    '```',
    editor || '(không đọc được code editor)',
    '```'
  ].join('\n')
}

export function extractCoachStepSummary(assistantReply: string): string {
  const snippets = extractSuggestedSnippets(assistantReply)
  if (snippets[0]) {
    const line =
      snippets[0]
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l && !l.startsWith('#') && !l.startsWith('//')) ?? snippets[0].split('\n')[0]
    return (line ?? '').slice(0, 140)
  }
  const explain = assistantReply.match(/\*\*Giải thích:\*\*\s*([^\n*]+)/)
  return explain?.[1]?.trim().slice(0, 140) ?? ''
}

export function selectWorkCoachReplyFormat(options: {
  hasThread: boolean
  replyMode: WorkCoachReplyMode
  reviewStatus: WorkCoachCodeReviewStatus
  profile?: WorkProblemProfile
  screenText?: string
  metadata?: ScreenMetadata
}): string {
  const profile =
    options.profile ??
    (options.screenText
      ? resolveWorkProblemProfile(
          options.screenText,
          options.metadata,
          extractScreenContext(options.screenText, 'work', options.metadata).kind
        )
      : undefined)

  const firstOnProblem =
    !options.hasThread &&
    options.reviewStatus === 'baseline' &&
    options.replyMode === 'normal'

  if (profile) {
    return firstOnProblem ? profile.formatFirst : profile.formatContinue
  }

  return firstOnProblem ? WORK_COACH_REPLY_FORMAT_VI : WORK_COACH_CONTINUATION_FORMAT_VI
}

export function buildWorkCoachOverlayFeedbackContext(query: string): string {
  return [WORK_COACH_OVERLAY_FEEDBACK_VI, '', `Tin nhắn overlay: "${query.trim()}"`].join('\n')
}

export function buildWorkCoachStuckContext(
  retryCount: number,
  stepSummary?: string,
  editorStub?: boolean,
  overlayFeedback?: boolean
): string {
  const parts = [WORK_COACH_STUCK_REEXPLAIN_VI]
  if (editorStub || overlayFeedback) parts.push('', WORK_COACH_NOT_UNDERSTOOD_VI)
  if (stepSummary?.trim()) {
    parts.push('', `Bước đang dạy (KHÔNG đổi sang bước khác): ${stepSummary.trim()}`)
  }
  parts.push('', `Lần giảng lại thứ ${Math.max(1, retryCount)}.`)
  return parts.join('\n')
}

export function appendWorkCoachContext(
  userMessage: string,
  thread: string,
  options?: {
    replyMode?: WorkCoachReplyMode
    codeReviewStatus?: WorkCoachCodeReviewStatus
    stuckRetryCount?: number
    suggestedSnippet?: string
    stepSummary?: string
    screenText?: string
    userOverlayQuery?: string
    metadata?: ScreenMetadata
    profile?: WorkProblemProfile
  }
): string {
  const replyMode = options?.replyMode ?? 'normal'
  const reviewStatus = options?.codeReviewStatus ?? 'baseline'
  const profile =
    options?.profile ??
    (options?.screenText
      ? resolveWorkProblemProfile(
          options.screenText,
          options.metadata,
          extractScreenContext(options.screenText, 'work', options.metadata).kind
        )
      : undefined)
  const overlayFeedback = options?.userOverlayQuery
    ? isUserConfusionFeedback(options.userOverlayQuery)
    : false
  const editorStub = options?.screenText ? isEditorStillStub(options.screenText) : false
  const snippetTracking = profile?.snippetTracking ?? true
  const allowCodeReview = profile?.allowCodeReview ?? true
  const editorContext =
    snippetTracking && options?.screenText ? buildWorkCoachEditorContext(options.screenText) : ''
  const editorBlock = editorContext ? ['', editorContext, ''] : []
  const formatBlock = selectWorkCoachReplyFormat({
    hasThread: !!thread.trim() || overlayFeedback || replyMode !== 'normal',
    replyMode: overlayFeedback ? 'stuck-reexplain' : replyMode,
    reviewStatus: overlayFeedback ? 'unchanged' : reviewStatus,
    profile,
    screenText: options?.screenText,
    metadata: options?.metadata
  })

  const overlayBlock =
    overlayFeedback && options?.userOverlayQuery
      ? ['', buildWorkCoachOverlayFeedbackContext(options.userOverlayQuery), '']
      : []

  const stuckBlock =
    snippetTracking && (replyMode === 'stuck-reexplain' || overlayFeedback)
      ? [
          '',
          buildWorkCoachStuckContext(
            options?.stuckRetryCount ?? 1,
            options?.stepSummary,
            editorStub,
            overlayFeedback
          ),
          ''
        ]
      : []
  const rejectedBlock =
    snippetTracking &&
    replyMode === 'snippet-rejected' &&
    options?.suggestedSnippet
      ? ['', buildWorkCoachSnippetRejectedContext(options.suggestedSnippet, options.screenText ?? ''), '']
      : []
  const codeReviewBlock =
    allowCodeReview && replyMode === 'code-review'
      ? ['', buildWorkCoachCodeReviewContext(), '']
      : []

  const formatSection = ['', '[REPLY FORMAT]', formatBlock, '']
  const threadFooter = [
    '',
    'End with ---THREAD--- and 2-3 Vietnamese sentences: topic + key facts on this screen so far.'
  ]

  if (!thread.trim()) {
    return [
      userMessage,
      ...editorBlock,
      ...overlayBlock,
      ...formatSection,
      ...stuckBlock,
      ...rejectedBlock,
      ...codeReviewBlock,
      ...threadFooter
    ].join('\n')
  }
  return [
    '[SESSION ON THIS SCREEN SO FAR — continue the narrative, do not repeat earlier points]',
    thread.trim(),
    ...editorBlock,
    ...overlayBlock,
    ...formatSection,
    ...stuckBlock,
    ...rejectedBlock,
    ...codeReviewBlock,
    '',
    userMessage,
    '',
    replyMode === 'code-review'
      ? 'User HAS real code on editor — 4-section continuation. Review THEIR code, patch next lines only. Do NOT suggest sorted-merge rewrite. Update ---THREAD---.'
      : replyMode === 'snippet-rejected'
      ? 'User typed DIFFERENT code — use 4-section continuation format. Snippet thay thế (1–2 cách). Do NOT advance step. Update ---THREAD---.'
      : replyMode === 'stuck-reexplain'
        ? 'User CHƯA HIỂU / chưa gõ snippet — 4-section continuation only. Re-teach SAME step + snippet thay thế. Do NOT advance. Update ---THREAD---.'
        : reviewStatus === 'approved'
          ? 'User APPROVED snippet. 4-section short format: confirm approve in **Kẹt ở đâu**, then NEXT single step in **Snippet thay thế**. Update ---THREAD---.'
          : 'Continue with 4-section short format if same session. Update ---THREAD---.'
  ].join('\n')
}

export { sanitizeCoachDisplayText, stripThreadForDisplay } from '../../shared/coach-display'
