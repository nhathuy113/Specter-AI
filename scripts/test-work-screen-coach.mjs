#!/usr/bin/env node
/**
 * Live test: capture what's on your pinned work screen and ask Gemini like Specter work coach.
 * Does NOT require the Specter app to be running — uses the same .env + specter-settings.json.
 *
 * Usage:
 *   pnpm ask:screen
 *   pnpm ask:screen -- --coach
 *   pnpm ask:screen -- --display 1 --save /tmp/screen.png
 *   node scripts/test-work-screen-coach.mjs --query "Giải thích biểu đồ GDP trên slide"
 */
import { config } from 'dotenv'
import { execSync } from 'child_process'
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs'
import { homedir, tmpdir } from 'os'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import Tesseract from 'tesseract.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
config({ path: resolve(root, '.env') })

const SETTINGS_PATH = join(homedir(), 'Library/Application Support/specter-ai/specter-settings.json')

const DEFAULT_WORK_COACH_SYSTEM_PROMPT = `You are a study and coding copilot watching the user's screen in real time.

Rules:
- Answer ONLY from the current screen capture below. Ignore activity logs, chat history, and files not visible on screen.
- When homework, math, quiz, or exercise questions are visible: give the answer or the very next step to solve it.
- When a video, article, or lecture is visible (YouTube, PDF, browser): summarize key facts and numbers shown; explain the slide/topic in plain language.
- When slides, a whiteboard, or charts are visible: explain like a tutor at the board — define terms, walk through each formula/number step by step, then give the takeaway.
- When code or IDE is visible: suggest the fix, next line, or refactor — be specific.
- Match the language on screen (Vietnamese or English).
- 1-4 short bullets max. Quote numbers, formulas, or error text exactly as shown on screen.
- Never suggest opening unrelated files, game mods, or past projects unless they appear on screen.
- Never claim you clicked, typed, or submitted anything.
- If the screen is unclear, say what to scroll or pause in one sentence.
- When a session summary is provided, continue from it — add new facts only, do not repeat.
- End every reply with ---THREAD--- then 2-3 sentences: running study notes for this same screen/video.`

function parseArgs(argv) {
  const opts = {
    mode: 'explain',
    display: null,
    save: null,
    noVision: false,
    query: null,
    help: false
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') opts.help = true
    else if (arg === '--coach') opts.mode = 'coach'
    else if (arg === '--explain') opts.mode = 'explain'
    else if (arg === '--no-vision') opts.noVision = true
    else if (arg === '--display') opts.display = parseInt(argv[++i], 10)
    else if (arg === '--save') opts.save = argv[++i]
    else if (arg === '--query' || arg === '-q') opts.query = argv[++i]
    else if (!arg.startsWith('-') && !opts.query) opts.query = arg
  }

  return opts
}

function printHelp() {
  console.log(`Specter work-screen coach (live CLI)

Captures your pinned work display + calls Gemini like Specter coach.
Reads: tools/Specter-AI/.env and ~/Library/Application Support/specter-ai/specter-settings.json

Usage:
  pnpm ask:screen
  pnpm ask:screen -- --coach
  pnpm ask:screen -- --display 2
  pnpm ask:screen -- --query "Giải thích bài trên màn hình"
  pnpm ask:screen -- --save /tmp/screen.png

Options:
  --explain     Explain slide/board/video (default)
  --coach       Continuous coach style — next step recommendation
  --display N   screencapture -D N (1=primary, 2=external, …)
  --no-vision   OCR text only, no screenshot to model
  --save PATH   Keep PNG capture at PATH
  --query, -q   Custom user prompt
`)
}

function loadSpecterSettings() {
  if (!existsSync(SETTINGS_PATH)) return {}
  try {
    return JSON.parse(readFileSync(SETTINGS_PATH, 'utf-8'))
  } catch {
    return {}
  }
}

function runOsascript(script, timeoutMs = 8000) {
  try {
    return execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
      encoding: 'utf-8',
      timeout: timeoutMs
    }).trim()
  } catch {
    return null
  }
}

function getFrontApp() {
  const raw = runOsascript(`
    tell application "System Events"
      set frontApp to first application process whose frontmost is true
      set appName to name of frontApp
      try
        tell frontApp
          set wTitle to name of front window
        end tell
        return appName & "|" & wTitle
      on error
        return appName & "|"
      end try
    end tell
  `)
  if (!raw) return { appName: 'unknown', windowTitle: '' }
  const [appName, ...rest] = raw.split('|')
  return { appName, windowTitle: rest.join('|') }
}

function probeDisplays() {
  const out = execSync('system_profiler SPDisplaysDataType', { encoding: 'utf-8', timeout: 15000 })
  const resolutions = [...out.matchAll(/Resolution:\s+(\d+)\s+x\s+(\d+)/g)].map((m) => ({
    width: parseInt(m[1], 10),
    height: parseInt(m[2], 10)
  }))

  if (resolutions.length === 0) {
    throw new Error('No displays found — check Screen Recording permission')
  }

  let x = 0
  return resolutions.map((res, index) => {
    const display = {
      index: index + 1,
      label: index === 0 ? 'Primary (Built-in)' : `External-${index}`,
      isPrimary: index === 0,
      bounds: { x, y: 0, width: res.width, height: res.height }
    }
    x += res.width
    return display
  })
}

function resolveCaptureDisplayIndex(settings, displays, cliDisplay) {
  if (cliDisplay && cliDisplay >= 1 && cliDisplay <= displays.length) {
    return { index: cliDisplay, reason: `--display ${cliDisplay}` }
  }

  const workEnabled = !!settings.workAreaCaptureEnabled
  const workDisplayId = settings.workAreaDisplayId

  if (workEnabled && (workDisplayId === 0 || workDisplayId == null)) {
    return { index: 1, reason: 'workAreaDisplayId=0 → primary MacBook' }
  }

  if (workEnabled && typeof workDisplayId === 'number' && workDisplayId > 0) {
    console.warn(
      `  WARN: workAreaDisplayId=${workDisplayId} is an Electron ID — using primary. Pass --display 2 for external.`
    )
    return { index: 1, reason: 'pinned work area (primary fallback)' }
  }

  return { index: 1, reason: 'default primary display' }
}

function captureDisplay(displayIndex, outPath) {
  execSync(`screencapture -x -D ${displayIndex} "${outPath}"`, { timeout: 20000 })
  const buf = readFileSync(outPath)
  if (buf.length < 8000) {
    throw new Error(`Capture too small (${buf.length} bytes) — grant Screen Recording to Terminal/Cursor`)
  }
  return buf
}

async function ocrPng(buffer) {
  const result = await Tesseract.recognize(buffer, 'eng', { logger: () => {} })
  return result.data.text.trim()
}

function buildExplainUserMessage(screenText, metadata) {
  const ocrBlock = screenText
    ? ['[SCREEN OCR]', screenText.slice(0, 4000), ''].join('\n')
    : ''

  return [
    ocrBlock,
    `[CONTEXT] app=${metadata.appName || '?'} window="${(metadata.windowTitle || '').slice(0, 120)}"`,
    '',
    '[TASK — GIẢI THÍCH BÀI TRÊN MÀN HÌNH]',
    'Giải thích như giáo viên đang dạy trên bảng/slide/video:',
    '1) Chủ đề là gì (1 câu)',
    '2) Giải thích từng ý, công thức, biểu đồ, số liệu nhìn thấy — từng bước',
    '3) Kết luận ngắn / ý cần nhớ',
    'Chỉ dùng nội dung trên màn hình. Không gợi ý file hay app khác.'
  ]
    .filter(Boolean)
    .join('\n')
}

function buildCoachUserMessage(screenText, metadata) {
  const ocrBlock = screenText
    ? ['[SCREEN OCR]', screenText.slice(0, 4000), ''].join('\n')
    : ''

  return [
    ocrBlock,
    `[CONTEXT] app=${metadata.appName || '?'} window="${(metadata.windowTitle || '').slice(0, 120)}"`,
    '',
    '[TASK]',
    'Recommend what the user should do next based on what is visible on screen.',
    '1-3 short bullets. Quote visible numbers, errors, or UI labels.'
  ].join('\n')
}

function appendSessionThread(userMessage, settings, screenText) {
  const saved = settings.workCoachSession
  if (!saved?.thread?.trim()) {
    return [
      userMessage,
      '',
      'End with ---THREAD--- and 2-3 sentences: topic + key facts covered on this screen so far.'
    ].join('\n')
  }

  return [
    '[SESSION ON THIS SCREEN SO FAR — continue the narrative, do not repeat earlier points]',
    saved.thread.trim(),
    '',
    userMessage,
    '',
    'Describe ONLY what is new on screen now. Update ---THREAD--- at the end.'
  ].join('\n')
}

function stripThreadForDisplay(reply) {
  const idx = reply.indexOf('---THREAD---')
  if (idx < 0) return reply.trim()
  return reply.slice(0, idx).trim()
}

function extractThread(reply) {
  const idx = reply.indexOf('---THREAD---')
  if (idx < 0) return ''
  return reply.slice(idx + '---THREAD---'.length).trim()
}

async function askGemini({ systemPrompt, userMessage, imageBase64, model, apiKey, useVision }) {
  const userContent = useVision && imageBase64
    ? [
        { type: 'text', text: userMessage },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } }
      ]
    : userMessage

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
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ]
    })
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || `Gemini HTTP ${res.status}`)
  const text = data.choices?.[0]?.message?.content?.trim()
  if (!text) throw new Error('Empty Gemini response')
  return text
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    printHelp()
    process.exit(0)
  }

  const settings = loadSpecterSettings()
  const apiKey = process.env.GEMINI_API_KEY?.trim() || settings.geminiApiKey?.trim()
  const model = process.env.GEMINI_MODEL?.trim() || settings.geminiModel?.trim() || 'gemini-3.1-flash-lite'

  if (!apiKey) {
    console.error('FAIL: GEMINI_API_KEY missing in .env or specter-settings.json')
    process.exit(1)
  }

  console.log('==> Specter work-screen coach (CLI)')
  console.log(`  model: ${model}`)
  console.log(`  mode: ${opts.mode}`)
  console.log(`  settings: ${existsSync(SETTINGS_PATH) ? SETTINGS_PATH : '(defaults only)'}`)

  const displays = probeDisplays()
  const { index: displayIndex, reason } = resolveCaptureDisplayIndex(settings, displays, opts.display)
  const display = displays.find((d) => d.index === displayIndex) ?? displays[0]

  console.log(`  layout: ${displays.length} display(s) — ${displays.map((d) => `#${d.index} ${d.label}`).join(', ')}`)
  console.log(`  capture: display #${displayIndex} (${display.label}) — ${reason}`)

  const front = getFrontApp()
  const metadata = {
    appName: `Work: ${display.label}`,
    windowTitle: front.windowTitle || front.appName
  }
  console.log(`  front app (info only): ${front.appName}${front.windowTitle ? ` — "${front.windowTitle.slice(0, 60)}"` : ''}`)

  const pngPath = join(tmpdir(), `specter-ask-screen-${Date.now()}.png`)
  let pngBuf

  try {
    pngBuf = captureDisplay(displayIndex, pngPath)
    console.log(`  screenshot: OK (${Math.round(pngBuf.length / 1024)}KB)`)

    if (opts.save) {
      writeFileSync(opts.save, pngBuf)
      console.log(`  saved: ${opts.save}`)
    }

    console.log('  OCR running...')
    const screenText = await ocrPng(pngBuf)
    console.log(`  OCR: ${screenText.length} chars`)

    let userMessage =
      opts.query?.trim() ||
      (opts.mode === 'coach'
        ? buildCoachUserMessage(screenText, metadata)
        : buildExplainUserMessage(screenText, metadata))

    if (!opts.query) {
      userMessage = appendSessionThread(userMessage, settings, screenText)
    }

    const useVision = !opts.noVision
    console.log(`  vision: ${useVision ? 'ON (screenshot + OCR)' : 'OFF (OCR only)'}`)
    console.log('  calling Gemini...')

    const reply = await askGemini({
      systemPrompt: DEFAULT_WORK_COACH_SYSTEM_PROMPT,
      userMessage,
      imageBase64: pngBuf.toString('base64'),
      model,
      apiKey,
      useVision
    })

    const displayReply = stripThreadForDisplay(reply)
    const thread = extractThread(reply)

    console.log('')
    console.log('--- Specter reply ---')
    console.log(displayReply)
    console.log('---')
    if (thread) {
      console.log('')
      console.log('--- session thread ---')
      console.log(thread)
      console.log('---')
    }
    console.log('')
    console.log('PASS')
  } catch (err) {
    console.error('FAIL:', err instanceof Error ? err.message : err)
    process.exit(1)
  } finally {
    if (!opts.save) {
      try {
        unlinkSync(pngPath)
      } catch {
        // ignore
      }
    }
  }
}

main()
