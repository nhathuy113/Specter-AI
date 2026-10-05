import { describe, expect, it } from 'vitest'
import { buildCoachSystemPrompt, buildCoachUserMessage, buildActiveTabUserMessage, resolveCoachRequest } from './coach-prompt'
import { DEFAULT_WORK_COACH_SYSTEM_PROMPT, WORK_COACH_REPLY_FORMAT_VI } from '../../shared/constants'
import { resolveAssistantRequest } from '../context/context-router'
import { appendWorkCoachContext } from '../work/work-coach-session'

describe('coach prompt', () => {
  it('uses general screen assistant prompt by default', () => {
    const prompt = buildCoachSystemPrompt('')
    expect(prompt.toLowerCase()).toContain('virtual screen assistant')
    expect(prompt.toLowerCase()).toContain('never claim you clicked')
  })

  it('work mode uses 5-section Vietnamese format', () => {
    const prompt = buildCoachSystemPrompt('', 'work')
    expect(prompt).toBe(DEFAULT_WORK_COACH_SYSTEM_PROMPT)
    expect(prompt).toContain('Trạng thái')
    expect(prompt).toContain('Tại sao')
    expect(prompt.toLowerCase()).not.toContain('1-4 short bullets')
  })

  it('active tab task includes WORK_COACH_REPLY_FORMAT_VI', () => {
    const msg = buildActiveTabUserMessage('LeetCode Median', 'work')
    expect(msg).toContain(WORK_COACH_REPLY_FORMAT_VI)
    expect(msg).toContain('**Trạng thái:**')
  })

  it('work browser task uses 5-section format not English bullets', () => {
    const req = resolveAssistantRequest('leetcode.com\nMedian of Two Sorted Arrays', 'work', {
      appName: 'Brave',
      windowTitle: 'LeetCode'
    })
    expect(req.userMessage).not.toContain('1-3 short bullets')
    const withFormat = appendWorkCoachContext(req.userMessage, '', {
      replyMode: 'normal',
      codeReviewStatus: 'baseline'
    })
    expect(withFormat).toContain('Trạng thái')
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

  it('work mode always uses built-in work prompt over saved coach prompt', () => {
    const prompt = buildCoachSystemPrompt('Old generic coach prompt', 'work')
    expect(prompt).toBe(DEFAULT_WORK_COACH_SYSTEM_PROMPT)
  })
})
