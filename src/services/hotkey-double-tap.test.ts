import { describe, expect, it } from 'vitest'
import {
  ACTIVE_TAB_DOUBLE_TAP_MS,
  nextActiveTabPressMs,
  shouldFireActiveTabDoubleTap
} from './hotkey-double-tap'

describe('hotkey double-tap gate', () => {
  it('requires second press within 450ms', () => {
    expect(ACTIVE_TAB_DOUBLE_TAP_MS).toBe(450)
    expect(shouldFireActiveTabDoubleTap(1000, 1200)).toBe('double-tap')
    expect(shouldFireActiveTabDoubleTap(1000, 1451)).toBe('first-tap')
    expect(shouldFireActiveTabDoubleTap(0, 500)).toBe('first-tap')
  })

  it('resets timer after double-tap', () => {
    expect(nextActiveTabPressMs('double-tap', 2000)).toBe(0)
    expect(nextActiveTabPressMs('first-tap', 2000)).toBe(2000)
  })
})
