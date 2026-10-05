export interface ScreenshotDisplayInfo {
  id: number
  name: string
  primary?: boolean
}

/** Normalize monitor names for fuzzy matching (Electron label vs system_profiler). */
export function normalizeDisplayName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

/**
 * Map an Electron display label to screenshot-desktop's screen index.
 * screenshot-desktop on macOS orders displays with primary first (id 0).
 */
export function matchScreenshotDisplayIndex(
  displayLabel: string,
  displays: ScreenshotDisplayInfo[]
): number | null {
  const normalizedLabel = normalizeDisplayName(displayLabel)
  if (!normalizedLabel) return null

  for (const display of displays) {
    const normalizedName = normalizeDisplayName(display.name)
    if (!normalizedName) continue
    if (
      normalizedLabel === normalizedName ||
      normalizedLabel.includes(normalizedName) ||
      normalizedName.includes(normalizedLabel)
    ) {
      return display.id
    }
  }

  return null
}

/** Index of an Electron display in screenshot-desktop order: primary, then the others. */
export function screenshotIndexForDisplay(displays: { id: number }[], primaryId: number, displayId: number): number {
  const primary = displays.find((display) => display.id === primaryId)
  const ordered = primary ? [primary, ...displays.filter((display) => display.id !== primaryId)] : displays
  const index = ordered.findIndex((display) => display.id === displayId)
  return index >= 0 ? index : 0
}

/** screenshot-desktop index 0 is the primary display, then the others. */
export function displayAtScreenshotIndex<T extends { id: number }>(
  displays: T[],
  primaryId: number,
  index: number
): T | undefined {
  const primary = displays.find((display) => display.id === primaryId)
  const ordered = primary ? [primary, ...displays.filter((display) => display.id !== primaryId)] : displays
  return ordered[index] ?? ordered[0]
}

/** Fallback when name matching fails — primary is always index 0 in screenshot-desktop. */
export function fallbackScreenshotDisplayIndex(
  isPrimary: boolean,
  displays: ScreenshotDisplayInfo[]
): number {
  if (isPrimary) return 0

  const nonPrimary = displays.find((d) => !d.primary)
  if (nonPrimary) return nonPrimary.id

  return displays.length > 1 ? 1 : 0
}

export interface DisplayBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface DisplayInfo {
  id: number
  label: string
  bounds: DisplayBounds
  isPrimary: boolean
}

export interface WindowRect {
  x: number
  y: number
  width: number
  height: number
}

export type SmartCropPlan =
  | { type: 'window-crop'; window: WindowRect; display: DisplayInfo }
  | { type: 'display-full'; display: DisplayInfo }

/** Find the display whose bounds contain the window center. */
export function displayForWindow(window: WindowRect, displays: DisplayInfo[]): DisplayInfo | null {
  if (displays.length === 0) return null

  const centerX = window.x + window.width / 2
  const centerY = window.y + window.height / 2

  for (const display of displays) {
    const b = display.bounds
    if (
      centerX >= b.x &&
      centerX < b.x + b.width &&
      centerY >= b.y &&
      centerY < b.y + b.height
    ) {
      return display
    }
  }

  return displays.find((d) => d.isPrimary) ?? displays[0]
}

/**
 * Smart crop — same rules for 1 or 2+ monitors:
 * - Focused window → crop that window on its display
 * - No window → full primary display
 */
export function planSmartCropCapture(
  activeWindow: WindowRect | null,
  displays: DisplayInfo[]
): SmartCropPlan | null {
  if (displays.length === 0) return null

  const primary = displays.find((d) => d.isPrimary) ?? displays[0]

  if (activeWindow) {
    const windowDisplay = displayForWindow(activeWindow, displays) ?? primary
    return { type: 'window-crop', window: activeWindow, display: windowDisplay }
  }

  return { type: 'display-full', display: primary }
}

export async function resolveScreenshotScreenIndexForDisplay(
  display: DisplayInfo,
  listDisplays: () => Promise<ScreenshotDisplayInfo[]>
): Promise<number> {
  return resolveScreenshotScreenIndex(display.label, display.isPrimary, listDisplays)
}

export async function resolveScreenshotScreenIndex(
  displayLabel: string,
  isPrimary: boolean,
  listDisplays: () => Promise<ScreenshotDisplayInfo[]>
): Promise<number> {
  const displays = await listDisplays()
  if (displays.length === 0) {
    return fallbackScreenshotDisplayIndex(isPrimary, displays)
  }

  const matched = matchScreenshotDisplayIndex(displayLabel, displays)
  if (matched !== null) return matched

  return fallbackScreenshotDisplayIndex(isPrimary, displays)
}
