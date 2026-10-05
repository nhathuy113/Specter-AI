import { describe, expect, it } from 'vitest'
import { mayAutoShowWatchFrame, nextWatchFrameBorder } from './watch-frame-border-policy'

describe('watch frame border policy', () => {
  it('toggles only while watch wants a border', () => {
    expect(nextWatchFrameBorder(false, true)).toBe('ignore')
    expect(nextWatchFrameBorder(false, false)).toBe('ignore')
    expect(nextWatchFrameBorder(true, true)).toBe('hide')
    expect(nextWatchFrameBorder(true, false)).toBe('show')
  })

  it('does not auto-show a border the user closed', () => {
    expect(mayAutoShowWatchFrame(true)).toBe(false)
    expect(mayAutoShowWatchFrame(false)).toBe(true)
  })
})
