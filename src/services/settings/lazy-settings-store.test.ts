import { describe, expect, it, vi } from 'vitest'
import { createLazySettingsStore } from './lazy-settings-store'

describe('settings store initialization', () => {
  it('loads and migrates only once, on first use', () => {
    const store = {}
    const load = vi.fn(() => store), migrate = vi.fn(), recover = vi.fn()
    const getStore = createLazySettingsStore({ load, migrate, recover })
    expect(load).not.toHaveBeenCalled()
    expect(getStore()).toBe(store)
    expect(getStore()).toBe(store)
    expect(load).toHaveBeenCalledOnce()
    expect(migrate).toHaveBeenCalledWith(store)
    expect(migrate).toHaveBeenCalledOnce()
    expect(recover).not.toHaveBeenCalled()
  })

  it('recovers a failed load and migrates the recovered store', () => {
    const error = new Error('invalid config'), recovered = {}
    const migrate = vi.fn(), recover = vi.fn(() => recovered)
    const getStore = createLazySettingsStore({ load: () => { throw error }, migrate, recover })
    expect(getStore()).toBe(recovered)
    expect(recover).toHaveBeenCalledWith(error)
    expect(migrate).toHaveBeenCalledWith(recovered)
  })

  it('does not treat migration failure as corruption or cache partial initialization', () => {
    const migrate = vi.fn().mockImplementationOnce(() => { throw new Error('migration failed') })
    const recover = vi.fn(), load = vi.fn(() => ({}))
    const getStore = createLazySettingsStore({ load, migrate, recover })
    expect(() => getStore()).toThrow('migration failed')
    expect(recover).not.toHaveBeenCalled()
    expect(getStore()).toEqual({})
    expect(load).toHaveBeenCalledTimes(2)
  })
})
