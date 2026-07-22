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

export function isDualMonitorSetup(displays: DisplayInfo[]): boolean {
  return displays.length > 1
}

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
 * Smart crop — auto-detects single vs dual monitor:
 * - Dual: focused window on secondary → crop; focus on primary / none → full secondary
 * - Single: crop focused window, or full primary if none
 */
export function planSmartCropCapture(
  activeWindow: WindowRect | null,
  displays: DisplayInfo[]
): SmartCropPlan | null {
  if (displays.length === 0) return null

  const primary = displays.find((d) => d.isPrimary) ?? displays[0]
  const secondary = displays.find((d) => !d.isPrimary) ?? null

  if (activeWindow) {
    const windowDisplay = displayForWindow(activeWindow, displays) ?? primary

    if (secondary && windowDisplay.id !== primary.id) {
      return { type: 'window-crop', window: activeWindow, display: windowDisplay }
    }

    if (secondary) {
      return { type: 'display-full', display: secondary }
    }

    return { type: 'window-crop', window: activeWindow, display: windowDisplay }
  }

  if (secondary) {
    return { type: 'display-full', display: secondary }
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
