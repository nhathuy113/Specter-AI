import { describe, expect, it, vi } from 'vitest'
import { createSettingsRepository } from './settings-repository'
import { DEFAULT_SETTINGS } from '../../shared/constants'

function fixture() {
  const values = new Map<string, unknown>(Object.entries(DEFAULT_SETTINGS))
  const persistence = { get: (key: string) => values.get(key), set: vi.fn((key: string, value: unknown) => { values.set(key, value) }), clear: vi.fn(() => values.clear()) }
  const codec = { encrypt: vi.fn((value: string) => `encrypted:${value}`), decrypt: vi.fn((value: string) => value.replace(/^encrypted:/, '')) }
  return { values, persistence, codec, repository: createSettingsRepository(() => persistence, codec) }
}

describe('settings repository', () => {
  it('encrypts all API keys and returns the same decrypted values in individual and aggregate reads', () => {
    const { repository, values, codec } = fixture()
    const keys = ['openrouterApiKey', 'openaiApiKey', 'geminiApiKey', 'whisperApiKey'] as const
    for (const key of keys) {
      repository.setSetting(key, 'private-key')
      expect(values.get(key)).toBe('encrypted:private-key')
      expect(repository.getSetting(key)).toBe('private-key')
      expect(repository.getAllSettings()[key]).toBe('private-key')
    }
    expect(codec.encrypt).toHaveBeenCalledTimes(keys.length)
    repository.setSetting('selectedModel', 'model')
    expect(values.get('selectedModel')).toBe('model')
    expect(codec.encrypt).toHaveBeenCalledTimes(keys.length)
  })

  it('rejects invalid or inherited settings without touching persistence', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const { repository, persistence, codec } = fixture()
      repository.setSetting('overlayOpacity', 2)
      repository.setSetting('toString', 'inherited')
      repository.setSetting('openaiApiKey', 123)
      expect(persistence.set).not.toHaveBeenCalled()
      expect(codec.encrypt).not.toHaveBeenCalled()
    } finally { warning.mockRestore() }
  })

  it('keeps persistence lazy until use and resets through its clear capability', () => {
    const { persistence, codec } = fixture()
    const load = vi.fn(() => persistence)
    const repository = createSettingsRepository(load, codec)
    expect(load).not.toHaveBeenCalled()
    repository.resetSettings()
    expect(persistence.clear).toHaveBeenCalledOnce()
  })

  it('projects exactly the public settings contract', () => {
    const { repository } = fixture()
    expect(repository.getAllSettings()).toEqual(expect.objectContaining({ workAreaCaptureEnabled: false, workAreaDisplayId: 0 }))
    expect(repository.getAllSettings()).not.toHaveProperty('conversations')
    expect(repository.getAllSettings()).not.toHaveProperty('activityJournalLog')
  })
})
