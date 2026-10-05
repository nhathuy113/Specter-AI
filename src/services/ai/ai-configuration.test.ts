import { describe, expect, it, vi } from 'vitest'
import { checkAiConfiguration, readAiConnection } from './ai-configuration'
import { completionCost, completionModelLabel } from './completion-pricing'
import { DEFAULT_SETTINGS } from '../../shared/constants'
import type { AiProviderId } from './contracts'

describe('provider configuration policy', () => {
  it.each([
    ['gemini', 'geminiModel', 'geminiApiKey'], ['openai', 'openaiModel', 'openaiApiKey'],
    ['openrouter', 'selectedModel', 'openrouterApiKey']
  ] as const)('reads only %s connection settings', (provider, modelKey, keyKey) => {
    const read = vi.fn((key: string) => ({ [modelKey]: 'chosen-model', [keyKey]: 'secret' })[key])
    expect(readAiConnection(provider, read)).toEqual({ model: 'chosen-model', apiKey: 'secret' })
    expect(read.mock.calls.map(([key]) => key)).toEqual([modelKey, keyKey])
  })

  it('Codex uses its default model and needs no API key', () => {
    const read = vi.fn(() => undefined)
    expect(readAiConnection('codex', read)).toEqual({ model: DEFAULT_SETTINGS.codexModel, apiKey: '' })
    expect(read.mock.calls).toEqual([['codexModel']])
  })

  it('rejects a corrupt or inherited provider name before dispatch', () => {
    for (const provider of ['toString', 'unknown', 123]) {
      expect(checkAiConfiguration(key => key === 'aiProvider' ? provider : 'key').configured).toBe(false)
    }
  })

  it('keeps provider model labels and zero cost for unpriced models', () => {
    expect(completionModelLabel('openrouter', 'vendor/model')).toBe('vendor/model')
    expect(completionModelLabel('gemini', 'chosen')).toBe('gemini/chosen')
    for (const provider of ['codex', 'openai', 'gemini', 'openrouter'] as AiProviderId[]) expect(completionCost(provider, 'unknown', 100, 200)).toBe(0)
    expect(completionCost('openrouter', 'custom/model', 100, 200, [{ id: 'custom/model', pricing: { prompt: '0.01', completion: '0.02' } } as never])).toBe(5)
  })
})
