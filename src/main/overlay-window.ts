// Overlay window — transparent, always-on-top, invisible to screen share
//
// Screen-capture protection:
//   macOS:   type:'panel' + screen-saver level → natively excluded from capture.
//   Windows: Uses koffi FFI to call SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)
//            which makes the window completely invisible to all capture APIs.
//            Electron's setContentProtection(true) is NOT used because it causes
//            a BLACK RECTANGLE on transparent/layered windows.
//   Linux:   No reliable screen-capture exclusion API exists.

import { app, BrowserWindow, screen, shell } from 'electron'
import path from 'path'
import { is } from '@electron-toolkit/utils'
import { getSetting, setSetting } from '../services/store'
import { OVERLAY_DEFAULTS } from '../shared/constants'
import { IPC_CHANNELS } from '../shared/ipc-channels'
import { applyExcludeFromCapture, verifyDisplayAffinity } from './capture-protection'

let overlayWindow: BrowserWindow | null = null
let backgroundWatchMode = false

/**
 * Apply screen-capture protection via native FFI (Windows only).
 * Uses WDA_EXCLUDEFROMCAPTURE for true invisibility — no black rectangle.
 */
function applyCaptureProtection(win: BrowserWindow): void {
  if (win.isDestroyed()) return
  if (process.platform !== 'win32') return

  const applied = applyExcludeFromCapture(win)
  if (applied) {
    // Verify the flag stuck
    verifyDisplayAffinity(win)
  }
}

function showProtectedOverlay(win: BrowserWindow, focus = false, force = false): void {
  if (win.isDestroyed()) return
  // Background watch/journal: never auto-show overlay (capture cycles must stay invisible)
  if (backgroundWatchMode && !force) return

  applyCaptureProtection(win)

  if (focus) {
    win.show()
    win.focus()
  } else {
    // showInactive — do not steal keyboard focus from the user's active app
    win.showInactive()
  }
}

/** Keep overlay hidden while Watch / journal / full-auto runs in the background. */
export function syncOverlayBackgroundMode(): void {
  const fullAuto = getSetting<boolean>('fullAutoMode')
  const watch = getSetting<boolean>('continuousCoach')
  const journal = getSetting<boolean>('activityJournal')
  setOverlayBackgroundWatch(!!(fullAuto || watch || journal))
}

export function createOverlayWindow(): BrowserWindow {
  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize

  const savedPosition = getSetting<{ x: number; y: number }>('overlayPosition')
  const savedSize = getSetting<{ width: number; height: number }>('overlaySize')

  const winWidth = savedSize?.width || OVERLAY_DEFAULTS.width
  const winHeight = savedSize?.height || OVERLAY_DEFAULTS.height
  const x = (savedPosition != null && savedPosition.x >= 0) ? savedPosition.x : screenWidth - winWidth - OVERLAY_DEFAULTS.margin
  const y = (savedPosition != null && savedPosition.y >= 0) ? savedPosition.y : OVERLAY_DEFAULTS.margin

  overlayWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x,
    y,
    show: false, // Hidden until user opens via hotkey/tray — avoids focus steal on startup
    transparent: true,
    frame: false,
    movable: true,          // Explicitly allow dragging
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    focusable: true,   // Must be true for keyboard input on Windows
    hasShadow: false,   // Critical: no OS-level window shadow (leaks through capture)
    thickFrame: false,  // Windows: disable thick frame shadow/border
    // NOTE: Do NOT set 'opacity' here — it creates WS_EX_LAYERED + LWA_ALPHA on Windows
    // which breaks SetWindowDisplayAffinity (screen-capture exclusion). Opacity is
    // handled via CSS in the renderer instead.
    // macOS: 'panel' type is excluded from screen capture
    ...(process.platform === 'darwin' ? { type: 'panel' } : {}),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false // Required: @electron-toolkit/preload uses Node APIs in preload
    }
  })

  // macOS: set window level above screen saver, excluded from capture
  if (process.platform === 'darwin') {
    overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1)
    overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  } else {
    // Windows/Linux: set always-on-top at screen-saver level
    overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  }

  // Windows: exclude from screen capture
  applyCaptureProtection(overlayWindow)
  overlayWindow.on('show', () => {
    if (overlayWindow) applyCaptureProtection(overlayWindow)
  })

  // When the overlay renderer is ready, send the initial opacity value
  overlayWindow.webContents.on('did-finish-load', () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      const opacity = getSetting<number>('overlayOpacity') || OVERLAY_DEFAULTS.opacity
      overlayWindow.webContents.send(IPC_CHANNELS.OVERLAY_SET_OPACITY, opacity)
    }
  })

  // Save position on move
  overlayWindow.on('moved', () => {
    if (overlayWindow) {
      const [px, py] = overlayWindow.getPosition()
      setSetting('overlayPosition', { x: px, y: py })
    }
  })

  // Save size on resize
  overlayWindow.on('resize', () => {
    if (overlayWindow) {
      const [w, h] = overlayWindow.getSize()
      setSetting('overlaySize', { width: w, height: h })
    }
  })

  overlayWindow.on('closed', () => {
    overlayWindow = null
  })

  // NOTE: Click-through for transparent regions is handled natively by Electron
  // when transparent: true + frame: false is set. No setIgnoreMouseEvents needed.
  // Using setIgnoreMouseEvents was actively breaking -webkit-app-region: drag.

  // Load the overlay renderer
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    overlayWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/overlay/index.html`)
  } else {
    overlayWindow.loadFile(path.join(__dirname, '../renderer/overlay/index.html'))
  }

  // --- Security: block all navigation and new windows ---
  overlayWindow.webContents.on('will-navigate', (event, url) => {
    // In dev, allow HMR reloads to the dev server
    if (is.dev && process.env['ELECTRON_RENDERER_URL'] && url.startsWith(process.env['ELECTRON_RENDERER_URL'])) {
      return
    }
    console.warn('[Specter] Blocked overlay navigation to:', url)
    event.preventDefault()
  })

  overlayWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Open external links in the user's default browser, not in the app
    if (url.startsWith('https://')) {
      shell.openExternal(url).catch(() => {})
    }
    return { action: 'deny' }
  })

  return overlayWindow
}

function applyOverlayInteractiveState(win: BrowserWindow, interactive: boolean): void {
  if (win.isDestroyed()) return
  if (interactive) {
    win.setFocusable(true)
    if (process.platform === 'darwin') {
      win.setAlwaysOnTop(true, 'screen-saver', 1)
    } else {
      win.setAlwaysOnTop(true, 'screen-saver')
    }
  } else {
    // Fully demote — hidden panel + alwaysOnTop can still block clicks/focus on macOS
    win.hide()
    win.setFocusable(false)
    win.setAlwaysOnTop(false)
  }
}

/** macOS: run as tray/accessory app so screen capture does not front Specter. */
export function syncMacAppActivationPolicy(): void {
  if (process.platform !== 'darwin') return
  if (backgroundWatchMode) {
    app.setActivationPolicy('accessory')
    app.dock?.hide()
  } else {
    app.setActivationPolicy('regular')
  }
}

export function setOverlayBackgroundWatch(enabled: boolean): void {
  backgroundWatchMode = enabled
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    applyOverlayInteractiveState(overlayWindow, !enabled)
  }
  syncMacAppActivationPolicy()
}

export function isOverlayBackgroundWatch(): boolean {
  return backgroundWatchMode
}

export function toggleOverlay(): void {
  if (!overlayWindow) return
  if (overlayWindow.isVisible()) {
    overlayWindow.hide()
    syncOverlayBackgroundMode()
  } else {
    backgroundWatchMode = false
    applyOverlayInteractiveState(overlayWindow, true)
    syncMacAppActivationPolicy()
    showProtectedOverlay(overlayWindow, true, true)
  }
}

export function getOverlayWindow(): BrowserWindow | null {
  return overlayWindow
}

export function showOverlay(options?: { focus?: boolean; force?: boolean }): void {
  if (!overlayWindow) return
  const force = options?.force ?? false
  if (force) {
    backgroundWatchMode = false
    applyOverlayInteractiveState(overlayWindow, true)
    syncMacAppActivationPolicy()
  }
  showProtectedOverlay(overlayWindow, options?.focus ?? false, force)
}

export function hideOverlay(): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return
  overlayWindow.hide()
  syncOverlayBackgroundMode()
}

/** After background capture — give focus back to whatever the user was using. */
export function releaseForegroundAfterBackgroundWork(): void {
  if (!backgroundWatchMode || process.platform !== 'darwin') return
  app.hide()
}

/**
 * Update overlay opacity via CSS in the renderer (NOT native window opacity).
 * Using native win.setOpacity() would add WS_EX_LAYERED + LWA_ALPHA which
 * breaks screen-capture exclusion on Windows.
 */
export function setOverlayOpacity(opacity: number): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return
  const clamped = Math.max(0.3, Math.min(1.0, opacity))
  overlayWindow.webContents.send(IPC_CHANNELS.OVERLAY_SET_OPACITY, clamped)
}
