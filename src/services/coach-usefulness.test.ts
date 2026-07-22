import { describe, expect, it } from 'vitest'
import { scoreCoachReply } from './coach-usefulness'

describe('scoreCoachReply rubric', () => {
  it('passes tactical game-log replies with stats and verbs', () => {
    const reply =
      'Reinforce the Brussels front — enemy pool shows 17.36K Manpower and 44 Armored. Consider pulling damaged divisions to avoid further armored losses.'
    const score = scoreCoachReply(reply, 'game-log')
    expect(score.useful, score.reasons.join('; ')).toBe(true)
  })

  it('fails game-log replies that mention API keys', () => {
    const reply = 'Configure your Gemini API key in .env before playing.'
    const score = scoreCoachReply(reply, 'game-log')
    expect(score.useful).toBe(false)
    expect(score.reasons.some((r) => r.includes('off-topic'))).toBe(true)
  })

  it('fails game-log replies missing actionable verbs', () => {
    const reply = 'The enemy has 17.36K Manpower and 44 Armored units in Brussels.'
    const score = scoreCoachReply(reply, 'game-log')
    expect(score.useful).toBe(false)
    expect(score.reasons).toContain('missing actionable verb')
  })

  it('passes IDE instant redirect guidance', () => {
    const reply = 'This screen shows your IDE, not gameplay. Focus your game on the external monitor.'
    const score = scoreCoachReply(reply, 'ide')
    expect(score.useful, score.reasons.join('; ')).toBe(true)
  })

  it('passes code/debug guidance for code screens', () => {
    const reply = 'Check the import path for `foo` and try fixing the type error on line 10 next.'
    const score = scoreCoachReply(reply, 'code')
    expect(score.useful, score.reasons.join('; ')).toBe(true)
  })

  it('rejects replies that are too short', () => {
    const score = scoreCoachReply('Reinforce.', 'game-log')
    expect(score.useful).toBe(false)
    expect(score.reasons).toContain('reply too short')
  })
})
