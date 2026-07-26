import { describe, expect, it } from 'vitest'
import { resolveAssistantRequest } from './context-router'
import { resolveWorkProblemProfile, shouldForceWorkCoachVision, shouldUseCursorWorkCoach } from './work-problem-profile'

describe('work-problem-profile', () => {
  it('detects visual quiz from 123test screen', () => {
    const profile = resolveWorkProblemProfile(
      '123test.com\nQuestion 1 of 8\nWhich figure belongs',
      { appName: 'Google Chrome', windowTitle: '123test' },
      'browser'
    )
    expect(profile.kind).toBe('visual-quiz')
  })

  it('detects coding exercise from LeetCode OCR', () => {
    const profile = resolveWorkProblemProfile(
      'leetcode.com\nMedian of Two Sorted Arrays\nclass Solution',
      { appName: 'Google Chrome' },
      'browser'
    )
    expect(profile.kind).toBe('coding-exercise')
  })

  it('resolveAssistantRequest uses vision-first work message for all work types', () => {
    const req = resolveAssistantRequest('123test.com\nQuestion 1 of 8', 'work', { appName: 'Chrome' })
    expect(req.workProblem?.kind).toBe('visual-quiz')
    expect(req.userMessage).toContain('[PROBLEM] visual-quiz')
    expect(req.userMessage).toContain('Screenshot attached')
    expect(req.userMessage).not.toContain('[OCR — supplementary only]')
  })

  it('forces vision whenever screenshot exists', () => {
    const profile = resolveWorkProblemProfile('leetcode', {}, 'browser')
    expect(shouldForceWorkCoachVision(profile, true)).toBe(true)
    expect(shouldForceWorkCoachVision(profile, false)).toBe(false)
  })

  it('uses Cursor SDK only for coding problems', () => {
    const quiz = resolveWorkProblemProfile('123test\nQuestion 1 of 8', {}, 'browser')
    const leetcode = resolveWorkProblemProfile('leetcode\nMedian of Two Sorted Arrays', {}, 'browser')
    const lecture = resolveWorkProblemProfile('youtube.com\nPHÂN TÍCH GDP', {}, 'browser')
    expect(shouldUseCursorWorkCoach(quiz)).toBe(false)
    expect(shouldUseCursorWorkCoach(lecture)).toBe(false)
    expect(shouldUseCursorWorkCoach(leetcode)).toBe(true)
  })
})
