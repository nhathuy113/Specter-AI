import type { DisplayInfo, SmartCropPlan } from './display-capture'

/** Always capture a pinned monitor (full display), ignoring keyboard focus. */
export function planPinnedWorkDisplay(
  displays: DisplayInfo[],
  displayId: number | null | undefined
): SmartCropPlan | null {
  if (displays.length === 0) return null
  let display = displayId ? displays.find((d) => d.id === displayId) : undefined
  if (!display) {
    display = displays.find((d) => d.isPrimary) ?? displays[0]
  }
  if (!display) return null
  return { type: 'display-full', display }
}

export function workAreaCaptureActive(
  enabled: boolean | undefined,
  displayId: number | null | undefined
): boolean {
  return !!enabled && (typeof displayId !== 'number' || displayId >= 0)
}
