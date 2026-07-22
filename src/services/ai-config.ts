import { DEFAULT_SETTINGS } from '../shared/constants'
import { getSetting } from './store'

export interface AiConfigStatus {
  configured: boolean
  provider: 'openrouter' | 'openai' | 'gemini' | 'codex'
  error?: string
}

/**
 * Check whether the selected AI backend is ready to use.
 * Call before screen capture / coach ticks to fail fast with a clear message.
 */
export function checkAiConfig(): AiConfigStatus {
  const provider = getSetting<'openrouter' | 'openai' | 'gemini' | 'codex'>('aiProvider') || DEFAULT_SETTINGS.aiProvider

  if (provider === 'codex') {
    return { configured: true, provider }
  }

  if (provider === 'gemini') {
    const geminiApiKey = getSetting<string>('geminiApiKey') || ''
    if (!geminiApiKey) {
      return {
        configured: false,
        provider,
        error: 'No Gemini API key configured. Open Settings and add your key from aistudio.google.com/apikey.'
      }
    }
    return { configured: true, provider }
  }

  if (provider === 'openai') {
    const openaiApiKey = getSetting<string>('openaiApiKey') || ''
    if (!openaiApiKey) {
      return {
        configured: false,
        provider,
        error: 'No OpenAI API key configured. Open Settings and add your OpenAI API key.'
      }
    }
    return { configured: true, provider }
  }

  const openrouterApiKey = getSetting<string>('openrouterApiKey') || ''
  if (!openrouterApiKey) {
    return {
      configured: false,
      provider,
      error: 'No OpenRouter API key configured. Open Settings and add your key from openrouter.ai/keys.'
    }
  }

  return { configured: true, provider }
}
