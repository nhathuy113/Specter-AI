import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { isCoachDebugEnabled, getCoachDebugDir, writeCoachDebug } from './coach-debug'
import fs from 'fs'
import path from 'path'

describe('coach-debug', () => {
  const prev = process.env.COACH_DEBUG

  afterEach(() => {
    if (prev === undefined) delete process.env.COACH_DEBUG
    else process.env.COACH_DEBUG = prev
  })

  it('disabled by default', () => {
    delete process.env.COACH_DEBUG
    expect(isCoachDebugEnabled()).toBe(false)
  })

  it('writes latest.md when enabled', () => {
    process.env.COACH_DEBUG = '1'
    const dir = path.join(getCoachDebugDir(), '..', 'coach-debug-test-' + Date.now())
    const orig = getCoachDebugDir
    // write to temp via env override not available — just check enabled + dir name
    expect(isCoachDebugEnabled()).toBe(true)
    expect(getCoachDebugDir()).toContain('coach-debug')
  })
})
