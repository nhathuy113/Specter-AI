import type { BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc-channels'
import { DEFAULT_SETTINGS } from '../shared/constants'
import { getSetting } from '../services/settings/store'
import { captureScreenText } from './screen-capture'
import { createAutoCaptureLoop } from './auto-capture-loop'
import { syncContinuousCoach } from './continuous-coach-loop'
import { syncActivityJournal } from './activity-journal-loop'
import { syncHourlyReportLoop } from './hourly-report-loop'
import { syncDeepseekChatRotate } from './deepseek-chat-rotate-loop'
import { syncGameCaptureLoop } from './game-capture-loop'
import { createRateLimiter } from './ipc/rate-limiter'
import { registerAiIpcHandlers } from './ipc/ai-handlers'
import { registerCaptureIpcHandlers } from './ipc/capture-handlers'
import { registerSettingsIpcHandlers } from './ipc/settings-handlers'
import { registerDataIpcHandlers } from './ipc/data-handlers'
import { registerAppIpcHandlers } from './ipc/app-handlers'
import { registerWatchFrameIpc } from './watch-frame-window'

export function registerIpcHandlers(overlayWindow: BrowserWindow): void {
  const checkRateLimit = createRateLimiter({
    [IPC_CHANNELS.AI_QUERY]: { maxCalls: 2, windowMs: 2000 },
    [IPC_CHANNELS.AUDIO_TRANSCRIBE]: { maxCalls: 1, windowMs: 3000 }
  })
  const autoCapture = createAutoCaptureLoop({
    captureScreen: captureScreenText,
    readConfig: () => ({
      enabled: getSetting<boolean>('autoCapture'),
      intervalSec: getSetting<number>('autoCaptureInterval') || DEFAULT_SETTINGS.autoCaptureInterval
    }),
    isDisposed: () => overlayWindow.isDestroyed(),
    publish: (update) => overlayWindow.webContents.send(IPC_CHANNELS.AUTO_CAPTURE_UPDATE, update),
    onError: (error) => console.warn('[Specter] Auto-capture failed:', error)
  })
  registerAiIpcHandlers(checkRateLimit)
  registerCaptureIpcHandlers(checkRateLimit)
  registerSettingsIpcHandlers(overlayWindow, autoCapture.sync)
  registerDataIpcHandlers()
  registerWatchFrameIpc()
  registerAppIpcHandlers(overlayWindow, autoCapture.stop)
  overlayWindow.once('closed', autoCapture.stop)

  autoCapture.sync()
  syncContinuousCoach(overlayWindow)
  syncActivityJournal()
  syncHourlyReportLoop()
  syncDeepseekChatRotate()
  syncGameCaptureLoop()
}
