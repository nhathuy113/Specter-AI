// Screen capture + OCR pipeline — uses worker thread for OCR to avoid blocking main
import { Worker } from 'worker_threads'
import path from 'path'
import { execSync } from 'child_process'
import screenshot from 'screenshot-desktop'
import { screen } from 'electron'
import type { ScreenCaptureResult, PerceptionMode, CapturePreviewOptions, CapturePreviewResult } from '../shared/types'
import { captureAccessibilityText } from '../services/capture/accessibility-capture'
import { resolveCaptureContext } from '../services/capture/capture-context'
import { fingerprintImage } from '../services/capture/image-fingerprint'
import { createCaptureSettingsReader } from '../services/capture/capture-preview'
import { resolveBackgroundCaptureParams } from '../services/capture/background-capture-params'
import { getSetting } from '../services/settings/store'
import { DEFAULT_SETTINGS } from '../shared/constants'
import {
  screenshotIndexForDisplay,
  type DisplayInfo,
  type SmartCropPlan,
  displayForWindow
} from '../services/capture/display-capture'
import { resolveSmartCapturePlan } from '../services/capture/smart-capture'
import { planPinnedWorkDisplay, workAreaCaptureActive } from '../services/capture/work-area-capture'
import { planWatchFrameCapture, type WatchFrame } from '../services/capture/watch-frame'
import { getOverlayWindow, isOverlayBackgroundWatch, releaseForegroundAfterBackgroundWork, showOverlay } from './overlay-window'
import { getMacOSFrontWindowInfo, getMacOSBrowserWindows, isSpecterForeground, rememberMacOSForegroundForRestore } from './macos-front-window'
import { getLiveWatchFrame, suspendWatchFrameForCapture } from './watch-frame-window'
import { captureScreenPng } from './go-capture'
import { rememberWorkWindow, resolveWorkWindowForCrop } from './work-window-memory'

let isCapturing = false

/** macOS screenshot via Electron. The screencapture helper fails under launchd. */
async function captureMacOSDisplayPng(displayIndex?: number): Promise<Buffer> {
  return captureScreenPng(displayIndex)
}

interface OCRResponse {
  success: boolean
  text?: string
  error?: string
}

interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
  title: string
}

/**
 * Run OCR in a worker thread so the main process stays responsive.
 * The worker file is built as a separate entry by electron-vite.
 */
function ocrInWorker(imageBuffer: Buffer, language = 'eng'): Promise<string> {
  return new Promise((resolve, reject) => {
    const workerPath = path.join(__dirname, 'ocr-worker.js')
    const worker = new Worker(workerPath, {
      workerData: {
        imageBuffer: Buffer.from(imageBuffer),
        language
      }
    })

    worker.on('message', (result: OCRResponse) => {
      if (result.success) {
        resolve(result.text || '')
      } else {
        reject(new Error(result.error || 'OCR failed'))
      }
      worker.terminate()
    })

    worker.on('error', (err) => {
      reject(err)
      worker.terminate()
    })

    // Timeout after 30 seconds — OCR shouldn't take longer
    const timeout = setTimeout(() => {
      worker.terminate()
      reject(new Error('OCR timed out after 30 seconds'))
    }, 30_000)

    worker.on('exit', () => {
      clearTimeout(timeout)
    })
  })
}

/**
 * Temporarily hide the overlay window so it doesn't appear in the screenshot.
 * Returns true if the overlay was visible and was hidden.
 */
function hideOverlayForCapture(): boolean {
  // Background mode: overlay stays hidden — never hide/show cycle (avoids focus steal on macOS)
  if (isOverlayBackgroundWatch()) return false

  // macOS panel windows are excluded from screen capture — skip hide/show to avoid focus steal
  if (process.platform === 'darwin') return false

  const overlay = getOverlayWindow()
  if (overlay && !overlay.isDestroyed() && overlay.isVisible()) {
    overlay.hide()
    return true
  }
  return false
}

/**
 * Restore the overlay window after capture.
 */
function restoreOverlay(): void {
  if (isOverlayBackgroundWatch()) return
  showOverlay({ focus: false })
}

/**
 * Small delay to let the OS repaint after hiding the overlay.
 * Without this, the screenshot may still capture the overlay in-flight.
 */
function waitForRepaint(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 150))
}

/**
 * Get the bounds of the currently active/focused window using native OS commands.
 * Returns null if detection fails (graceful fallback to full-screen capture).
 */
function getActiveWindowBounds(): WindowBounds | null {
  try {
    if (process.platform === 'win32') {
      // PowerShell: get foreground window bounds via Win32 API
      const script = `
        Add-Type @"
        using System;
        using System.Runtime.InteropServices;
        public class WinAPI {
          [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
          [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
          [DllImport("user32.dll", SetLastError=true, CharSet=CharSet.Auto)]
          public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);
          [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
        }
"@
        $hwnd = [WinAPI]::GetForegroundWindow()
        $rect = New-Object WinAPI+RECT
        [WinAPI]::GetWindowRect($hwnd, [ref]$rect) | Out-Null
        $sb = New-Object System.Text.StringBuilder 256
        [WinAPI]::GetWindowText($hwnd, $sb, 256) | Out-Null
        "$($rect.Left)|$($rect.Top)|$($rect.Right - $rect.Left)|$($rect.Bottom - $rect.Top)|$($sb.ToString())"
      `.trim()

      const result = execSync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"')}"`, {
        timeout: 3000,
        encoding: 'utf-8',
        windowsHide: true
      }).trim()

      const parts = result.split('|')
      if (parts.length >= 4) {
        const x = parseInt(parts[0], 10)
        const y = parseInt(parts[1], 10)
        const width = parseInt(parts[2], 10)
        const height = parseInt(parts[3], 10)
        const title = parts.slice(4).join('|')

        if (width > 50 && height > 50) {
          return { x, y, width, height, title }
        }
      }
    } else if (process.platform === 'darwin') {
      const info = getMacOSFrontWindowInfo()
      if (info) {
        return {
          x: info.x,
          y: info.y,
          width: info.width,
          height: info.height,
          title: info.windowTitle || info.appName
        }
      }
    } else if (process.platform === 'linux') {
      // xdotool + xwininfo for X11
      const windowId = execSync('xdotool getactivewindow', {
        timeout: 2000,
        encoding: 'utf-8'
      }).trim()

      const info = execSync(`xwininfo -id ${windowId}`, {
        timeout: 2000,
        encoding: 'utf-8'
      })

      const xMatch = info.match(/Absolute upper-left X:\s+(\d+)/)
      const yMatch = info.match(/Absolute upper-left Y:\s+(\d+)/)
      const wMatch = info.match(/Width:\s+(\d+)/)
      const hMatch = info.match(/Height:\s+(\d+)/)

      const titleResult = execSync(`xdotool getactivewindow getwindowname`, {
        timeout: 2000,
        encoding: 'utf-8'
      }).trim()

      if (xMatch && yMatch && wMatch && hMatch) {
        const x = parseInt(xMatch[1], 10)
        const y = parseInt(yMatch[1], 10)
        const width = parseInt(wMatch[1], 10)
        const height = parseInt(hMatch[1], 10)

        if (width > 50 && height > 50) {
          return { x, y, width, height, title: titleResult }
        }
      }
    }
  } catch (err) {
    console.warn('[Specter] Active window detection failed (will use full screen):', err)
  }

  return null
}

/**
 * Crop an image buffer to the specified bounds.
 * Uses a simple PNG pixel-copy approach via sharp if available, otherwise returns the full image.
 * Since sharp is a devDependency used for icon generation, we fall back gracefully.
 */
async function cropImageBuffer(
  imgBuffer: Buffer,
  bounds: WindowBounds,
  _displayBounds: { x: number; y: number; width: number; height: number }
): Promise<Buffer> {
  try {
    // sharp is available as a devDep — try it for cropping
    const sharp = require('sharp')

    const metadata = await sharp(imgBuffer).metadata()
    const imgWidth = metadata.width || 1
    const imgHeight = metadata.height || 1

    // Calculate scale factor (screenshot may be at display DPI scale)
    const scaleX = imgWidth / _displayBounds.width
    const scaleY = imgHeight / _displayBounds.height

    // Convert window bounds to image pixel coords, accounting for display offset
    let cropX = Math.round((bounds.x - _displayBounds.x) * scaleX)
    let cropY = Math.round((bounds.y - _displayBounds.y) * scaleY)
    let cropW = Math.round(bounds.width * scaleX)
    let cropH = Math.round(bounds.height * scaleY)

    // Clamp to image bounds
    cropX = Math.max(0, cropX)
    cropY = Math.max(0, cropY)
    cropW = Math.min(cropW, imgWidth - cropX)
    cropH = Math.min(cropH, imgHeight - cropY)

    if (cropW < 50 || cropH < 50) {
      console.warn('[Specter] Crop area too small, using full screenshot')
      return imgBuffer
    }

    return await sharp(imgBuffer)
      .extract({ left: cropX, top: cropY, width: cropW, height: cropH })
      .png()
      .toBuffer()
  } catch {
    // sharp not available or crop failed — return full image
    console.warn('[Specter] Image cropping unavailable, using full screenshot')
    return imgBuffer
  }
}

async function captureDisplayScreenshot(displayIndex?: number): Promise<Buffer> {
  if (process.platform === 'darwin') {
    return captureMacOSDisplayPng(displayIndex)
  }
  if (displayIndex === undefined) {
    return screenshot({ format: 'png' })
  }
  return screenshot({ format: 'png', screen: displayIndex })
}

function listElectronDisplays(): DisplayInfo[] {
  const primaryId = screen.getPrimaryDisplay().id
  return screen.getAllDisplays().map((d) => ({
    id: d.id,
    label: d.label,
    bounds: d.bounds,
    isPrimary: d.id === primaryId
  }))
}

async function captureFromPlan(plan: SmartCropPlan): Promise<Buffer> {
  const displays = listElectronDisplays()
  const primaryId = displays.find((display) => display.isPrimary)?.id ?? displays[0]?.id ?? plan.display.id
  const screenIndex = screenshotIndexForDisplay(displays, primaryId, plan.display.id)
  let imgBuffer = await captureDisplayScreenshot(screenIndex)

  if (plan.type === 'window-crop') {
    imgBuffer = await cropImageBuffer(
      imgBuffer,
      { ...plan.window, title: '' },
      plan.display.bounds
    )
  }

  return imgBuffer
}

/**
 * Capture the full screen and run OCR.
 * OCR runs in a separate worker thread so the main process (IPC, hotkeys, UI)
 * is not blocked during recognition.
 * The overlay is hidden before capture to avoid the AI reading its own UI.
 *
 * @param activeWindowOnly - If true, attempt to crop to the active window's bounds
 */
export async function captureScreenText(
  activeWindowOnly = false,
  perceptionMode?: PerceptionMode,
  opts: { skipAccessibility?: boolean; coachVision?: boolean; captureSettings?: CapturePreviewOptions } = {}
): Promise<ScreenCaptureResult> {
  const readCaptureSetting = createCaptureSettingsReader(opts.captureSettings ?? {}, getSetting)
  if (isCapturing) {
    throw new Error('Screen capture already in progress')
  }

  isCapturing = true

  if (isOverlayBackgroundWatch() && process.platform === 'darwin') {
    rememberMacOSForegroundForRestore(getMacOSFrontWindowInfo())
  }

  // Detect active window BEFORE hiding overlay (so the user's actual window is still focused)
  let activeWindowBounds: WindowBounds | null = null
  let frontWindowMeta: ReturnType<typeof getMacOSFrontWindowInfo> = null
  if (activeWindowOnly) {
    if (process.platform === 'darwin') {
      const liveFront = getMacOSFrontWindowInfo()
      rememberWorkWindow(liveFront)
      const primaryBounds = screen.getPrimaryDisplay().bounds
      const browserWindows = getMacOSBrowserWindows()
      frontWindowMeta = resolveWorkWindowForCrop(liveFront, {
        browserWindows,
        primaryBounds
      })
      if (frontWindowMeta) rememberWorkWindow(frontWindowMeta)
      if (frontWindowMeta) {
        activeWindowBounds = {
          x: frontWindowMeta.x,
          y: frontWindowMeta.y,
          width: frontWindowMeta.width,
          height: frontWindowMeta.height,
          title: frontWindowMeta.windowTitle || frontWindowMeta.appName
        }
        if (liveFront && liveFront !== frontWindowMeta) {
          const cropDisplay = displayForWindow(frontWindowMeta, listElectronDisplays())
          console.info(
            `[Specter] Crop browser (not front app): ${frontWindowMeta.appName} | ${frontWindowMeta.windowTitle || '(no title)'} | display: ${cropDisplay?.label ?? '?'}`
          )
        }
      }
    } else {
      activeWindowBounds = getActiveWindowBounds()
    }
  }

  const wasVisible = hideOverlayForCapture()
  let restoreFrame = () => {}
  try {
    const frame = suspendWatchFrameForCapture()
    restoreFrame = frame.restore
    if (wasVisible || frame.hidden) await waitForRepaint()

    let imgBuffer: Buffer
    const displays = listElectronDisplays()
    const displayCount = displays.length
    const workEnabled = readCaptureSetting<boolean>('workAreaCaptureEnabled')
    const workDisplayId = readCaptureSetting<number>('workAreaDisplayId')
    const pinnedPlan =
      workAreaCaptureActive(workEnabled, workDisplayId) &&
      planPinnedWorkDisplay(displays, workDisplayId)
    const frameOn = !!(readCaptureSetting<boolean>('fullAutoMode') || readCaptureSetting<boolean>('continuousCoach'))
    const watchFrame = frameOn ? (getLiveWatchFrame() ?? readCaptureSetting<WatchFrame>('watchFrame')) : undefined
    const framePlan = planWatchFrameCapture(watchFrame, displays)
    const frameDisplay = framePlan?.display

    if (framePlan) {
      imgBuffer = await captureFromPlan(framePlan)
      console.info(`[Specter] Watch frame on ${framePlan.display.label}`)
    } else if (pinnedPlan) {
      imgBuffer = await captureFromPlan(pinnedPlan)
      console.info(`[Specter] Work area capture: ${pinnedPlan.display.label} (full display)`)
    } else if (activeWindowOnly) {
      const plan = resolveSmartCapturePlan(activeWindowBounds, displays)
      if (plan) {
        imgBuffer = await captureFromPlan(plan)
        if (plan.type === 'window-crop') {
          console.info(
            `[Specter] Smart crop: ${frontWindowMeta?.appName ?? 'window'} | ${frontWindowMeta?.windowTitle || activeWindowBounds?.title || '(no title)'}`
          )
        } else {
          console.info(`[Specter] Smart crop fallback: ${plan.display.label} (full display)`)
        }
      } else {
        imgBuffer = await captureDisplayScreenshot()
        console.info('[Specter] Smart crop unavailable — full primary display')
      }
    } else {
      imgBuffer = await captureDisplayScreenshot()
    }

    const base64 = imgBuffer.toString('base64')
    restoreFrame()

    // Restore overlay immediately after screenshot (before slow OCR)
    if (wasVisible) restoreOverlay()

    const mode = perceptionMode
      ?? (readCaptureSetting<string>('perceptionMode') as PerceptionMode)
      ?? DEFAULT_SETTINGS.perceptionMode

    const axResult =
      mode === 'vision' || opts.skipAccessibility
        ? null
        : captureAccessibilityText()

    const appName = frameDisplay
      ? `Watch: ${frameDisplay.label}`
      : pinnedPlan
        ? `Work: ${pinnedPlan.display.label}`
        : (frontWindowMeta?.appName ?? axResult?.appName)
    const windowTitle = frameDisplay
      ? 'watch-frame'
      : pinnedPlan
        ? 'pinned-work-display'
        : (frontWindowMeta?.windowTitle ?? axResult?.windowTitle)

    const context = await resolveCaptureContext(imgBuffer, {
      coachVision: !!opts.coachVision, mode, appName, windowTitle, accessibility: axResult
    }, { ocr: ocrInWorker, fingerprint: fingerprintImage })

    return {
      ...context,
      screenshot: base64,
      timestamp: Date.now(),
      appName,
      windowTitle,
      displayCount
    }
  } catch (err: unknown) {
    // Always restore overlay even if capture fails
    if (wasVisible) restoreOverlay()
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[Specter] Screen capture failed:', err)
    throw new Error(message || 'Screen capture failed')
  } finally {
    restoreFrame()
    isCapturing = false
    releaseForegroundAfterBackgroundWork()
  }
}

/** Preview what full-auto / watch capture sees (same path as background coach). */
export async function captureAutoFocusPreview(overrides: CapturePreviewOptions = {}): Promise<CapturePreviewResult> {
  const p = resolveBackgroundCaptureParams(createCaptureSettingsReader(overrides, getSetting))
  const capture = await captureScreenText(p.activeWindowOnly, p.perceptionMode, {
    skipAccessibility: p.skipAccessibility,
    coachVision: p.coachVision,
    captureSettings: overrides
  })
  const textPreview = (capture.text || capture.fingerprintText || '').trim().slice(0, 400)
  return {
    screenshot: capture.screenshot ?? '',
    timestamp: capture.timestamp,
    appName: capture.appName,
    windowTitle: capture.windowTitle,
    textPreview,
    useVision: !!capture.useVision
  }
}

/**
 * Capture screen without OCR — returns just the screenshot as base64.
 * Useful for preview mode where the user sees the screenshot before deciding to send.
 * The overlay is hidden during capture.
 */
export async function captureScreenOnly(): Promise<{ screenshot: string; timestamp: number }> {
  if (isCapturing) throw new Error('Screen capture already in progress')
  isCapturing = true
  const wasVisible = hideOverlayForCapture()
  let restoreFrame = () => {}
  try {
    const frame = suspendWatchFrameForCapture()
    restoreFrame = frame.restore
    if (wasVisible || frame.hidden) await waitForRepaint()
    const imgBuffer = await captureDisplayScreenshot()
    return { screenshot: imgBuffer.toString('base64'), timestamp: Date.now() }
  } finally {
    restoreFrame()
    if (wasVisible) restoreOverlay()
    isCapturing = false
  }
}

/**
 * Game Mode — smart-crop screenshot + front-window metadata, no OCR (1s cadence).
 */
export async function captureGameFrame(): Promise<{
  pngBuffer: Buffer
  screenshot: string
  appName: string
  windowTitle: string
  timestamp: number
}> {
  if (isCapturing) {
    throw new Error('Screen capture already in progress')
  }

  isCapturing = true
  let frontWindowMeta: ReturnType<typeof getMacOSFrontWindowInfo> = null
  let activeWindowBounds: WindowBounds | null = null

  if (process.platform === 'darwin') {
    frontWindowMeta = getMacOSFrontWindowInfo()
    if (isOverlayBackgroundWatch()) {
      rememberMacOSForegroundForRestore(frontWindowMeta)
    }
    if (frontWindowMeta) {
      activeWindowBounds = {
        x: frontWindowMeta.x,
        y: frontWindowMeta.y,
        width: frontWindowMeta.width,
        height: frontWindowMeta.height,
        title: frontWindowMeta.windowTitle || frontWindowMeta.appName
      }
    }
  } else {
    activeWindowBounds = getActiveWindowBounds()
  }

  const wasVisible = hideOverlayForCapture()
  let restoreFrame = () => {}
  try {
    const frame = suspendWatchFrameForCapture()
    restoreFrame = frame.restore
    if (wasVisible || frame.hidden) await waitForRepaint()

    const displays = listElectronDisplays()
    const plan = resolveSmartCapturePlan(activeWindowBounds, displays)
    let imgBuffer: Buffer
    if (plan) {
      imgBuffer = await captureFromPlan(plan)
    } else {
      imgBuffer = await captureDisplayScreenshot()
    }

    if (wasVisible) restoreOverlay()

    return {
      pngBuffer: imgBuffer,
      screenshot: imgBuffer.toString('base64'),
      appName: frontWindowMeta?.appName || 'Unknown',
      windowTitle: frontWindowMeta?.windowTitle || '',
      timestamp: Date.now()
    }
  } catch (err: unknown) {
    if (wasVisible) restoreOverlay()
    const message = err instanceof Error ? err.message : 'Game frame capture failed'
    throw new Error(message)
  } finally {
    restoreFrame()
    isCapturing = false
    releaseForegroundAfterBackgroundWork()
  }
}

export function isCurrentlyCapturing(): boolean {
  return isCapturing
}
