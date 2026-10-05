import { describe, expect, it } from 'vitest'
import {
  extractSuggestedSnippets,
  isEditorStillStub,
  isUserConfusionFeedback,
  snippetApproved
} from './work-coach-snippet'

describe('work-coach-snippet', () => {
  it('extracts fenced code from coach reply', () => {
    const reply = '**Giải pháp:**\n```python\nif len(nums1) > len(nums2):\n    nums1, nums2 = nums2, nums1\n```'
    expect(extractSuggestedSnippets(reply)[0]).toContain('len(nums1)')
  })

  it('approves when editor matches suggested swap', () => {
    const snippet = 'if len(nums1) > len(nums2):\n    nums1, nums2 = nums2, nums1'
    const screen = `Median\nclass Solution:\n    def findMedianSortedArrays(self, nums1, nums2):\n        if len(nums1) > len(nums2):\n            nums1, nums2 = nums2, nums1`
    expect(snippetApproved(snippet, screen)).toBe(true)
  })

  it('rejects when editor has different logic', () => {
    const snippet = 'if len(nums1) > len(nums2):\n    nums1, nums2 = nums2, nums1'
    const screen = `class Solution:\n    def findMedianSortedArrays(self, nums1, nums2):\n        return sorted(nums1 + nums2)[0]`
    expect(snippetApproved(snippet, screen)).toBe(false)
  })

  it('detects stub editor (pass only)', () => {
    expect(isEditorStillStub('class Solution:\n    def findMedianSortedArrays(self, nums1, nums2):\n        pass')).toBe(true)
    expect(isEditorStillStub('class Solution:\n    def f(self, a, b):\n        if len(a)>len(b): pass')).toBe(false)
  })

  it('detects overlay confusion feedback', () => {
    expect(isUserConfusionFeedback('restart chưa?')).toBe(true)
    expect(isUserConfusionFeedback('chưa hiểu bước này')).toBe(true)
    expect(isUserConfusionFeedback('[Coach auto]')).toBe(false)
    expect(isUserConfusionFeedback('if len(a) > len(b): swap')).toBe(false)
  })
})
