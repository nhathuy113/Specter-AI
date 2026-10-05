import type { BrowserWindow } from 'electron'
import { getSetting, setSetting } from '../services/settings/store'
import { syncActivityJournal } from './activity-journal-loop'
import { syncContinuousCoach } from './continuous-coach-loop'
import { syncOverlayBackgroundMode } from './overlay-window'
import { IPC_CHANNELS } from '../shared/ipc-channels'
import {
  buildWorkAutoDisablePatch,
  buildWorkAutoEnablePatch,
  isWorkAutoModeEnabled as isWorkAutoEnabled
} from '../services/work/work-auto-settings'

/** Double ⌘/ toggles continuous work auto (watch + explain on pinned MacBook screen). */
export function isWorkAutoModeEnabled(): boolean {
  return isWorkAutoEnabled(
    getSetting<boolean>('fullAutoMode') ?? false,
    getSetting<boolean>('continuousCoach') ?? false
  )
}

export function toggleWorkAutoMode(overlayWindow: BrowserWindow): boolean {
  const enabling = !isWorkAutoModeEnabled()

  if (enabling) {
    const patch = buildWorkAutoEnablePatch({
      workAreaDisplayId: getSetting<number>('workAreaDisplayId'),
      detectIntervalSec: getSetting<number>('detectIntervalSec'),
      coachCooldownSec: getSetting<number>('coachCooldownSec')
    })
    for (const [key, value] of Object.entries(patch)) {
      setSetting(key, value)
    }
  } else {
    const patch = buildWorkAutoDisablePatch()
    setSetting('fullAutoMode', patch.fullAutoMode)
    setSetting('continuousCoach', patch.continuousCoach)
  }

  syncContinuousCoach(overlayWindow)
  syncActivityJournal()
  syncOverlayBackgroundMode()

  if (!overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send(IPC_CHANNELS.WORK_AUTO_TOGGLED, { enabled: enabling })
  }

  console.info(`[Specter] Work auto mode ${enabling ? 'ON' : 'OFF'} (double ⌘/)`)
  return enabling
}

export function getWorkAutoModeStatus(): { enabled: boolean } {
  return { enabled: isWorkAutoModeEnabled() }
}
