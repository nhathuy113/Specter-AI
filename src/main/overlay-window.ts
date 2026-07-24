// Overlay window — transparent, always-on-top, invisible to screen share
//
// Screen-capture protection:
//   macOS:   type:'panel' + screen-saver level → natively excluded from capture.
//   Windows: Uses koffi FFI to call SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)
//            which makes the window completely invisible to all capture APIs.
//            Electron's setContentProtection(true) is NOT used because it causes
//            a BLACK RECTANGLE on transparent/layered windows.
//   Linux:   No reliable screen-capture exclusion API exists.

import { app, BrowserWindow, screen, shell, type Rectangle } from 'electron'
import path from 'path'
import { is } from '@electron-toolkit/utils'
import { getSetting, setSetting } from '../services/store'
import { OVERLAY_DEFAULTS } from '../shared/constants'
import { IPC_CHANNELS } from '../shared/ipc-channels'
import { applyExcludeFromCapture, verifyDisplayAffinity } from './capture-protection'
import { restoreMacOSForegroundApp } from './macos-front-window'
import { defaultExpandedOverlayBounds, defaultPillOverlayBounds, getOverlayTargetDisplay, isPillSizedBounds } from '../services/overlay-placement'

let overlayWindow: BrowserWindow | null = null
let backgroundWatchMode = false
let cachedExpandedBounds: Rectangle | null = null

const PILL = { width: 250, height: 56, margin: 16 }

/**
 * Apply screen-capture protection via native FFI (Windows only).
 * Uses WDA_EXCLUDEFROMCAPTURE for true invisibility — no black rectangle.
 */
function applyCaptureProtection(win: BrowserWindow): void {
  if (win.isDestroyed()) return
  if (process.platform !== 'win32') return

  const applied = applyExcludeFromCapture(win)
  if (applied) {
    verifyDisplayAffinity(win)
  }
}

function isPillBounds(bounds: Rectangle): boolean {
  return isPillSizedBounds(bounds)
}

function resolveExpandedBounds(): Rectangle {
  if (cachedExpandedBounds && !isPillBounds(cachedExpandedBounds)) {
    return cachedExpandedBounds
  }

  const savedPosition = getSetting<{ x: number; y: number }>('overlayPosition')
  const savedSize = getSetting<{ width: number; height: number }>('overlaySize')
  const winWidth = savedSize?.width || OVERLAY_DEFAULTS.width
  const winHeight = savedSize?.height || OVERLAY_DEFAULTS.height

  if (savedPosition != null && savedPosition.x >= 0 && savedPosition.y >= 0) {
    return { x: savedPosition.x, y: savedPosition.y, width: winWidth, height: winHeight }
  }

  return defaultExpandedOverlayBounds(winWidth, winHeight)
}

function getPillBounds(): Rectangle {
  return defaultPillOverlayBounds(PILL.width, PILL.height, PILL.margin)
}

function cacheExpandedBounds(win: BrowserWindow): void {
  const bounds = win.getBounds()
  if (isPillBounds(bounds)) return
  cachedExpandedBounds = bounds
  setSetting('overlayPosition', { x: bounds.x, y: bounds.y })
  setSetting('overlaySize', { width: bounds.width, height: bounds.height })
}

function restoreExpandedBounds(win: BrowserWindow): void {
  win.setBounds(resolveExpandedBounds())
}

function showProtectedOverlay(win: BrowserWindow, focus = false, force = false): void {
  if (win.isDestroyed()) return
  if (backgroundWatchMode && !force) return

  applyCaptureProtection(win)

  if (focus) {
    win.show()
    win.focus()
  } else {
    win.showInactive()
  }
}

/** Keep pill visible while Watch / journal / full-auto runs in the background. */
export function syncOverlayBackgroundMode(): void {
  const fullAuto = getSetting<boolean>('fullAutoMode')
  const watch = getSetting<boolean>('continuousCoach')
  const journal = getSetting<boolean>('activityJournal')
  setOverlayBackgroundWatch(!!(fullAuto || watch || journal))
}

export function createOverlayWindow(): BrowserWindow {
  const initialBounds = resolveExpandedBounds()

  overlayWindow = new BrowserWindow({
    width: initialBounds.width,
    height: initialBounds.height,
    x: initialBounds.x,
    y: initialBounds.y,
    show: false,
    transparent: true,
    frame: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    focusable: true,
    hasShadow: false,
    thickFrame: false,
    ...(process.platform === 'darwin' ? { type: 'panel' } : {}),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (process.platform === 'darwin') {
    overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1)
    overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  } else {
    overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  }

  applyCaptureProtection(overlayWindow)
  overlayWindow.on('show', () => {
    if (overlayWindow) applyCaptureProtection(overlayWindow)
  })

  overlayWindow.webContents.on('did-finish-load', () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      const opacity = getSetting<number>('overlayOpacity') || OVERLAY_DEFAULTS.opacity
      overlayWindow.webContents.send(IPC_CHANNELS.OVERLAY_SET_OPACITY, opacity)
      syncOverlayBackgroundMode()
    }
  })

  overlayWindow.on('moved', () => {
    if (!overlayWindow) return
    const bounds = overlayWindow.getBounds()
    if (isPillBounds(bounds)) return
    setSetting('overlayPosition', { x: bounds.x, y: bounds.y })
    cachedExpandedBounds = bounds
  })

  overlayWindow.on('resize', () => {
    if (!overlayWindow) return
    const bounds = overlayWindow.getBounds()
    if (isPillBounds(bounds)) return
    setSetting('overlaySize', { width: bounds.width, height: bounds.height })
    cachedExpandedBounds = bounds
  })

  overlayWindow.on('closed', () => {
    overlayWindow = null
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    overlayWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/overlay/index.html`)
  } else {
    overlayWindow.loadFile(path.join(__dirname, '../renderer/overlay/index.html'))
  }

  overlayWindow.webContents.on('will-navigate', (event, url) => {
    if (is.dev && process.env['ELECTRON_RENDERER_URL'] && url.startsWith(process.env['ELECTRON_RENDERER_URL'])) {
      return
    }
    console.warn('[Specter] Blocked overlay navigation to:', url)
    event.preventDefault()
  })

  overlayWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) {
      shell.openExternal(url).catch(() => {})
    }
    return { action: 'deny' }
  })

  return overlayWindow
}

function sendOverlayPillMode(win: BrowserWindow, minimized: boolean): void {
  if (win.isDestroyed()) return
  win.webContents.send(IPC_CHANNELS.OVERLAY_SET_PILL_MODE, { minimized })
}

/** Compact pill docked bottom-right of primary display (MacBook). */
export function showOverlayPill(): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return

  cacheExpandedBounds(overlayWindow)
  const pillBounds = getPillBounds()
  overlayWindow.setBounds(pillBounds)
  overlayWindow.setFocusable(false)
  if (process.platform === 'darwin') {
    overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1)
  } else {
    overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  }
  sendOverlayPillMode(overlayWindow, true)
  overlayWindow.showInactive()
  console.info(`[Specter] Overlay pill @ (${pillBounds.x},${pillBounds.y}) ${pillBounds.width}x${pillBounds.height} on ${getOverlayTargetDisplay().label || 'display'}`)
}

export function expandOverlayWindow(focus = true): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return

  cachedExpandedBounds = null
  restoreExpandedBounds(overlayWindow)
  const bounds = overlayWindow.getBounds()
  overlayWindow.setFocusable(true)
  if (process.platform === 'darwin') {
    overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1)
  } else {
    overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  }
  sendOverlayPillMode(overlayWindow, false)
  console.info(`[Specter] Overlay expanded @ (${bounds.x},${bounds.y}) ${bounds.width}x${bounds.height} on ${getOverlayTargetDisplay().label || 'display'}`)
  if (focus) {
    overlayWindow.show()
    overlayWindow.focus()
  } else {
    overlayWindow.showInactive()
  }
}

function applyOverlayInteractiveState(win: BrowserWindow, interactive: boolean): void {
  if (win.isDestroyed()) return
  if (interactive) {
    expandOverlayWindow(false)
  } else {
    showOverlayPill()
  }
}

/** Focus steal is handled via showInactive(); keep regular activation so the panel stays visible. */
export function syncMacAppActivationPolicy(): void {
  if (process.platform !== 'darwin') return
  app.setActivationPolicy('regular')
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
  if (overlayWindow.isVisible() && !isPillBounds(overlayWindow.getBounds())) {
    overlayWindow.hide()
    syncOverlayBackgroundMode()
    return
  }
  if (overlayWindow.isVisible() && isPillBounds(overlayWindow.getBounds())) {
    overlayWindow.hide()
    return
  }

  backgroundWatchMode = false
  expandOverlayWindow(true)
}

export function getOverlayWindow(): BrowserWindow | null {
  return overlayWindow
}

export function showOverlay(options?: { focus?: boolean; force?: boolean }): void {
  if (!overlayWindow) return
  const force = options?.force ?? false
  if (force) {
    backgroundWatchMode = false
    syncMacAppActivationPolicy()
    expandOverlayWindow(options?.focus ?? true)
    return
  }
  showProtectedOverlay(overlayWindow, options?.focus ?? false, force)
}

export function hideOverlay(): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return
  if (backgroundWatchMode) {
    showOverlayPill()
    return
  }
  overlayWindow.hide()
}

export function releaseForegroundAfterBackgroundWork(): void {
  if (!backgroundWatchMode || process.platform !== 'darwin') return
  restoreMacOSForegroundApp()
}

export function setOverlayOpacity(opacity: number): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return
  const clamped = Math.max(0.3, Math.min(1.0, opacity))
  overlayWindow.webContents.send(IPC_CHANNELS.OVERLAY_SET_OPACITY, clamped)
}
