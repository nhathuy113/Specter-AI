import { resolvePerceptionPlan } from './perception'
import type { PerceptionMode } from '../../shared/types'

interface CaptureContextOptions {
  coachVision: boolean
  mode: PerceptionMode
  appName?: string
  windowTitle?: string
  accessibility: { text: string; appName?: string; windowTitle?: string } | null
}

export async function resolveCaptureContext<T>(image: T, options: CaptureContextOptions, ports: {
  ocr(image: T): Promise<string>
  fingerprint(image: T): Promise<string>
}) {
  if (options.coachVision) {
    const imageFingerprint = await ports.fingerprint(image)
    const text = [
      options.appName ? `[ACTIVE APP] ${options.appName}` : '',
      options.windowTitle ? `[WINDOW] ${options.windowTitle}` : '',
      '[SCREENSHOT] Use the attached image as primary context.'
    ].filter(Boolean).join('\n')
    return { text, textSource: 'metadata' as const, useVision: true, imageFingerprint }
  }
  const text = await ports.ocr(image)
  return resolvePerceptionPlan(options.mode, text, options.accessibility)
}
