import { describe, expect, it, vi } from 'vitest'
import { buildCoachUserMessage, resolveCoachRequest } from '../coach/coach-prompt'
import { checkAiConfig } from '../ai/ai-config'
import { createCoachTickRunner } from '../coach/coach-tick-runner'
import { CoachTriggerEvaluator } from '../coach/coach-state'
import { fingerprintScreenText } from './fingerprint'
import {
  BROWSER_ON_PRIMARY,
  CURSOR_ON_DUAL_PRIMARY,
  CURSOR_ON_SINGLE,
  HOI4_WINDOW_ON_SECONDARY,
  resolveSmartCapturePlan,
  shouldIgnoreActiveWindow,
  SINGLE_MONITOR,
  VG27A_DUAL_MONITOR
} from './smart-capture'
import type { ScreenCaptureResult } from '../../shared/types'

const mockCapture = (text: string): ScreenCaptureResult => ({ text, timestamp: Date.now() })

vi.mock('../settings/store', () => ({
  getSetting: vi.fn((key: string) => {
    if (key === 'aiProvider') return 'gemini'
    if (key === 'geminiApiKey') return 'AIza-test-key'
    return undefined
  })
}))

const HOI4_COMBAT_LOG = `
Brussels
2 hours ago.
Manpower: 23
Armored: 6
Air: 0
Other: 15
Manpower: 17.36K
Armored: 44
`.trim()

describe('smart capture (unified 1/2 monitor)', () => {
  it('crops HOI4 when game window is focused on secondary monitor', () => {
    const plan = resolveSmartCapturePlan(HOI4_WINDOW_ON_SECONDARY, VG27A_DUAL_MONITOR)
    expect(plan).toEqual({
      type: 'window-crop',
      window: { x: 1440, y: 0, width: 2560, height: 1440 },
      display: VG27A_DUAL_MONITOR[1]
    })
  })

  it('crops browser when focused on primary laptop screen (dual)', () => {
    const plan = resolveSmartCapturePlan(BROWSER_ON_PRIMARY, VG27A_DUAL_MONITOR)
    expect(plan?.type).toBe('window-crop')
    if (plan?.type === 'window-crop') {
      expect(plan.display.label).toBe('Color LCD')
    }
  })

  it('captures full primary when Specter overlay has focus', () => {
    const dual = resolveSmartCapturePlan(
      { x: 200, y: 200, width: 420, height: 600, title: 'Specter AI' },
      VG27A_DUAL_MONITOR
    )
    expect(dual).toEqual({ type: 'display-full', display: VG27A_DUAL_MONITOR[0] })

    const single = resolveSmartCapturePlan(
      { x: 200, y: 200, width: 420, height: 600, title: 'Specter AI' },
      SINGLE_MONITOR
    )
    expect(single).toEqual({ type: 'display-full', display: SINGLE_MONITOR[0] })
  })

  it('captures full primary when no active window', () => {
    expect(resolveSmartCapturePlan(null, VG27A_DUAL_MONITOR)).toEqual({
      type: 'display-full',
      display: VG27A_DUAL_MONITOR[0]
    })
    expect(resolveSmartCapturePlan(null, SINGLE_MONITOR)).toEqual({
      type: 'display-full',
      display: SINGLE_MONITOR[0]
    })
  })

  it('crops Cursor the same way on single and dual primary', () => {
    const single = resolveSmartCapturePlan(CURSOR_ON_SINGLE, SINGLE_MONITOR)
    const dual = resolveSmartCapturePlan(CURSOR_ON_DUAL_PRIMARY, VG27A_DUAL_MONITOR)
    expect(single?.type).toBe('window-crop')
    expect(dual?.type).toBe('window-crop')
  })
})

describe('shouldIgnoreActiveWindow', () => {
  it('ignores only Specter overlay on any layout', () => {
    expect(shouldIgnoreActiveWindow('Specter AI')).toBe(true)
    expect(shouldIgnoreActiveWindow('Cursor')).toBe(false)
    expect(shouldIgnoreActiveWindow('Google AI Studio')).toBe(false)
    expect(shouldIgnoreActiveWindow('Hearts of Iron IV')).toBe(false)
  })
})

describe('coach pipeline e2e (capture → fingerprint → coach message)', () => {
  it('builds coach user message from game log OCR', () => {
    const message = buildCoachUserMessage(HOI4_COMBAT_LOG, 'game')
    expect(message).toContain('Brussels')
    expect(message).toContain('[ENTRIES')
    expect(message).toContain('17.36K')
  })

  it('game mode instant redirect when OCR is IDE chrome', () => {
    const req = resolveCoachRequest('Cursor Specter GEMINI_API_KEY .env', 'game')
    expect(req.kind).toBe('ide')
    expect(req.instantReply).toBeTruthy()
  })

  it('dedups animated combat log with stable fingerprint', () => {
    const frameA = HOI4_COMBAT_LOG
    const frameB = HOI4_COMBAT_LOG.replace('2 hours ago', '3 hours ago')
    expect(fingerprintScreenText(frameA)).toBe(fingerprintScreenText(frameB))
  })

  it('runs full coach tick: trigger on new battle, skip duplicate frames', async () => {
    const evaluator = new CoachTriggerEvaluator()
    const runCoachTick = createCoachTickRunner(evaluator)

    let ocrFrame = HOI4_COMBAT_LOG
    const captureScreen = async () => mockCapture(ocrFrame)

    const first = await runCoachTick({
      nowMs: 1_000,
      cooldownSec: 10,
      isStreaming: false,
      assistantMode: 'game',
      captureScreen
    })
    expect(first.action).toBe('trigger')

    const duplicate = await runCoachTick({
      nowMs: 2_000,
      cooldownSec: 10,
      isStreaming: false,
      assistantMode: 'game',
      captureScreen
    })
    expect(duplicate.action).toBe('skip')
    if (duplicate.action === 'skip') {
      expect(duplicate.reason).toBe('duplicate-fingerprint')
    }

    ocrFrame = HOI4_COMBAT_LOG.replace('Brussels', 'Namur')
    const afterCooldown = await runCoachTick({
      nowMs: 12_000,
      cooldownSec: 10,
      isStreaming: false,
      assistantMode: 'game',
      captureScreen
    })
    expect(afterCooldown.action).toBe('trigger')
  })

  it('ai config is ready when gemini key is set', () => {
    const status = checkAiConfig()
    expect(status.configured).toBe(true)
    expect(status.provider).toBe('gemini')
  })
})
