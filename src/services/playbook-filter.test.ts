import { describe, expect, it } from 'vitest'
import { buildPlaybookContext, filterPlaybooksForMode } from './playbook-filter'
import type { Playbook } from '../shared/types'

const sample = (overrides: Partial<Playbook>): Playbook => ({
  id: '1',
  name: 'Test',
  content: 'content',
  isActive: true,
  createdAt: 1,
  ...overrides
})

describe('playbook-filter', () => {
  it('includes playbooks with no mode restriction', () => {
    const result = filterPlaybooksForMode([sample({ name: 'All' })], 'work')
    expect(result).toHaveLength(1)
  })

  it('filters by assistant mode', () => {
    const playbooks = [
      sample({ name: 'Work only', modes: ['work'] }),
      sample({ name: 'Game only', modes: ['game'], id: '2' })
    ]
    const result = filterPlaybooksForMode(playbooks, 'work')
    expect(result.map((p) => p.name)).toEqual(['Work only'])
  })

  it('builds playbook context block', () => {
    const ctx = buildPlaybookContext([sample({ name: 'Notes', content: 'Remember X' })])
    expect(ctx).toContain('[PLAYBOOK: Notes]')
    expect(ctx).toContain('Remember X')
  })
})
