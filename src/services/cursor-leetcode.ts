import type { LeetCodeFixture } from '../shared/leetcode-fixtures'
import { MEDIAN_OF_TWO_SORTED_ARRAYS } from '../shared/leetcode-fixtures'
import { buildCursorCopilotStepPrompt as buildCursorCopilotFromShared } from './copilot-step-prompt'

export type { CopilotStepInput } from './copilot-step-prompt'
export { buildCopilotStepPrompt, buildCopilotSystemPrompt } from './copilot-step-prompt'

export interface CursorCopilotStepInput {
  problem: LeetCodeFixture
  stepNumber: number
  priorSteps?: string[]
  screenContext?: string
  language?: 'javascript' | 'typescript'
}

export interface CursorLeetCodePromptInput {
  problem: LeetCodeFixture
  language?: 'javascript' | 'typescript'
}

/** Fast copilot: one step + small snippet only. No tools, no full solution. */
export function buildCursorCopilotStepPrompt(input: CursorCopilotStepInput): string {
  return buildCursorCopilotFromShared(input)
}

/** @deprecated Full auto-solve — slow (~100s). Use buildCursorCopilotStepPrompt instead. */
export function buildCursorLeetCodePrompt(input: CursorLeetCodePromptInput): string {
  const lang = input.language ?? 'javascript'
  const { problem } = input
  const file = lang === 'javascript' ? 'solution.js' : 'solution.ts'

  return [
    `LeetCode coding task — ${problem.title}`,
    '',
    problem.description,
    '',
    `Implement ${problem.signature} in ${file}.`,
    'Requirements:',
    '- Correctness first; must pass test.js (node test.js).',
    '- Target O(log(m+n)) for this problem — binary search partition, not full merge.',
    '- Use INT_MIN / INT_MAX (or Number.MIN_SAFE_INTEGER) for empty partition edges.',
    '- Export the function from solution.js: module.exports = { findMedianSortedArrays }.',
    '- Keep solution.js under ~60 lines — small working snippet only.',
    '- Run `node test.js` yourself and fix until ALL_TESTS_PASSED.',
    '- Reply with the final solution.js source only (fenced ```javascript block), no essay.'
  ].join('\n')
}

/** Pull first JS/TS fenced block from agent reply. */
export function extractCodeBlock(reply: string, lang: 'javascript' | 'typescript' = 'javascript'): string {
  const tag = lang === 'javascript' ? 'javascript' : 'typescript'
  const re = new RegExp('```(?:' + tag + '|js|ts)?\\s*([\\s\\S]*?)```', 'i')
  const m = reply.match(re)
  if (m?.[1]?.trim()) return m[1].trim()

  const any = reply.match(/```[\s\S]*?\n([\s\S]*?)```/)
  if (any?.[1]?.trim()) return any[1].trim()

  return reply.trim()
}

export function defaultMedianFixture(): LeetCodeFixture {
  return MEDIAN_OF_TWO_SORTED_ARRAYS
}

/** Median problem — copilot step outline for tests / session continuity. */
export const MEDIAN_COPILOT_STEPS = [
  'Chọn mảng ngắn hơn làm nums1 (swap nếu cần)',
  'Binary search partition i trên nums1; j = (m+n+1)/2 - i',
  'Dùng -Infinity/Infinity cho partition ở biên',
  'Kiểm tra nums1[i-1] <= nums2[j] và nums2[j-1] <= nums1[i]; trả median'
] as const
