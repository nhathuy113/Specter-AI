import type { AssistantMode } from '../../shared/types'
import type { ScreenCaptureResult } from '../../shared/types'
import { CoachTriggerEvaluator, type CoachEvaluateResult } from './coach-state'

export interface CoachTickDeps {
  nowMs: number
  cooldownSec: number
  isStreaming: boolean
  assistantMode: AssistantMode
  captureScreen: () => Promise<ScreenCaptureResult>
  /** When false, evaluate trigger but do not consume fingerprint (overlay still pill). */
  recordTrigger?: boolean
}

export type CoachTickResult = CoachEvaluateResult & {
  capturedText?: string
  capture?: ScreenCaptureResult
}

export function createCoachTickRunner(evaluator: CoachTriggerEvaluator) {
  return async function runCoachTick(deps: CoachTickDeps): Promise<CoachTickResult> {
    let capture: ScreenCaptureResult = { text: '', timestamp: Date.now() }
    try {
      capture = await deps.captureScreen()
    } catch {
      return { action: 'skip', reason: 'empty-text', fingerprint: '' }
    }

    const ocrForFingerprint = capture.fingerprintText?.trim() || capture.text

    const result = evaluator.evaluate({
      ocrText: ocrForFingerprint,
      imageFingerprint: capture.useVision ? capture.imageFingerprint : undefined,
      nowMs: deps.nowMs,
      cooldownSec: deps.cooldownSec,
      isStreaming: deps.isStreaming,
      assistantMode: deps.assistantMode,
      displayCount: capture.displayCount,
      appName: capture.appName,
      windowTitle: capture.windowTitle,
    })

    if (result.action === 'trigger') {
      if (deps.recordTrigger !== false) {
        evaluator.recordCoachTriggered(deps.nowMs, result.fingerprint)
      }
      return { ...result, capturedText: capture.text, capture }
    }

    return { ...result, capturedText: capture.text, capture }
  }
}
