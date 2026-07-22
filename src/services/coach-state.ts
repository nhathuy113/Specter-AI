import type { AssistantMode } from '../shared/types'
import { extractScreenContext } from './context-router'
import { fingerprintCoachScreenText } from './fingerprint'

export type CoachSkipReason =
  | 'empty-text'
  | 'duplicate-fingerprint'
  | 'cooldown'
  | 'streaming'
  | 'non-actionable-screen'

export type CoachEvaluateResult =
  | { action: 'skip'; reason: CoachSkipReason; fingerprint: string }
  | { action: 'trigger'; fingerprint: string; screenText: string }

export interface CoachEvaluateInput {
  ocrText: string
  nowMs: number
  cooldownSec: number
  isStreaming: boolean
  assistantMode?: AssistantMode
  displayCount?: number
}

export class CoachTriggerEvaluator {
  private lastFingerprint = ''
  private lastCoachAtMs = 0

  evaluate(input: CoachEvaluateInput): CoachEvaluateResult {
    const mode = input.assistantMode ?? 'general'
    const ctx = extractScreenContext(input.ocrText, mode, {
      displayCount: input.displayCount
    })

    if (ctx.kind === 'empty' || !ctx.actionable) {
      return { action: 'skip', reason: 'non-actionable-screen', fingerprint: '' }
    }

    const fingerprint = fingerprintCoachScreenText(input.ocrText)

    if (!fingerprint) {
      return { action: 'skip', reason: 'empty-text', fingerprint }
    }

    if (input.isStreaming) {
      return { action: 'skip', reason: 'streaming', fingerprint }
    }

    if (fingerprint === this.lastFingerprint) {
      return { action: 'skip', reason: 'duplicate-fingerprint', fingerprint }
    }

    const cooldownMs = Math.max(0, input.cooldownSec) * 1000
    if (this.lastCoachAtMs > 0 && input.nowMs - this.lastCoachAtMs < cooldownMs) {
      return { action: 'skip', reason: 'cooldown', fingerprint }
    }

    return {
      action: 'trigger',
      fingerprint,
      screenText: input.ocrText.trim()
    }
  }

  recordCoachTriggered(nowMs: number, fingerprint: string): void {
    this.lastFingerprint = fingerprint
    this.lastCoachAtMs = nowMs
  }

  reset(): void {
    this.lastFingerprint = ''
    this.lastCoachAtMs = 0
  }
}
