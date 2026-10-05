import { describe, expect, it } from 'vitest'
import { isLiveDevRenderer, macDockPolicy } from './mac-dock-policy'

describe('mac dock policy', () => {
  it('hides the Dock in prod and keeps it in live dev', () => {
    expect(macDockPolicy(false)).toEqual({ activation: 'accessory', showDock: false })
    expect(macDockPolicy(true)).toEqual({ activation: 'regular', showDock: true })
  })

  it('treats a renderer url as live dev', () => {
    expect(isLiveDevRenderer(undefined)).toBe(false)
    expect(isLiveDevRenderer('')).toBe(false)
    expect(isLiveDevRenderer('http://localhost:5173')).toBe(true)
  })
})
