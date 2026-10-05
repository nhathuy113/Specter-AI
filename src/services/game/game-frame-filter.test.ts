import { describe, expect, it } from 'vitest'
import { shouldSkipWindowTitle } from './game-frame-filter'

describe('game-frame-filter', () => {
  it('skips generic launcher/loader window titles', () => {
    expect(shouldSkipWindowTitle('Paradox Launcher')).toBe(true)
    expect(shouldSkipWindowTitle('Loading...')).toBe(true)
    expect(shouldSkipWindowTitle('Hearts of Iron IV')).toBe(false)
    expect(shouldSkipWindowTitle('Stellaris')).toBe(false)
  })
})
