import sharp from 'sharp'
import { createHash } from 'crypto'

/** Hash a small, quantized luminance image, ignoring PNG encoding and metadata. */
export async function fingerprintImage(image: Buffer): Promise<string> {
  const pixels = await sharp(image).resize(256, 144, { fit: 'fill' }).removeAlpha().greyscale().raw().toBuffer()
  for (let index = 0; index < pixels.length; index++) pixels[index] >>= 4
  return createHash('sha256').update(pixels).digest('hex')
}
