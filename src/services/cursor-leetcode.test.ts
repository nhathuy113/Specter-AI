import { describe, expect, it } from 'vitest'
import {
  buildCursorCopilotStepPrompt,
  buildCursorLeetCodePrompt,
  extractCodeBlock,
  defaultMedianFixture
} from './cursor-leetcode'

describe('cursor-leetcode', () => {
  it('copilot prompt is text-only and one step', () => {
    const prompt = buildCursorCopilotStepPrompt({
      problem: defaultMedianFixture(),
      stepNumber: 2,
      priorSteps: ['Swap shorter array']
    })
    expect(prompt).toContain('Do NOT use tools')
    expect(prompt).toContain('BƯỚC 2')
    expect(prompt).toContain('Swap shorter array')
  })

  it('full prompt kept for optional slow path', () => {
    const prompt = buildCursorLeetCodePrompt({ problem: defaultMedianFixture() })
    expect(prompt).toContain('node test.js')
  })

  it('extracts fenced javascript block', () => {
    const code = extractCodeBlock('Here:\n```javascript\nfunction f() { return 1 }\n```\nDone')
    expect(code).toContain('function f()')
  })
})
