import { describe, expect, it } from 'vitest'
import { hashFromRawPixels, shouldKeepFrame } from './game-frame-dedup'

describe('game-frame-dedup', () => {
  it('skips identical hashes', () => {
    const h = hashFromRawPixels(Buffer.alloc(256, 1))
    expect(shouldKeepFrame(h, h)).toBe(false)
    expect(shouldKeepFrame(h, null)).toBe(true)
  })
})
