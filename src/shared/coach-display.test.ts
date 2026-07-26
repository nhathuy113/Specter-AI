import { describe, expect, it } from 'vitest'
import { sanitizeCoachDisplayText, stripThreadForDisplay } from './coach-display'

describe('coach-display', () => {
  it('strips ---THREAD--- suffix', () => {
    expect(stripThreadForDisplay('**Trạng thái:** LeetCode\n---THREAD--- hidden')).toBe('**Trạng thái:** LeetCode')
  })

  it('strips LaTeX to plain text', () => {
    const raw = 'Độ phức tạp $O(\\log(m+n))$ và $O(\\log(\\min(m, n)))$.'
    expect(sanitizeCoachDisplayText(raw)).toBe('Độ phức tạp O(log(m+n)) và O(log(min(m, n))).')
  })

  it('strips bare backslash log outside dollars', () => {
    expect(sanitizeCoachDisplayText('Độ phức tạp $O(\\log(m+n))$')).toContain('O(log(m+n))')
    expect(sanitizeCoachDisplayText('x')).toBe('x')
  })

  it('strips thread and LaTeX together', () => {
    const raw = '**Giải pháp:** partition $i$. ---THREAD--- session note'
    expect(sanitizeCoachDisplayText(raw)).toBe('**Giải pháp:** partition i.')
  })
})
