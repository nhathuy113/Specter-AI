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

  it('enables work coach stack with smart crop (not pinned full display)', () => {
    const patch = buildWorkAutoEnablePatch({})
    expect(patch).toMatchObject({
      fullAutoMode: true,
      continuousCoach: true,
      assistantMode: 'work',
      activityJournal: true,
      smartCrop: true,
      workAreaCaptureEnabled: false,
      detectIntervalSec: DEFAULT_SETTINGS.detectIntervalSec,
      coachCooldownSec: DEFAULT_SETTINGS.workCoachCooldownSec
    })
    expect(patch.workAreaDisplayId).toBeUndefined()
  })

  it('raises cooldown to work minimum without lowering user value above it', () => {
    const patch = buildWorkAutoEnablePatch({
      workAreaDisplayId: 2,
      detectIntervalSec: 8,
      coachCooldownSec: 20
    })
    expect(patch.workAreaDisplayId).toBeUndefined()
    expect(patch.detectIntervalSec).toBeUndefined()
    expect(patch.coachCooldownSec).toBe(DEFAULT_SETTINGS.workCoachCooldownSec)
  })

  it('keeps user cooldown when already above work minimum', () => {
    const patch = buildWorkAutoEnablePatch({
      coachCooldownSec: 120
    })
    expect(patch.coachCooldownSec).toBe(120)
  })

  it('disables auto without touching unrelated settings', () => {
    expect(buildWorkAutoDisablePatch()).toEqual({
      fullAutoMode: false,
      continuousCoach: false
    })
  })
})
