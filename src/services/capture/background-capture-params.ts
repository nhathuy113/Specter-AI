import { DEFAULT_SETTINGS } from '../../shared/constants'
import type { AssistantMode, PerceptionMode } from '../../shared/types'

export interface BackgroundCaptureParams {
  activeWindowOnly: boolean
  perceptionMode: PerceptionMode
  skipAccessibility: boolean
  coachVision: boolean
}

/** Same capture knobs as continuous coach / full-auto watch loop. */
export function resolveBackgroundCaptureParams(read: (key: string) => unknown): BackgroundCaptureParams {
  const fullAuto = !!read('fullAutoMode')
  const assistantMode = (read('assistantMode') || DEFAULT_SETTINGS.assistantMode) as AssistantMode
  const smartCrop =
    assistantMode === 'work'
      ? true
      : !!(read('smartCrop') ?? DEFAULT_SETTINGS.smartCrop)
  const perceptionMode = (
    fullAuto
      ? 'vision'
      : (read('perceptionMode') || DEFAULT_SETTINGS.perceptionMode)
  ) as PerceptionMode

  return {
    activeWindowOnly: smartCrop,
    perceptionMode,
    skipAccessibility: fullAuto,
    /** Full auto + work: multimodal screenshot to the model (OCR only for fingerprint/journal). */
    coachVision: assistantMode === 'work' || fullAuto
  }
}
