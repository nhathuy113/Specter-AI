import { readAudioFormat, validateAudioSize } from './audio-format'
import { checkWhisperConfiguration, readWhisperConnection } from './whisper-configuration'
import type { SettingsReader, WhisperConnection } from './whisper-configuration'
import { createTranscriptBuffer } from './transcript-buffer'

export interface TranscriptionRequest {
  connection: WhisperConnection
  audio: Uint8Array
  mimeType: string
  extension: string
  language?: string
  signal: AbortSignal
}
export type TranscriptionTransport = (request: TranscriptionRequest) => Promise<string>

export function createTranscriptionService(read: SettingsReader, transcribe: TranscriptionTransport) {
  const transcript = createTranscriptBuffer()
  const pending = new Set<AbortController>()
  let generation = 0

  return {
    checkConfiguration: () => checkWhisperConfiguration(read),
    appendTranscript: transcript.append,
    getTranscript: transcript.get,
    clearTranscript(): void {
      generation++
      transcript.clear()
      for (const controller of pending) controller.abort()
      pending.clear()
    },
    async transcribeAudio(audio: Uint8Array, mimeType: string): Promise<string> {
      const connection = readWhisperConnection(read)
      if (!connection) {
        throw new Error(checkWhisperConfiguration(read).error || 'Whisper not configured. Set a Whisper API key in Settings > Audio Transcription.')
      }
      if (!validateAudioSize(audio)) return ''
      const format = readAudioFormat(mimeType)
      const configuredLanguage = read('language')
      const language = typeof configuredLanguage === 'string' && /^[a-z]{2,3}$/i.test(configuredLanguage) ? configuredLanguage : undefined
      const controller = new AbortController()
      const version = generation
      pending.add(controller)
      try {
        const text = (await transcribe({ connection, audio, ...format, language, signal: controller.signal })).trim()
        if (version !== generation) return ''
        if (text) transcript.append(text)
        return text
      } catch (error) {
        if (version !== generation) return ''
        throw error
      } finally {
        pending.delete(controller)
      }
    }
  }
}
