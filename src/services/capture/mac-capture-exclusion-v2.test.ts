import { describe, expect, it, vi } from 'vitest'
import { CaptureExclusionV2, MacCaptureExclusionV2, type CaptureProtectedWindow, type MacCaptureShape } from './mac-capture-exclusion-v2'

function window(overrides: Partial<CaptureProtectedWindow> = {}): CaptureProtectedWindow {
  return {
    isDestroyed: () => false,
    setContentProtection: vi.fn(),
    getNativeWindowHandle: () => Buffer.alloc(8),
    getBounds: () => ({ width: 420, height: 80 }),
    ...overrides
  }
}

function shape(windowId: number | null = 7): MacCaptureShape {
  return { windowId: vi.fn(() => windowId), exclude: vi.fn(() => true) }
}

describe('MacCaptureExclusionV2', () => {
  it('sets content protection and excludes the window bounds', () => {
    const mac = shape()
    const win = window()
    expect(new MacCaptureExclusionV2(mac).protect(win)).toBe(true)
    expect(win.setContentProtection).toHaveBeenCalledWith(true)
    expect(mac.exclude).toHaveBeenCalledWith(7, 420, 80)
    expect(win.setContentProtection).toHaveBeenCalledBefore(mac.exclude as ReturnType<typeof vi.fn>)
  })

  it('does not touch a destroyed window', () => {
    const mac = shape()
    const win = window({ isDestroyed: () => true })
    expect(new MacCaptureExclusionV2(mac).protect(win)).toBe(false)
    expect(win.setContentProtection).not.toHaveBeenCalled()
    expect(mac.exclude).not.toHaveBeenCalled()
  })

  it('keeps content protection when the window id is missing', () => {
    const mac = shape(null)
    const win = window()
    expect(new MacCaptureExclusionV2(mac).protect(win)).toBe(false)
    expect(win.setContentProtection).toHaveBeenCalledWith(true)
    expect(mac.exclude).not.toHaveBeenCalled()
  })
})

describe('CaptureExclusionV2', () => {
  it('uses the mac exclusion on darwin and the windows callback on win32', () => {
    const mac = shape()
    const excludeWindows = vi.fn(() => true)
    const win = window()
    expect(new CaptureExclusionV2('darwin', new MacCaptureExclusionV2(mac), excludeWindows).protect(win)).toBe(true)
    expect(mac.exclude).toHaveBeenCalledOnce()
    expect(excludeWindows).not.toHaveBeenCalled()
    const windows = window()
    expect(new CaptureExclusionV2('win32', new MacCaptureExclusionV2(shape()), excludeWindows).protect(windows)).toBe(true)
    expect(excludeWindows).toHaveBeenCalledWith(windows)
    expect(windows.setContentProtection).not.toHaveBeenCalled()
    const linux = window()
    expect(new CaptureExclusionV2('linux', new MacCaptureExclusionV2(shape()), excludeWindows).protect(linux)).toBe(false)
    expect(linux.setContentProtection).not.toHaveBeenCalled()
  })
})
