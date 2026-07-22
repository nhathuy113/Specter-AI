import { execFileSync } from 'child_process'
import path from 'path'

export interface MacOSFrontWindowInfo {
  x: number
  y: number
  width: number
  height: number
  appName: string
  windowTitle: string
}

/** Parse `x|y|w|h|app|title` line from macos-front-window.swift */
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

  return {
    x,
    y,
    width,
    height,
    appName: parts[4] || '',
    windowTitle: parts.slice(5).join('|')
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
