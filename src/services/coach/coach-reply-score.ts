/** Automated quality gate for work-coach replies. */

export interface CoachReplyScore {
  good: string[]
  bad: string[]
  pass: boolean
}

export function scoreCoachReply(text: string, options?: { expectCodeReview?: boolean }): CoachReplyScore {
  const good: string[] = []
  const bad: string[] = []
  const expectCodeReview = options?.expectCodeReview ?? true

  if (/sorted\s*\(\s*nums1\s*\+\s*nums2/i.test(text)) {
    bad.push('suggests sorted(nums1+nums2) brute force')
  }
  if (/\*\*Trạng thái:\*\*/.test(text)) {
    bad.push('uses full 6-section Trạng thái')
  }
  if (expectCodeReview && !/\*\*Kẹt ở đâu:\*\*|#{1,3}\s*\d*\.?\s*Kẹt ở đâu|^Kẹt ở đâu/m.test(text)) {
    bad.push('missing 4-section Kẹt ở đâu')
  }
  if (!/```/.test(text)) {
    bad.push('missing code snippet')
  }
  if (/maxleft|minright|max_left|min_right|partition|left.*right|while/i.test(text)) {
    good.push('references partition/binary-search code')
  }
  if (/\*\*Kẹt ở đâu:\*\*/.test(text)) good.push('4-section format')
  if (/typeerror|none is not valid/i.test(text) && expectCodeReview) {
    good.push('ties to runtime error')
  }

  const pass = bad.length === 0 && good.length >= 2
  return { good, bad, pass }
}
