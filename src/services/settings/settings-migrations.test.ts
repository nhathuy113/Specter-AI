import { describe, expect, it, vi } from 'vitest'
import { migrateSettings } from './settings-migrations'
import { DEFAULT_SETTINGS, DEFAULT_SYSTEM_PROMPT } from '../../shared/constants'

function fixture(initial: Record<string, unknown>) {
  const values = new Map(Object.entries(initial))
  const set = vi.fn((key: string, value: unknown) => { values.set(key, value) })
  return { values, store: { get: (key: string) => values.get(key), set } }
}

describe('settings migrations', () => {
  it('adds missing hotkeys while preserving customized shortcuts and is idempotent', () => {
    const { store, values } = fixture({ hotkeys: { toggleOverlay: 'custom' } })
    migrateSettings(store)
    expect(values.get('hotkeys')).toEqual({ ...DEFAULT_SETTINGS.hotkeys, toggleOverlay: 'custom' })
    store.set.mockClear()
    migrateSettings(store)
    expect(store.set).not.toHaveBeenCalled()
  })

  it('preserves customized prompts and opacity', () => {
    const { store, values } = fixture({ systemPrompt: 'my custom instructions', overlayOpacity: 0.6, hotkeys: DEFAULT_SETTINGS.hotkeys })
    migrateSettings(store)
    expect(values.get('systemPrompt')).toBe('my custom instructions')
    expect(values.get('overlayOpacity')).toBe(0.6)
    expect(store.set).not.toHaveBeenCalled()
  })

  it('upgrades known old factory defaults', () => {
    const { store, values } = fixture({
      systemPrompt: `You are a real-time AI assistant helping the user during meetings, interviews, and work sessions.
You have access to what's on their screen and what's being said.
Give concise, immediately actionable responses.
Format responses for quick reading: use short paragraphs and bullet points.
Never reveal that you are an AI assistant unless directly asked.`, overlayOpacity: 0.85
    })
    migrateSettings(store)
    expect(values.get('systemPrompt')).toBe(DEFAULT_SYSTEM_PROMPT)
    expect(values.get('overlayOpacity')).toBe(DEFAULT_SETTINGS.overlayOpacity)
  })
})
