import type { ScreenMetadata } from '../shared/types'
import type { ScreenKind } from './context-router'
import {
  pickWorkProblemSpec,
  type WorkProblemKind,
  type WorkProblemSpec
} from './work-problem-registry'

export interface WorkProblemProfile {
  kind: WorkProblemKind
  screenKind: ScreenKind
  confidence: number
  taskHints: string[]
  formatFirst: string
  formatContinue: string
  forceVision: boolean
  snippetTracking: boolean
  allowCodeReview: boolean
}

function toProfile(spec: WorkProblemSpec, screenKind: ScreenKind, confidence: number): WorkProblemProfile {
  return {
    kind: spec.kind,
    screenKind,
    confidence,
    taskHints: spec.taskHints,
    formatFirst: spec.formatFirst,
    formatContinue: spec.formatContinue,
    forceVision: spec.forceVision,
    snippetTracking: spec.snippetTracking,
    allowCodeReview: spec.allowCodeReview
  }
}

export function resolveWorkProblemProfile(
  screenText: string,
  metadata: ScreenMetadata | undefined,
  screenKind: ScreenKind
): WorkProblemProfile {
  const ctx = { screenText, metadata, screenKind }
  const spec = pickWorkProblemSpec(ctx)
  return toProfile(spec, screenKind, spec.detect(ctx))
}

/** Work coach always uses vision when a cropped screenshot is available. */
export function shouldForceWorkCoachVision(_profile: WorkProblemProfile, hasScreenshot: boolean): boolean {
  return hasScreenshot
}

/** @deprecated Use resolveWorkProblemProfile(...).kind === 'visual-quiz' */
export function isVisualQuizProfile(profile: WorkProblemProfile): boolean {
  return profile.kind === 'visual-quiz'
}
