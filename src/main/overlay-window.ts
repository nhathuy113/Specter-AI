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
import { getSetting, setSetting } from '../services/settings/store'
import { OVERLAY_DEFAULTS } from '../shared/constants'
import { IPC_CHANNELS } from '../shared/ipc-channels'
import { applyExcludeFromCapture, verifyDisplayAffinity } from './capture-protection'
import { syncWatchFrame } from './watch-frame-window'
import { restoreMacOSForegroundApp } from './macos-front-window'
import { defaultExpandedOverlayBounds, defaultPillOverlayBounds, getOverlayTargetDisplay, isPillSizedBounds } from '../services/ui/overlay-placement'
import { resolveOverlayFitBounds, type OverlayFitRequest } from '../services/ui/overlay-fit'

let overlayWindow: BrowserWindow | null = null
let backgroundWatchMode = false
let cachedExpandedBounds: Rectangle | null = null
let suppressResizePersist = false

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

  if (savedPosition != null && !(savedPosition.x === -1 && savedPosition.y === -1)) {
    return { x: savedPosition.x, y: savedPosition.y, width: winWidth, height: winHeight }
  }

  return defaultExpandedOverlayBounds(winWidth, winHeight)
}

function getPillBounds(): Rectangle {
  return defaultPillOverlayBounds(PILL.width, PILL.height, PILL.margin)
}

function setBoundsQuiet(win: BrowserWindow, bounds: Rectangle): void {
  suppressResizePersist = true
  win.setBounds(bounds)
  setTimeout(() => {
    suppressResizePersist = false
  }, 120)
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
  syncWatchFrame()
}

function applyMacNativeGlass(win: BrowserWindow): void {
  if (process.platform !== 'darwin' || win.isDestroyed()) return
  // Blur desktop behind window — NSVisualEffectView (not CSS backdrop-filter).
  win.setVibrancy('under-window')
}

export function createOverlayWindow(): BrowserWindow {
  const initialBounds = resolveExpandedBounds()
  const isMac = process.platform === 'darwin'

  overlayWindow = new BrowserWindow({
    width: initialBounds.width,
    height: initialBounds.height,
    x: initialBounds.x,
    y: initialBounds.y,
    show: false,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    focusable: true,
    hasShadow: false,
    thickFrame: false,
    ...(isMac
      ? {
          type: 'panel',
          vibrancy: 'under-window',
          visualEffectState: 'active'
        }
      : {}),
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
    applyMacNativeGlass(overlayWindow)
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
      overlayWindow.webContents.send(IPC_CHANNELS.OVERLAY_SET_GLASS_MODE, {
        native: process.platform === 'darwin'
      })
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
    if (!overlayWindow || suppressResizePersist) return
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
  const current = overlayWindow.getBounds()
  const pillBounds = { ...getPillBounds(), x: current.x, y: current.y }
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

  const current = overlayWindow.getBounds()
  if (!overlayWindow.isVisible()) restoreExpandedBounds(overlayWindow)
  else if (isPillBounds(current)) {
    const savedSize = getSetting<{ width: number; height: number }>('overlaySize')
    setBoundsQuiet(overlayWindow, {
      x: current.x,
      y: current.y,
      width: savedSize?.width || OVERLAY_DEFAULTS.width,
      height: savedSize?.height || OVERLAY_DEFAULTS.height
    })
  }
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

function applyOverlayBackgroundLayout(win: BrowserWindow, watchEnabled: boolean): void {
  if (win.isDestroyed()) return

  const bounds = win.getBounds()
  const expanded = win.isVisible() && !isPillBounds(bounds)

  if (watchEnabled) {
    if (!win.isVisible()) {
      showOverlayPill()
      return
    }
    if (isPillBounds(bounds)) {
      win.setFocusable(false)
      win.showInactive()
      return
    }
    // Expanded overlay stays expanded when auto/watch toggles on
    win.setFocusable(false)
    sendOverlayPillMode(win, false)
    win.showInactive()
    return
  }

  // Watch off — preserve current layout; only restore focusability when expanded
  if (expanded || !isPillBounds(bounds)) {
    win.setFocusable(true)
    sendOverlayPillMode(win, false)
  }
}

/** Keep regular activation so the panel stays visible, then hide the Dock icon. */
export function syncMacAppActivationPolicy(): void {
  if (process.platform !== 'darwin') return
  app.setActivationPolicy('regular')
  app.dock?.hide()
}

/** True when the expanded overlay panel is visible (not pill, not fully hidden). */
export function isOverlayExpandedForCoach(): boolean {
  if (!overlayWindow || overlayWindow.isDestroyed()) return false
  if (!overlayWindow.isVisible()) return false
  return !isPillBounds(overlayWindow.getBounds())
}

export function isOverlayFullyHidden(): boolean {
  if (!overlayWindow || overlayWindow.isDestroyed()) return true
  return !overlayWindow.isVisible()
}

/** Pill visible — work journal only, no coach AI. */
export function isOverlayPillMode(): boolean {
  if (isOverlayFullyHidden()) return false
  return isPillBounds(overlayWindow!.getBounds())
}

/** Coach auto + COACH_DEBUG only when expanded panel is open. */
export function shouldRunCoachAutoUi(): boolean {
  return isOverlayExpandedForCoach()
}

/** Activity journal while pill (background work log). */
export function shouldRunWorkJournal(): boolean {
  return isOverlayPillMode()
}

/** COACH_DEBUG when expanded (same as coach). */
export function shouldRunCoachVerboseLogging(): boolean {
  return isOverlayExpandedForCoach()
}

export function fitOverlayToContent(req: OverlayFitRequest): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return

  const display = getOverlayTargetDisplay()
  const target: import('../services/ui/overlay-placement').OverlayDisplayLike = {
    id: display.id,
    label: display.label,
    bounds: display.bounds,
    isPrimary: display.id === screen.getPrimaryDisplay().id
  }
  const next = resolveOverlayFitBounds(req, target, overlayWindow.getBounds())
  setBoundsQuiet(overlayWindow, next)

  if (req.mode === 'pill') {
    sendOverlayPillMode(overlayWindow, true)
  } else if (!isPillBounds(next)) {
    cachedExpandedBounds = { ...overlayWindow.getBounds(), width: next.width, height: next.height }
    setSetting('overlaySize', { width: next.width, height: next.height })
  }
}

export function setOverlayBackgroundWatch(enabled: boolean): void {
  backgroundWatchMode = enabled
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    applyOverlayBackgroundLayout(overlayWindow, enabled)
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
