import { globalShortcut, type BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc-channels'
import { getSetting } from '../services/settings/store'
import { DEFAULT_HOTKEYS } from '../shared/constants'
import { showOverlay, toggleOverlay } from './overlay-window'
import { toggleWorkAutoMode } from './work-auto-mode'
import {
  nextActiveTabPressMs,
  shouldFireActiveTabDoubleTap
} from '../services/ui/hotkey-double-tap'

let overlayRef: BrowserWindow | null = null
let lastActiveTabPressMs = 0

export function registerHotkeys(overlayWindow: BrowserWindow): void {
  overlayRef = overlayWindow
  applyHotkeys()
}

function mergedHotkeys() {
  const stored = getSetting<typeof DEFAULT_HOTKEYS>('hotkeys') || {}
  return { ...DEFAULT_HOTKEYS, ...stored }
}

function applyHotkeys(): void {
  if (!overlayRef || overlayRef.isDestroyed()) return

  globalShortcut.unregisterAll()

  const hotkeys = mergedHotkeys()
  const win = overlayRef

  try {
    globalShortcut.register(hotkeys.askAI, () => {
      if (win && !win.isDestroyed()) {
        showOverlay({ focus: true, force: true })
        win.webContents.send(IPC_CHANNELS.HOTKEY_ASK_AI)
      }
    })
  } catch (e) {
    console.warn('[Specter] Failed to register askAI hotkey:', e)
  }

  try {
    globalShortcut.register(hotkeys.screenshotAsk, () => {
      if (win && !win.isDestroyed()) {
        showOverlay({ focus: true, force: true })
        win.webContents.send(IPC_CHANNELS.HOTKEY_ASK_WITH_SCREENSHOT)
      }
    })
  } catch (e) {
    console.warn('[Specter] Failed to register screenshotAsk hotkey:', e)
  }

  try {
    const toggleAccelerator = 'CommandOrControl+\\'
    const toggle = () => {
      if (win && !win.isDestroyed()) toggleOverlay()
    }
    globalShortcut.register(toggleAccelerator, toggle)
    if (hotkeys.toggleOverlay !== toggleAccelerator) {
      globalShortcut.register(hotkeys.toggleOverlay, toggle)
    }
    console.info(`[Specter] Hotkey ${toggleAccelerator} toggles the overlay`)
  } catch (e) {
    console.warn('[Specter] Failed to register toggleOverlay hotkey:', e)
  }

  try {
    globalShortcut.register(hotkeys.toggleAudio, () => {
      if (win && !win.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.HOTKEY_TOGGLE_AUDIO)
      }
    })
  } catch (e) {
    console.warn('[Specter] Failed to register toggleAudio hotkey:', e)
  }

  // Double-tap ⌘/ within 450ms → toggle work auto mode (continuous watch + explain)
  try {
    globalShortcut.register(hotkeys.activeTabAsk, () => {
      if (!win || win.isDestroyed()) return
      const now = Date.now()
      const action = shouldFireActiveTabDoubleTap(lastActiveTabPressMs, now)
      lastActiveTabPressMs = nextActiveTabPressMs(action, now)
      if (action === 'double-tap') {
        toggleWorkAutoMode(win)
      }
    })
  } catch (e) {
    console.warn('[Specter] Failed to register activeTabAsk hotkey:', e)
  }
}

export function reRegisterHotkeys(): void {
  applyHotkeys()
}

export function unregisterAllHotkeys(): void {
  globalShortcut.unregisterAll()
}
