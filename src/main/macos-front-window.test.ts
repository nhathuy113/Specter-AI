import { describe, expect, it } from 'vitest'
import { parseMacOSFrontWindowLine, shouldRestoreForegroundAfterCapture, isSpecterForeground } from './macos-front-window'

describe('parseMacOSFrontWindowLine', () => {
  it('parses new swift output with pid and bundleId', () => {
    const info = parseMacOSFrontWindowLine(
      '1440|0|2560|1440|12345|com.todesktop.230313mzl4w4u92|Cursor|hoi4-my-mod'
    )
    expect(info).toEqual({
      x: 1440,
      y: 0,
      width: 2560,
      height: 1440,
      pid: 12345,
      bundleId: 'com.todesktop.230313mzl4w4u92',
      appName: 'Cursor',
      windowTitle: 'hoi4-my-mod'
    })
  })

  it('parses legacy swift output', () => {
    const info = parseMacOSFrontWindowLine('1440|0|2560|1440|Cursor|hoi4-my-mod')
    expect(info).toMatchObject({
      appName: 'Cursor',
      windowTitle: 'hoi4-my-mod',
      pid: 0
    })
  })

  it('returns null for empty output', () => {
    expect(parseMacOSFrontWindowLine('')).toBeNull()
  })

  it('restores only when Specter stole focus', () => {
    const cursor = {
      x: 0,
      y: 0,
      width: 800,
      height: 600,
      pid: 100,
      bundleId: 'com.cursor',
      appName: 'Cursor',
      windowTitle: 'code'
    }
    const game = { ...cursor, pid: 200, appName: 'hoi4', bundleId: 'com.paradox' }
    const specter = { ...cursor, pid: 300, bundleId: 'com.specter.ai', appName: 'Specter AI' }

    expect(shouldRestoreForegroundAfterCapture(100, cursor)).toBe(false)
    expect(shouldRestoreForegroundAfterCapture(100, game)).toBe(false)
    expect(shouldRestoreForegroundAfterCapture(100, specter)).toBe(true)
    expect(isSpecterForeground(specter)).toBe(true)
    expect(isSpecterForeground(game)).toBe(false)
  })
})
