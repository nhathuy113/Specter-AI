import { describe, expect, it, vi } from 'vitest'
const settings = vi.hoisted(() => ({ fullAutoMode: false, continuousCoach: false, workAreaCaptureEnabled: true, workAreaDisplayId: 42 }))
const set = vi.hoisted(() => vi.fn())
vi.mock('../services/settings/store', () => ({
  getSetting: (key: string) => settings[key as keyof typeof settings], setSetting: set
}))
vi.mock('./activity-journal-loop', () => ({ syncActivityJournal: vi.fn() }))
vi.mock('./continuous-coach-loop', () => ({ syncContinuousCoach: vi.fn() }))
vi.mock('./overlay-window', () => ({ syncOverlayBackgroundMode: vi.fn() }))
import { toggleWorkAutoMode } from './work-auto-mode'
import type { BrowserWindow } from 'electron'

it('the actual Auto toggle does not overwrite an enabled monitor pin', () => {
  const overlay = { isDestroyed: () => false, webContents: { send: vi.fn() } } as unknown as BrowserWindow
  expect(toggleWorkAutoMode(overlay)).toBe(true)
  expect(set).toHaveBeenCalledWith('fullAutoMode', true)
  expect(set.mock.calls.some(([key]) => key === 'workAreaCaptureEnabled' || key === 'workAreaDisplayId')).toBe(false)
  expect(settings.workAreaCaptureEnabled).toBe(true)
  expect(settings.workAreaDisplayId).toBe(42)
})
