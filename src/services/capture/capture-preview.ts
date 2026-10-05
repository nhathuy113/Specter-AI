import type { CapturePreviewOptions } from '../../shared/types'
import { isValidSetting } from '../settings/settings-validation'

const keys = new Set(['workAreaCaptureEnabled', 'workAreaDisplayId', 'fullAutoMode', 'continuousCoach', 'assistantMode', 'smartCrop', 'perceptionMode'])

export function parseCapturePreviewOptions(raw?: unknown): CapturePreviewOptions {
  if (raw === undefined) return {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid capture preview options')
  const options: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!keys.has(key) || !isValidSetting(key, value)) throw new Error(`Invalid capture preview setting: ${key}`)
    options[key] = value
  }
  return options as CapturePreviewOptions
}

/** Unsaved form values are read for one capture, without triggering settings side effects. */
export function createCaptureSettingsReader(overrides: CapturePreviewOptions, read: (key: string) => unknown) {
  return <T = unknown>(key: string): T => (
    Object.hasOwn(overrides, key) ? overrides[key as keyof CapturePreviewOptions] : read(key)
  ) as T
}
