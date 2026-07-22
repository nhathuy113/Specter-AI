import { describe, expect, it } from 'vitest'
import { parseMacOSFrontWindowLine } from './macos-front-window'

describe('parseMacOSFrontWindowLine', () => {
  it('parses swift output', () => {
    const info = parseMacOSFrontWindowLine('1440|0|2560|1440|Cursor|hoi4-my-mod')
    expect(info).toEqual({
      x: 1440,
      y: 0,
      width: 2560,
      height: 1440,
      appName: 'Cursor',
      windowTitle: 'hoi4-my-mod'
    })
  })

  it('returns null for empty output', () => {
    expect(parseMacOSFrontWindowLine('')).toBeNull()
  })
})
