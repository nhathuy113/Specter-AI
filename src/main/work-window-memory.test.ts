import { describe, expect, it, beforeEach } from 'vitest'
import {
  getRememberedWorkWindow,
  pickBestBrowserWindow,
  rememberWorkWindow,
  resetWorkWindowMemory,
  resolveWorkWindowForCrop
} from './work-window-memory'

const CHROME = {
  x: 80,
  y: 40,
  width: 1280,
  height: 800,
  pid: 123,
  bundleId: 'com.google.Chrome',
  appName: 'Google Chrome',
  windowTitle: '123test.com'
}

const CURSOR = {
  x: 0,
  y: 0,
  width: 2560,
  height: 1410,
  pid: 456,
  bundleId: 'com.todesktop.230313mzl4w4u92',
  appName: 'Cursor',
  windowTitle: 'PERFORMANCE REVIEW'
}

const SPECTER = {
  x: 100,
  y: 100,
  width: 420,
  height: 600,
  pid: 999,
  bundleId: 'com.specter.ai',
  appName: 'Specter AI',
  windowTitle: 'Specter AI'
}

describe('work-window-memory', () => {
  beforeEach(() => resetWorkWindowMemory())

  it('remembers Chrome as browser window', () => {
    rememberWorkWindow(CHROME)
    expect(getRememberedWorkWindow()?.appName).toBe('Google Chrome')
  })

  it('does not replace browser with Cursor', () => {
    rememberWorkWindow(CHROME)
    expect(resolveWorkWindowForCrop(CURSOR)?.appName).toBe('Google Chrome')
  })

  it('falls back to browser when Specter is front', () => {
    rememberWorkWindow(CHROME)
    expect(resolveWorkWindowForCrop(SPECTER)?.appName).toBe('Google Chrome')
  })

  it('uses Cursor when no browser remembered', () => {
    expect(resolveWorkWindowForCrop(CURSOR)?.appName).toBe('Cursor')
  })

  it('scans browser on primary when Cursor is front on external', () => {
    const chromeOnPrimary = { ...CHROME, x: 80, y: 40 }
    const cursorOnExternal = { ...CURSOR, x: 1600, y: 0 }
    const primaryBounds = { x: 0, y: 0, width: 1440, height: 900 }

    const picked = resolveWorkWindowForCrop(cursorOnExternal, {
      browserWindows: [chromeOnPrimary],
      primaryBounds
    })

    expect(picked?.appName).toBe('Google Chrome')
    expect(picked?.windowTitle).toContain('123test')
  })

  it('prefers quiz title when multiple browsers exist', () => {
    const quiz = { ...CHROME, windowTitle: '123test.com IQ Test' }
    const other = {
      ...CHROME,
      x: 200,
      y: 200,
      windowTitle: 'Gmail',
      pid: 124
    }
    expect(pickBestBrowserWindow([other, quiz])?.windowTitle).toContain('123test')
  })
})
