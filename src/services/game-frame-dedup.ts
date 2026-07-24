import crypto from 'crypto'

/** 16×16 grayscale downscale hash — fast duplicate detection without extra deps at test time. */
export function hashFromRawPixels(raw: Buffer, width = 16, height = 16): string {
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16)
}

export async function fingerprintPng(pngBuffer: Buffer): Promise<string> {
  try {
    const sharp = require('sharp') as typeof import('sharp')
    const raw = await sharp(pngBuffer)
      .resize(16, 16, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer()
    return hashFromRawPixels(raw)
  } catch {
    return crypto.createHash('sha256').update(pngBuffer).digest('hex').slice(0, 16)
  }
}

export function shouldKeepFrame(newHash: string, lastKeptHash: string | null): boolean {
  if (!lastKeptHash) return true
  return newHash !== lastKeptHash
}

export interface BufferedFrame {
  timestamp: number
  hash: string
  pngBuffer: Buffer
}
