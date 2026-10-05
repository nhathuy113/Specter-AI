import { DEFAULT_SETTINGS } from '../../shared/constants'
import type { UserSettings } from '../../shared/types'
import type { AiProviderId } from './contracts'

interface ProviderSettings {
  modelKey: keyof UserSettings
  keyKey?: keyof UserSettings
  defaultModel: string
  missingKeyError?: string
}

const definitions: Record<AiProviderId, ProviderSettings> = {
  openrouter: {
    modelKey: 'selectedModel', keyKey: 'openrouterApiKey', defaultModel: DEFAULT_SETTINGS.selectedModel,
    missingKeyError: 'No OpenRouter API key configured. Open Settings and add your key from openrouter.ai/keys.'
  },
  openai: {
    modelKey: 'openaiModel', keyKey: 'openaiApiKey', defaultModel: DEFAULT_SETTINGS.openaiModel,
    missingKeyError: 'No OpenAI API key configured. Open Settings and add your OpenAI API key.'
  },
  gemini: {
    modelKey: 'geminiModel', keyKey: 'geminiApiKey', defaultModel: DEFAULT_SETTINGS.geminiModel,
    missingKeyError: 'No Gemini API key configured. Open Settings and add your key from aistudio.google.com/apikey.'
  },
  codex: { modelKey: 'codexModel', defaultModel: DEFAULT_SETTINGS.codexModel }
}

export type SettingsReader = (key: string) => unknown
export interface AiConfigStatus { configured: boolean; provider: AiProviderId; error?: string }

export function readAiConnection(provider: AiProviderId, read: SettingsReader) {
  const definition = definitions[provider]
  const model = read(definition.modelKey)
  const apiKey = definition.keyKey ? read(definition.keyKey) : ''
  return {
    model: typeof model === 'string' && model ? model : definition.defaultModel,
    apiKey: typeof apiKey === 'string' ? apiKey : ''
  }
}

export function checkAiConfiguration(read: SettingsReader): AiConfigStatus {
  const selected = read('aiProvider') || DEFAULT_SETTINGS.aiProvider
  if (typeof selected !== 'string' || !Object.hasOwn(definitions, selected)) {
    return { configured: false, provider: DEFAULT_SETTINGS.aiProvider, error: 'Unknown AI provider. Choose a provider in Settings.' }
  }
  const provider = selected as AiProviderId
  const definition = definitions[provider]
  const key = definition.keyKey ? read(definition.keyKey) : undefined
  if (definition.keyKey && (typeof key !== 'string' || !key)) {
    return { configured: false, provider, error: definition.missingKeyError }
  }
  return { configured: true, provider }
}
