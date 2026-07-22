import { describe, expect, it, beforeEach } from 'vitest'
import { CoachTriggerEvaluator } from './coach-state'

const SCREEN_A = 'Brussels\nManpower: 23\nArmored: 6'
const SCREEN_B = 'Namur\nManpower: 112\nArmored: 9'

describe('CoachTriggerEvaluator', () => {
  let evaluator: CoachTriggerEvaluator

  beforeEach(() => {
    evaluator = new CoachTriggerEvaluator()
  })

  it('triggers on first non-empty screen', () => {
    const result = evaluator.evaluate({
      ocrText: SCREEN_A,
      nowMs: 1_000,
      cooldownSec: 10,
      isStreaming: false
    })

    expect(result.action).toBe('trigger')
    if (result.action === 'trigger') {
      expect(result.screenText).toContain('Brussels')
    }
  })

  it('skips duplicate fingerprint', () => {
    evaluator.recordCoachTriggered(1_000, evaluator.evaluate({
      ocrText: SCREEN_A,
      nowMs: 1_000,
      cooldownSec: 10,
      isStreaming: false
    }).fingerprint)

    const result = evaluator.evaluate({
      ocrText: SCREEN_A,
      nowMs: 2_000,
      cooldownSec: 10,
      isStreaming: false
    })

    expect(result).toEqual({
      action: 'skip',
      reason: 'duplicate-fingerprint',
      fingerprint: result.fingerprint
    })
  })

  it('skips while streaming', () => {
    const result = evaluator.evaluate({
      ocrText: SCREEN_B,
      nowMs: 1_000,
      cooldownSec: 10,
      isStreaming: true
    })

    expect(result.action).toBe('skip')
    if (result.action === 'skip') {
      expect(result.reason).toBe('streaming')
    }
  })

  it('skips during cooldown after a coach trigger', () => {
    const first = evaluator.evaluate({
      ocrText: SCREEN_A,
      nowMs: 1_000,
      cooldownSec: 10,
      isStreaming: false
    })
    expect(first.action).toBe('trigger')
    evaluator.recordCoachTriggered(1_000, first.fingerprint)

    const second = evaluator.evaluate({
      ocrText: SCREEN_B,
      nowMs: 5_000,
      cooldownSec: 10,
      isStreaming: false
    })

    expect(second.action).toBe('skip')
    if (second.action === 'skip') {
      expect(second.reason).toBe('cooldown')
    }
  })

  it('triggers again after cooldown with new screen content', () => {
    const first = evaluator.evaluate({
      ocrText: SCREEN_A,
      nowMs: 1_000,
      cooldownSec: 10,
      isStreaming: false
    })
    evaluator.recordCoachTriggered(1_000, first.fingerprint)

    const second = evaluator.evaluate({
      ocrText: SCREEN_B,
      nowMs: 12_000,
      cooldownSec: 10,
      isStreaming: false
    })

    expect(second.action).toBe('trigger')
  })

  it('skips IDE chrome in game mode during watch', () => {
    const result = evaluator.evaluate({
      ocrText: 'Cursor\nGEMINI_API_KEY\n.env\nSpecter AI',
      nowMs: 1_000,
      cooldownSec: 10,
      isStreaming: false,
      assistantMode: 'game'
    })

    expect(result.action).toBe('skip')
    if (result.action === 'skip') {
      expect(result.reason).toBe('non-actionable-screen')
    }
  })

  it('triggers on IDE content in general mode', () => {
    const result = evaluator.evaluate({
      ocrText: 'Cursor\nfunction buildApp() {\n  return true\n}',
      nowMs: 1_000,
      cooldownSec: 10,
      isStreaming: false,
      assistantMode: 'general'
    })

    expect(result.action).toBe('trigger')
  })
})
