import { describe, expect, it, vi } from 'vitest'
import { createTranscriptionService } from './transcription-service'
import type { TranscriptionRequest } from './transcription-service'
import { checkWhisperConfiguration, readWhisperConnection } from './whisper-configuration'
import { createTranscriptBuffer } from './transcript-buffer'

const audio = new Uint8Array(1024)
const read = (key: string): unknown => ({ whisperProvider: 'groq', whisperApiKey: 'key', language: 'vi' })[key]

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail })
  return { promise, resolve, reject }
}

describe('transcription service', () => {
  it('passes configuration, format and language through a transport port', async () => {
    const transport = vi.fn(async () => ' Xin chào ')
    const service = createTranscriptionService(read, transport)
    expect(await service.transcribeAudio(audio, ' AUDIO/WEBM ; codecs=opus ')).toBe('Xin chào')
    expect(service.getTranscript()).toBe('Xin chào')
    expect(transport).toHaveBeenCalledWith(expect.objectContaining({
      connection: { apiKey: 'key', url: 'https://api.groq.com/openai/v1/audio/transcriptions', model: 'whisper-large-v3-turbo' },
      mimeType: 'audio/webm', extension: 'webm', language: 'vi', audio
    }))
  })

  it('skips small chunks and rejects excessive sizes and invalid MIME before sending', async () => {
    const transport = vi.fn(async () => '')
    const service = createTranscriptionService(read, transport)
    expect(await service.transcribeAudio(new Uint8Array(1023), 'audio/webm')).toBe('')
    await expect(service.transcribeAudio(new Uint8Array(25 * 1024 * 1024 + 1), 'audio/webm')).rejects.toThrow('Maximum is 25MB')
    for (const mime of ['audio/webm-malicious', 'audio/wavx', 'toString']) {
      await expect(service.transcribeAudio(audio, mime)).rejects.toThrow('Unsupported audio format')
    }
    expect(transport).not.toHaveBeenCalled()
  })

  it('aborts every pending chunk on clear and suppresses late success and failure', async () => {
    const first = deferred<string>(), second = deferred<string>()
    const requests: TranscriptionRequest[] = []
    const service = createTranscriptionService(read, request => {
      requests.push(request)
      return requests.length === 1 ? first.promise : second.promise
    })
    const a = service.transcribeAudio(audio, 'audio/wav')
    const b = service.transcribeAudio(audio, 'audio/wav')
    service.appendTranscript('old meeting')
    service.clearTranscript()
    expect(requests.every(request => request.signal.aborted)).toBe(true)
    first.resolve('late old text')
    second.reject(new Error('late old failure'))
    expect(await Promise.all([a, b])).toEqual(['', ''])
    expect(service.getTranscript()).toBe('')
  })

  it('finishing one chunk retains cancellation of another; new sessions remain usable', async () => {
    const second = deferred<string>()
    const requests: TranscriptionRequest[] = []
    const service = createTranscriptionService(read, request => {
      requests.push(request)
      return requests.length === 2 ? second.promise : Promise.resolve('new text')
    })
    const first = service.transcribeAudio(audio, 'audio/wav')
    const pending = service.transcribeAudio(audio, 'audio/wav')
    await first
    service.clearTranscript()
    expect(requests[1].signal.aborted).toBe(true)
    await expect(service.transcribeAudio(audio, 'audio/wav')).resolves.toBe('new text')
    second.resolve('old text')
    await expect(pending).resolves.toBe('')
    expect(service.getTranscript()).toBe('new text')
  })

  it('preserves transcript on API failure and rejects missing configuration', async () => {
    const service = createTranscriptionService(read, async () => { throw new Error('offline') })
    service.appendTranscript('previous')
    await expect(service.transcribeAudio(audio, 'audio/wav')).rejects.toThrow('offline')
    expect(service.getTranscript()).toBe('previous')
    const missing = createTranscriptionService(() => undefined, vi.fn())
    await expect(missing.transcribeAudio(audio, 'audio/wav')).rejects.toThrow('No Groq API key')
  })
})

describe('Whisper configuration', () => {
  it('uses the dedicated key and configured custom model', () => {
    const settings: Record<string, unknown> = { whisperProvider: 'custom', whisperApiKey: 'whisper', whisperApiUrl: 'https://example.com/audio', whisperModel: 'custom-model', openrouterApiKey: 'other' }
    expect(readWhisperConnection(key => settings[key])).toEqual({ url: settings.whisperApiUrl, apiKey: 'whisper', model: 'custom-model' })
    delete settings.whisperApiKey
    expect(readWhisperConnection(key => settings[key])).toBeNull()
    expect(checkWhisperConfiguration(key => settings[key]).configured).toBe(false)
  })

  it('rejects unknown providers and invalid custom endpoints consistently', () => {
    for (const provider of ['toString', 'unknown']) {
      const settings: Record<string, string> = { whisperProvider: provider, whisperApiKey: 'key' }
      expect(checkWhisperConfiguration(key => settings[key]).configured).toBe(false)
      expect(readWhisperConnection(key => settings[key])).toBeNull()
    }
    for (const url of ['http://example.com', 'https://localhost', 'https://[::1]', 'https://127.0.0.1', 'https://10.1.2.3', 'https://app.internal']) {
      const settings: Record<string, string> = { whisperProvider: 'custom', whisperApiKey: 'key', whisperApiUrl: url }
      expect(checkWhisperConfiguration(key => settings[key]).configured, url).toBe(false)
      expect(readWhisperConnection(key => settings[key]), url).toBeNull()
    }
  })
})

describe('transcript buffer', () => {
  it('sanitizes control characters, retains Unicode and bounds the rolling buffer', () => {
    const buffer = createTranscriptBuffer()
    buffer.append('Xin\u0000 chào')
    expect(buffer.get()).toBe('Xin chào')
    buffer.append('123456789', 5)
    expect(buffer.get()).toBe('56789')
    buffer.append('zero limit', 0)
    expect(buffer.get()).toBe('')
    buffer.append('fresh')
    buffer.clear()
    expect(buffer.get()).toBe('')
    expect(createTranscriptBuffer().get()).toBe('')
  })
})
