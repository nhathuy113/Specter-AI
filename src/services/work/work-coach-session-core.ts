import type { ScreenMetadata } from '../../shared/types'
import { parseHourlyAiResponse } from '../context/thread-response'
import { extractScreenContext } from '../context/context-router'
import { extractSuggestedSnippets, hasUserWrittenLogic, snippetApproved } from './work-coach-snippet'
import { resolveWorkProblemProfile } from './work-problem-profile'
import { extractEditorCodeFingerprint, workSessionKey } from './work-coach-identity'
import type { WorkCoachSessionState, WorkCoachReplyMode, WorkCoachCodeReviewStatus, WorkCoachCodeReview } from './work-coach-session-types'

export interface WorkCoachSessionRepository {
  load(): WorkCoachSessionState | null
  save(state: WorkCoachSessionState): void
}

export function createWorkCoachSession(repository: WorkCoachSessionRepository, now: () => number = Date.now) {
  function loadWorkCoachSession(): WorkCoachSessionState | null {
    const raw = repository.load()
    if (!raw?.sessionKey || typeof raw.thread !== 'string') return null
    return raw
  }

  function saveWorkCoachSession(state: WorkCoachSessionState): void {
    repository.save(state)
  }

  function getWorkCoachThread(screenText: string, metadata?: ScreenMetadata): string {
    const key = workSessionKey(screenText, metadata)
    const saved = loadWorkCoachSession()
    if (!saved || saved.sessionKey !== key) return ''
    return saved.thread
  }

  function updateWorkCoachThread(
    screenText: string,
    metadata: ScreenMetadata | undefined,
    assistantReply: string,
    options?: { triggerReview?: WorkCoachCodeReviewStatus }
  ): WorkCoachSessionState {
    const key = workSessionKey(screenText, metadata)
    const codeFp = extractEditorCodeFingerprint(screenText)
    const loaded = loadWorkCoachSession()
    const sameSession = loaded?.sessionKey === key
    const saved = sameSession ? loaded : null
    const sameCode = sameSession && saved?.codeFingerprintAtLastCoach === codeFp
    const { sessionThread } = parseHourlyAiResponse(assistantReply)
    const snippets = extractSuggestedSnippets(assistantReply)
    const trigger = options?.triggerReview ?? 'baseline'

    const next: WorkCoachSessionState = {
      sessionKey: key,
      thread: sessionThread.slice(0, 1200),
      updatedAt: now(),
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
  function saveWorkCoachCursorReply(
    screenText: string,
    metadata: ScreenMetadata | undefined,
    reply: string
  ): void {
    const key = workSessionKey(screenText, metadata)
    const saved = loadWorkCoachSession()
    const base: WorkCoachSessionState =
      saved?.sessionKey === key
        ? saved
        : { sessionKey: key, thread: '', updatedAt: now() }
    saveWorkCoachSession({
      ...base,
      cursorCoachReply: reply.slice(0, 8000),
      updatedAt: now()
    })
  }

  /** Approve = editor matches last snippet; reject = typed but different; unchanged = no typing. */
  function evaluateWorkCoachCodeReview(
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
  function isWorkCoachStuck(screenText: string, metadata?: ScreenMetadata): boolean {
    return evaluateWorkCoachCodeReview(screenText, metadata).status === 'unchanged'
  }

  function getWorkCoachReplyMode(screenText: string, metadata?: ScreenMetadata): WorkCoachReplyMode {
    return evaluateWorkCoachCodeReview(screenText, metadata).replyMode
  }

  return { loadWorkCoachSession, saveWorkCoachSession, getWorkCoachThread, updateWorkCoachThread, saveWorkCoachCursorReply, evaluateWorkCoachCodeReview, isWorkCoachStuck, getWorkCoachReplyMode }
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
