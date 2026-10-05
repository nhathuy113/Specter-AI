import { describe, expect, it, beforeEach } from 'vitest'
import { CoachTriggerEvaluator } from './coach-state'

const SCREEN_A = 'Brussels\nManpower: 23\nArmored: 6'
const SCREEN_B = 'Namur\nManpower: 112\nArmored: 9'

describe('CoachTriggerEvaluator', () => {
  let evaluator: CoachTriggerEvaluator

  beforeEach(() => {
    evaluator = new CoachTriggerEvaluator()
  })

  it('detects visual changes without OCR while retaining duplicate and cooldown gates', () => {
    const input = { ocrText: '[SCREENSHOT]', imageFingerprint: 'frame-a', nowMs: 1000, cooldownSec: 10, isStreaming: false }
    const first = evaluator.evaluate(input)
    expect(first.action).toBe('trigger')
    evaluator.recordCoachTriggered(input.nowMs, first.fingerprint)
    expect(evaluator.evaluate({ ...input, nowMs: 12000 })).toMatchObject({ action: 'skip', reason: 'duplicate-fingerprint' })
    expect(evaluator.evaluate({ ...input, imageFingerprint: 'frame-b', nowMs: 2000 })).toMatchObject({ action: 'skip', reason: 'cooldown' })
    expect(evaluator.evaluate({ ...input, imageFingerprint: 'frame-b', nowMs: 12000 })).toMatchObject({ action: 'trigger', screenChanged: true })
    expect(evaluator.evaluate({ ...input, imageFingerprint: 'frame-b', nowMs: 12000, isStreaming: true })).toMatchObject({ action: 'skip', reason: 'streaming' })
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
      nowMs: 12_000,
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

  it('skips duplicate fingerprint for same leetcode page in work mode within cooldown', () => {
    const meta = { appName: 'Work: Built-in', windowTitle: 'pinned' }
    const screenA = '4. Median of Two Sorted Arrays\nHard\nGiven two sorted arrays nums1 and nums2'
    const screenB = '4. Median of Two Sorted Arrays\nHard\nSubmissions 5678\nGiven two sorted arrays nums1 and nums2'

    const first = evaluator.evaluate({
      ocrText: screenA,
      nowMs: 1_000,
      cooldownSec: 10,
      isStreaming: false,
      assistantMode: 'work',
      appName: meta.appName,
      windowTitle: meta.windowTitle
    })
    expect(first.action).toBe('trigger')
    evaluator.recordCoachTriggered(1_000, first.fingerprint)

    const duringCooldown = evaluator.evaluate({
      ocrText: screenB,
      nowMs: 5_000,
      cooldownSec: 10,
      isStreaming: false,
      assistantMode: 'work',
      appName: meta.appName,
      windowTitle: meta.windowTitle
    })

    expect(duringCooldown.action).toBe('skip')
    if (duringCooldown.action === 'skip') {
      expect(duringCooldown.reason).toBe('cooldown')
    }
  })

  it('re-triggers work coach when user has not changed code after cooldown', () => {
    const meta = { appName: 'Work: Built-in', windowTitle: 'pinned' }
    const screen =
      '4. Median of Two Sorted Arrays\nHard\ndef findMedianSortedArrays(nums1, nums2):\n    pass'

    const first = evaluator.evaluate({
      ocrText: screen,
      nowMs: 1_000,
      cooldownSec: 10,
      isStreaming: false,
      assistantMode: 'work',
      appName: meta.appName,
      windowTitle: meta.windowTitle
    })
    expect(first.action).toBe('trigger')
    evaluator.recordCoachTriggered(1_000, first.fingerprint)

    const second = evaluator.evaluate({
      ocrText: screen,
      nowMs: 20_000,
      cooldownSec: 10,
      isStreaming: false,
      assistantMode: 'work',
      appName: meta.appName,
      windowTitle: meta.windowTitle
    })

    expect(second.action).toBe('trigger')
    if (second.action === 'trigger') {
      expect(second.workReplyMode).toBe('stuck-reexplain')
    }
  })

  it('triggers on next quiz question after poll cooldown (not during)', () => {
    const meta = { appName: 'Google Chrome', windowTitle: '123test' }
    const q1 = '123test.com\nQuestion 1 of 8\nWhich figure completes the pattern?'
    const q2 = '123test.com\nQuestion 2 of 8\nWhich figure completes the pattern?'

    const first = evaluator.evaluate({
      ocrText: q1,
      nowMs: 1_000,
      cooldownSec: 3,
      isStreaming: false,
      assistantMode: 'work',
      appName: meta.appName,
      windowTitle: meta.windowTitle
    })
    expect(first.action).toBe('trigger')
    if (first.action === 'trigger') {
      expect(first.screenChanged).toBe(false)
    }
    evaluator.recordCoachTriggered(1_000, first.fingerprint)

    const duringCooldown = evaluator.evaluate({
      ocrText: q2,
      nowMs: 2_000,
      cooldownSec: 3,
      isStreaming: false,
      assistantMode: 'work',
      appName: meta.appName,
      windowTitle: meta.windowTitle
    })
    expect(duringCooldown.action).toBe('skip')
    if (duringCooldown.action === 'skip') {
      expect(duringCooldown.reason).toBe('cooldown')
    }

    const afterCooldown = evaluator.evaluate({
      ocrText: q2,
      nowMs: 5_000,
      cooldownSec: 3,
      isStreaming: false,
      assistantMode: 'work',
      appName: meta.appName,
      windowTitle: meta.windowTitle
    })
    expect(afterCooldown.action).toBe('trigger')
    if (afterCooldown.action === 'trigger') {
      expect(afterCooldown.screenChanged).toBe(true)
      expect(afterCooldown.fingerprint).not.toBe(first.fingerprint)
    }
  })

  it('skips triggers during reading pause after coach stream ends', () => {
    const meta = { appName: 'Google Chrome', windowTitle: '123test' }
    const q2 = '123test.com\nQuestion 2 of 8\nWhich figure completes the pattern?'

    evaluator.recordCoachTriggered(1_000, 'q1-fp')
    evaluator.recordReadingPause(2_000, 3)

    const duringPause = evaluator.evaluate({
      ocrText: q2,
      nowMs: 3_000,
      cooldownSec: 3,
      isStreaming: false,
      assistantMode: 'work',
      appName: meta.appName,
      windowTitle: meta.windowTitle
    })

    expect(duringPause.action).toBe('skip')
    if (duringPause.action === 'skip') {
      expect(duringPause.reason).toBe('cooldown')
    }
  })

  it('skips duplicate fingerprint for same quiz question in work mode after cooldown', () => {
    const meta = { appName: 'Google Chrome', windowTitle: '123test' }
    const screen =
      '123test.com\nQuestion 1 of 20\nWhich figure completes the pattern?\nRow 1 Box 1'

    const first = evaluator.evaluate({
      ocrText: screen,
      nowMs: 1_000,
      cooldownSec: 5,
      isStreaming: false,
      assistantMode: 'work',
      appName: meta.appName,
      windowTitle: meta.windowTitle
    })
    expect(first.action).toBe('trigger')
    evaluator.recordCoachTriggered(1_000, first.fingerprint)

    const second = evaluator.evaluate({
      ocrText: screen,
      nowMs: 20_000,
      cooldownSec: 5,
      isStreaming: false,
      assistantMode: 'work',
      appName: meta.appName,
      windowTitle: meta.windowTitle
    })

    expect(second.action).toBe('skip')
    if (second.action === 'skip') {
      expect(second.reason).toBe('duplicate-fingerprint')
    }
  })

  it('triggers work coach when user edits code on same leetcode page', () => {
    const meta = { appName: 'Work: Built-in', windowTitle: 'pinned' }
    const before =
      '4. Median of Two Sorted Arrays\nHard\ndef findMedianSortedArrays(nums1, nums2):\n    pass'
    const after =
      '4. Median of Two Sorted Arrays\nHard\ndef findMedianSortedArrays(nums1, nums2):\n    if len(nums1) > len(nums2):'

    const first = evaluator.evaluate({
      ocrText: before,
      nowMs: 1_000,
      cooldownSec: 10,
      isStreaming: false,
      assistantMode: 'work',
      appName: meta.appName,
      windowTitle: meta.windowTitle
    })
    evaluator.recordCoachTriggered(1_000, first.fingerprint)

    const second = evaluator.evaluate({
      ocrText: after,
      nowMs: 20_000,
      cooldownSec: 10,
      isStreaming: false,
      assistantMode: 'work',
      appName: meta.appName,
      windowTitle: meta.windowTitle
    })

    expect(second.action).toBe('trigger')
    if (second.action === 'trigger') {
      expect(second.workReplyMode).toBe('code-review')
      expect(second.fingerprint).not.toBe(first.fingerprint)
    }
  })
})
