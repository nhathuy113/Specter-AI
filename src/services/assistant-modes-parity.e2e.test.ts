import { describe, expect, it } from 'vitest'
import { ASSISTANT_MODES } from '../shared/constants'
import { extractScreenContext, resolveAssistantRequest } from './context-router'
import {
  BROWSER_ON_PRIMARY,
  CURSOR_ON_DUAL_PRIMARY,
  CURSOR_ON_SINGLE,
  HOI4_WINDOW_ON_SECONDARY,
  resolveSmartCapturePlan,
  SINGLE_MONITOR,
  VG27A_DUAL_MONITOR
} from './smart-capture'

const IDE_OCR = `
Cursor File Edit Selection View
PERFORMANCE REVIEW tools Specter-AI
GEMINI_API_KEY .env
pnpm test:screen:live
`.trim()

describe('display layout parity (1 vs 2 monitors)', () => {
  it('crops focused Cursor on single and dual primary the same way', () => {
    const single = resolveSmartCapturePlan(CURSOR_ON_SINGLE, SINGLE_MONITOR)
    const dual = resolveSmartCapturePlan(CURSOR_ON_DUAL_PRIMARY, VG27A_DUAL_MONITOR)

    expect(single?.type).toBe('window-crop')
    expect(dual?.type).toBe('window-crop')
  })

  it('crops game window on secondary monitor in dual setup', () => {
    const plan = resolveSmartCapturePlan(HOI4_WINDOW_ON_SECONDARY, VG27A_DUAL_MONITOR)
    expect(plan?.type).toBe('window-crop')
    if (plan?.type === 'window-crop') {
      expect(plan.display.label).toBe('VG27A')
    }
  })

  it('crops browser on primary in dual setup (not full secondary)', () => {
    const plan = resolveSmartCapturePlan(BROWSER_ON_PRIMARY, VG27A_DUAL_MONITOR)
    expect(plan).toEqual({
      type: 'window-crop',
      window: { x: 80, y: 40, width: 1280, height: 800 },
      display: VG27A_DUAL_MONITOR[0]
    })
  })

  it('uses full primary when no window on single or dual', () => {
    const single = resolveSmartCapturePlan(null, SINGLE_MONITOR)
    const dual = resolveSmartCapturePlan(null, VG27A_DUAL_MONITOR)
    expect(single?.type).toBe('display-full')
    expect(dual?.type).toBe('display-full')
    expect(single?.display.isPrimary).toBe(true)
    expect(dual?.display.isPrimary).toBe(true)
  })

  it('IDE routing is identical regardless of displayCount metadata', () => {
    for (const mode of ASSISTANT_MODES) {
      const oneMonitor = extractScreenContext(IDE_OCR, mode, { displayCount: 1 })
      const twoMonitors = extractScreenContext(IDE_OCR, mode, { displayCount: 2 })
      expect(twoMonitors.actionable).toBe(oneMonitor.actionable)
      expect(twoMonitors.instantReply).toBe(oneMonitor.instantReply)
    }
  })

  it('coach request matches for 1 vs 2 monitors', () => {
    for (const mode of ASSISTANT_MODES) {
      const one = resolveAssistantRequest(IDE_OCR, mode, { displayCount: 1 })
      const two = resolveAssistantRequest(IDE_OCR, mode, { displayCount: 2 })
      expect(two.instantReply).toBe(one.instantReply)
      expect(two.userMessage).toBe(one.userMessage)
    }
  })
})
