import type { Rectangle } from 'electron'
import {
  WORK_COACH_TRIPLE_MIN_WIDTH,
  OVERLAY_DEFAULTS
} from '../shared/constants'
import {
  computeExpandedOverlayBounds,
  computePillOverlayBounds,
  type OverlayDisplayLike
} from './overlay-placement'

export type OverlayFitMode = 'pill' | 'panel' | 'work-triple'

export interface OverlayFitRequest {
  mode: OverlayFitMode
  width: number
  height: number
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function workArea(display: OverlayDisplayLike, margin = 16) {
  return {
    x: display.bounds.x + margin,
    y: display.bounds.y + margin,
    width: display.bounds.width - margin * 2,
    height: display.bounds.height - margin * 2
  }
}

/** Map measured renderer content to Electron window bounds. */
export function resolveOverlayFitBounds(
  req: OverlayFitRequest,
  display: OverlayDisplayLike,
  current: Rectangle
): Rectangle {
  const area = workArea(display)

  if (req.mode === 'pill') {
    const width = clamp(Math.ceil(req.width + 24), 220, 360)
    const height = clamp(Math.ceil(req.height + 10), 52, 80)
    return computePillOverlayBounds(display, width, height)
  }

  const minWidth = req.mode === 'work-triple' ? WORK_COACH_TRIPLE_MIN_WIDTH : 380
  const maxWidth = area.width
  const minHeight = req.mode === 'work-triple' ? 440 : 320
  const maxHeight = Math.floor(area.height * 0.92)

  const width = clamp(Math.ceil(req.width + 28), minWidth, maxWidth)
  const height = clamp(Math.ceil(req.height + 20), minHeight, maxHeight)

  let x = current.x
  let y = current.y

  const looksDefault =
    current.width <= OVERLAY_DEFAULTS.width + 40 && current.height <= OVERLAY_DEFAULTS.height + 40
  if (looksDefault || x < area.x || y < area.y) {
    return computeExpandedOverlayBounds(display, width, height)
  }

  if (x + width > area.x + area.width) x = area.x + area.width - width
  if (y + height > area.y + area.height) y = area.y + area.height - height
  if (x < area.x) x = area.x
  if (y < area.y) y = area.y

  return { x, y, width, height }
}
