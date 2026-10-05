export interface WatchFrame {
  x: number
  y: number
  width: number
  height: number
}

export type FrameEdge = 'move' | 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se'
export const MIN_FRAME_SIZE = 80

/** Zero-size defaults, non-finite values and unbounded IPC rectangles are ignored. */
export function isWatchFrame(value: unknown): value is WatchFrame {
  if (!value || typeof value !== 'object') return false
  const frame = value as WatchFrame
  return [frame.x, frame.y, frame.width, frame.height].every(
    n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1_000_000
  ) && frame.width >= MIN_FRAME_SIZE && frame.height >= MIN_FRAME_SIZE
}

export function clampWatchFrame(frame: WatchFrame, area: WatchFrame): WatchFrame {
  const marginX = Math.max(0, Math.min(20, (area.width - MIN_FRAME_SIZE) / 2))
  const marginY = Math.max(0, Math.min(20, (area.height - MIN_FRAME_SIZE) / 2))
  const width = Math.round(Math.min(Math.max(MIN_FRAME_SIZE, frame.width), area.width - marginX * 2))
  const height = Math.round(Math.min(Math.max(MIN_FRAME_SIZE, frame.height), area.height - marginY * 2))
  return {
    x: Math.round(Math.min(Math.max(frame.x, area.x + marginX), area.x + area.width - width - marginX)),
    y: Math.round(Math.min(Math.max(frame.y, area.y + marginY), area.y + area.height - height - marginY)),
    width, height
  }
}

export function resizeWatchFrame(start: WatchFrame, edge: FrameEdge, dx: number, dy: number): WatchFrame {
  if (edge === 'move') return { ...start, x: Math.round(start.x + dx), y: Math.round(start.y + dy) }
  const width = Math.round(Math.max(MIN_FRAME_SIZE, start.width + (edge.includes('w') ? -dx : edge.includes('e') ? dx : 0)))
  const height = Math.round(Math.max(MIN_FRAME_SIZE, start.height + (edge.includes('n') ? -dy : edge.includes('s') ? dy : 0)))
  return {
    x: edge.includes('w') ? start.x + start.width - width : start.x,
    y: edge.includes('n') ? start.y + start.height - height : start.y,
    width, height
  }
}

export function hitWatchFrame(x: number, y: number, width: number, height: number): FrameEdge | null {
  if (x < 0 || y < 0 || x > width || y > height) return null
  const left = x <= 14, right = x >= width - 14, top = y <= 14, bottom = y >= height - 14
  if (top && left) return 'nw'
  if (top && right) return 'ne'
  if (bottom && left) return 'sw'
  if (bottom && right) return 'se'
  if (top) return 'n'
  if (y <= 28) return 'move'
  if (bottom) return 's'
  if (left) return 'w'
  if (right) return 'e'
  return null
}

export function planWatchFrameCapture(frame: unknown, displays: import('./display-capture').DisplayInfo[]): import('./display-capture').SmartCropPlan | null {
  if (!isWatchFrame(frame) || displays.length === 0) return null
  const overlap = (area: WatchFrame) => Math.max(0, Math.min(frame.x + frame.width, area.x + area.width) - Math.max(frame.x, area.x)) *
    Math.max(0, Math.min(frame.y + frame.height, area.y + area.height) - Math.max(frame.y, area.y))
  const display = [...displays].sort((a, b) => overlap(b.bounds) - overlap(a.bounds))[0]
  const target = overlap(display.bounds) > 0 ? display : displays.find(display => display.isPrimary) ?? display
  return { type: 'window-crop', display: target, window: clampWatchFrame(frame, target.bounds) }
}
