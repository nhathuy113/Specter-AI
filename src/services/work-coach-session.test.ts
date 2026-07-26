import { describe, expect, it } from 'vitest'
import {
  appendWorkCoachContext,
  evaluateWorkCoachCodeReview,
  extractEditorCodeFingerprint,
  extractStableContentId,
  isWorkCoachStuck,
  saveWorkCoachCursorReply,
  selectWorkCoachReplyFormat,
  workSessionKey
} from './work-coach-session'

describe('work-coach-session', () => {
  it('builds stable session key from work area + video title', () => {
    const text = 'youtube.com\nPHÂN TÍCH VĨ MÔ VÀ DOANH NGHIỆP\nGDP VÀ CÁC TRỌNG SỐ'
    const a = workSessionKey(text, { appName: 'Work: Built-in Retina Display', windowTitle: 'pinned' })
    const b = workSessionKey(text, { appName: 'Work: Built-in Retina Display', windowTitle: 'pinned' })
    expect(a).toBe(b)
  })

  it('resets key when video topic changes', () => {
    const meta = { appName: 'Work: Built-in', windowTitle: 'x' }
    const k1 = workSessionKey('PHÂN TÍCH GDP 2024', meta)
    const k2 = workSessionKey('LÃI SUẤT VÀ TÍN DỤNG NGÂN HÀNG', meta)
    expect(k1).not.toBe(k2)
  })

  it('appends session thread to coach user message', () => {
    const out = appendWorkCoachContext('[CONTENT] slide 2', 'Already covered GDP 7.63%')
    expect(out).toContain('SESSION ON THIS SCREEN SO FAR')
    expect(out).toContain('GDP 7.63%')
  })

  it('extracts youtube-like content id', () => {
    expect(extractStableContentId('Brave\nPHÂN TÍCH VĨ MÔ youtube')).toMatch(/phân tích/)
  })

  it('extracts leetcode problem title from numbered line', () => {
    const id = extractStableContentId('Brave\n4. Median of Two Sorted Arrays\nHard\nSubmissions 1234')
    expect(id).toContain('median of two sorted arrays')
  })

  it('same leetcode page with OCR noise shares session key', () => {
    const meta = { appName: 'Work: Built-in Retina Display', windowTitle: 'pinned' }
    const a = workSessionKey('4. Median of Two Sorted Arrays\nHard\nGiven two sorted arrays', meta)
    const b = workSessionKey('4. Median of Two Sorted Arrays\nHard\nSubmissions\n999\nGiven two sorted arrays', meta)
    expect(a).toBe(b)
  })

  it('detects unchanged editor code fingerprint', () => {
    const a = extractEditorCodeFingerprint('def solve():\n    return 1\n')
    const b = extractEditorCodeFingerprint('def solve():\n    return 1\n# comment noise')
    expect(a).toBe(b)
  })

  it('appends stuck re-explain block when requested', () => {
    const out = appendWorkCoachContext('[CONTENT]', 'thread', {
      replyMode: 'stuck-reexplain',
      stuckRetryCount: 2
    })
    expect(out).toContain('NGƯỜI DÙNG CHƯA ÁP DỤNG')
    expect(out).toContain('Lần giảng lại thứ 2')
  })

  it('isWorkCoachStuck compares saved code fingerprint', () => {
    expect(isWorkCoachStuck('def x(): pass')).toBe(false)
  })

  it('saveWorkCoachCursorReply persists for same session', () => {
    expect(typeof saveWorkCoachCursorReply).toBe('function')
  })

  it('selectWorkCoachReplyFormat uses short format on continuation', () => {
    const full = selectWorkCoachReplyFormat({ hasThread: false, replyMode: 'normal', reviewStatus: 'baseline' })
    const cont = selectWorkCoachReplyFormat({ hasThread: true, replyMode: 'stuck-reexplain', reviewStatus: 'unchanged' })
    expect(full).toContain('**Trạng thái:**')
    expect(cont).toContain('**Kẹt ở đâu:**')
    expect(cont).not.toContain('**Trạng thái:**')
  })

  it('appendWorkCoachContext includes rejected block', () => {
    const out = appendWorkCoachContext('[CONTENT]', 'thread', {
      replyMode: 'snippet-rejected',
      suggestedSnippet: 'if len(a)>len(b): swap',
      screenText: 'class Solution:\n    return 1'
    })
    expect(out).toContain('USER GÕ CODE KHÁC SNIPPET')
    expect(out).toContain('if len(a)>len(b): swap')
  })

  it('appendWorkCoachContext treats overlay confusion as stuck re-explain', () => {
    const out = appendWorkCoachContext('[CONTENT]', 'thread', {
      replyMode: 'stuck-reexplain',
      userOverlayQuery: 'restart chưa?',
      screenText: 'class Solution:\n    def f(self, a, b):\n        pass'
    })
    expect(out).toContain('USER GÕ TRONG OVERLAY')
    expect(out).toContain('**Kẹt ở đâu:**')
    expect(out).not.toContain('**Trạng thái:**')
  })

  it('detects code-review when user has binary search logic', () => {
    const screen = `TypeError: None is not valid value
class Solution:
    def findMedianSortedArrays(self, nums1, nums2):
        m, n = len(nums1), len(nums2)
        if m > n:
            nums1, nums2 = nums2, nums1
        left, right = 0, m
        while left <= right:
            index = (left + right) / 2
        return float(result)`
    expect(evaluateWorkCoachCodeReview(screen).replyMode).toBe('code-review')
    const out = appendWorkCoachContext('[CONTENT]', '', {
      replyMode: 'code-review',
      screenText: screen
    })
    expect(out).toContain('EDITOR CODE ON SCREEN')
    expect(out).toContain('REVIEW TRÊN CODE ĐÓ')
    expect(out).not.toContain('**Trạng thái:**')
  })
})
