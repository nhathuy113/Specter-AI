import type { AssistantMode } from '../shared/types'
import type { ScreenCaptureResult } from '../shared/types'
import { CoachTriggerEvaluator, type CoachEvaluateResult } from './coach-state'

export interface CoachTickDeps {
  nowMs: number
  cooldownSec: number
  isStreaming: boolean
  assistantMode: AssistantMode
  captureScreen: () => Promise<ScreenCaptureResult>
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

    const result = evaluator.evaluate({
      ocrText: capture.text,
      nowMs: deps.nowMs,
      cooldownSec: deps.cooldownSec,
      isStreaming: deps.isStreaming,
      assistantMode: deps.assistantMode,
      displayCount: capture.displayCount,
      appName: capture.appName,
      windowTitle: capture.windowTitle,
      screenshotBase64: capture.screenshot
    })

    if (result.action === 'trigger') {
      evaluator.recordCoachTriggered(deps.nowMs, result.fingerprint)
      return { ...result, capturedText: capture.text, capture }
    }

    return { ...result, capturedText: capture.text, capture }
  }
}
