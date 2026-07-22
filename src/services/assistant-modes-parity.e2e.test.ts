import { describe, expect, it } from 'vitest'
import { ASSISTANT_MODES } from '../shared/constants'
import { extractScreenContext, resolveAssistantRequest } from './context-router'
import {
  CURSOR_ON_SINGLE,
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

const SINGLE_META = { displayCount: 1 }
const DUAL_META = { displayCount: 2 }

describe('assistant mode parity', () => {
  it('single monitor: all modes treat IDE screen the same (actionable, no redirect)', () => {
    for (const mode of ASSISTANT_MODES) {
      const ctx = extractScreenContext(IDE_OCR, mode, SINGLE_META)
      expect(ctx.kind, mode).toBe('ide')
      expect(ctx.actionable, mode).toBe(true)
      expect(ctx.instantReply, mode).toBeUndefined()
    }
  })

  it('single monitor: all modes send IDE to model (no instant redirect)', () => {
    for (const mode of ASSISTANT_MODES) {
      const req = resolveAssistantRequest(IDE_OCR, mode, SINGLE_META)
      expect(req.instantReply, mode).toBeUndefined()
      expect(req.userMessage, mode).toContain('[CONTENT]')
      expect(req.userMessage, mode).toContain('Cursor')
      expect(req.userMessage, mode).toContain('pnpm test:screen:live')
    }
  })

  it('dual monitor: game mode still redirects IDE; others send to model', () => {
    const general = extractScreenContext(IDE_OCR, 'general', DUAL_META)
    const work = extractScreenContext(IDE_OCR, 'work', DUAL_META)
    const game = extractScreenContext(IDE_OCR, 'game', DUAL_META)

    expect(general.instantReply).toBeUndefined()
    expect(work.instantReply).toBeUndefined()
    expect(game.instantReply?.toLowerCase()).toContain('game')
    expect(game.actionable).toBe(false)
  })

  it('smart crop plan is identical regardless of assistant mode (capture layer)', () => {
    const plans = ASSISTANT_MODES.map(() =>
      resolveSmartCapturePlan(CURSOR_ON_SINGLE, SINGLE_MONITOR)
    )
    const baseline = plans[0]
    for (const plan of plans) {
      expect(plan).toEqual(baseline)
    }
  })
})
