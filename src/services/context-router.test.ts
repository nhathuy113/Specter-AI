import { describe, expect, it } from 'vitest'
import { extractScreenContext, resolveAssistantRequest } from './context-router'
import { parseGameLogEntries, formatGameLogEntries } from './skills/game-log'

const GAME_LOG_OCR = `
Brussels
2 hours ago.
Manpower: 23
Armored: 6
Air: 0
Other: 15
Manpower: 17.36K
Armored: 44
`.trim()

const IDE_OCR = `
Cursor File Edit Selection View
PERFORMANCE REVIEW tools Specter-AI
GEMINI_API_KEY .env
pnpm test:screen:live
`.trim()

describe('game-log skill', () => {
  it('parses structured combat log entries', () => {
    const entries = parseGameLogEntries(GAME_LOG_OCR.split('\n').map((l) => l.trim()).filter(Boolean))
    expect(entries).toHaveLength(1)
    expect(entries[0].location).toBe('Brussels')
    expect(entries[0].poolManpower).toBe('17.36K')
  })

  it('formats entries for the model', () => {
    const entries = parseGameLogEntries(GAME_LOG_OCR.split('\n').map((l) => l.trim()).filter(Boolean))
    const formatted = formatGameLogEntries(entries)
    expect(formatted).toContain('Brussels')
    expect(formatted).toContain('17.36K')
  })
})

describe('extractScreenContext', () => {
  it('detects game combat log', () => {
    const ctx = extractScreenContext(GAME_LOG_OCR, 'general')
    expect(ctx.kind).toBe('game-log')
    expect(ctx.focusedText).toContain('Brussels')
    expect(ctx.actionable).toBe(true)
  })

  it('allows IDE in general mode', () => {
    const ctx = extractScreenContext(IDE_OCR, 'general')
    expect(ctx.kind).toBe('ide')
    expect(ctx.actionable).toBe(true)
    expect(ctx.instantReply).toBeUndefined()
  })

  it('redirects IDE in game mode on dual monitor', () => {
    const ctx = extractScreenContext(IDE_OCR, 'game', { displayCount: 2 })
    expect(ctx.kind).toBe('ide')
    expect(ctx.instantReply?.toLowerCase()).toContain('game')
  })

  it('allows IDE in game mode on single monitor like other modes', () => {
    const ctx = extractScreenContext(IDE_OCR, 'game', { displayCount: 1 })
    expect(ctx.kind).toBe('ide')
    expect(ctx.actionable).toBe(true)
    expect(ctx.instantReply).toBeUndefined()
  })

  it('returns empty guidance for blank OCR', () => {
    const ctx = extractScreenContext('   ', 'general')
    expect(ctx.kind).toBe('empty')
    expect(ctx.actionable).toBe(false)
  })
})

describe('resolveAssistantRequest', () => {
  it('builds structured game-log message', () => {
    const req = resolveAssistantRequest(GAME_LOG_OCR, 'game')
    expect(req.kind).toBe('game-log')
    expect(req.userMessage).toContain('[ENTRIES')
    expect(req.userMessage).toContain('Brussels')
  })

  it('instant reply for game mode on IDE (dual monitor)', () => {
    const req = resolveAssistantRequest(IDE_OCR, 'game', { displayCount: 2 })
    expect(req.instantReply).toBeTruthy()
  })

  it('general mode sends IDE content to model', () => {
    const req = resolveAssistantRequest(IDE_OCR, 'general')
    expect(req.instantReply).toBeUndefined()
    expect(req.userMessage).toContain('[SCREEN TYPE]')
  })

  it('includes active app metadata in prompt', () => {
    const req = resolveAssistantRequest(
      IDE_OCR,
      'work',
      { appName: 'Cursor', windowTitle: 'Settings.tsx' }
    )
    expect(req.userMessage).toContain('[ACTIVE APP] Cursor')
    expect(req.userMessage).toContain('[WINDOW] Settings.tsx')
  })

  it('uses code-error skill for TS errors', () => {
    const req = resolveAssistantRequest(
      'src/app.ts:10:5 - error TS2304: Cannot find name foo\nCursor terminal output',
      'work',
      { appName: 'Cursor', windowTitle: 'app.ts' }
    )
    expect(req.kind).toBe('code')
    expect(req.userMessage).toContain('Cannot find name foo')
  })
})
