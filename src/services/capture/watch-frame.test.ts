import { describe, expect, it } from 'vitest'
import { isWatchFrame } from './watch-frame'

describe('watch frame', () => {
  it('accepts a draggable rectangle and rejects the empty default', () => {
    expect(isWatchFrame({ x: 10, y: 20, width: 800, height: 500 })).toBe(true)
    expect(isWatchFrame({ x: 0, y: 0, width: 0, height: 0 })).toBe(false)
    expect(isWatchFrame(null)).toBe(false)
  })
})

import { clampWatchFrame, resizeWatchFrame, hitWatchFrame, planWatchFrameCapture } from './watch-frame'

it('keeps the opposite edge fixed at minimum size when shrinking north/west', () => {
  expect(resizeWatchFrame({ x: 100, y: 100, width: 200, height: 200 }, 'nw', 500, 500)).toEqual({ x: 220, y: 220, width: 80, height: 80 })
})

it('clamps negative monitor coordinates and oversized saved frames into the display', () => {
  const frame = clampWatchFrame({ x: -5000, y: -5000, width: 9999, height: 9999 }, { x: -1920, y: 0, width: 1920, height: 1080 })
  expect(frame).toEqual({ x: -1900, y: 20, width: 1880, height: 1040 })
  expect(clampWatchFrame({ x: 0, y: 0, width: 800, height: 800 }, { x: 0, y: 0, width: 90, height: 90 })).toEqual({ x: 5, y: 5, width: 80, height: 80 })
})

it('hit-tests the border and label without intercepting the center', () => {
  expect(hitWatchFrame(100, 100, 800, 500)).toBeNull()
  expect(hitWatchFrame(100, 20, 800, 500)).toBe('move')
  expect(hitWatchFrame(100, 2, 800, 500)).toBe('n')
  expect(hitWatchFrame(790, 490, 800, 500)).toBe('se')
  expect(hitWatchFrame(-1, 100, 800, 500)).toBeNull()
})

it('plans a single-monitor crop and recovers saved rectangles after monitor removal', () => {
  const primary = { id: 1, label: 'Primary', isPrimary: true, bounds: { x: 0, y: 0, width: 1000, height: 800 } }
  const external = { id: 2, label: 'External', isPrimary: false, bounds: { x: -1000, y: 0, width: 1000, height: 800 } }
  const frame = { x: -900, y: 50, width: 800, height: 500 }
  expect(planWatchFrameCapture(frame, [primary, external])?.display.id).toBe(2)
  const fallback = planWatchFrameCapture(frame, [primary])
  expect(fallback).toMatchObject({ display: primary, window: { x: 20, y: 50, width: 800, height: 500 } })
  expect(planWatchFrameCapture(frame, [])).toBeNull()
})
