import { describe, expect, it } from 'vitest'
import { CoachTriggerEvaluator } from './coach-state'
import { createCoachTickRunner } from './coach-tick-runner'
import type { ScreenCaptureResult } from '../../shared/types'

const QUIZ_OCR = '123test.com\nQuestion 1 of 8\nWhich figure completes the pattern?'

function mockCapture(): ScreenCaptureResult {
  return {
    text: '[ACTIVE APP] Google Chrome\n[WINDOW] IQ Test',
    fingerprintText: QUIZ_OCR,
    screenshot: 'b64',
    timestamp: Date.now(),
    useVision: true,
    appName: 'Google Chrome',
    windowTitle: 'IQ Test'
  }
}

describe('createCoachTickRunner recordTrigger', () => {
  it('does not consume fingerprint when recordTrigger is false (pill mode)', async () => {
    const evaluator = new CoachTriggerEvaluator()
    const runTick = createCoachTickRunner(evaluator)

    const pill = await runTick({
      nowMs: 1_000,
      cooldownSec: 3,
      isStreaming: false,
      assistantMode: 'work',
      captureScreen: async () => mockCapture(),
      recordTrigger: false
    })
    expect(pill.action).toBe('trigger')

    const expanded = await runTick({
      nowMs: 4_000,
      cooldownSec: 3,
      isStreaming: false,
      assistantMode: 'work',
      captureScreen: async () => mockCapture(),
      recordTrigger: true
    })
    expect(expanded.action).toBe('trigger')
  })

  it('skips duplicate when recordTrigger true on first tick', async () => {
    const evaluator = new CoachTriggerEvaluator()
    const runTick = createCoachTickRunner(evaluator)

    await runTick({
      nowMs: 1_000,
      cooldownSec: 3,
      isStreaming: false,
      assistantMode: 'work',
      captureScreen: async () => mockCapture(),
      recordTrigger: true
    })

    const second = await runTick({
      nowMs: 4_000,
      cooldownSec: 3,
      isStreaming: false,
      assistantMode: 'work',
      captureScreen: async () => mockCapture(),
      recordTrigger: true
    })
    expect(second.action).toBe('skip')
    if (second.action === 'skip') {
      expect(second.reason).toBe('duplicate-fingerprint')
    }
  })
})
