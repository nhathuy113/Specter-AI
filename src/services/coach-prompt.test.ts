import { describe, expect, it } from 'vitest'
import { buildCoachSystemPrompt, buildCoachUserMessage, resolveCoachRequest } from './coach-prompt'

describe('coach prompt', () => {
  it('uses general screen assistant prompt by default', () => {
    const prompt = buildCoachSystemPrompt('')
    expect(prompt.toLowerCase()).toContain('virtual screen assistant')
    expect(prompt.toLowerCase()).toContain('never claim you clicked')
  })

  it('builds structured game-log user message', () => {
    const message = buildCoachUserMessage('Brussels\nManpower: 23\nArmored: 6', 'game')
    expect(message).toContain('[ENTRIES')
    expect(message).toContain('Brussels')
    expect(message).toContain('concrete in-game action')
  })

  it('general mode keeps IDE OCR for the model', () => {
    const req = resolveCoachRequest('Cursor\nfunction main() {}', 'general')
    expect(req.kind).toBe('ide')
    expect(req.instantReply).toBeUndefined()
    expect(req.userMessage).toContain('[CONTENT]')
  })

  it('game mode redirects IDE-only screen', () => {
    const req = resolveCoachRequest('Cursor\nGEMINI_API_KEY\n.env', 'game')
    expect(req.instantReply?.toLowerCase()).toMatch(/ide|general|work/)
  })
})
