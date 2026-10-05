import { describe, expect, it } from 'vitest'
import {
  mergeAccessibilityAndOcr,
  resolvePerceptionPlan,
  shouldUseVision,
  buildVisionUserTask,
  VISION_TEXT_THRESHOLD
} from './perception'

describe('perception', () => {
  it('prefers accessibility when richer than OCR', () => {
    const ax = {
      text: 'Cursor\nSettings.tsx\nfunction buildApp() {\n  return true\n}\n'.repeat(5),
      appName: 'Cursor',
      windowTitle: 'Settings.tsx'
    }
    const result = mergeAccessibilityAndOcr(ax, 'menu bar noise')
    expect(result.textSource).toBe('accessibility')
    expect(result.appName).toBe('Cursor')
  })

  it('falls back to OCR when accessibility is empty', () => {
    const result = mergeAccessibilityAndOcr(null, 'Brussels\nManpower: 23')
    expect(result.textSource).toBe('ocr')
    expect(result.text).toContain('Manpower')
  })

  it('auto mode uses vision when text is thin', () => {
    expect(shouldUseVision('auto', 'short')).toBe(true)
    expect(shouldUseVision('auto', 'x'.repeat(VISION_TEXT_THRESHOLD + 10))).toBe(false)
  })

  it('ocr mode never uses vision', () => {
    expect(shouldUseVision('ocr', '')).toBe(false)
  })

  it('vision mode always uses vision', () => {
    expect(shouldUseVision('vision', 'lots of text '.repeat(50))).toBe(true)
  })

  it('resolvePerceptionPlan sets useVision in auto for thin OCR', () => {
    const plan = resolvePerceptionPlan('auto', 'tiny', null)
    expect(plan.useVision).toBe(true)
    expect(plan.textSource).toBe('ocr')
  })

  it('buildVisionUserTask appends screenshot note when text exists', () => {
    const task = buildVisionUserTask('[CONTENT]\nBrussels\nManpower: 23')
    expect(task).toContain('screenshot')
    expect(task).toContain('Brussels')
  })
})
