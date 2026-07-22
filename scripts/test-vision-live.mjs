#!/usr/bin/env node
/**
 * Live Gemini vision test — secondary monitor screenshot + multimodal completion.
 * Usage: pnpm test:vision:live
 */
import { config } from 'dotenv'
import { execSync } from 'child_process'
import { readFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
config({ path: resolve(root, '.env') })

const apiKey = process.env.GEMINI_API_KEY?.trim()
const model = process.env.GEMINI_MODEL?.trim() || 'gemini-3.1-flash-lite'

if (!apiKey) {
  console.error('FAIL: GEMINI_API_KEY missing in .env')
  process.exit(1)
}

const pngPath = join(tmpdir(), `specter-vision-e2e-${Date.now()}.png`)

function captureSecondary() {
  execSync(`screencapture -x -D 2 "${pngPath}"`, { timeout: 15000 })
  const buf = readFileSync(pngPath)
  if (buf.length < 10_000) {
    throw new Error(`Capture too small (${buf.length} bytes)`)
  }
  return buf.toString('base64')
}

async function visionChat(imageBase64) {
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
        {
          role: 'system',
          content: 'You are a virtual screen assistant. Recommend only — never claim you clicked anything. Reply in 1-3 short bullets.'
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '[TASK] Look at the screenshot. What is the user doing and what should they consider doing next? Be specific to visible UI.'
            },
            {
              type: 'image_url',
              image_url: { url: `data:image/png;base64,${imageBase64}` }
            }
          ]
        }
      ]
    })
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || `chat ${res.status}`)
  const text = data.choices?.[0]?.message?.content?.trim()
  if (!text) throw new Error('empty completion')
  return text
}

function scoreVisionReply(reply) {
  const lower = reply.toLowerCase()
  if (reply.length < 30) return { ok: false, reason: 'too short' }

  const junk = [/configure your api key/, /\bgemini api key\b/i, /add your openrouter/i]
  for (const pattern of junk) {
    if (pattern.test(lower)) return { ok: false, reason: 'off-topic setup junk' }
  }

  const actionable =
    /\b(check|consider|open|review|next|try|focus|click|read|use|debug|run|verify|proceed|update|test|look|ensure|confirm|watch|implement|fix|continue|start|stop)\b/i
  const context =
    /\b(screen|window|app|cursor|browser|game|file|terminal|code|ui|editor|settings|package|script|workflow|project|test|specter|chat|agent)\b/i

  if (!actionable.test(lower)) return { ok: false, reason: 'missing actionable verb' }
  if (!context.test(lower)) return { ok: false, reason: 'missing UI/context terms' }
  return { ok: true }
}

console.log(`==> Gemini vision live test (model: ${model})`)

try {
  const imageBase64 = captureSecondary()
  console.log(`  capture: OK (${Math.round(imageBase64.length / 1024)}KB base64)`)

  const reply = await visionChat(imageBase64)
  const score = scoreVisionReply(reply)

  console.log('  vision reply:')
  console.log('  ---')
  console.log(reply.slice(0, 700))
  console.log('  ---')

  if (!score.ok) {
    console.error(`FAIL: ${score.reason}`)
    process.exit(1)
  }

  console.log('  vision rubric: PASS')
  console.log('PASS')
} catch (err) {
  console.error('FAIL:', err instanceof Error ? err.message : err)
  process.exit(1)
} finally {
  try {
    unlinkSync(pngPath)
  } catch {
    // ignore
  }
}
