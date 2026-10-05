// Main-process composition root. Recording remains in the renderer.
import { getSetting } from '../services/settings/store'
import { createTranscriptionService } from '../services/audio/transcription-service'
import { createWhisperHttpTransport } from '../services/audio/whisper-http'

const service = createTranscriptionService(getSetting, createWhisperHttpTransport())

export const checkWhisperConfig = service.checkConfiguration
export const appendTranscript = service.appendTranscript
export const getTranscript = service.getTranscript
export const clearTranscript = service.clearTranscript

export async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
  if (!Buffer.isBuffer(audioBuffer)) throw new Error('Invalid audio data: expected a Buffer')
  return service.transcribeAudio(audioBuffer, mimeType)
}
