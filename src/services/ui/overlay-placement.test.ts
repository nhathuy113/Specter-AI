import { describe, expect, it } from 'vitest'
import { VG27A_DUAL_MONITOR } from '../capture/smart-capture'
import {
  computeExpandedOverlayBounds,
  computePillOverlayBounds,
  isPillSizedBounds,
  pickOverlayTargetDisplay
} from './overlay-placement'
import { OVERLAY_DEFAULTS } from '../../shared/constants'

describe('overlay-placement', () => {
  it('targets external monitor for overlay UI when dual setup', () => {
    const target = pickOverlayTargetDisplay(VG27A_DUAL_MONITOR, 1)
    expect(target.label).toBe('VG27A')
    expect(target.isPrimary).toBe(false)
  })

  it('anchors expanded overlay left + vertically centered on external display', () => {
    const external = VG27A_DUAL_MONITOR[1]
    const bounds = computeExpandedOverlayBounds(external)
    expect(bounds.x).toBe(external.bounds.x + OVERLAY_DEFAULTS.margin)
    expect(bounds.y).toBe(external.bounds.y + Math.round((external.bounds.height - OVERLAY_DEFAULTS.height) / 2))
    expect(bounds.width).toBe(OVERLAY_DEFAULTS.width)
    expect(bounds.height).toBe(OVERLAY_DEFAULTS.height)
  })

  it('anchors pill left + vertically centered on external display', () => {
    const external = VG27A_DUAL_MONITOR[1]
    const pill = computePillOverlayBounds(external, 250, 56, 16)
    expect(pill.x).toBe(external.bounds.x + 16)
    expect(pill.y).toBe(external.bounds.y + Math.round((external.bounds.height - 56) / 2))
    expect(pill.width).toBe(250)
    expect(pill.height).toBe(56)
  })

  it('detects pill-sized bounds for background watch mode', () => {
    expect(isPillSizedBounds({ width: 250, height: 56 })).toBe(true)
    expect(isPillSizedBounds({ width: 420, height: 600 })).toBe(false)
  })
})
