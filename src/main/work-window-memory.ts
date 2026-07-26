import type { MacOSFrontWindowInfo } from './macos-front-window'
import { isSpecterForeground } from './macos-front-window'

/** Last browser window (Chrome/Safari…) — quiz / web homework. */
let lastBrowserWindow: MacOSFrontWindowInfo | null = null
/** Last non-dev foreground window. */
let lastWorkWindow: MacOSFrontWindowInfo | null = null

const BROWSER_APP = /\b(chrome|firefox|safari|brave|edge|opera)\b/i
const DEV_APP = /\b(specter|electron|cursor|vscode|visual studio|code|iterm|terminal|warp|zsh)\b/i
const WORK_TITLE = /\b(123test|iq test|quiz|leetcode|youtube|coursera|udemy)\b/i

export interface WorkWindowCropOptions {
  browserWindows?: MacOSFrontWindowInfo[]
  primaryBounds?: { x: number; y: number; width: number; height: number }
}

function isBrowserApp(info: MacOSFrontWindowInfo): boolean {
  return BROWSER_APP.test(info.appName) || BROWSER_APP.test(info.bundleId)
}

function isDevApp(info: MacOSFrontWindowInfo): boolean {
  return isSpecterForeground(info) || DEV_APP.test(`${info.appName} ${info.bundleId}`)
}

function windowCenterInBounds(
  window: MacOSFrontWindowInfo,
  bounds: { x: number; y: number; width: number; height: number }
): boolean {
  const cx = window.x + window.width / 2
  const cy = window.y + window.height / 2
  return (
    cx >= bounds.x &&
    cx < bounds.x + bounds.width &&
    cy >= bounds.y &&
    cy < bounds.y + bounds.height
  )
}

/** Prefer quiz browser on MacBook primary — not Cursor on external overlay monitor. */
export function pickBestBrowserWindow(
  windows: MacOSFrontWindowInfo[],
  primaryBounds?: { x: number; y: number; width: number; height: number }
): MacOSFrontWindowInfo | null {
  if (windows.length === 0) return null

  const scored = windows.map((w) => {
    let score = w.width * w.height
    const title = `${w.windowTitle} ${w.appName}`.toLowerCase()
    if (WORK_TITLE.test(title)) score += 1_000_000_000
    if (primaryBounds && windowCenterInBounds(w, primaryBounds)) score += 500_000_000
    return { w, score }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored[0]?.w ?? null
}

export function rememberWorkWindow(info: MacOSFrontWindowInfo | null): void {
  if (!info || isSpecterForeground(info)) return
  if (info.width < 50 || info.height < 50) return
  if (isBrowserApp(info)) lastBrowserWindow = info
  if (!isDevApp(info)) lastWorkWindow = info
}

/** Prefer live browser; when Specter/IDE has focus, scan all monitors for Chrome. */
export function resolveWorkWindowForCrop(
  current: MacOSFrontWindowInfo | null,
  opts: WorkWindowCropOptions = {}
): MacOSFrontWindowInfo | null {
  if (current && isBrowserApp(current)) {
    lastBrowserWindow = current
    lastWorkWindow = current
    return current
  }

  if (current && !isDevApp(current)) {
    lastWorkWindow = current
    return current
  }

  if (lastBrowserWindow) return lastBrowserWindow

  const scanned = pickBestBrowserWindow(opts.browserWindows ?? [], opts.primaryBounds)
  if (scanned) {
    lastBrowserWindow = scanned
    return scanned
  }

  if (current && isDevApp(current) && !isSpecterForeground(current)) {
    return current
  }

  return lastBrowserWindow ?? lastWorkWindow
}

export function getRememberedWorkWindow(): MacOSFrontWindowInfo | null {
  return lastBrowserWindow ?? lastWorkWindow
}

export function resetWorkWindowMemory(): void {
  lastBrowserWindow = null
  lastWorkWindow = null
}
