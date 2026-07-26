import { describe, expect, it } from 'vitest'
import { isVisualQuizScreen } from './work-coach-quiz'
import { resolveWorkProblemProfile } from './work-problem-profile'
import { selectWorkCoachReplyFormat } from './work-coach-session'

describe('work-coach-quiz', () => {
  it('detects 123test IQ screen', () => {
    const text = '123test.com\nQuestion 3 of 20\nWhich figure completes the pattern?'
    expect(isVisualQuizScreen(text, { appName: 'Brave', windowTitle: 'IQ test' })).toBe(true)
  })

  it('detects matrix language in browser without coding signals', () => {
    const text = 'Row 1 Box 1 horizontal lines\nRow 1 Box 2 vertical lines\nChoose answer'
    expect(isVisualQuizScreen(text, { appName: 'Google Chrome', windowTitle: '123test' })).toBe(true)
  })

  it('does not treat Cursor IDE chat mentioning quiz as visual quiz', () => {
    const text =
      'Work coach quiz / bai hoc\n123test.com mentioned in chat\nIQ Test in sidebar'
    expect(isVisualQuizScreen(text, { appName: 'Cursor', windowTitle: 'PERFORMANCE REVIEW' })).toBe(
      false
    )
  })

  it('does not treat leetcode as quiz', () => {
    const text = '4. Median of Two Sorted Arrays\nclass Solution:\n    def findMedianSortedArrays'
    expect(isVisualQuizScreen(text)).toBe(false)
  })

  it('detects real 123test in Chrome', () => {
    const text = '123test.com\nQuestion 4 of 8\nWhich figure belongs'
    expect(isVisualQuizScreen(text, { appName: 'Google Chrome', windowTitle: 'IQ Test' })).toBe(true)
  })

  it('profile uses quiz format on first IQ screen', () => {
    const text = '123test.com\nQuestion 1 of 30'
    const profile = resolveWorkProblemProfile(text, { appName: 'Chrome' }, 'browser')
    const format = selectWorkCoachReplyFormat({
      hasThread: false,
      replyMode: 'normal',
      reviewStatus: 'baseline',
      profile
    })
    expect(profile.kind).toBe('visual-quiz')
    expect(format).toContain('**Đáp án:**')
    expect(format).not.toContain('**Trạng thái:**')
  })
})
