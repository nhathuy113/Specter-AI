import { describe, expect, it } from 'vitest'
import { resolveCoachRequest } from './coach-prompt'
import { buildPlaybookContext, filterPlaybooksForMode } from './playbook-filter'
import { mergeAccessibilityAndOcr, resolvePerceptionPlan } from './perception'
import { scoreCoachReply } from './coach-usefulness'
import type { Playbook } from '../shared/types'

const GAME_LOG_OCR = `
Brussels
2 hours ago.
Manpower: 23
Armored: 6
Manpower: 17.36K
Armored: 44
`.trim()

const MOCK_LLM_GAME_REPLY = `
* Reinforce Brussels — enemy pool shows 17.36K Manpower and 44 Armored.
* Consider pulling your armored divisions to avoid further losses.
* Watch supply lines before pushing again.
`.trim()

describe('coach pipeline (mock LLM stage)', () => {
  it('perception → router → playbook → rubric-ready mock reply', () => {
    const ax = { text: 'Hearts of Iron IV', appName: 'HOI4', windowTitle: 'Brussels' }
    const merged = mergeAccessibilityAndOcr(ax, GAME_LOG_OCR)
    expect(merged.textSource).toBe('ocr')
    expect(merged.appName).toBe('HOI4')

    const plan = resolvePerceptionPlan('auto', merged.text, ax)
    expect(plan.appName).toBe('HOI4')

    const req = resolveCoachRequest(merged.text, 'game', {
      appName: merged.appName,
      windowTitle: merged.windowTitle,
      textSource: plan.textSource
    })
    expect(req.kind).toBe('game-log')
    expect(req.instantReply).toBeUndefined()
    expect(req.userMessage).toContain('Brussels')

    const playbooks: Playbook[] = [
      {
        id: '1',
        name: 'HOI4 tips',
        content: 'Prioritize encirclements over frontal assaults.',
        isActive: true,
        modes: ['game'],
        createdAt: 1
      },
      {
        id: '2',
        name: 'Work notes',
        content: 'Sprint planning Friday.',
        isActive: true,
        modes: ['work'],
        createdAt: 2
      }
    ]

    const active = filterPlaybooksForMode(playbooks, 'game')
    expect(active).toHaveLength(1)
    const playbookBlock = buildPlaybookContext(active)
    expect(playbookBlock).toContain('encirclements')

    const fullUserMessage = `${playbookBlock}\n\n${req.userMessage}`
    expect(fullUserMessage).toContain('[PLAYBOOK: HOI4 tips]')
    expect(fullUserMessage).toContain('[ENTRIES')

    const score = scoreCoachReply(MOCK_LLM_GAME_REPLY, req.kind)
    expect(score.useful, score.reasons.join('; ')).toBe(true)
  })

  it('game mode IDE screen skips mock LLM (instant redirect)', () => {
    const merged = mergeAccessibilityAndOcr(
      { text: 'Cursor', appName: 'Cursor', windowTitle: 'Specter-AI' },
      'Cursor\nGEMINI_API_KEY\n.env'
    )
    const req = resolveCoachRequest(merged.text, 'game', {
      appName: merged.appName,
      windowTitle: merged.windowTitle
    })
    expect(req.instantReply).toBeTruthy()
    expect(req.userMessage).toBe('')

    const score = scoreCoachReply(req.instantReply!, req.kind)
    expect(score.useful, score.reasons.join('; ')).toBe(true)
  })

  it('work mode code error gets structured prompt without instant redirect', () => {
    const errorOcr = 'src/app.ts:10:5 - error TS2304: Cannot find name foo'
    const req = resolveCoachRequest(errorOcr, 'work', {
      appName: 'Cursor',
      windowTitle: 'app.ts'
    })
    expect(req.kind).toBe('code')
    expect(req.instantReply).toBeUndefined()
    expect(req.userMessage).toContain('Cannot find name foo')
    expect(req.userMessage).toContain('[ACTIVE APP] Cursor')
  })
})
