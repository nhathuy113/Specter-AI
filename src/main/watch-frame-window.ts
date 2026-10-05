import { app, BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'path'
import { IPC_CHANNELS } from '../shared/ipc-channels'
import { applyExcludeFromCapture } from './capture-protection'
import { getSetting, setSetting } from '../services/settings/store'
import { clampWatchFrame, hitWatchFrame, isWatchFrame, type WatchFrame } from '../services/capture/watch-frame'
import { watchFrameCaptureHold, type WatchFrameSurface } from '../services/capture/watch-frame-capture-hold'

let frameWindow: BrowserWindow | null = null
let showGeneration = 0
let ready = false
let dragging = false
let saveTimer: ReturnType<typeof setTimeout> | undefined
let hoverTimer: ReturnType<typeof setInterval> | undefined
let registered = false

function saveFrame(): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = undefined
  if (frameWindow && !frameWindow.isDestroyed()) setSetting('watchFrame', frameWindow.getBounds())
}

function queueSave(): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(saveFrame, 150)
}

export function notifyWatchFrameAsk(loading: boolean): void {
  if (!frameWindow || frameWindow.isDestroyed()) return
  frameWindow.webContents.send(IPC_CHANNELS.WATCH_FRAME_ASK_STATE, loading)
}

export function getLiveWatchFrame(): WatchFrame | undefined {
  return frameWindow && !frameWindow.isDestroyed() ? frameWindow.getBounds() : undefined
}

function watchFrameSurface(): WatchFrameSurface {
  const win = frameWindow
  return {
    get dragging() { return dragging },
    get visible() { return !!(win && !win.isDestroyed() && win.isVisible()) },
    hide: () => { win?.hide() },
    restore: () => {
      if (ready && watchFrameWanted() && frameWindow && !frameWindow.isDestroyed() && !frameWindow.isVisible()) frameWindow.showInactive()
    }
  }
}

/** Hide the border from screenshots; restore only a current, ready frame. */
export function suspendWatchFrameForCapture(): { hidden: boolean; restore: () => void } {
  return watchFrameCaptureHold.begin(watchFrameSurface())
}

function watchFrameWanted(): boolean {
  return !!(getSetting<boolean>('fullAutoMode') || getSetting<boolean>('continuousCoach'))
}

function closeWatchFrame(): void {
  showGeneration += 1
  saveFrame()
  if (hoverTimer) clearInterval(hoverTimer)
  hoverTimer = undefined
  ready = false
  dragging = false
  const win = frameWindow
  frameWindow = null
  if (!win || win.isDestroyed()) return
  win.hide()
  win.close()
}

function defaultFrame(): WatchFrame {
  const displays = screen.getAllDisplays()
  const primary = screen.getPrimaryDisplay()
  const pinned = getSetting<boolean>('workAreaCaptureEnabled') && displays.find(display => display.id === getSetting<number>('workAreaDisplayId'))
  const external = pinned || displays.find(display => display.id !== primary.id) || primary
  const area = external.workArea
  const width = Math.min(960, Math.round(area.width * 0.6))
  const height = Math.min(600, Math.round(area.height * 0.6))
  return {
    x: area.x + Math.round((area.width - width) / 2),
    y: area.y + Math.round((area.height - height) / 2),
    width,
    height
  }
}

function clampFrame(frame: WatchFrame): WatchFrame {
  return clampWatchFrame(frame, screen.getDisplayMatching(frame).workArea)
}

function currentFrame(): WatchFrame {
  const saved = getSetting<WatchFrame>('watchFrame')
  return clampFrame(isWatchFrame(saved) ? saved : defaultFrame())
}

function loadFrame(win: BrowserWindow): void {
  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/watch-frame/index.html`).catch(error => console.warn('[Specter] Watch frame load failed:', error))
  } else {
    void win.loadFile(join(__dirname, '../renderer/watch-frame/index.html')).catch(error => console.warn('[Specter] Watch frame load failed:', error))
  }
}

export function registerWatchFrameIpc(): void {
  if (registered) return
  registered = true
  app.once('before-quit', closeWatchFrame)
  ipcMain.handle(IPC_CHANNELS.WATCH_FRAME_GET, () => {
    const bounds = frameWindow && !frameWindow.isDestroyed() ? frameWindow.getBounds() : currentFrame()
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
  })

  ipcMain.on(IPC_CHANNELS.WATCH_FRAME_SET, (event, raw: unknown) => {
    if (!isWatchFrame(raw)) return
    const win = frameWindow
    if (!win || win.isDestroyed() || event.sender !== win.webContents) return
    win.setBounds(clampFrame(raw))
    queueSave()
  })

  ipcMain.on(IPC_CHANNELS.WATCH_FRAME_PASSTHROUGH, (event, ignore: unknown) => {
    const win = frameWindow
    if (!win || win.isDestroyed() || event.sender !== win.webContents) return
    if (typeof ignore !== 'boolean') return
    win.setIgnoreMouseEvents(dragging ? false : ignore, { forward: true })
  })

  ipcMain.on(IPC_CHANNELS.WATCH_FRAME_DRAGGING, (event, active: unknown) => {
    if (!frameWindow || frameWindow.isDestroyed() || event.sender !== frameWindow.webContents || typeof active !== 'boolean') return
    dragging = active
    if (active) frameWindow.setIgnoreMouseEvents(false, { forward: true })
    else saveFrame()
  })
}

/** Visible border of the capture rectangle. Shown while Watch or full auto is on. */
export function syncWatchFrame(): void {
  if (!watchFrameWanted()) {
    closeWatchFrame()
    return
  }

  const bounds = currentFrame()
  if (JSON.stringify(getSetting('watchFrame')) !== JSON.stringify(bounds)) setSetting('watchFrame', bounds)

  if (!frameWindow || frameWindow.isDestroyed()) {
    const win = new BrowserWindow({
      ...bounds,
      transparent: true,
      backgroundColor: '#00000000',
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      focusable: false,
      hasShadow: false,
      show: false,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    })
    frameWindow = win
    ready = false
    win.setIgnoreMouseEvents(true, { forward: true })
    win.setAlwaysOnTop(true, 'screen-saver', 1)
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    if (process.platform === 'darwin') win.setContentProtection(true)
    if (process.platform === 'win32') applyExcludeFromCapture(win)
    const generation = showGeneration
    win.on('closed', () => {
      if (frameWindow === win) {
        frameWindow = null
        ready = false
        dragging = false
        if (saveTimer) clearTimeout(saveTimer)
        if (hoverTimer) clearInterval(hoverTimer)
        saveTimer = undefined
        hoverTimer = undefined
      }
    })
    frameWindow.webContents.on('did-fail-load', (_event, code, description, url) => {
      console.warn('[Specter] Watch frame failed to load:', code, description, url)
    })
    frameWindow.once('ready-to-show', () => {
      if (generation !== showGeneration) return
      if (frameWindow !== win || win.isDestroyed() || !watchFrameWanted()) return
      ready = true
      if (!watchFrameCaptureHold.suspended) win.showInactive()
      console.info('[Specter] Watch frame visible', frameWindow.getBounds())
    })
    loadFrame(win)
    // Linux does not forward ignored mouse moves; poll only there to re-enable border interaction.
    if (process.platform === 'linux') hoverTimer = setInterval(() => {
      if (!frameWindow || frameWindow.isDestroyed() || !ready || dragging) return
      const point = screen.getCursorScreenPoint(), frame = frameWindow.getBounds()
      frameWindow.setIgnoreMouseEvents(hitWatchFrame(point.x - frame.x, point.y - frame.y, frame.width, frame.height) === null)
    }, 80)
  } else if (!dragging) {
    frameWindow.setBounds(bounds)
    if (ready && !watchFrameCaptureHold.suspended && !frameWindow.isVisible()) frameWindow.showInactive()
  }
}
