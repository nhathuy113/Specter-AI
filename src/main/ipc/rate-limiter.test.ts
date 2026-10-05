import { describe, expect, it } from 'vitest'
import { createRateLimiter } from './rate-limiter'
import { createRequestOwnership } from '../../services/ui/request-ownership'

describe('request policy', () => {
  it('slides the window and keeps channels and instances independent', () => {
    let now = 0
    const rules = { query: { maxCalls: 2, windowMs: 2000 }, audio: { maxCalls: 1, windowMs: 3000 } }
    const allow = createRateLimiter(rules, () => now)
    expect(allow('query')).toBe(true)
    now = 500
    expect(allow('query')).toBe(true)
    expect(allow('query')).toBe(false)
    expect(allow('audio')).toBe(true)
    expect(createRateLimiter(rules, () => now)('query')).toBe(true)
    now = 2000
    expect(allow('query')).toBe(true)
    expect(allow('query')).toBe(false)
    expect(allow('unlimited')).toBe(true)
    expect(allow('toString')).toBe(true)
  })

  it('new requests invalidate previous writes without affecting another target', () => {
    const owners = createRequestOwnership<object>()
    const first = {}, second = {}
    const old = owners.begin(first), other = owners.begin(second)
    const current = owners.begin(first)
    expect(old()).toBe(false)
    expect(current()).toBe(true)
    expect(other()).toBe(true)
    owners.invalidate(first)
    expect(current()).toBe(false)
    expect(other()).toBe(true)
  })
})
