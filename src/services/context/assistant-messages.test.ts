import { describe, expect, it } from 'vitest'
import { buildAssistantMessages } from './assistant-messages'

describe('assistant context isolation', () => {
  const base = { assistantMode: 'work' as const, systemPrompt: 'system', userMessage: 'current screen', useVision: false }

  it('coach prompts exclude unrelated journal and playbook context', () => {
    const messages = buildAssistantMessages({ ...base, coachMode: true, playbookContext: 'unrelated document', journalContext: 'previous game' })
    expect(messages.at(-1)).toEqual({ role: 'user', content: 'current screen' })
    expect(JSON.stringify(messages)).not.toContain('previous game')
    expect(JSON.stringify(messages)).not.toContain('unrelated document')
  })

  it('general assistant includes selected context and only the last ten history messages', () => {
    const history = Array.from({ length: 12 }, (_, i) => ({ role: i === 10 ? 'system' : 'assistant', content: `history ${i}` }))
    const messages = buildAssistantMessages({ ...base, assistantMode: 'general', coachMode: false, playbookContext: 'document', journalContext: 'journal', history })
    expect(messages.at(-1)?.content).toBe('document\n\njournal\n\ncurrent screen')
    expect(messages).toHaveLength(11)
    expect(messages[1].content).toBe('history 2')
    expect(messages.filter(m => m.role === 'system')).toHaveLength(1)
  })

  it('instant replies do not receive the vision instruction wrapper', () => {
    const messages = buildAssistantMessages({ ...base, coachMode: true, useVision: true, instantReply: 'redirect' })
    expect(messages.at(-1)?.content).toBe('current screen')
  })
})
