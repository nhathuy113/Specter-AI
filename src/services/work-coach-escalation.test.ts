import { describe, expect, it } from 'vitest'
import {
  resolveWorkCoachEscalation,
  WORK_COACH_GEMINI_36,
  WORK_COACH_GEMINI_LITE
} from './work-coach-escalation'

describe('work-coach-escalation', () => {
  it('always runs triple panel', () => {
    expect(resolveWorkCoachEscalation('normal', 0)).toBe(4)
    expect(resolveWorkCoachEscalation('stuck-reexplain', 0)).toBe(4)
    expect(resolveWorkCoachEscalation('stuck-reexplain', 1)).toBe(4)
    expect(resolveWorkCoachEscalation('stuck-reexplain', 2)).toBe(4)
    expect(resolveWorkCoachEscalation('snippet-rejected', 2)).toBe(4)
    expect(resolveWorkCoachEscalation('normal', 2)).toBe(4)
  })

  it('exports expected model ids', () => {
    expect(WORK_COACH_GEMINI_LITE).toBe('gemini-3.1-flash-lite')
    expect(WORK_COACH_GEMINI_36).toBe('gemini-3.6-flash')
  })
})
