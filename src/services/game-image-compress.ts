import fs from 'fs'
import path from 'path'
import type { GameBlockFrame, GameBlockManifest } from './game-capture-store'

export interface EncodeWebpOptions {
  webpQuality?: number
}

/** PNG capture buffer → WebP for disk (game mode stores WebP only). */
export async function encodePngBufferToWebp(
  pngBuffer: Buffer,
  opts: EncodeWebpOptions = {}
): Promise<Buffer> {
  const quality = opts.webpQuality ?? 35
  const sharp = require('sharp') as typeof import('sharp')
  return sharp(pngBuffer).webp({ quality, effort: 4, smartSubsample: true }).toBuffer()
}

export function frameFileCandidates(frame: GameBlockFrame, blockDir: string): string[] {
  const names = [frame.imageFile, frame.webpFile, frame.pngFile].filter(Boolean) as string[]
  return names.map((n) => path.join(blockDir, n))
}

/** Prefer largest keyframe on disk (skips empty/black leftovers). */
export function pickBestKeyframePath(
  block: GameBlockManifest,
  blockDir: string
): string | null {
  let bestPath: string | null = null
  let bestSize = 0

  for (const frame of block.frames) {
    for (const p of frameFileCandidates(frame, blockDir)) {
      if (!fs.existsSync(p)) continue
      const size = fs.statSync(p).size
      if (size > bestSize) {
        bestSize = size
        bestPath = p
      }
    }
  }

  return bestPath
}
