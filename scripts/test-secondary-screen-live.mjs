#!/usr/bin/env node
/**
 * Live E2E: smart-crop capture + OCR (auto-detects single vs dual monitor).
 *
 * Usage: pnpm test:screen:live
 */
import { execSync } from 'child_process'
import { readFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import Tesseract from 'tesseract.js'

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

function getFrontWindow() {
  const raw = runOsascript(`
    tell application "System Events"
      set frontApp to first application process whose frontmost is true
      set appName to name of frontApp
      try
        tell frontApp
          set {x, y} to position of front window
          set {w, h} to size of front window
        end tell
        return (x as text) & "|" & (y as text) & "|" & (w as text) & "|" & (h as text) & "|" & appName
      on error
        return "0|0|0|0|" & appName
      end try
    end tell
  `)
  if (!raw) return null

  const [xs, ys, ws, hs, ...titleParts] = raw.split('|')
  const width = parseInt(ws, 10)
  const height = parseInt(hs, 10)
  if (!width || !height) {
    return { x: 0, y: 0, width: 0, height: 0, title: titleParts.join('|') }
  }
  return {
    x: parseInt(xs, 10),
    y: parseInt(ys, 10),
    width,
    height,
    title: titleParts.join('|')
  }
}

/** Parse system_profiler for display resolutions (primary first). */
function probeDisplays() {
  const out = execSync('system_profiler SPDisplaysDataType', { encoding: 'utf-8', timeout: 15000 })
  const resolutions = [...out.matchAll(/Resolution:\s+(\d+)\s+x\s+(\d+)/g)].map((m) => ({
    width: parseInt(m[1], 10),
    height: parseInt(m[2], 10)
  }))

  if (resolutions.length === 0) {
    throw new Error('No displays found via system_profiler')
  }

  let x = 0
  return resolutions.map((res, index) => {
    const display = {
      id: index + 1,
      label: index === 0 ? 'Primary' : `External-${index}`,
      isPrimary: index === 0,
      bounds: { x, y: 0, width: res.width, height: res.height }
    }
    x += res.width
    return display
  })
}

const IGNORED_ALWAYS = ['specter', 'electron']
const IGNORED_ON_DUAL_ONLY = ['cursor', 'google ai studio']

function isDualMonitor(displays) {
  return displays.length > 1
}

function shouldIgnoreActiveWindow(title, displays) {
  const lower = title.toLowerCase()
  if (IGNORED_ALWAYS.some((n) => lower.includes(n))) return true
  if (!isDualMonitor(displays)) return false
  return IGNORED_ON_DUAL_ONLY.some((n) => lower.includes(n))
}

function resolveSmartCapturePlan(activeWindow, displays) {
  let windowForPlan = activeWindow
  if (activeWindow?.title && shouldIgnoreActiveWindow(activeWindow.title, displays)) {
    windowForPlan = null
  } else if (activeWindow) {
    const { title: _t, ...rect } = activeWindow
    windowForPlan = rect
  }

  const primary = displays.find((d) => d.isPrimary) ?? displays[0]
  const secondary = displays.find((d) => !d.isPrimary) ?? null

  if (windowForPlan) {
    const cx = windowForPlan.x + windowForPlan.width / 2
    const cy = windowForPlan.y + windowForPlan.height / 2
    const windowDisplay =
      displays.find(
        (d) =>
          cx >= d.bounds.x &&
          cx < d.bounds.x + d.bounds.width &&
          cy >= d.bounds.y &&
          cy < d.bounds.y + d.bounds.height
      ) ?? primary

    if (secondary && windowDisplay.id !== primary.id) {
      return { type: 'window-crop', display: windowDisplay, displayIndex: displays.indexOf(windowDisplay) + 1 }
    }
    if (secondary) {
      return { type: 'display-full', display: secondary, displayIndex: displays.indexOf(secondary) + 1 }
    }
    return { type: 'window-crop', display: windowDisplay, displayIndex: displays.indexOf(windowDisplay) + 1 }
  }

  if (secondary) {
    return { type: 'display-full', display: secondary, displayIndex: displays.indexOf(secondary) + 1 }
  }
  return { type: 'display-full', display: primary, displayIndex: 1 }
}

function captureDisplay(displayIndex, outPath) {
  execSync(`screencapture -x -D ${displayIndex} "${outPath}"`, { timeout: 15000 })
  const buf = readFileSync(outPath)
  if (buf.length < 10_000) {
    throw new Error(`Capture too small (${buf.length} bytes) for display ${displayIndex}`)
  }
  return buf
}

async function ocrPng(buffer) {
  const result = await Tesseract.recognize(buffer, 'eng', { logger: () => {} })
  return result.data.text.trim()
}

console.log('==> Screen capture live E2E (auto-detect monitors)')

const displays = probeDisplays()
const dual = isDualMonitor(displays)
console.log(`  layout: ${dual ? 'dual' : 'single'} monitor (${displays.length} display(s))`)
console.log(`  displays: ${displays.map((d) => `${d.label} ${d.bounds.width}x${d.bounds.height}@x${d.bounds.x}`).join(', ')}`)

const frontWindow = getFrontWindow()
if (frontWindow) {
  console.log(`  front window: "${frontWindow.title}" @ (${frontWindow.x},${frontWindow.y}) ${frontWindow.width}x${frontWindow.height}`)
} else {
  console.log('  front window: (osascript unavailable — using display fallback)')
}

const plan = frontWindow
  ? resolveSmartCapturePlan(frontWindow, displays)
  : { type: 'display-full', display: dual ? displays[1] : displays[0], displayIndex: dual ? 2 : 1 }
console.log(`  smart-crop plan: ${plan.type} on ${plan.display.label} (screencapture -D ${plan.displayIndex})`)

const pngPath = join(tmpdir(), `specter-screen-e2e-${Date.now()}.png`)
try {
  const png = captureDisplay(plan.displayIndex, pngPath)
  console.log(`  capture: OK (${png.length} bytes)`)

  console.log('  OCR running...')
  const text = await ocrPng(png)
  const sample = text.replace(/\s+/g, ' ').slice(0, 240)

  console.log(`  OCR chars: ${text.length}`)
  console.log(`  OCR sample: ${sample || '(empty)'}`)

  if (text.length < 40) {
    console.error('FAIL: OCR text too short — check Screen Recording permission or display content')
    process.exit(1)
  }

  const hints = ['cursor', 'specter', 'performance', 'review', 'typescript', 'settings', 'gemini', '.env', 'tools']
  const lower = text.toLowerCase()
  const hits = hints.filter((h) => lower.includes(h))

  const isIdeChrome = hits.length >= 2 || (hits.includes('cursor') && hits.includes('.env'))
  if (isIdeChrome) {
    console.log('  assistant classify: ide (general mode → coach IDE; game mode → instant redirect)')
  } else if (/\bmanpower\b/i.test(text) && /\barmored\b/i.test(text)) {
    console.log('  assistant classify: game-log → tactical bullets')
  } else {
    console.log('  assistant classify: general/unknown screen')
  }

  if (hits.length === 0) {
    console.warn('  WARN: no IDE keyword hits in OCR (may still be valid UI text)')
  } else {
    console.log(`  OCR keyword hits: ${hits.join(', ')}`)
  }

  if (dual && plan.type !== 'display-full' && plan.displayIndex !== 2 && shouldIgnoreActiveWindow(frontWindow?.title ?? '', displays)) {
    console.warn(`  WARN: dual-monitor + IDE focus usually yields display-full on monitor 2, got ${plan.type} @ ${plan.displayIndex}`)
  }

  if (!dual && plan.type !== 'window-crop' && frontWindow && !shouldIgnoreActiveWindow(frontWindow.title, displays)) {
    console.warn(`  WARN: single-monitor usually window-crops focused app, got ${plan.type}`)
  }

  console.log(`PASS: ${dual ? 'dual' : 'single'}-monitor capture + OCR works`)
} finally {
  try {
    unlinkSync(pngPath)
  } catch {
    // ignore
  }
}
