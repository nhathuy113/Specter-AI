import { describe, expect, it } from 'vitest'
import { createWorkCoachSession } from './work-coach-session-core'
import type { WorkCoachSessionState } from './work-coach-session-types'

function memorySession() {
  let saved: WorkCoachSessionState | null = null
  const api = createWorkCoachSession({ load: () => saved, save: (state) => { saved = structuredClone(state) } }, () => 1234)
  return api
}

describe('work session persistence contract', () => {
  it('persists through the injected repository and clock without Electron', () => {
    const session = memorySession()
    session.updateWorkCoachThread('1. First Problem Title', undefined, 'answer\n---THREAD---\ncontext')
    expect(session.loadWorkCoachSession()).toMatchObject({ thread: 'context', updatedAt: 1234 })
    expect(session.getWorkCoachThread('1. First Problem Title')).toBe('context')
  })

  it('new problems do not inherit a snippet, step, Cursor reply or retry count', () => {
    const session = memorySession()
    const previous = session.updateWorkCoachThread('1. First Problem Title', undefined, '```python\nleft = 0\n```\n---THREAD---\nold context')
    session.saveWorkCoachSession({ ...previous, stuckRetryCount: 5, cursorCoachReply: 'old advice' })
    const next = session.updateWorkCoachThread('2. Another Problem Title', undefined, 'new answer', { triggerReview: 'unchanged' })
    expect(next.sessionKey).not.toBe(previous.sessionKey)
    expect(next.lastSuggestedSnippet).toBeUndefined()
    expect(next.lastCoachStepSummary).toBeUndefined()
    expect(next.cursorCoachReply).toBeUndefined()
    expect(next.stuckRetryCount).toBe(1)
    expect(session.getWorkCoachThread('1. First Problem Title')).toBe('')
  })

  it('preserves the current teaching step within the same problem', () => {
    const session = memorySession()
    session.updateWorkCoachThread('1. First Problem Title', undefined, '```python\nleft = 0\n```')
    session.updateWorkCoachThread('1. First Problem Title', undefined, 'explain again', { triggerReview: 'unchanged' })
    expect(session.loadWorkCoachSession()).toMatchObject({ lastSuggestedSnippet: 'left = 0', stuckRetryCount: 1 })
  })

  it('independent session instances never share state', () => {
    const first = memorySession(), second = memorySession()
    first.saveWorkCoachCursorReply('1. First Problem Title', undefined, 'advice')
    expect(first.loadWorkCoachSession()?.cursorCoachReply).toBe('advice')
    expect(second.loadWorkCoachSession()).toBeNull()
  })
})
