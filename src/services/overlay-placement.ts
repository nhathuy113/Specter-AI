import { screen, type Display, type Rectangle } from 'electron'
import { OVERLAY_DEFAULTS } from '../shared/constants'

export interface OverlayDisplayLike {
  id: number
  label?: string
  bounds: { x: number; y: number; width: number; height: number }
  isPrimary?: boolean
}

/** Overlay UI on external monitor when available; capture may still use primary MacBook. */
export function pickOverlayTargetDisplay(
  displays: OverlayDisplayLike[],
  primaryId: number
): OverlayDisplayLike {
  if (displays.length === 0) {
    throw new Error('No displays')
  }
  if (displays.length === 1) return displays[0]
  return displays.find((d) => d.id !== primaryId) ?? displays[0]
}

export function computeExpandedOverlayBounds(
  display: OverlayDisplayLike,
  winWidth = OVERLAY_DEFAULTS.width,
  winHeight = OVERLAY_DEFAULTS.height,
  margin = OVERLAY_DEFAULTS.margin
): Rectangle {
  const b = display.bounds
  return {
    x: b.x + margin,
    y: b.y + Math.max(margin, Math.round((b.height - winHeight) / 2)),
    width: winWidth,
    height: winHeight
  }
}

export function computePillOverlayBounds(
  display: OverlayDisplayLike,
  pillWidth: number,
  pillHeight: number,
  margin = 16
): Rectangle {
  const b = display.bounds
  return {
    x: b.x + margin,
    y: b.y + Math.round((b.height - pillHeight) / 2),
    width: pillWidth,
    height: pillHeight
  }
}

export function isPillSizedBounds(bounds: Pick<Rectangle, 'width' | 'height'>, pillWidth = 250, pillHeight = 56): boolean {
  return bounds.width <= pillWidth + 24 && bounds.height <= pillHeight + 24
}

export function getOverlayTargetDisplay(): Display {
  const displays = screen.getAllDisplays()
  const primary = screen.getPrimaryDisplay()
  if (displays.length <= 1) return primary
  return displays.find((d) => d.id !== primary.id) ?? primary
}

export function defaultExpandedOverlayBounds(
  winWidth = OVERLAY_DEFAULTS.width,
  winHeight = OVERLAY_DEFAULTS.height
): Rectangle {
  const displays = screen.getAllDisplays()
  const primary = screen.getPrimaryDisplay()
  const target = pickOverlayTargetDisplay(displays, primary.id)
  return computeExpandedOverlayBounds(target, winWidth, winHeight)
}

export function defaultPillOverlayBounds(
  pillWidth: number,
  pillHeight: number,
  margin = 16
): Rectangle {
  const displays = screen.getAllDisplays()
  const primary = screen.getPrimaryDisplay()
  const target = pickOverlayTargetDisplay(displays, primary.id)
  return computePillOverlayBounds(target, pillWidth, pillHeight, margin)
}
