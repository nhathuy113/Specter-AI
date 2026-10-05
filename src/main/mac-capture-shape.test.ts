import { describe, expect, it } from 'vitest'
import { macCaptureShapeLoaded } from './mac-capture-shape'

describe('koffi mac capture shape', () => {
  it('loads CGSSetWindowCaptureExcludeShape on macOS', () => {
    expect(macCaptureShapeLoaded()).toBe(process.platform === 'darwin')
  })
})
