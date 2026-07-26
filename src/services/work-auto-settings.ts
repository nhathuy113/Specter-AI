import type { AssistantMode } from '../shared/constants'
import { DEFAULT_SETTINGS } from '../shared/constants'

export interface WorkAutoEnablePatch {
  fullAutoMode: boolean
  continuousCoach: boolean
  assistantMode: AssistantMode
  activityJournal: boolean
  smartCrop: boolean
  journalSmartCrop: boolean
  workAreaCaptureEnabled: boolean
  workAreaDisplayId?: number
  detectIntervalSec?: number
  coachCooldownSec?: number
}

export function isWorkAutoModeEnabled(fullAutoMode: boolean, continuousCoach: boolean): boolean {
  return fullAutoMode && continuousCoach
}

/** Settings applied when double ⌘/ enables work auto mode. */
export function buildWorkAutoEnablePatch(existing: {
  workAreaDisplayId?: number | null
  detectIntervalSec?: number | null
  coachCooldownSec?: number | null
}): WorkAutoEnablePatch {
  const patch: WorkAutoEnablePatch = {
    fullAutoMode: true,
    continuousCoach: true,
    assistantMode: 'work',
    activityJournal: true,
    smartCrop: true,
    journalSmartCrop: true,
    workAreaCaptureEnabled: false
  }

  if (!existing.workAreaDisplayId && existing.workAreaCaptureEnabled) {
    patch.workAreaDisplayId = 0
  }
  if (!existing.detectIntervalSec) {
    patch.detectIntervalSec = DEFAULT_SETTINGS.detectIntervalSec
  }
  patch.coachCooldownSec = Math.max(
    existing.coachCooldownSec ?? 0,
    DEFAULT_SETTINGS.workCoachCooldownSec
  )

  return patch
}

export function buildWorkAutoDisablePatch(): Pick<WorkAutoEnablePatch, 'fullAutoMode' | 'continuousCoach'> {
  return { fullAutoMode: false, continuousCoach: false }
}
