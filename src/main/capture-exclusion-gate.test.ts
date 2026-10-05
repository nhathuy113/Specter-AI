import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'

/**
 * Regression gate for capture exclusion.
 * v1: Windows WDA_EXCLUDEFROMCAPTURE, never setContentProtection (black rectangle).
 * v2: macOS setContentProtection plus CGSSetWindowCaptureExcludeShape.
 */
const root = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf-8')

describe('capture exclusion v1 and v2 gate', () => {
  it('keeps Windows v1 on WDA_EXCLUDEFROMCAPTURE and off setContentProtection', () => {
    const windows = read('src/main/capture-protection.ts')
    expect(windows).toContain('const WDA_EXCLUDEFROMCAPTURE = 0x00000011')
    expect(windows).toContain('SetWindowDisplayAffinity')
    expect(windows).toContain("if (process.platform !== 'win32') return false")
    expect(windows).toContain('Do NOT combine this with Electron\'s setContentProtection(true)')
    expect(windows).not.toContain('win.setContentProtection')
  })

  it('injects MacCaptureExclusionV2 and keeps the Windows path off setContentProtection', () => {
    const wiring = read('src/main/capture-exclusion.ts')
    const mac = read('src/services/capture/mac-capture-exclusion-v2.ts')
    const windows = read('src/main/capture-protection.ts')
    expect(wiring).toContain('new CaptureExclusionV2(')
    expect(wiring).toContain('new MacCaptureExclusionV2(koffiMacCaptureShape)')
    expect(wiring).toContain('applyExcludeFromCapture')
    expect(mac).toContain('win.setContentProtection(true)')
    expect(mac).toContain("if (this.platform === 'darwin') return this.mac.protect(win)")
    expect(mac).toContain("if (this.platform === 'win32') return this.excludeWindows(win)")
    expect(windows).not.toContain('win.setContentProtection')
  })

  it('reapplies exclusion when the overlay or watch frame is shown, moved, or resized', () => {
    const overlay = read('src/main/overlay-window.ts')
    const frame = read('src/main/watch-frame-window.ts')
    expect(overlay).toContain('captureExclusion.protect(win)')
    expect(overlay).toContain("overlayWindow.on('show'")
    expect(overlay).toContain("overlayWindow.on('moved'")
    expect(overlay).toContain("overlayWindow.on('resize'")
    expect(overlay).toContain('captureExclusion.protect(overlayWindow)')
    expect(overlay).not.toContain('win.setContentProtection')
    expect(frame).toContain("win.on('show', protect)")
    expect(frame).toContain("win.on('move', protect)")
    expect(frame).toContain("win.on('resize', protect)")
    expect(frame).toContain('captureExclusion.protect(win)')
    expect(frame).not.toContain('win.setContentProtection')
  })

  it('decodes the NSView pointer before the private exclude-shape call', () => {
    const shape = read('src/main/mac-capture-shape.ts')
    expect(shape).toContain("if (loadFailed || process.platform !== 'darwin') return null")
    expect(shape).toContain('handle.readBigUInt64LE(0)')
    expect(shape).toContain('if (view === 0n) return null')
    expect(shape).toContain("sel('window')")
    expect(shape).toContain("sel('windowNumber')")
    expect(shape).toContain('shape.msg(view, shape.windowSel)')
    expect(shape).toContain('id <= 0')
    expect(shape).toContain('origin: { x: 0, y: 0 }')
    expect(shape).toContain('shape.release(region)')
    expect(shape).toContain('CGSSetWindowCaptureExcludeShape')
    expect(shape).toContain('CGRegionCreateWithRect')
    expect(shape).not.toContain('shape.msg(handle, shape.windowSel)')
  })
})
