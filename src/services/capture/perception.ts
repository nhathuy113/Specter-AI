import type { PerceptionMode } from '../../shared/types'

export type TextSource = 'accessibility' | 'ocr' | 'hybrid' | 'none'

export const VISION_TEXT_THRESHOLD = 120

export interface PerceptionPlan {
  text: string
  textSource: TextSource
  useVision: boolean
  appName?: string
  windowTitle?: string
}

function letterRatio(text: string): number {
  if (!text.length) return 0
  return (text.match(/[a-zA-Z0-9]/g) || []).length / text.length
}

/** Merge accessibility + OCR text, preferring the richer source. */
export function mergeAccessibilityAndOcr(
  accessibility: { text: string; appName?: string; windowTitle?: string } | null,
  ocrText: string
): { text: string; textSource: TextSource; appName?: string; windowTitle?: string } {
  const ax = accessibility?.text.trim() || ''
  const ocr = ocrText.trim()

  if (!ax && !ocr) {
    return { text: '', textSource: 'none' }
  }

  if (!ax) {
    return { text: ocr, textSource: 'ocr' }
  }

  if (!ocr) {
    return {
      text: ax,
      textSource: 'accessibility',
      appName: accessibility?.appName,
      windowTitle: accessibility?.windowTitle
    }
  }

  const axScore = ax.length * letterRatio(ax)
  const ocrScore = ocr.length * letterRatio(ocr)

  if (axScore >= ocrScore * 1.15 && ax.length >= 80) {
    return {
      text: ax,
      textSource: 'accessibility',
      appName: accessibility?.appName,
      windowTitle: accessibility?.windowTitle
    }
  }

  if (ocrScore >= axScore * 1.15) {
    return {
      text: ocr,
      textSource: 'ocr',
      appName: accessibility?.appName,
      windowTitle: accessibility?.windowTitle
    }
  }

  const header = [
    accessibility?.appName ? `[APP] ${accessibility.appName}` : '',
    accessibility?.windowTitle ? `[WINDOW] ${accessibility.windowTitle}` : ''
  ].filter(Boolean).join('\n')

  const merged = [header, ax, ocr].filter(Boolean).join('\n\n').slice(0, 8000)
  return {
    text: merged,
    textSource: 'hybrid',
    appName: accessibility?.appName,
    windowTitle: accessibility?.windowTitle
  }
}

export function shouldUseVision(mode: PerceptionMode, mergedText: string): boolean {
  if (mode === 'vision') return true
  if (mode === 'ocr') return false

  const trimmed = mergedText.trim()
  if (trimmed.length < VISION_TEXT_THRESHOLD) return true
  if (letterRatio(trimmed) < 0.15) return true
  return false
}

export function resolvePerceptionPlan(
  mode: PerceptionMode,
  ocrText: string,
  accessibility: { text: string; appName?: string; windowTitle?: string } | null
): PerceptionPlan {
  const merged = mergeAccessibilityAndOcr(accessibility, ocrText)
  return {
    ...merged,
    useVision: shouldUseVision(mode, merged.text)
  }
}

export function buildVisionUserTask(assistantUserMessage: string): string {
  if (assistantUserMessage.trim()) {
    return `${assistantUserMessage}\n\n[NOTE] A cropped screenshot of the user's active work window is attached. Use the image as primary context; OCR above is supplementary only.`
  }
  return [
    '[TASK]',
    'Look at the attached cropped screenshot of the user work window.',
    'Recommend 1-3 concrete next steps based on what you see.',
    'Never claim you clicked or typed anything.'
  ].join('\n')
}
