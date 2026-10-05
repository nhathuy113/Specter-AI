import { parseCapturePreviewOptions } from '../../services/capture/capture-preview'
import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { validateGeminiApiKey } from '../../services/ai/gemini-api'
import { checkAiConfig } from '../../services/ai/ai-config'
import { captureScreenText, captureScreenOnly, captureAutoFocusPreview } from '../screen-capture'
import { transcribeAudio, checkWhisperConfig } from '../audio-capture'

export function registerCaptureIpcHandlers(checkRateLimit: (channel: string) => boolean): void {
  // Screen capture (with OCR)
  ipcMain.handle(IPC_CHANNELS.SCREEN_CAPTURE, async () => {
    try {
      return await captureScreenText()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Screen capture failed'
      throw new Error(message)
    }
  })

  // Screen capture preview (no OCR, just screenshot)
  ipcMain.handle(IPC_CHANNELS.SCREEN_CAPTURE_PREVIEW, async () => {
    try {
      return await captureScreenOnly()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Screen capture failed'
      throw new Error(message)
    }
  })

  ipcMain.handle(IPC_CHANNELS.SCREEN_CAPTURE_AUTO_PREVIEW, async (_event, options: unknown) => {
    try {
      return await captureAutoFocusPreview(parseCapturePreviewOptions(options))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Screen capture failed'
      throw new Error(message)
    }
  })

  // AI config check — called on overlay load and before AI actions
  ipcMain.handle(IPC_CHANNELS.AI_CHECK_CONFIG, () => {
    return checkAiConfig()
  })

  ipcMain.handle(IPC_CHANNELS.GEMINI_VALIDATE_KEY, async (_event, apiKey: unknown) => {
    if (typeof apiKey !== 'string' || !apiKey.trim()) {
      return { valid: false, error: 'API key is empty.' }
    }
    return validateGeminiApiKey(apiKey.trim())
  })

  // Audio config check — called before starting recording to give immediate feedback
  ipcMain.handle(IPC_CHANNELS.AUDIO_CHECK_CONFIG, () => {
    return checkWhisperConfig()
  })

  // Audio transcription — receives audio buffer from renderer's MediaRecorder
  // Electron IPC can deliver ArrayBuffer as Buffer, Uint8Array, or ArrayBuffer depending on version
  ipcMain.handle(IPC_CHANNELS.AUDIO_TRANSCRIBE, async (_event, audioData: unknown, mimeType: string) => {
    // Rate limit
    if (!checkRateLimit(IPC_CHANNELS.AUDIO_TRANSCRIBE)) {
      throw new Error('Transcription rate limit exceeded. Please wait.')
    }

    // Validate mimeType is a string
    if (typeof mimeType !== 'string' || mimeType.length > 100) {
      throw new Error('Invalid MIME type')
    }

    try {
      let buffer: Buffer
      if (Buffer.isBuffer(audioData)) {
        buffer = audioData
      } else if (audioData instanceof ArrayBuffer) {
        buffer = Buffer.from(audioData)
      } else if (ArrayBuffer.isView(audioData)) {
        buffer = Buffer.from(audioData.buffer, audioData.byteOffset, audioData.byteLength)
      } else {
        buffer = Buffer.from(audioData as ArrayBuffer)
      }
      const text = await transcribeAudio(buffer, mimeType || 'audio/webm;codecs=opus')
      return text
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Transcription failed'
      throw new Error(message)
    }
  })

}
