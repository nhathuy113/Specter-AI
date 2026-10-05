import { describe, expect, it, vi } from 'vitest'
const exists = vi.hoisted(() => vi.fn())
vi.mock('fs', () => ({ default: { existsSync: exists } }))
import { cloakDeepseekProfileReady, selectCompletionRoute } from './completion-route'

describe('completion route', () => {
  it('routes coach requests based on an explicit readiness snapshot', () => {
    expect(selectCompletionRoute(true, 'gemini', true)).toBe('deepseek-cloak')
    expect(selectCompletionRoute(true, 'gemini', false)).toBe('gemini')
    expect(selectCompletionRoute(false, 'openai', true)).toBe('openai')
  })

  it('checks the profile through the filesystem adapter only for coach requests', () => {
    exists.mockReturnValue(true)
    expect(cloakDeepseekProfileReady()).toBe(true)
    expect(selectCompletionRoute(true, 'gemini')).toBe('deepseek-cloak')
    exists.mockClear()
    expect(selectCompletionRoute(false, 'gemini')).toBe('gemini')
    expect(exists).not.toHaveBeenCalled()
    exists.mockReturnValue(false)
    expect(selectCompletionRoute(true, 'gemini')).toBe('gemini')
  })
})
