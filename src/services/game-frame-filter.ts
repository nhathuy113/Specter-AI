/** Generic game-frame filters — no per-game config. */

export const SKIP_WINDOW_TITLE =
  /\b(launcher|loading|splash|updating|connecting|initializing|please wait|press any key|boot sequence)\b/i

export function shouldSkipWindowTitle(windowTitle: string): boolean {
  return SKIP_WINDOW_TITLE.test(windowTitle.trim())
}

export interface FrameStats {
  mean: number
  variance: number
}

export async function frameStats(pngBuffer: Buffer): Promise<FrameStats> {
  const sharp = require('sharp') as typeof import('sharp')
  const { data } = await sharp(pngBuffer)
    .resize(32, 32, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true })

  let sum = 0
  for (let i = 0; i < data.length; i++) sum += data[i]!
  const mean = sum / data.length / 255

  let varSum = 0
  for (let i = 0; i < data.length; i++) {
    const d = data[i]! / 255 - mean
    varSum += d * d
  }
  return { mean, variance: varSum / data.length }
}

export interface SkipFrameResult {
  skip: boolean
  reason?: string
}

/** Drop launcher titles, black/white flashes, and low-content warmup frames. */
export async function shouldSkipGameFrame(
  pngBuffer: Buffer,
  windowTitle: string,
  sessionAgeMs: number,
  warmupSec = 45
): Promise<SkipFrameResult> {
  if (shouldSkipWindowTitle(windowTitle)) {
    return { skip: true, reason: 'launcher-title' }
  }

  const { mean, variance } = await frameStats(pngBuffer)
  if (mean < 0.06) return { skip: true, reason: 'black-frame' }
  if (mean > 0.97 && variance < 0.002) return { skip: true, reason: 'white-flash' }

  if (sessionAgeMs < warmupSec * 1000 && variance < 0.008 && mean < 0.3) {
    return { skip: true, reason: 'warmup-static' }
  }

  return { skip: false }
}
