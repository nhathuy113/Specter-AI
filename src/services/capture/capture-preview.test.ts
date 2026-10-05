import { describe, expect, it, vi } from 'vitest'
import { createCaptureSettingsReader, parseCapturePreviewOptions } from './capture-preview'
import { resolveBackgroundCaptureParams } from './background-capture-params'

describe('capture preview settings', () => {
  it('uses unsaved form values for one capture without modifying persistence', () => {
    const stored = { fullAutoMode: false, workAreaCaptureEnabled: false, workAreaDisplayId: 1 }
    const read = vi.fn((key: string) => stored[key as keyof typeof stored])
    const overrides = parseCapturePreviewOptions({ fullAutoMode: true, workAreaDisplayId: 2, workAreaCaptureEnabled: true })
    const preview = createCaptureSettingsReader(overrides, read)
    expect(resolveBackgroundCaptureParams(preview)).toMatchObject({ perceptionMode: 'vision', coachVision: true })
    expect(preview('workAreaDisplayId')).toBe(2)
    expect(stored).toEqual({ fullAutoMode: false, workAreaCaptureEnabled: false, workAreaDisplayId: 1 })
    expect(overrides).toEqual({ fullAutoMode: true, workAreaDisplayId: 2, workAreaCaptureEnabled: true })
    expect(parseCapturePreviewOptions()).toEqual({})
  })

  it('rejects secret settings, invalid values and malformed IPC payloads', () => {
    for (const value of [null, [], 123, { fullAutoMode: 'yes' }, { geminiApiKey: 'secret' }, { workAreaDisplayId: Infinity }]) {
      expect(() => parseCapturePreviewOptions(value)).toThrow()
    }
  })
})
