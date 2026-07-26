#!/usr/bin/env node
/**
 * Live + real-OCR coach loop. Exit 0 only when both fixtures produce helpful replies.
 */
import { config } from 'dotenv'
import { readFileSync } from 'fs'
import { homedir } from 'os'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
config({ path: resolve(root, '.env') })

const apiKey = process.env.GEMINI_API_KEY?.trim()
const model = process.env.GEMINI_MODEL?.trim() || 'gemini-3.1-flash-lite'
if (!apiKey) {
  console.error('FAIL: GEMINI_API_KEY missing')
  process.exit(1)
}

const CLEAN = `TypeError: None is not valid value
class Solution:
    def findMedianSortedArrays(self, nums1, nums2):
        m, n = len(nums1), len(nums2)
        if m > n:
            nums1, nums2 = nums2, nums1
        left, right = 0, m
        while left <= right:
            index = (left + right) / 2
        return float(result)`

const NOISY = readFileSync(resolve(root, 'src/services/fixtures/leetcode-median-noisy-ocr.txt'), 'utf8')

const SYSTEM = `You are a study copilot. Reply in Vietnamese ONLY using exactly these 4 markdown headers:
**Kẹt ở đâu:**
**Giải thích lại:**
**Snippet thay thế:**
**Tại sao:**

User HAS real partition/binary-search code — review it, patch 3-5 lines in a fenced python block. Never suggest sorted(nums1+nums2). No LaTeX.`

function scoreReply(text) {
  const bad = []
  const good = []
  if (/sorted\s*\(\s*nums1\s*\+\s*nums2/i.test(text)) bad.push('brute force sorted()')
  if (/\*\*Trạng thái:\*\*/.test(text)) bad.push('6-section reset')
  if (!/\*\*Kẹt ở đâu:\*\*|#{1,3}\s*\d*\.?\s*Kẹt ở đâu|^Kẹt ở đâu/m.test(text)) bad.push('missing 4-section')
  if (!/```/.test(text)) bad.push('no snippet')
  if (/maxleft|minright|max_left|left.*right|partition|while/i.test(text)) good.push('partition-aware')
  if (/\*\*Kẹt ở đâu:\*\*/.test(text)) good.push('4-section')
  return { bad, good, pass: bad.length === 0 && good.length >= 2 }
}

function cleanOcr(text) {
  const lines = []
  for (const raw of text.split('\n')) {
    let line = raw.trim()
    const n = line.match(/^\d{1,2}\s+(.+)/)
    if (n) line = n[1]
    if (/def findMedian|while |if |return |maxLeft|minRight|A, B|left, right|float\(/i.test(line)) {
      if (!/problemlist|example|input:|output:|explanation:/i.test(line)) lines.push(line)
    }
  }
  const i = lines.findIndex((l) => /def findMedian/i.test(l))
  return lines.slice(i >= 0 ? i : 0, i >= 0 ? i + 30 : 30).join('\n')
}

function buildPrompt(screenText, label) {
  const editor = cleanOcr(screenText)
  return [
    `[FIXTURE: ${label}]`,
    'TypeError: None is not valid value',
    '',
    '[EDITOR CODE ON SCREEN]',
    '```',
    editor,
    '```',
    '',
    'Review THEIR code. Patch 3-5 lines. No sorted-merge rewrite. 4 sections only.'
  ].join('\n')
}

async function callGemini(userPrompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: `${SYSTEM}\n\n${userPrompt}` }] }],
      generationConfig: { maxOutputTokens: 1200, temperature: 0.35 }
    })
  })
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? ''
}

async function runCase(name, screenText) {
  const prompt = buildPrompt(screenText, name)
  console.log(`\n==> ${name} (prompt ${prompt.length} chars)`)
  const reply = await callGemini(prompt)
  const score = scoreReply(reply)
  console.log('--- reply (head) ---')
  console.log(reply.slice(0, 600))
  console.log('--- score ---', score)
  return score.pass
}

let ok = true
ok = (await runCase('clean', CLEAN)) && ok
ok = (await runCase('real-noisy-ocr', NOISY)) && ok

console.log(ok ? '\nALL PASS' : '\nFAIL')
process.exit(ok ? 0 : 1)
