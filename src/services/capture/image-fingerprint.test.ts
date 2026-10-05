import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { fingerprintImage } from './image-fingerprint'

async function image(color: number, compressionLevel: number) {
  return sharp({ create: { width: 128, height: 72, channels: 3, background: { r: color, g: color, b: color } } }).png({ compressionLevel }).toBuffer()
}

describe('visual fingerprint', () => {
  it('ignores encoding and small brightness noise, but detects a changed frame', async () => {
    const baseline = await fingerprintImage(await image(64, 0))
    expect(await fingerprintImage(await image(64, 9))).toBe(baseline)
    expect(await fingerprintImage(await image(65, 9))).toBe(baseline)
    expect(await fingerprintImage(await image(192, 9))).not.toBe(baseline)
  })
})
