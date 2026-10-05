import { describe, expect, it, vi } from 'vitest'
import { ExcludedFromCapturePolicy, HiddenDuringCapturePolicy, WatchFrameCaptureHold, frameVisibilityPolicy, type WatchFrameSurface } from './watch-frame-capture-hold'

function surface(overrides: Partial<WatchFrameSurface> = {}): WatchFrameSurface {
  return { dragging: false, visible: true, hide: vi.fn(), restore: vi.fn(), ...overrides }
}

describe('frame visibility policy', () => {
  it('keeps the frame on macOS and Windows and hides it on Linux', () => {
    expect(frameVisibilityPolicy('darwin')).toBeInstanceOf(ExcludedFromCapturePolicy)
    expect(frameVisibilityPolicy('win32')).toBeInstanceOf(ExcludedFromCapturePolicy)
    expect(frameVisibilityPolicy('linux')).toBeInstanceOf(HiddenDuringCapturePolicy)
  })
})

describe('WatchFrameCaptureHold', () => {
  it('does not hide when the policy keeps the frame visible', () => {
    const frame = surface()
    const hold = new WatchFrameCaptureHold(new ExcludedFromCapturePolicy()).begin(frame)
    expect(hold.hidden).toBe(false)
    hold.restore()
    expect(frame.hide).not.toHaveBeenCalled()
    expect(frame.restore).not.toHaveBeenCalled()
  })

  it('hides on the hidden policy and restores once after overlapping captures', () => {
    const frame = surface()
    const later = surface({ visible: false })
    const holder = new WatchFrameCaptureHold(new HiddenDuringCapturePolicy())
    const first = holder.begin(frame)
    const second = holder.begin(later)
    expect(first.hidden).toBe(true)
    expect(holder.suspended).toBe(true)
    first.restore()
    first.restore()
    expect(frame.restore).not.toHaveBeenCalled()
    second.restore()
    expect(frame.hide).toHaveBeenCalledTimes(1)
    expect(later.restore).toHaveBeenCalledTimes(1)
    expect(holder.suspended).toBe(false)
  })
})
