import type { AssistantMode } from '../../shared/types'
import { extractScreenContext } from '../context/context-router'
import { fingerprintCoachScreenText, fingerprintWorkCoachProgress } from '../capture/fingerprint'
import { evaluateWorkCoachCodeReview } from '../work/work-coach-session'
import { resolveWorkProblemProfile } from '../work/work-problem-profile'

export type CoachSkipReason =
  | 'empty-text'
  | 'duplicate-fingerprint'
  | 'cooldown'
  | 'streaming'
  | 'non-actionable-screen'

export type CoachEvaluateResult =
  | { action: 'skip'; reason: CoachSkipReason; fingerprint: string }
  | {
      action: 'trigger'
      fingerprint: string
      screenText: string
      screenChanged: boolean
      workReplyMode?: 'normal' | 'stuck-reexplain' | 'snippet-rejected' | 'code-review'
    }

export interface CoachEvaluateInput {
  ocrText: string
  nowMs: number
  cooldownSec: number
  isStreaming: boolean
  assistantMode?: AssistantMode
  displayCount?: number
  appName?: string
  windowTitle?: string
}

export class CoachTriggerEvaluator {
  private lastFingerprint = ''
  private lastCoachAtMs = 0
  private readingPauseUntilMs = 0

  evaluate(input: CoachEvaluateInput): CoachEvaluateResult {
    const mode = input.assistantMode ?? 'general'
    const meta = { appName: input.appName, windowTitle: input.windowTitle }
    const ctx = extractScreenContext(input.ocrText, mode, {
      displayCount: input.displayCount,
      ...meta
    })

    if (ctx.kind === 'empty' || !ctx.actionable) {
      return { action: 'skip', reason: 'non-actionable-screen', fingerprint: '' }
    }

    const profile =
      mode === 'work' ? resolveWorkProblemProfile(input.ocrText, meta, ctx.kind) : undefined
    const visualProgress = !!(profile && !profile.snippetTracking)

    const fingerprint =
      mode === 'work'
        ? fingerprintWorkCoachProgress(input.ocrText, meta)
        : fingerprintCoachScreenText(input.ocrText)

    if (!fingerprint) {
      return { action: 'skip', reason: 'empty-text', fingerprint }
    }

    const screenChanged =
      this.lastFingerprint !== '' && fingerprint !== this.lastFingerprint

    if (input.isStreaming) {
      return { action: 'skip', reason: 'streaming', fingerprint }
    }

    if (this.readingPauseUntilMs > 0 && input.nowMs < this.readingPauseUntilMs) {
      return { action: 'skip', reason: 'cooldown', fingerprint }
    }

    if (fingerprint === this.lastFingerprint && this.lastFingerprint !== '') {
      if (mode === 'work' && visualProgress) {
        return { action: 'skip', reason: 'duplicate-fingerprint', fingerprint }
      }
      if (mode !== 'work') {
        return { action: 'skip', reason: 'duplicate-fingerprint', fingerprint }
      }
    }

    const cooldownMs = Math.max(0, input.cooldownSec) * 1000
    const withinCooldown =
      this.lastCoachAtMs > 0 && input.nowMs - this.lastCoachAtMs < cooldownMs

    if (withinCooldown) {
      return { action: 'skip', reason: 'cooldown', fingerprint }
    }

    if (mode === 'work' && profile) {
      const review = evaluateWorkCoachCodeReview(input.ocrText, meta)

      let workReplyMode = review.replyMode
      if (
        profile.snippetTracking &&
        review.status === 'baseline' &&
        fingerprint === this.lastFingerprint &&
        this.lastFingerprint !== ''
      ) {
        workReplyMode = 'stuck-reexplain'
      }
      return {
        action: 'trigger',
        fingerprint,
        screenText: input.ocrText.trim(),
        screenChanged,
        workReplyMode
      }
    }

    return {
      action: 'trigger',
      fingerprint,
      screenText: input.ocrText.trim(),
      screenChanged
    }
  }

  recordCoachTriggered(nowMs: number, fingerprint: string): void {
    this.lastFingerprint = fingerprint
    this.lastCoachAtMs = nowMs
  }

  recordReadingPause(nowMs: number, pauseSec: number): void {
    this.readingPauseUntilMs = nowMs + Math.max(0, pauseSec) * 1000
  }

  reset(): void {
    this.lastFingerprint = ''
    this.lastCoachAtMs = 0
    this.readingPauseUntilMs = 0
  }
}
