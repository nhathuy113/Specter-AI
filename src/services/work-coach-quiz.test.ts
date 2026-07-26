import { describe, expect, it } from 'vitest'
import { isVisualQuizScreen } from './work-coach-quiz'
import { resolveWorkProblemProfile } from './work-problem-profile'
import { selectWorkCoachReplyFormat } from './work-coach-session'

describe('work-coach-quiz', () => {
  it('detects 123test IQ screen', () => {
    const text = '123test.com\nQuestion 3 of 20\nWhich figure completes the pattern?'
    expect(isVisualQuizScreen(text, { appName: 'Brave', windowTitle: 'IQ test' })).toBe(true)
  })

  it('detects matrix language without coding signals', () => {
    const text = 'Row 1 Box 1 horizontal lines\nRow 1 Box 2 vertical lines\nChoose answer'
    expect(isVisualQuizScreen(text)).toBe(true)
  })

  it('does not treat leetcode as quiz', () => {
    const text = '4. Median of Two Sorted Arrays\nclass Solution:\n    def findMedianSortedArrays'
    expect(isVisualQuizScreen(text)).toBe(false)
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
