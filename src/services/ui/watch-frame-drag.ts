import { resizeWatchFrame, type FrameEdge, type WatchFrame } from '../capture/watch-frame'

interface Point { x: number; y: number }

export function createWatchFrameDrag(readBounds: () => Promise<WatchFrame>, publish: (frame: WatchFrame) => void) {
  let generation = 0
  let drag: { edge: FrameEdge; origin: Point; bounds: WatchFrame } | undefined
  let pointer: Point | undefined
  return {
    async begin(edge: FrameEdge, origin: Point): Promise<void> {
      const current = ++generation
      pointer = origin
      drag = undefined
      let bounds: WatchFrame
      try { bounds = await readBounds() }
      catch (error) { if (current !== generation) return; throw error }
      if (current !== generation) return
      drag = { edge, origin, bounds }
      if (pointer) publish(resizeWatchFrame(bounds, edge, pointer.x - origin.x, pointer.y - origin.y))
    },
    move(point: Point): void {
      pointer = point
      if (drag) publish(resizeWatchFrame(drag.bounds, drag.edge, point.x - drag.origin.x, point.y - drag.origin.y))
    },
    end(): void {
      generation++
      drag = undefined
      pointer = undefined
    }
  }
}
