import { ipcMain, BrowserWindow, screen } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { getSetting, setSetting, getAllSettings, isValidSetting } from '../../services/settings/store'
import { syncWatchFrame } from '../watch-frame-window'
import { syncActivityJournal } from '../activity-journal-loop'
import { syncHourlyReportLoop } from '../hourly-report-loop'
import { syncGameCaptureLoop } from '../game-capture-loop'
import { syncContinuousCoach } from '../continuous-coach-loop'
import { getWorkAutoModeStatus } from '../work-auto-mode'
import { setOverlayOpacity } from '../overlay-window'
import { reRegisterHotkeys } from '../hotkey-manager'
import { isValidSettingsKey } from './input-validation'

export function registerSettingsIpcHandlers(overlayWindow: BrowserWindow, syncAutoCapture: () => void): void {
  // Settings — with allowlist validation
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, (_event, key: string) => {
    if (!isValidSettingsKey(key)) {
      throw new Error('Invalid settings key')
    }
    return getSetting(key)
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, (_event, key: string, value: unknown) => {
    if (!isValidSettingsKey(key)) {
      throw new Error('Invalid settings key')
    }
    if (!isValidSetting(key, value)) {
      throw new Error(`Invalid value for setting: ${key}`)
    }
    setSetting(key, value)
    if (key === 'watchFrame') syncWatchFrame()
    // Live-update overlay opacity when changed
    if (key === 'overlayOpacity' && typeof value === 'number') {
      setOverlayOpacity(value)
    }
    // Re-sync auto-capture when its settings change
    if (key === 'autoCapture' || key === 'autoCaptureInterval') {
      syncAutoCapture()
    }
    if (
      key === 'continuousCoach' ||
      key === 'fullAutoMode' ||
      key === 'assistantMode' ||
      key === 'perceptionMode' ||
      key === 'detectIntervalSec' ||
      key === 'coachCooldownSec'
    ) {
      if (key === 'fullAutoMode' && value === true) {
        setSetting('continuousCoach', true)
        setSetting('activityJournal', true)
        setSetting('smartCrop', true)
        setSetting('journalSmartCrop', true)
      }
      syncContinuousCoach(overlayWindow)
      if (!overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send(IPC_CHANNELS.WORK_AUTO_TOGGLED, {
          enabled: getWorkAutoModeStatus().enabled
        })
      }
    }
    if (key === 'activityJournal' || key === 'journalIntervalSec' || key === 'journalSmartCrop' || key === 'fullAutoMode') {
      syncActivityJournal()
      syncHourlyReportLoop()
    }
    if (key === 'hourlyReportEnabled' || key === 'hourlyReportIntervalSec') {
      syncHourlyReportLoop()
    }
    if (
      key === 'gameModeEnabled' ||
      key === 'gameCaptureIntervalSec' ||
      key === 'gameBlockSec' ||
      key === 'gameHourlyAiSec'
    ) {
      syncGameCaptureLoop()
    }
    // Re-register hotkeys when hotkey settings change
    if (key === 'hotkeys') {
      reRegisterHotkeys()
    }
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_ALL, () => {
    return getAllSettings()
  })

  ipcMain.handle(IPC_CHANNELS.DISPLAYS_LIST, () => {
    const primaryId = screen.getPrimaryDisplay().id
    return screen.getAllDisplays().map((d) => ({
      id: d.id,
      label: d.label || `Display ${d.id}`,
      bounds: d.bounds,
      isPrimary: d.id === primaryId
    }))
  })

}
