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
import { extractScreenContext } from '../context/context-router'
import {
  extractEditorCodeText,
  isEditorStillStub,
  isUserConfusionFeedback
} from './work-coach-snippet'
import { resolveWorkProblemProfile, type WorkProblemProfile } from './work-problem-profile'

import type { WorkCoachReplyMode, WorkCoachCodeReviewStatus } from './work-coach-session-types'

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
