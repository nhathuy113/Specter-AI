const extensions: Record<string, string> = {
  'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'mp4',
  'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/flac': 'flac'
}

export function readAudioFormat(mimeType: unknown): { mimeType: string; extension: string } {
  const normalized = typeof mimeType === 'string' ? mimeType.toLowerCase().trim() : ''
  const base = normalized.split(';', 1)[0].trim()
  if (!Object.hasOwn(extensions, base)) {
    throw new Error(`Unsupported audio format: ${String(mimeType).slice(0, 50)}`)
  }
  return { mimeType: base, extension: extensions[base] }
}

export function validateAudioSize(audio: Uint8Array): boolean {
  if (audio.byteLength > 25 * 1024 * 1024) {
    throw new Error(`Audio chunk too large (${Math.round(audio.byteLength / 1024 / 1024)}MB). Maximum is 25MB.`)
  }
  return audio.byteLength >= 1024
}
