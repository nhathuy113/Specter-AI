import { beforeEach, describe, expect, it, vi } from 'vitest'
import { checkAiConfig } from './ai-config'

vi.mock('../settings/store', () => ({
  getSetting: vi.fn()
}))

import { getSetting } from '../settings/store'

const mockedGetSetting = vi.mocked(getSetting)

describe('checkAiConfig', () => {
  beforeEach(() => {
    mockedGetSetting.mockReset()
  })

  it('requires OpenRouter key by default', () => {
    mockedGetSetting.mockImplementation((key: string) => {
      if (key === 'aiProvider') return 'openrouter'
      if (key === 'openrouterApiKey') return ''
      return undefined
    })

    const status = checkAiConfig()
    expect(status.configured).toBe(false)
    expect(status.error).toMatch(/OpenRouter API key/i)
  })

  it('passes when OpenRouter key is set', () => {
    mockedGetSetting.mockImplementation((key: string) => {
      if (key === 'aiProvider') return 'openrouter'
      if (key === 'openrouterApiKey') return 'sk-or-test'
      return undefined
    })

    expect(checkAiConfig().configured).toBe(true)
  })

  it('requires OpenAI key when that provider is selected', () => {
    mockedGetSetting.mockImplementation((key: string) => {
      if (key === 'aiProvider') return 'openai'
      if (key === 'openaiApiKey') return ''
      return undefined
    })

    const status = checkAiConfig()
    expect(status.configured).toBe(false)
    expect(status.error).toMatch(/OpenAI API key/i)
  })

  it('requires Gemini key when that provider is selected', () => {
    mockedGetSetting.mockImplementation((key: string) => {
      if (key === 'aiProvider') return 'gemini'
      if (key === 'geminiApiKey') return ''
      return undefined
    })

    const status = checkAiConfig()
    expect(status.configured).toBe(false)
    expect(status.error).toMatch(/Gemini API key/i)
  })

  it('treats Codex as configured without an API key', () => {
    mockedGetSetting.mockImplementation((key: string) => {
      if (key === 'aiProvider') return 'codex'
      return undefined
    })

    expect(checkAiConfig()).toEqual({ configured: true, provider: 'codex' })
  })
})
