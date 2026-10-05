import { DEFAULT_MODELS, GEMINI_MODELS } from '../../shared/constants'
import type { AiProviderId } from './contracts'
import type { OpenRouterModel } from '../../shared/types'

const OPENAI_MODEL_PRICING: Record<string, { prompt: string; completion: string }> = {
  'gpt-5.5': { prompt: '0.000005', completion: '0.00003' },
  'gpt-5.5-pro': { prompt: '0.00003', completion: '0.00018' },
  'gpt-5.4': { prompt: '0.0000025', completion: '0.000015' },
  'gpt-5.4-mini': { prompt: '0.00000075', completion: '0.0000045' },
  'gpt-5.4-nano': { prompt: '0.0000002', completion: '0.00000125' },
  'chat-latest': { prompt: '0.000005', completion: '0.00003' }
}

const GEMINI_MODEL_PRICING: Record<string, { prompt: string; completion: string }> = Object.fromEntries(
  GEMINI_MODELS.map((m) => [m.id, m.pricing])
)

export function completionModelLabel(provider: AiProviderId, model: string): string {
  return provider === 'openrouter' ? model : `${provider}/${model}`
}

export function completionCost(provider: AiProviderId, model: string, promptTokens: number, completionTokens: number, cachedModels: OpenRouterModel[] = []): number {
  const pricing = provider === 'openrouter'
    ? (DEFAULT_MODELS.find(m => m.id === model) || cachedModels.find(m => m.id === model))?.pricing
    : provider === 'openai' ? OPENAI_MODEL_PRICING[model]
    : provider === 'gemini' ? GEMINI_MODEL_PRICING[model] : undefined
  return promptTokens * parseFloat(pricing?.prompt || '0') + completionTokens * parseFloat(pricing?.completion || '0')
}
