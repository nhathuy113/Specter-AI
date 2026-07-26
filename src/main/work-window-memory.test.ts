import { describe, expect, it, beforeEach } from 'vitest'
import {
  getRememberedWorkWindow,
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

  it('remembers non-Specter window', () => {
    rememberWorkWindow(CHROME)
    expect(getRememberedWorkWindow()?.appName).toBe('Google Chrome')
  })

  it('ignores Specter foreground', () => {
    rememberWorkWindow(SPECTER)
    expect(getRememberedWorkWindow()).toBeNull()
  })

  it('resolveWorkWindowForCrop falls back when Specter is front', () => {
    rememberWorkWindow(CHROME)
    expect(resolveWorkWindowForCrop(SPECTER)).toEqual(CHROME)
  })

  it('resolveWorkWindowForCrop prefers live Chrome', () => {
    rememberWorkWindow({ ...CHROME, windowTitle: 'old tab' })
    const live = { ...CHROME, windowTitle: 'new tab' }
    expect(resolveWorkWindowForCrop(live)?.windowTitle).toBe('new tab')
  })
})
