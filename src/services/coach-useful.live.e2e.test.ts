import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'
import { buildCoachSystemPrompt, resolveCoachRequest } from './coach-prompt'
import { scoreCoachReply } from './coach-usefulness'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
config({ path: resolve(root, '.env') })

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

async function callGeminiCoach(systemPrompt: string, userMessage: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-3.1-flash-lite'
  if (!apiKey) throw new Error('GEMINI_API_KEY missing')

  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      max_tokens: 220,
      stream: false,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ]
    })
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || `chat ${res.status}`)
  const text = data.choices?.[0]?.message?.content?.trim()
  if (!text) throw new Error('empty completion')
  return text
}

describe('assistant useful live e2e', () => {
  it('game mode + IDE OCR → instant redirect on dual monitor (no API)', () => {
    const req = resolveCoachRequest(IDE_OCR, 'game', { displayCount: 2 })
    expect(req.kind).toBe('ide')
    expect(req.instantReply).toBeTruthy()
    const score = scoreCoachReply(req.instantReply!, 'ide')
    expect(score.useful, score.reasons.join('; ')).toBe(true)
  })

  it('game mode + combat log → Gemini tactical reply', async () => {
    const apiKey = process.env.GEMINI_API_KEY?.trim()
    if (!apiKey) {
      console.log('SKIP: GEMINI_API_KEY not set')
      return
    }

    const req = resolveCoachRequest(GAME_LOG_OCR, 'game')
    expect(req.kind).toBe('game-log')
    expect(req.instantReply).toBeUndefined()
    expect(req.userMessage).toContain('[ENTRIES')

    const reply = await callGeminiCoach(buildCoachSystemPrompt(''), req.userMessage)
    console.log('\n--- game-log coach reply ---\n', reply, '\n----------------------------\n')

    const score = scoreCoachReply(reply, 'game-log')
    expect(score.useful, score.reasons.join('; ')).toBe(true)
  }, 60_000)
})
