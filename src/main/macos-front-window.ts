import { execFileSync } from 'child_process'
import path from 'path'

export interface MacOSFrontWindowInfo {
  x: number
  y: number
  width: number
  height: number
  pid: number
  bundleId: string
  appName: string
  windowTitle: string
}

const SPECTER_BUNDLE = 'com.specter.ai'

export function isSpecterForeground(info: MacOSFrontWindowInfo | null): boolean {
  if (!info) return false
  return info.bundleId === SPECTER_BUNDLE || /specter|electron/i.test(info.appName)
}

/** Parse `x|y|w|h|pid|bundleId|appName|title` from macos-front-window.swift */
export function parseMacOSFrontWindowLine(raw: string): MacOSFrontWindowInfo | null {
  const line = raw.trim()
  if (!line) return null

  const parts = line.split('|')
  if (parts.length < 4) return null

  const x = parseInt(parts[0], 10)
  const y = parseInt(parts[1], 10)
  const width = parseInt(parts[2], 10)
  const height = parseInt(parts[3], 10)
  if (!Number.isFinite(x) || !Number.isFinite(y) || width < 50 || height < 50) return null

  // New format: pid|bundleId|appName|title...
  if (parts.length >= 8) {
    const pid = parseInt(parts[4], 10)
    if (!Number.isFinite(pid)) return null
    return {
      x,
      y,
      width,
      height,
      pid,
      bundleId: parts[5] || '',
      appName: parts[6] || '',
      windowTitle: parts.slice(7).join('|')
    }
  }

  // Legacy: appName|title...
  return {
    x,
    y,
    width,
    height,
    pid: 0,
    bundleId: '',
    appName: parts[4] || '',
    windowTitle: parts.slice(5).join('|')
  }
}

let restorePid: number | null = null

export function shouldRestoreForegroundAfterCapture(
  rememberedPid: number,
  current: MacOSFrontWindowInfo | null
): boolean {
  if (!rememberedPid || rememberedPid <= 0 || !current) return false
  // Already on target — no activate() spam
  if (current.pid === rememberedPid) return false
  // User on game/IDE/etc. — respect current focus, never yank to stale remembered app
  if (!isSpecterForeground(current)) return false
  // Specter (or Electron) stole focus during capture — safe to restore pre-capture app
  return true
}

export function rememberMacOSForegroundForRestore(info: MacOSFrontWindowInfo | null): void {
  if (!info?.pid || info.pid <= 0) {
    restorePid = null
    return
  }
  if (info.bundleId === SPECTER_BUNDLE || /specter/i.test(info.appName)) {
    restorePid = null
    return
  }
  restorePid = info.pid
}

/** Re-activate pre-capture app — re-reads focus immediately before (and after) activate. */
export function restoreMacOSForegroundApp(): void {
  if (process.platform !== 'darwin') return
  const pid = restorePid
  restorePid = null
  if (!pid || pid <= 0) return

  // Re-check #1: only restore if Specter currently holds focus
  const before = getMacOSFrontWindowInfo()
  if (!shouldRestoreForegroundAfterCapture(pid, before)) return

  try {
    const scriptPath = path.join(__dirname, '../../scripts/macos-front-window.swift')
    execFileSync('swift', [scriptPath, '--activate-pid', String(pid)], { timeout: 3000 })
  } catch (err) {
    console.warn('[Specter] Failed to restore front app after capture:', err)
    return
  }

  // Re-check #2: confirm we left Specter foreground
  const after = getMacOSFrontWindowInfo()
  if (isSpecterForeground(after)) {
    console.warn('[Specter] Focus restore incomplete — still on Specter after activate')
  }
}

/** Non-invasive front window lookup — does not use AppleScript System Events. */
export function getMacOSFrontWindowInfo(): MacOSFrontWindowInfo | null {
  if (process.platform !== 'darwin') return null

  try {
    const scriptPath = path.join(__dirname, '../../scripts/macos-front-window.swift')
    const raw = execFileSync('swift', [scriptPath], {
      encoding: 'utf-8',
      timeout: 4000
    })
    return parseMacOSFrontWindowLine(raw)
  } catch (err) {
    console.warn('[Specter] Swift front-window lookup failed:', err)
    return null
  }
}
