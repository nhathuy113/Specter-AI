import { execSync } from 'child_process'

export interface AccessibilityCaptureResult {
  appName: string
  windowTitle: string
  text: string
  available: boolean
}

const MAX_AX_CHARS = 8000

function runOsascript(script: string, timeoutMs = 6000): string | null {
  if (process.platform !== 'darwin') return null
  try {
    return execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
      encoding: 'utf-8',
      timeout: timeoutMs
    }).trim()
  } catch {
    return null
  }
}

/**
 * macOS: read frontmost app/window metadata + shallow accessibility text.
 * Requires Accessibility permission for System Events (same as window bounds).
 */
export function captureAccessibilityText(): AccessibilityCaptureResult | null {
  if (process.platform !== 'darwin') return null

  const script = `
    set output to ""
    tell application "System Events"
      set frontApp to first application process whose frontmost is true
      set appName to name of frontApp
      set winTitle to ""
      try
        set winTitle to name of front window of frontApp
      end try
      set output to appName & linefeed & winTitle & linefeed
      try
        set selText to value of attribute "AXSelectedText" of frontApp
        if selText is not missing value and selText is not "" then
          set output to output & selText & linefeed
        end if
      end try
      try
        set uiElems to UI elements of front window of frontApp
        repeat with e in uiElems
          try
            set v to value of e
            if v is not missing value and v is not "" then
              set output to output & v & linefeed
            end if
          end try
          try
            set d to description of e
            if d is not missing value and d is not "" then
              set output to output & d & linefeed
            end if
          end try
        end repeat
      end try
    end tell
    return output
  `

  const raw = runOsascript(script)
  if (!raw) return null

  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) return null

  const appName = lines[0] || 'Unknown'
  const windowTitle = lines[1] || ''
  const body = lines.slice(2).join('\n').slice(0, MAX_AX_CHARS)

  const text = [appName, windowTitle, body].filter(Boolean).join('\n').trim()
  if (!text) return null

  return {
    appName,
    windowTitle,
    text,
    available: true
  }
}
