import type { LeetCodeFixture } from '../shared/leetcode-fixtures'

export interface CopilotStepInput {
  problem: LeetCodeFixture
  stepNumber: number
  priorSteps?: string[]
  screenContext?: string
  language?: 'javascript' | 'typescript'
}

const GEMINI_COPILOT_SYSTEM = `LeetCode copilot — Vietnamese, one step at a time.
Code: max 3-5 lines, Vietnamese comment every line, then explain each line in plain words.
Tại sao: 2-3 sentences (goal, why this step first, what breaks if skipped).
If user has not applied prior hint: re-teach same step slower, simpler code, no magic constants.
No LaTeX. No inf/-inf dumps without explaining one border case first.`

/** Shared copilot prompt for Gemini (fast) and Cursor SDK. */
export function buildCopilotStepPrompt(input: CopilotStepInput): string {
  const lang = input.language ?? 'javascript'
  const { problem, stepNumber, priorSteps = [], screenContext } = input

  const prior =
    priorSteps.length > 0
      ? ['Đã làm:', ...priorSteps.map((s, i) => `${i + 1}. ${s}`), '']
      : []

  const screen =
    screenContext?.trim() ?
      ['OCR:', screenContext.trim().slice(0, 600), '']
    : []

  return [
    `Bài: ${problem.title}`,
    problem.description,
    '',
    ...screen,
    ...prior,
    `Chỉ trả lời BƯỚC ${stepNumber} (tổng ~4 bước). KHÔNG làm hộ — snippet nhỏ thôi.`,
    '',
    `**Bước ${stepNumber}:** <tên>`,
    '**Làm gì:** 1 câu',
    '**Snippet:**',
    '```' + lang,
    '```',
    '**Tiếp theo:** 1 câu'
  ].join('\n')
}

export function buildCopilotSystemPrompt(): string {
  return GEMINI_COPILOT_SYSTEM
}

/** Cursor SDK variant — adds no-tools guard (agent otherwise runs shell ~100s). */
export function buildCursorCopilotStepPrompt(input: CopilotStepInput): string {
  return [
    'TEXT ONLY. Do NOT use tools, files, or shell. Do NOT output full solution.',
    '',
    buildCopilotStepPrompt(input)
  ].join('\n')
}
