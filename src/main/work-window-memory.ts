import type { MacOSFrontWindowInfo } from './macos-front-window'
import { isSpecterForeground } from './macos-front-window'

/** Last non-Specter foreground window — used to crop when Specter panel has focus. */
let lastWorkWindow: MacOSFrontWindowInfo | null = null

export function rememberWorkWindow(info: MacOSFrontWindowInfo | null): void {
  if (!info || isSpecterForeground(info)) return
  if (info.width < 50 || info.height < 50) return
  lastWorkWindow = info
}

/** Prefer live foreground; fall back to remembered work app when Specter is front. */
export function resolveWorkWindowForCrop(
  current: MacOSFrontWindowInfo | null
): MacOSFrontWindowInfo | null {
  if (current && !isSpecterForeground(current)) {
    rememberWorkWindow(current)
    return current
  }
  return lastWorkWindow
}

export function getRememberedWorkWindow(): MacOSFrontWindowInfo | null {
  return lastWorkWindow
}

/** For tests — reset module state. */
export function resetWorkWindowMemory(): void {
  lastWorkWindow = null
}
