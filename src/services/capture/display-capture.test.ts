import { describe, expect, it } from 'vitest'
import {
  displayForWindow,
  displayAtScreenshotIndex,
  fallbackScreenshotDisplayIndex,
  screenshotIndexForDisplay,
  matchScreenshotDisplayIndex,
  normalizeDisplayName,
  planSmartCropCapture,
  type DisplayInfo
} from './display-capture'

const DUAL_MONITOR_DISPLAYS = [
  { id: 0, name: 'Color LCD', primary: true },
  { id: 1, name: 'VG27A', primary: false }
]

const DUAL_ELECTRON: DisplayInfo[] = [
  { id: 1, label: 'Color LCD', isPrimary: true, bounds: { x: 0, y: 0, width: 1440, height: 900 } },
  { id: 2, label: 'VG27A', isPrimary: false, bounds: { x: 1440, y: 0, width: 2560, height: 1440 } }
]

describe('normalizeDisplayName', () => {
  it('strips punctuation and case', () => {
    expect(normalizeDisplayName('ASUS VG27A (2560×1440)')).toBe('asusvg27a25601440')
  })
})

describe('matchScreenshotDisplayIndex', () => {
  it('matches exact monitor names', () => {
    expect(matchScreenshotDisplayIndex('VG27A', DUAL_MONITOR_DISPLAYS)).toBe(1)
  })

  it('matches when Electron label is more verbose', () => {
    expect(matchScreenshotDisplayIndex('ASUS VG27A', DUAL_MONITOR_DISPLAYS)).toBe(1)
  })

  it('matches built-in display', () => {
    expect(matchScreenshotDisplayIndex('Color LCD', DUAL_MONITOR_DISPLAYS)).toBe(0)
  })

  it('returns null when no display matches', () => {
    expect(matchScreenshotDisplayIndex('Unknown Monitor', DUAL_MONITOR_DISPLAYS)).toBeNull()
  })
})

describe('screenshotIndexForDisplay', () => {
  const displays = [{ id: 2 }, { id: 1 }]

  it('numbers the primary display 0 and the external display 1', () => {
    expect(screenshotIndexForDisplay(displays, 1, 1)).toBe(0)
    expect(screenshotIndexForDisplay(displays, 1, 2)).toBe(1)
  })
})

describe('displayAtScreenshotIndex', () => {
  const displays = [{ id: 2 }, { id: 1 }]

  it('puts the primary display at index 0', () => {
    expect(displayAtScreenshotIndex(displays, 1, 0)?.id).toBe(1)
    expect(displayAtScreenshotIndex(displays, 1, 1)?.id).toBe(2)
  })
})

describe('fallbackScreenshotDisplayIndex', () => {
  it('uses index 0 for primary display', () => {
    expect(fallbackScreenshotDisplayIndex(true, DUAL_MONITOR_DISPLAYS)).toBe(0)
  })

  it('uses first non-primary display for secondary monitor', () => {
    expect(fallbackScreenshotDisplayIndex(false, DUAL_MONITOR_DISPLAYS)).toBe(1)
  })
})

const SINGLE_ELECTRON: DisplayInfo[] = [
  { id: 1, label: 'Built-in Retina', isPrimary: true, bounds: { x: 0, y: 0, width: 3024, height: 1964 } }
]

describe('planSmartCropCapture', () => {
  const gameWindow = { x: 1440, y: 0, width: 2560, height: 1440 }
  const browserOnPrimary = { x: 100, y: 100, width: 1200, height: 800 }

  it('crops game window when focused on secondary monitor', () => {
    const plan = planSmartCropCapture(gameWindow, DUAL_ELECTRON)
    expect(plan?.type).toBe('window-crop')
    if (plan?.type === 'window-crop') {
      expect(plan.display.label).toBe('VG27A')
    }
  })

  it('crops browser when focused on primary in dual setup', () => {
    const plan = planSmartCropCapture(browserOnPrimary, DUAL_ELECTRON)
    expect(plan).toEqual({
      type: 'window-crop',
      window: browserOnPrimary,
      display: DUAL_ELECTRON[0]
    })
  })

  it('captures full primary when no active window on dual setup', () => {
    const plan = planSmartCropCapture(null, DUAL_ELECTRON)
    expect(plan).toEqual({ type: 'display-full', display: DUAL_ELECTRON[0] })
  })

  it('single monitor crops focused window', () => {
    const cursorWindow = { x: 0, y: 0, width: 2560, height: 1410 }
    const plan = planSmartCropCapture(cursorWindow, SINGLE_ELECTRON)
    expect(plan).toEqual({
      type: 'window-crop',
      window: cursorWindow,
      display: SINGLE_ELECTRON[0]
    })
  })

  it('single monitor uses full primary when no window', () => {
    const plan = planSmartCropCapture(null, SINGLE_ELECTRON)
    expect(plan).toEqual({ type: 'display-full', display: SINGLE_ELECTRON[0] })
  })
})

describe('displayForWindow', () => {
  it('maps window center to the correct monitor', () => {
    const display = displayForWindow({ x: 1500, y: 200, width: 800, height: 600 }, DUAL_ELECTRON)
    expect(display?.label).toBe('VG27A')
  })
})
