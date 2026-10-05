import { describe, expect, it } from 'vitest'
import { VG27A_DUAL_MONITOR } from './smart-capture'
import { planPinnedWorkDisplay, workAreaCaptureActive } from './work-area-capture'

describe('work-area-capture', () => {
  it('pins capture to a specific display', () => {
    const plan = planPinnedWorkDisplay(VG27A_DUAL_MONITOR, 2)
    expect(plan?.type).toBe('display-full')
    expect(plan?.display.label).toBe('VG27A')
  })

  it('requires enabled flag', () => {
    expect(workAreaCaptureActive(true, 2)).toBe(true)
    expect(workAreaCaptureActive(true, 0)).toBe(true)
    expect(workAreaCaptureActive(false, 2)).toBe(false)
  })

  it('falls back to primary when display id missing', () => {
    const plan = planPinnedWorkDisplay(VG27A_DUAL_MONITOR, 0)
    expect(plan?.display.isPrimary).toBe(true)
  })
})
