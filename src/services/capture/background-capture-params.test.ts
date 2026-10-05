import { describe, expect, it } from 'vitest'
import { resolveBackgroundCaptureParams } from './background-capture-params'

describe('resolveBackgroundCaptureParams', () => {
  it('matches full-auto watch: OCR, no AX, work uses smart crop + coach vision', () => {
    const params = resolveBackgroundCaptureParams((key) => {
      if (key === 'fullAutoMode') return true
      if (key === 'assistantMode') return 'work'
      return undefined
    })
    expect(params).toEqual({
      activeWindowOnly: true,
      perceptionMode: 'vision',
      skipAccessibility: true,
      coachVision: true
    })
  })
})
