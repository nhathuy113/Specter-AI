import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { getSetting, setSetting } = vi.hoisted(() => ({
  getSetting: vi.fn(),
  setSetting: vi.fn()
}))

vi.mock('./store', () => ({
  getSetting,
  setSetting
}))

import { bootstrapSettingsFromEnv } from './env-bootstrap'

describe('bootstrapSettingsFromEnv', () => {
  const env = process.env

  beforeEach(() => {
    vi.resetAllMocks()
    process.env = { ...env }
    getSetting.mockReturnValue(undefined)
  })

  afterEach(() => {
    process.env = env
  })

  it('seeds gemini key when store is empty', () => {
    process.env.GEMINI_API_KEY = 'AIza-test-key'
    getSetting.mockImplementation((key: string) => {
      if (key === 'geminiApiKey') return ''
      return undefined
    })

    bootstrapSettingsFromEnv()

    expect(setSetting).toHaveBeenCalledWith('geminiApiKey', 'AIza-test-key')
    expect(setSetting).toHaveBeenCalledWith('aiProvider', 'gemini')
  })

  it('seeds assistant and perception modes from env', () => {
    process.env.ASSISTANT_MODE = 'game'
    process.env.PERCEPTION_MODE = 'vision'

    bootstrapSettingsFromEnv()

    expect(setSetting).toHaveBeenCalledWith('assistantMode', 'game')
    expect(setSetting).toHaveBeenCalledWith('perceptionMode', 'vision')
  })

  it('ignores invalid assistant mode values', () => {
    process.env.ASSISTANT_MODE = 'invalid-mode'

    bootstrapSettingsFromEnv()

    expect(setSetting).not.toHaveBeenCalledWith('assistantMode', expect.anything())
  })

  it('ignores removed work assistant mode', () => {
    process.env.ASSISTANT_MODE = 'work'

    bootstrapSettingsFromEnv()

    expect(setSetting).not.toHaveBeenCalledWith('assistantMode', expect.anything())
  })

  it('syncs gemini key when env differs from store', () => {
    process.env.GEMINI_API_KEY = 'AIza-new'
    getSetting.mockImplementation((key: string) => {
      if (key === 'geminiApiKey') return 'AIza-existing'
      return undefined
    })

    bootstrapSettingsFromEnv()

    expect(setSetting).toHaveBeenCalledWith('geminiApiKey', 'AIza-new')
  })
})
