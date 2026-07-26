#!/usr/bin/env node
/**
 * Live E2E — general work coach: cropped screenshot + vision (same path as app).
 * Usage: pnpm test:work:crop [screenshot.png]
 */
import { config } from 'dotenv'
import { readFileSync } from 'fs'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
config({ path: join(root, '.env') })

// Import TS modules via dynamic path — use inline constants to avoid build dependency
const DEFAULT_WORK_COACH_SYSTEM_PROMPT = `You are a study and coding copilot watching the user's screen in real time.

Rules:
- The attached screenshot is a CROP of the active work window — treat it as the primary source of truth.
- OCR text in the user message is supplementary only; if it conflicts with the image, trust the image.
- Always reply in Vietnamese with concrete answers visible on screen.`

const defaultImage = join(
  process.env.HOME ?? '',
  '.cursor/projects/Users-huyriki-Desktop-PERFORMANCE-REVIEW/assets/Screenshot_2026-07-26_at_15.41.46-e6cbe58d-f677-4cef-b4c0-86d038270196.png'
)

async function main() {
  const imagePath = process.argv[2] ? resolve(process.argv[2]) : defaultImage
  const screenshot = readFileSync(imagePath).toString('base64')
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    console.error('Missing GEMINI_API_KEY in .env')
    process.exit(1)
  }
  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-3.6-flash'

  const screenText = '123test.com\nQuestion 1 of 8\nWhich figure belongs in the empty box?'
  const metadata = { appName: 'Google Chrome', windowTitle: '123test.com' }

  // Mirror app prompt assembly
  const req = {
    userMessage: [
      '[ACTIVE APP] Google Chrome',
      '[WINDOW] 123test.com',
      '[PROBLEM] visual-quiz',
      '',
      '[TASK]',
      'Screenshot attached — cropped active work window. Use the image as the primary source.',
      'Reply in Vietnamese with a concrete answer or next step visible on screen.',
      '',
      '[OCR — supplementary only]',
      screenText.slice(0, 800),
      '',
      '[REPLY FORMAT]',
      '**Đáp án:** chọn số 1–8. **Tại sao:** 1–2 câu.'
    ].join('\n')
  }

  const userContent = `${req.userMessage}\n\n[NOTE] A cropped screenshot of the user's active work window is attached. Use the image as primary context; OCR above is supplementary only.`

  console.log('Image:', imagePath)
  console.log('Model:', model)
  console.log('Flow: general crop + vision (work coach)\n')

  const t0 = Date.now()
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      max_tokens: 600,
      stream: false,
      messages: [
        { role: 'system', content: DEFAULT_WORK_COACH_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: userContent },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${screenshot}` } }
          ]
        }
      ]
    })
  })

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  if (!res.ok) {
    console.error(`HTTP ${res.status}:`, (await res.text()).slice(0, 500))
    process.exit(1)
  }
  const data = await res.json()
  const answer = data.choices?.[0]?.message?.content ?? ''
  console.log(`⏱ ${elapsed}s | tokens: ${data.usage?.total_tokens ?? '?'}\n`)
  console.log(answer)

  const hasAnswer = /\b8\b|đáp án|option/i.test(answer)
  if (!hasAnswer) {
    console.error('\nFAIL: response missing concrete answer')
    process.exit(2)
  }
  console.log('\nPASS')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
