import { describe, expect, it } from 'vitest'
import { parseHourlyAiResponse } from './game-hourly-ai'

describe('parseHourlyAiResponse', () => {
  it('splits summary and session thread', () => {
    const raw = `* Did combat in Brussels

---THREAD---
Player holds Belgium front; planning production shift to armor.`
    const { summary, sessionThread } = parseHourlyAiResponse(raw)
    expect(summary).toContain('Brussels')
    expect(sessionThread).toContain('Belgium')
  })
})
