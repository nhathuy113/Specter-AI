import { describe, expect, it, vi } from 'vitest'
import { resolveCaptureContext } from './capture-context'

describe('capture context policy', () => {
  it('vision never invokes OCR, including when the OCR worker would fail or stall', async () => {
    const ocr = vi.fn(() => new Promise<string>(() => {}))
    const fingerprint = vi.fn(async () => 'image-key')
    const result = await resolveCaptureContext('image', { coachVision: true, mode: 'vision', appName: 'Browser', accessibility: null }, { ocr, fingerprint })
    expect(result).toMatchObject({ useVision: true, textSource: 'metadata', imageFingerprint: 'image-key' })
    expect(result.text).toContain('[ACTIVE APP] Browser')
    const frame = await resolveCaptureContext('image', { coachVision: true, mode: 'vision', appName: 'Watch: VG27A', windowTitle: 'watch-frame', accessibility: null }, { ocr, fingerprint })
    expect(frame.text).toBe('[SCREENSHOT] Use the attached image as primary context.')
    expect(ocr).not.toHaveBeenCalled()
    expect(fingerprint).toHaveBeenCalledWith('image')
  })

  it('retains OCR and accessibility merging for text capture', async () => {
    const fingerprint = vi.fn()
    const result = await resolveCaptureContext('image', { coachVision: false, mode: 'ocr', accessibility: { text: 'accessible' } }, { ocr: async () => 'recognized', fingerprint })
    expect(result.text).toContain('recognized')
    expect(result.text).toContain('accessible')
    expect(result.useVision).toBe(false)
    expect(fingerprint).not.toHaveBeenCalled()
  })
})
