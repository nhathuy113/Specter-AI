import { describe, expect, it } from 'vitest'
import { VG27A_DUAL_MONITOR } from '../capture/smart-capture'
import { resolveOverlayFitBounds } from './overlay-fit'

describe('overlay fit', () => {
  it('keeps the dragged position when a prompt grows the panel', () => {
    const display = VG27A_DUAL_MONITOR[1]
    const next = resolveOverlayFitBounds(
      { mode: 'panel', width: 360, height: 420 },
      display,
      { x: 1800, y: 400, width: 420, height: 600 }
    )
    expect(next.x).toBe(1800)
    expect(next.y).toBe(400)
  })

  it('keeps a position above the display when the panel is resized', () => {
    const display = VG27A_DUAL_MONITOR[1]
    const next = resolveOverlayFitBounds(
      { mode: 'panel', width: 400, height: 400 },
      display,
      { x: 1528, y: -329, width: 844, height: 1295 }
    )
    expect(next).toMatchObject({ x: 1528, y: -329 })
  })
})
