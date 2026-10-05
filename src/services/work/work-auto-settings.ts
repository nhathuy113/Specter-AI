import { DEFAULT_SETTINGS } from '../../shared/constants'

export interface WorkAutoEnablePatch {
  fullAutoMode: boolean
  continuousCoach: boolean
  activityJournal: boolean
  smartCrop: boolean
  journalSmartCrop: boolean
  workAreaDisplayId?: number
  detectIntervalSec?: number
  coachCooldownSec?: number
}

export function isWorkAutoModeEnabled(fullAutoMode: boolean, continuousCoach: boolean): boolean {
  return fullAutoMode && continuousCoach
}

/** Settings applied when Auto turns on. Does not change assistant mode. */
export function buildWorkAutoEnablePatch(existing: {
  workAreaCaptureEnabled?: boolean | null
  workAreaDisplayId?: number | null
  detectIntervalSec?: number | null
  coachCooldownSec?: number | null
}): WorkAutoEnablePatch {
  const patch: WorkAutoEnablePatch = {
    fullAutoMode: true,
    continuousCoach: true,
    activityJournal: true,
    smartCrop: true,
    journalSmartCrop: true
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
