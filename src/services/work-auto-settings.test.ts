import { describe, expect, it } from 'vitest'
import {
  buildWorkAutoDisablePatch,
  buildWorkAutoEnablePatch,
  isWorkAutoModeEnabled
} from './work-auto-settings'
import { DEFAULT_SETTINGS } from '../shared/constants'

describe('work auto settings gate', () => {
  it('requires both fullAutoMode and continuousCoach', () => {
    expect(isWorkAutoModeEnabled(true, true)).toBe(true)
    expect(isWorkAutoModeEnabled(true, false)).toBe(false)
    expect(isWorkAutoModeEnabled(false, true)).toBe(false)
  })

  it('enables work coach stack on MacBook pinned capture', () => {
    const patch = buildWorkAutoEnablePatch({})
    expect(patch).toMatchObject({
      fullAutoMode: true,
      continuousCoach: true,
      assistantMode: 'work',
      activityJournal: true,
      workAreaCaptureEnabled: true,
      workAreaDisplayId: 0,
      detectIntervalSec: DEFAULT_SETTINGS.detectIntervalSec,
      coachCooldownSec: DEFAULT_SETTINGS.coachCooldownSec
    })
  })

  it('does not overwrite existing intervals when enabling', () => {
    const patch = buildWorkAutoEnablePatch({
      workAreaDisplayId: 2,
      detectIntervalSec: 8,
      coachCooldownSec: 20
    })
    expect(patch.workAreaDisplayId).toBeUndefined()
    expect(patch.detectIntervalSec).toBeUndefined()
    expect(patch.coachCooldownSec).toBeUndefined()
  })

  it('disables auto without touching unrelated settings', () => {
    expect(buildWorkAutoDisablePatch()).toEqual({
      fullAutoMode: false,
      continuousCoach: false
    })
  })
})
