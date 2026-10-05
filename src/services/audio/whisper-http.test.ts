import { afterEach, describe, expect, it, vi } from 'vitest'
import { createWhisperHttpTransport } from './whisper-http'
import type { TranscriptionRequest } from './transcription-service'

function input(signal = new AbortController().signal): TranscriptionRequest {
  // A subarray verifies the multipart file contains only the requested chunk.
  return { connection: { url: 'https://example.com/transcribe', model: 'whisper', apiKey: 'secret' },
    audio: new Uint8Array([9, 1, 2, 3, 9]).subarray(1, 4), mimeType: 'audio/wav', extension: 'wav', language: 'vi', signal }
}

afterEach(() => vi.useRealTimers())

describe('Whisper HTTP adapter', () => {
  it('sends an in-memory multipart file and trims the returned text', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ text: ' hello ' }))
    expect(await createWhisperHttpTransport(request)(input())).toBe('hello')
    const [url, options] = request.mock.calls[0]
    expect(url).toBe('https://example.com/transcribe')
    expect(options?.headers).toEqual({ Authorization: 'Bearer secret' })
    const body = options?.body as FormData
    expect(body.get('model')).toBe('whisper')
    expect(body.get('language')).toBe('vi')
    const file = body.get('file') as File
    expect(file.name).toBe('audio.wav')
    expect(file.type).toBe('audio/wav')
    expect(Array.from(new Uint8Array(await file.arrayBuffer()))).toEqual([1, 2, 3])
  })

  it('skips rate limits and malformed success payloads', async () => {
    for (const response of [new Response('', { status: 429 }), Response.json(null), Response.json({ text: 123 })]) {
      expect(await createWhisperHttpTransport(vi.fn<typeof fetch>().mockResolvedValue(response))(input())).toBe('')
    }
  })

  it.each([[401, 'key is invalid'], [403, 'key is invalid'], [413, 'chunk too large'], [500, 'Whisper API error 500']])('maps HTTP %s to a useful error', async (status, message) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response('failed', { status }))
    await expect(createWhisperHttpTransport(request)(input())).rejects.toThrow(message)
  })

  it('aborts on timeout and releases the deadline after success', async () => {
    vi.useFakeTimers()
    const request = vi.fn<typeof fetch>().mockImplementation(async (_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
    }))
    const result = createWhisperHttpTransport(request)(input())
    const assertion = expect(result).rejects.toThrow('timed out after 30 seconds')
    await vi.advanceTimersByTimeAsync(30_000)
    await assertion
    expect(vi.getTimerCount()).toBe(0)
    await createWhisperHttpTransport(vi.fn<typeof fetch>().mockResolvedValue(Response.json({ text: 'ok' })))(input())
    expect(vi.getTimerCount()).toBe(0)
  })

  it('forwards session cancellation and detaches its listener', async () => {
    const controller = new AbortController()
    const remove = vi.spyOn(controller.signal, 'removeEventListener')
    const request = vi.fn<typeof fetch>().mockImplementation(async (_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
    }))
    const result = createWhisperHttpTransport(request)(input(controller.signal))
    const assertion = expect(result).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    await assertion
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
  })
})
