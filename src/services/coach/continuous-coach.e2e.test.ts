import { describe, expect, it, beforeEach } from 'vitest'
import type { ScreenCaptureResult } from '../../shared/types'
import { CoachTriggerEvaluator } from './coach-state'
import { createCoachTickRunner } from './coach-tick-runner'

const mockCapture = (text: string): ScreenCaptureResult => ({ text, timestamp: Date.now() })

const BRUSSELS = `
Brussels
2 hours ago.
Manpower: 23
Armored: 6
`.trim()

const NAMUR = `
Namur
5 days ago.
Manpower: 112
Armored: 9
`.trim()

describe('continuous coach e2e loop', () => {
  let evaluator: CoachTriggerEvaluator
  let runCoachTick: ReturnType<typeof createCoachTickRunner>

  beforeEach(() => {
    evaluator = new CoachTriggerEvaluator()
    runCoachTick = createCoachTickRunner(evaluator)
  })

  it('captures once, triggers once, then dedups identical screen', async () => {
    let captureCount = 0
    const captureScreen = async () => {
      captureCount += 1
      return mockCapture(BRUSSELS)
    }

    const first = await runCoachTick({
      nowMs: 1_000,
      cooldownSec: 10,
      isStreaming: false,
      assistantMode: 'game',
      captureScreen
    })
    expect(first.action).toBe('trigger')
    expect(captureCount).toBe(1)

    const second = await runCoachTick({
      nowMs: 2_000,
      cooldownSec: 10,
      isStreaming: false,
      assistantMode: 'game',
      captureScreen
    })
    expect(second.action).toBe('skip')
    if (second.action === 'skip') {
      expect(second.reason).toBe('duplicate-fingerprint')
    }
    expect(captureCount).toBe(2)
  })

  it('triggers again when screen content changes after cooldown', async () => {
    let frame = BRUSSELS
    const captureScreen = async () => mockCapture(frame)

    const first = await runCoachTick({ nowMs: 1_000, cooldownSec: 5, isStreaming: false, assistantMode: 'game', captureScreen })
    expect(first.action).toBe('trigger')

    frame = NAMUR
    const duringCooldown = await runCoachTick({ nowMs: 3_000, cooldownSec: 5, isStreaming: false, assistantMode: 'game', captureScreen })
    expect(duringCooldown.action).toBe('skip')
    if (duringCooldown.action === 'skip') {
      expect(duringCooldown.reason).toBe('cooldown')
    }

    const afterCooldown = await runCoachTick({ nowMs: 7_000, cooldownSec: 5, isStreaming: false, assistantMode: 'game', captureScreen })
    expect(afterCooldown.action).toBe('trigger')
    if (afterCooldown.action === 'trigger') {
      expect(afterCooldown.screenText).toContain('Namur')
    }
  })

  it('does not trigger while overlay is streaming', async () => {
    const result = await runCoachTick({
      nowMs: 1_000,
      cooldownSec: 10,
      isStreaming: true,
      assistantMode: 'game',
      captureScreen: async () => mockCapture(BRUSSELS)
    })

    expect(result.action).toBe('skip')
    if (result.action === 'skip') {
      expect(result.reason).toBe('streaming')
    }
  })
})
