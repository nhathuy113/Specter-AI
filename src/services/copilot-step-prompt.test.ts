import { describe, expect, it } from 'vitest'
import { buildCopilotStepPrompt, buildCursorCopilotStepPrompt } from './copilot-step-prompt'
import { defaultMedianFixture } from './cursor-leetcode'

describe('copilot-step-prompt', () => {
  it('builds compact step prompt for Gemini', () => {
    const p = buildCopilotStepPrompt({
      problem: defaultMedianFixture(),
      stepNumber: 1
    })
    expect(p).toContain('BƯỚC 1')
    expect(p).toContain('Median')
    expect(p.length).toBeLessThan(1200)
  })

  it('cursor variant adds no-tools guard', () => {
    const p = buildCursorCopilotStepPrompt({
      problem: defaultMedianFixture(),
      stepNumber: 2,
      priorSteps: ['swap arrays']
    })
    expect(p).toContain('Do NOT use tools')
    expect(p).toContain('swap arrays')
  })
})
