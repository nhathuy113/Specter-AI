#!/usr/bin/env node
/**
 * Preview how each coach engine explains (same prompt as overlay).
 *   pnpm test:coach-explain
 */
import { config } from 'dotenv'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
config({ path: join(root, '.env') })

const SYSTEM = `You are a study and coding copilot watching the user's screen in real time.
Always reply in Vietnamese using 6 sections: Trạng thái → Vấn đề → Giải thích → Giải pháp → Đọc code → Tại sao.
Tại sao = 2-3 sentences. Code max 3-5 lines with Vietnamese comments. No LaTeX.
When user has NOT applied prior hint: re-teach SAME step slower, simpler code, fuller Tại sao.`

const SCREEN = `[ACTIVE APP] Work: Built-in Retina Display
[WINDOW] LeetCode

4. Median of Two Sorted Arrays
Hard

class Solution:
    def findMedianSortedArrays(self, nums1: List[int], nums2: List[int]) -> float:
        pass`

const USER = `[CONTENT]
${SCREEN}

[TASK — GIẢI THÍCH BÀI TRÊN MÀN HÌNH]
Trả lời tiếng Việt đơn giản — như giảng cho bạn chưa quen thuật toán.

**Trạng thái:** ...
**Vấn đề:** ...
**Giải thích:** ... ví dụ [1,3] và [2]
**Giải pháp:** max 3-5 dòng Python, comment # tiếng Việt
**Đọc code:** 2-4 gạch đầu dòng
**Tại sao:** 2-3 câu bắt buộc

[NGƯỜI DÙNG CHƯA ÁP DỤNG GỢI Ý — GIẢNG LẠI CHI TIẾT HƠN]
Coach lần trước gợi ý: "Nếu len(nums1) > len(nums2) thì swap hai mảng — luôn binary search trên mảng ngắn hơn."
User vẫn để code pass. Giảng lại bước đó từ đầu, chậm hơn, code 1-2 dòng đơn giản.`

async function askGemini(model, apiKey) {
  const t0 = Date.now()
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: USER }
      ],
      max_tokens: model.includes('3.6') ? 1200 : 900,
      temperature: 0.4
    })
  })
  const data = await res.json()
  const text = data.choices?.[0]?.message?.content ?? data.error?.message ?? JSON.stringify(data)
  return { model, sec: ((Date.now() - t0) / 1000).toFixed(1), text }
}

function printBlock(title, { model, sec, text }) {
  console.log('\n' + '='.repeat(72))
  console.log(`${title} (${model}, ${sec}s)`)
  console.log('='.repeat(72))
  console.log(text.trim() || '(empty)')
}

async function main() {
  const geminiKey = process.env.GEMINI_API_KEY?.trim()
  if (!geminiKey) {
    console.error('Missing GEMINI_API_KEY in .env')
    process.exit(1)
  }

  console.log('Scenario: Median #4 — user stuck, chưa apply "swap mảng ngắn hơn"')
  console.log('Running 2 Gemini models in parallel...\n')

  const tasks = [
    askGemini('gemini-3.1-flash-lite', geminiKey).then((r) => ({
      label: 'Cột 1: Gemini 3.1 Lite',
      ...r
    })),
    askGemini('gemini-3.6-flash', geminiKey).then((r) => ({
      label: 'Cột 2: Gemini 3.6 Flash',
      ...r
    }))
  ]

  const results = await Promise.all(tasks)
  for (const r of results) {
    printBlock(r.label, r)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
