import { ipcMain, BrowserWindow, app, shell } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { getJournalEntries, exportJournalMarkdown, clearJournal } from '../../services/journal/activity-journal'
import { stopActivityJournal } from '../activity-journal-loop'
import { askWatchFrameCoach, stopContinuousCoach, setOverlayCoachStreaming, flushCoachTickOnExpand } from '../continuous-coach-loop'
import { getWorkAutoModeStatus, toggleWorkAutoMode } from '../work-auto-mode'
import { expandOverlayWindow, showOverlayPill, fitOverlayToContent } from '../overlay-window'
import { APP_VERSION } from '../../shared/constants'

export function registerAppIpcHandlers(overlayWindow: BrowserWindow, stopAutoCapture: () => void): void {
  // App
  ipcMain.handle(IPC_CHANNELS.APP_VERSION, () => {
    return APP_VERSION
  })

  ipcMain.on(IPC_CHANNELS.COACH_STREAMING, (_event, args: { streaming?: boolean }) => {
    setOverlayCoachStreaming(!!args?.streaming)
  })

  ipcMain.handle(IPC_CHANNELS.WORK_AUTO_GET_STATUS, () => getWorkAutoModeStatus())

  ipcMain.handle(IPC_CHANNELS.WORK_AUTO_TOGGLE, () => {
    if (overlayWindow.isDestroyed()) {
      return { enabled: false }
    }
    const enabled = toggleWorkAutoMode(overlayWindow)
    return { enabled }
  })

  ipcMain.on(IPC_CHANNELS.APP_QUIT, () => {
    stopAutoCapture()
    stopContinuousCoach()
    stopActivityJournal()
    app.quit()
  })

  ipcMain.handle(IPC_CHANNELS.ACTIVITY_JOURNAL_LIST, () => {
    return getJournalEntries()
  })

  ipcMain.handle(IPC_CHANNELS.ACTIVITY_JOURNAL_EXPORT, () => {
    return exportJournalMarkdown()
  })

  ipcMain.on(IPC_CHANNELS.ACTIVITY_JOURNAL_CLEAR, () => {
    clearJournal()
  })

  ipcMain.on(IPC_CHANNELS.WATCH_FRAME_ASK, () => {
    void askWatchFrameCoach()
  })

  ipcMain.on(IPC_CHANNELS.OVERLAY_EXPAND, () => {
    expandOverlayWindow(true)
    flushCoachTickOnExpand()
  })

  ipcMain.on(IPC_CHANNELS.OVERLAY_COLLAPSE, () => {
    showOverlayPill()
  })

  ipcMain.on(IPC_CHANNELS.OVERLAY_FIT_CONTENT, (_event, payload: unknown) => {
    if (typeof payload !== 'object' || payload === null) return
    const p = payload as Record<string, unknown>
    const mode = p.mode
    const width = p.width
    const height = p.height
    if (mode !== 'pill' && mode !== 'panel' && mode !== 'work-triple') return
    if (typeof width !== 'number' || typeof height !== 'number') return
    if (!Number.isFinite(width) || !Number.isFinite(height)) return
    fitOverlayToContent({
      mode,
      width: Math.max(0, Math.min(4000, width)),
      height: Math.max(0, Math.min(4000, height))
    })
  })

  // Shell — open URLs in external browser (validated in preload)
  ipcMain.on('shell:open-external', (_event, url: unknown) => {
    if (typeof url !== 'string') return
    try {
      const parsed = new URL(url)
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        shell.openExternal(url)
      }
    } catch {
      // Invalid URL — ignore
    }
  })

}
