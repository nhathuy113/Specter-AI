import type { TranscriptionTransport } from './transcription-service'

// Only the HTTP adapter knows multipart bodies, status codes and request deadlines.
export function createWhisperHttpTransport(request: typeof fetch = fetch, timeoutMs = 30_000): TranscriptionTransport {
  return async ({ connection, audio, mimeType, extension, language, signal }) => {
    const controller = new AbortController()
    const cancel = () => controller.abort()
    signal.addEventListener('abort', cancel, { once: true })
    if (signal.aborted) cancel()
    const timeout = setTimeout(cancel, timeoutMs)
    try {
      const bytes = new ArrayBuffer(audio.byteLength)
      new Uint8Array(bytes).set(audio)
      const body = new FormData()
      body.append('file', new Blob([bytes], { type: mimeType }), `audio.${extension}`)
      body.append('model', connection.model)
      if (language) body.append('language', language)
      const response = await request(connection.url, {
        method: 'POST', headers: { Authorization: `Bearer ${connection.apiKey}` },
        body, signal: controller.signal
      })
      if (response.ok) {
        const data: unknown = await response.json()
        return data && typeof data === 'object' && 'text' in data && typeof data.text === 'string' ? data.text.trim() : ''
      }
      if (response.status === 429) return ''
      if (response.status === 401 || response.status === 403) {
        throw new Error('Whisper API key is invalid or expired. Check Settings > Audio Transcription.')
      }
      if (response.status === 413) throw new Error('Audio chunk too large for Whisper API. Try a shorter recording interval.')
      const errorBody = await response.text().catch(() => '')
      throw new Error(`Whisper API error ${response.status}: ${errorBody.slice(0, 200) || response.statusText}`)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError' && !signal.aborted) {
        throw new Error(`Whisper transcription timed out after ${timeoutMs / 1000} seconds. Check your network connection.`)
      }
      if (error instanceof Error) throw error
      throw new Error(`Transcription failed: ${String(error)}`)
    } finally {
      clearTimeout(timeout)
      signal.removeEventListener('abort', cancel)
    }
  }
}
