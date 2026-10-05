import type { Rectangle } from 'electron'
import { WORK_COACH_DUAL_MIN_WIDTH } from '../../shared/constants'
import { type OverlayDisplayLike } from './overlay-placement'

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
    return { x: current.x, y: current.y, width, height }
  }

  const minWidth = req.mode === 'work-triple' ? WORK_COACH_DUAL_MIN_WIDTH : 380
  const maxWidth = area.width
  const minHeight = req.mode === 'work-triple' ? 440 : 320
  const maxHeight = Math.floor(area.height * 0.92)

  const width = clamp(Math.ceil(req.width + 28), minWidth, maxWidth)
  const height = clamp(Math.ceil(req.height + 20), minHeight, maxHeight)

  return { x: current.x, y: current.y, width, height }
}
