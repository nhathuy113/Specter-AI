import {
  isDualMonitorSetup,
  planSmartCropCapture,
  type DisplayInfo,
  type SmartCropPlan,
  type WindowRect
} from './display-capture'

export { isDualMonitorSetup } from './display-capture'

const IGNORED_ALWAYS = ['specter', 'electron']
const IGNORED_ON_DUAL_ONLY = ['cursor', 'google ai studio']

export function shouldIgnoreActiveWindow(title: string, displays?: DisplayInfo[]): boolean {
  const lower = title.toLowerCase()
  if (IGNORED_ALWAYS.some((needle) => lower.includes(needle))) return true
  if (displays && !isDualMonitorSetup(displays)) return false
  return IGNORED_ON_DUAL_ONLY.some((needle) => lower.includes(needle))
}

/**
 * Resolve smart-capture plan — auto-detects single vs dual monitor:
 * - Dual: game on external → crop that window; IDE on laptop → full external monitor
 * - Single: crop focused window, or full primary if Specter has focus
 */
export function resolveSmartCapturePlan(
  activeWindow: (WindowRect & { title?: string }) | null,
  displays: DisplayInfo[]
): SmartCropPlan | null {
  let windowForPlan: WindowRect | null = activeWindow

  if (activeWindow?.title && shouldIgnoreActiveWindow(activeWindow.title, displays)) {
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

/** User's dual-monitor layout: MacBook primary + VG27A secondary (2560×1440). */
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
