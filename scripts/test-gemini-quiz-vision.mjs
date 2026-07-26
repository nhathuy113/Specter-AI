#!/usr/bin/env node
/**
 * Live test — Gemini vision for IQ quiz (slim prompt, no OCR dump).
 */
import { config } from 'dotenv'
import { readFileSync } from 'fs'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
config({ path: join(root, '.env') })

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai'
const WORK_COACH_QUIZ_SYSTEM_PROMPT = `Bạn giải bài IQ / hình trên screenshot đính kèm.
Trả lời tiếng Việt, ngắn: **Đáp án:** (chọn số 1–8 nếu có lựa chọn) + **Tại sao:** 1–2 câu.
Không code. Không yêu cầu user tự suy luận thêm.`

const defaultImage = join(
  process.env.HOME ?? '',
  '.cursor/projects/Users-huyriki-Desktop-PERFORMANCE-REVIEW/assets/Screenshot_2026-07-26_at_15.41.46-e6cbe58d-f677-4cef-b4c0-86d038270196.png'
)

const QUIZ_USER = `[PROBLEM] visual-quiz
123test.com — Question 1 of 8

[TASK]
Screenshot đính kèm — nhìn hình và chốt đáp án.
Trả lời tiếng Việt ngắn: **Đáp án:** (số 1–8, đếm trái→phải trên→dưới) + **Tại sao:** 1–2 câu.
Không code. Không bắt user tự làm.

[NOTE] A screenshot of the user's screen is attached. Use both the text above and the image.`

async function main() {
  const imagePath = process.argv[2] ? resolve(process.argv[2]) : defaultImage
  const screenshot = readFileSync(imagePath).toString('base64')
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    console.error('Missing GEMINI_API_KEY in .env')
    process.exit(1)
  }
  const model = process.env.GEMINI_QUIZ_MODEL?.trim() || 'gemini-3.6-flash'

  console.log('Image:', imagePath)
  console.log('Model:', model)
  console.log('Slim quiz prompt (no OCR dump)\n')

  const t0 = Date.now()
  const res = await fetch(`${GEMINI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      max_tokens: 400,
      stream: false,
      messages: [
        { role: 'system', content: WORK_COACH_QUIZ_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: QUIZ_USER },
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
  console.log(`⏱ ${elapsed}s | tokens: ${data.usage?.total_tokens ?? '?'}\n`)
  console.log(data.choices?.[0]?.message?.content ?? '(empty)')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
