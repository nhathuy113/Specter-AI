#!/usr/bin/env node
/**
 * Fast LeetCode copilot via Gemini — target sub-10s per step.
 *
 *   pnpm ask:gemini                    # gemini-3.6-flash step 1
 *   pnpm ask:gemini -- --model gemini-3.1-flash-lite --step 2
 *   pnpm ask:gemini -- --compare       # benchmark models
 */
import { config } from 'dotenv'
import { readFileSync, existsSync } from 'fs'
import { homedir } from 'os'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
config({ path: join(root, '.env') })

const SETTINGS_PATH = join(homedir(), 'Library/Application Support/specter-ai/specter-settings.json')

const MEDIAN = {
  slug: 'median-of-two-sorted-arrays',
  title: '4. Median of Two Sorted Arrays',
  description: `Given two sorted arrays nums1 and nums2, return the median.
Overall runtime must be O(log(m+n)).`,
  signature: 'function findMedianSortedArrays(nums1, nums2)'
}

const PRIOR_BY_STEP = {
  1: [],
  2: ['Chọn mảng ngắn hơn làm nums1 (swap nếu cần)'],
  3: [
    'Chọn mảng ngắn hơn làm nums1 (swap nếu cần)',
    'Binary search partition i; j = (m+n+1)/2 - i'
  ],
  4: [
    'Chọn mảng ngắn hơn làm nums1 (swap nếu cần)',
    'Binary search partition i; j = (m+n+1)/2 - i',
    'Dùng -Infinity/Infinity cho partition ở biên'
  ]
}

const SYSTEM = `LeetCode copilot — Vietnamese, one step at a time.
Never output the full solution. Max 8-12 lines of code per step.
No LaTeX. Be concise.`

function buildUserPrompt(step) {
  const prior = PRIOR_BY_STEP[step] ?? []
  const priorBlock =
    prior.length > 0 ? ['Đã làm:', ...prior.map((s, i) => `${i + 1}. ${s}`), ''].join('\n') : ''

  return [
    `Bài: ${MEDIAN.title}`,
    MEDIAN.description,
    '',
    priorBlock,
    `Chỉ trả lời BƯỚC ${step} (tổng ~4 bước). KHÔNG làm hộ — snippet nhỏ thôi.`,
    '',
    `**Bước ${step}:** <tên>`,
    '**Làm gì:** 1 câu',
    '**Snippet:**',
    '```javascript',
    '```',
    '**Tiếp theo:** 1 câu'
  ].join('\n')
}

function loadSettings() {
  if (!existsSync(SETTINGS_PATH)) return {}
  try {
    return JSON.parse(readFileSync(SETTINGS_PATH, 'utf8'))
  } catch {
    return {}
  }
}

async function askGemini({ model, apiKey, step, maxTokens }) {
  const tokens = maxTokens ?? (model.includes('3.6') ? 1200 : 450)
  const t0 = Date.now()
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      max_tokens: tokens,
      temperature: 0.2,
      stream: false,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: buildUserPrompt(step) }
      ]
    })
  })

  const data = await res.json()
  const elapsedMs = Date.now() - t0

  if (!res.ok) {
    throw new Error(data.error?.message || `HTTP ${res.status}`)
  }

  const choice = data.choices?.[0]
  const text = choice?.message?.content?.trim()
  if (!text) throw new Error('Empty response')

  return {
    text,
    elapsedMs,
    usage: data.usage,
    finishReason: choice?.finish_reason
  }
}

function parseArgs(argv) {
  const opts = { step: 1, model: null, compare: false, help: false, maxTokens: null }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') opts.help = true
    else if (arg === '--compare') opts.compare = true
    else if (arg === '--step') opts.step = parseInt(argv[++i], 10) || 1
    else if (arg === '--model') opts.model = argv[++i]
    else if (arg === '--max-tokens') opts.maxTokens = parseInt(argv[++i], 10) || 1200
  }
  return opts
}

async function runOne(model, apiKey, step, maxTokens) {
  const { text, elapsedMs, usage, finishReason } = await askGemini({ model, apiKey, step, maxTokens })
  const sec = (elapsedMs / 1000).toFixed(2)
  const ok = elapsedMs < 10_000 ? '✅ sub-10s' : '⚠️ >10s'
  console.log(`\n=== ${model} | max_tokens=${maxTokens ?? (model.includes('3.6') ? 1200 : 450)} | step ${step} | ${sec}s ${ok} ===`)
  if (finishReason === 'length') console.log('warn: truncated (finish_reason=length)')
  if (usage) {
    console.log(`tokens: prompt ${usage.prompt_tokens ?? '?'} + completion ${usage.completion_tokens ?? '?'}`)
  }
  console.log(text)
  return elapsedMs
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    console.log(`pnpm ask:gemini [-- --step N] [--model gemini-3.6-flash] [--max-tokens 1200] [--compare]`)
    return
  }

  const settings = loadSettings()
  const apiKey = process.env.GEMINI_API_KEY?.trim() || settings.geminiApiKey?.trim()
  if (!apiKey) {
    console.error('Missing GEMINI_API_KEY')
    process.exit(1)
  }

  if (opts.compare) {
    const maxTok = opts.maxTokens ?? 1200
    const models = ['gemini-3.1-flash-lite', 'gemini-3.6-flash']
    const times = []
    for (const model of models) {
      try {
        const ms = await runOne(model, apiKey, opts.step, maxTok)
        times.push({ model, ms })
      } catch (err) {
        console.error(`\n=== ${model} FAILED ===`, err.message)
      }
    }
    console.log('\n--- benchmark ---')
    for (const { model, ms } of times.sort((a, b) => a.ms - b.ms)) {
      console.log(`${(ms / 1000).toFixed(2)}s  ${model}`)
    }
    return
  }

  const model =
    opts.model ||
    process.env.GEMINI_MODEL?.trim() ||
    settings.geminiModel?.trim() ||
    'gemini-3.6-flash'

  console.log(`Gemini copilot | model: ${model} | step: ${opts.step}${opts.maxTokens ? ` | max_tokens: ${opts.maxTokens}` : ''}`)
  try {
    await runOne(model, apiKey, opts.step, opts.maxTokens ?? undefined)
  } catch (err) {
    console.error('FAIL:', err.message)
    process.exit(1)
  }
}

main()
