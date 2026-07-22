#!/usr/bin/env node
/**
 * Live Gemini useful assistant test — general screen assistant prompt + rubric.
 * Usage: pnpm test:gemini:live
 */
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
config({ path: resolve(root, '.env') })

const apiKey = process.env.GEMINI_API_KEY?.trim()
const model = process.env.GEMINI_MODEL?.trim() || 'gemini-3.1-flash-lite'

const GAME_LOG_OCR = `
Brussels
Manpower: 23
Armored: 6
Manpower: 17.36K
Armored: 44
`.trim()

const DEFAULT_COACH_SYSTEM_PROMPT = `You are a virtual screen assistant. The user performs every click and keystroke — you recommend only.

Rules:
- Read the screen context provided. Be direct and useful.
- Reply with 1-3 short bullets: situation → suggested next step → optional watch-out.
- Quote specific text, numbers, or errors from the screen when visible.
- Never claim you clicked, typed, or completed anything.
- Never mention API keys, Specter settings, or developer setup unless the user is clearly configuring those.
- If context is insufficient, say what is missing in one sentence.
- Be concise. No filler or meta-commentary.
- Never reveal you are an AI assistant unless directly asked.`

function buildGameLogUserMessage() {
  return [
    '[SCREEN TYPE] Game combat log (structured OCR)',
    '[ENTRIES — newest first]',
    '1. Brussels — Losses: Manpower 23, Armored 6 — Enemy pool (if shown): Manpower 17.36K, Armored 44',
    '',
    '[TASK]',
    'Give 2-3 tactical bullets: battle read using visible numbers → concrete in-game action → optional risk.',
    'Quote specific stats from the log. Never mention API keys or IDE setup.'
  ].join('\n')
}

function scoreUsefulness(reply) {
  const lower = reply.toLowerCase()
  const bad = [/api key/, /\.env/, /openrouter/, /specter settings/]
  for (const p of bad) {
    if (p.test(lower)) return { ok: false, reason: `junk: ${p}` }
  }
  if (reply.length < 25) return { ok: false, reason: 'too short' }
  if (!/\b(manpower|armored|division|front|reinforce|pause|supply|micro|battle|in-game)\b/i.test(lower)) {
    return { ok: false, reason: 'missing game tactical terms' }
  }
  if (!/\b(check|consider|reinforce|pause|pull|micro|watch|open|shift|add|hold|attack|retreat)\b/i.test(lower)) {
    return { ok: false, reason: 'missing actionable verb' }
  }
  return { ok: true }
}

const baseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai'

async function validateKey() {
  const res = await fetch(`${baseUrl}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` }
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `models list ${res.status}`)
  }
}

async function chatOnce() {
  const res = await fetch(`${baseUrl}/chat/completions`, {
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
        { role: 'system', content: DEFAULT_COACH_SYSTEM_PROMPT },
        { role: 'user', content: buildGameLogUserMessage() }
      ]
    })
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error?.message || `chat ${res.status}`)
  }

  const text = data.choices?.[0]?.message?.content?.trim()
  if (!text) throw new Error('empty completion')
  return text
}

if (!apiKey) {
  console.error('FAIL: GEMINI_API_KEY missing in .env')
  process.exit(1)
}

console.log(`==> Gemini useful assistant test (model: ${model})`)

try {
  await validateKey()
  console.log('  validate key: OK')

  const reply = await chatOnce()
  const score = scoreUsefulness(reply)
  console.log('  assistant reply:')
  console.log('  ---')
  console.log(reply.slice(0, 600))
  console.log('  ---')

  if (!score.ok) {
    console.error(`FAIL: reply not useful (${score.reason})`)
    process.exit(1)
  }

  console.log('  usefulness rubric: PASS')
  console.log('PASS')
} catch (err) {
  console.error('FAIL:', err instanceof Error ? err.message : err)
  process.exit(1)
}
