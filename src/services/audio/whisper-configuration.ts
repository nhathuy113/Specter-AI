export type SettingsReader = (key: string) => unknown
export interface WhisperConnection { url: string; model: string; apiKey: string }

function readString(read: SettingsReader, key: string): string {
  const value = read(key)
  return typeof value === 'string' ? value : ''
}

// Whisper endpoint configs
const WHISPER_ENDPOINTS = {
  groq: {
    url: 'https://api.groq.com/openai/v1/audio/transcriptions',
    model: 'whisper-large-v3-turbo'
  },
  openai: {
    url: 'https://api.openai.com/v1/audio/transcriptions',
    model: 'whisper-1'
  }
} as const

/**
 * Validate that a URL is HTTPS and points to an expected domain.
 */
function validateWhisperUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    // Must be HTTPS
    if (parsed.protocol !== 'https:') return false
    // Block localhost/internal network to prevent SSRF
    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '')
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.') ||
      hostname.startsWith('192.168.') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      return false
    }
    return true
  } catch {
    return false
  }
}

/**
 * Check whether Whisper transcription is properly configured.
 * Call this before starting recording to give the user immediate feedback.
 */
export function checkWhisperConfiguration(read: SettingsReader): { configured: boolean; provider: string; error?: string } {
  const provider = readString(read, 'whisperProvider') || 'groq'
  if (!['groq', 'openai', 'custom'].includes(provider)) {
    return { configured: false, provider, error: 'Unknown transcription provider. Choose a provider in Settings.' }
  }
  const whisperApiKey = readString(read, 'whisperApiKey') || ''

  if (!whisperApiKey) {
    const providerName = provider === 'groq' ? 'Groq' : provider === 'openai' ? 'OpenAI' : 'Whisper'
    return {
      configured: false,
      provider,
      error: `No ${providerName} API key set. Go to Settings > Audio Transcription to add your key.${
        provider === 'groq' ? ' Get a free key at console.groq.com' : ''
      }`
    }
  }

  if (provider === 'custom') {
    const customUrl = readString(read, 'whisperApiUrl') || ''
    if (!customUrl) {
      return { configured: false, provider, error: 'Custom Whisper endpoint URL is not set. Configure it in Settings.' }
    }
    if (!validateWhisperUrl(customUrl)) {
      return { configured: false, provider, error: 'Custom Whisper endpoint must be a valid HTTPS URL. Local/internal addresses are not allowed.' }
    }
  }

  return { configured: true, provider }
}

/**
 * Get the Whisper API endpoint and key based on user settings.
 *
 * Supports three providers:
 * - 'groq'   (default) — free tier via Groq Cloud (whisper-large-v3-turbo)
 * - 'openai'           — OpenAI Whisper API (whisper-1), requires OpenAI key
 * - 'custom'           — user-specified URL + model
 *
 * Users get a free Groq key at https://console.groq.com
 */
export function readWhisperConnection(read: SettingsReader): WhisperConnection | null {
  const provider = readString(read, 'whisperProvider') || 'groq'
  if (!['groq', 'openai', 'custom'].includes(provider)) return null
  const whisperApiKey = readString(read, 'whisperApiKey') || ''

  // Do NOT fall back to OpenRouter key — it won't work with Groq or OpenAI endpoints
  if (!whisperApiKey) {
    return null
  }

  if (provider === 'custom') {
    const customUrl = readString(read, 'whisperApiUrl') || ''
    const customModel = readString(read, 'whisperModel') || 'whisper-1'
    if (!customUrl) return null
    // Validate custom URL before using it
    if (!validateWhisperUrl(customUrl)) return null
    return { url: customUrl, model: customModel, apiKey: whisperApiKey }
  }

  const endpoint = WHISPER_ENDPOINTS[provider as keyof typeof WHISPER_ENDPOINTS]
    || WHISPER_ENDPOINTS.groq

  return { url: endpoint.url, model: endpoint.model, apiKey: whisperApiKey }
}
