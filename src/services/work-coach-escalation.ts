import {
  WORK_COACH_GEMINI_36,
  WORK_COACH_GEMINI_LITE,
  WORK_COACH_TRIPLE_LABELS
} from '../shared/constants'
import type { WorkCoachReplyMode } from './work-coach-session'

/** Work coach expand uses dual Gemini panel; level kept for debug labels. */
export type WorkCoachEscalationLevel = 4

export { WORK_COACH_GEMINI_LITE, WORK_COACH_GEMINI_36, WORK_COACH_TRIPLE_LABELS }

/** Expand coach runs Lite + 3.6; Cursor SDK added for coding problems only. */
export function resolveWorkCoachEscalation(
  _replyMode: WorkCoachReplyMode,
  _stuckRetryCount: number
): WorkCoachEscalationLevel {
  return 4
}

export function workCoachEscalationLabel(_level: WorkCoachEscalationLevel): string {
  return 'adaptive'
}
