import {
  planSmartCropCapture,
  type DisplayInfo,
  type SmartCropPlan,
  type WindowRect
} from './display-capture'

const IGNORED_WINDOW_TITLES = ['specter', 'electron']

/** Only Specter overlay is ignored — same on 1 or 2 monitors. */
export function shouldIgnoreActiveWindow(title: string): boolean {
  const lower = title.toLowerCase()
  return IGNORED_WINDOW_TITLES.some((needle) => lower.includes(needle))
}

/**
 * Resolve smart-capture plan — identical rules for single and dual monitor.
 */
export function resolveSmartCapturePlan(
  activeWindow: (WindowRect & { title?: string }) | null,
  displays: DisplayInfo[]
): SmartCropPlan | null {
  let windowForPlan: WindowRect | null = activeWindow

  if (activeWindow?.title && shouldIgnoreActiveWindow(activeWindow.title)) {
    windowForPlan = null
  } else if (activeWindow) {
    const { title: _title, ...rect } = activeWindow
    windowForPlan = rect
  }

  return planSmartCropCapture(windowForPlan, displays)
}

/** Single built-in display (e.g. MacBook only). */
export const SINGLE_MONITOR: DisplayInfo[] = [
  { id: 1, label: 'Built-in Retina', isPrimary: true, bounds: { x: 0, y: 0, width: 3024, height: 1964 } }
]

/** Dual-monitor layout: MacBook primary + VG27A secondary (2560×1440). */
export const VG27A_DUAL_MONITOR: DisplayInfo[] = [
  { id: 1, label: 'Color LCD', isPrimary: true, bounds: { x: 0, y: 0, width: 1440, height: 900 } },
  { id: 2, label: 'VG27A', isPrimary: false, bounds: { x: 1440, y: 0, width: 2560, height: 1440 } }
]

export const HOI4_WINDOW_ON_SECONDARY: WindowRect & { title: string } = {
  x: 1440,
  y: 0,
  width: 2560,
  height: 1440,
  title: 'Hearts of Iron IV'
}

export const BROWSER_ON_PRIMARY: WindowRect & { title: string } = {
  x: 80,
  y: 40,
  width: 1280,
  height: 800,
  title: 'Google Chrome'
}

export const CURSOR_ON_SINGLE: WindowRect & { title: string } = {
  x: 0,
  y: 0,
  width: 2560,
  height: 1410,
  title: 'Cursor'
}

export const CURSOR_ON_DUAL_PRIMARY: WindowRect & { title: string } = {
  x: 80,
  y: 40,
  width: 1280,
  height: 800,
  title: 'Cursor'
}
