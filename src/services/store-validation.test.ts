import { describe, expect, it } from 'vitest'
import { isValidSetting } from './store'

describe('store validation', () => {
  it('accepts playbooks with mode scoping', () => {
    const valid = isValidSetting('playbooks', [
      {
        id: 'pb-1',
        name: 'Work notes',
        content: 'Sprint goals',
        isActive: true,
        modes: ['work', 'general'],
        createdAt: Date.now()
      }
    ])
    expect(valid).toBe(true)
  })

  it('rejects playbooks with invalid mode values', () => {
    const invalid = isValidSetting('playbooks', [
      {
        id: 'pb-1',
        name: 'Bad',
        content: 'x',
        isActive: true,
        modes: ['invalid-mode'],
        createdAt: Date.now()
      }
    ])
    expect(invalid).toBe(false)
  })

  it('validates assistant and perception modes', () => {
    expect(isValidSetting('assistantMode', 'game')).toBe(true)
    expect(isValidSetting('assistantMode', 'invalid')).toBe(false)
    expect(isValidSetting('perceptionMode', 'auto')).toBe(true)
    expect(isValidSetting('perceptionMode', 'always')).toBe(false)
  })
})
