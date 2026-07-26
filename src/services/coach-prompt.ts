import { DEFAULT_COACH_SYSTEM_PROMPT, DEFAULT_WORK_COACH_SYSTEM_PROMPT } from '../shared/constants'
import type { AssistantMode, ScreenMetadata } from '../shared/types'
import { resolveAssistantRequest, type ScreenKind } from './context-router'
import { resolveWorkProblemProfile, type WorkProblemProfile } from './work-problem-profile'
import { extractScreenContext } from './context-router'

export function buildCoachSystemPrompt(customPrompt?: string, mode?: AssistantMode): string {
  if (mode === 'work') return DEFAULT_WORK_COACH_SYSTEM_PROMPT
  if (mode === 'custom' && customPrompt?.trim()) {
    return customPrompt.trim()
  }
  if (customPrompt?.trim()) return customPrompt.trim()
  return DEFAULT_COACH_SYSTEM_PROMPT
}

export interface CoachRequest {
  kind: ScreenKind
  userMessage: string
  instantReply?: string
  actionable: boolean
  workProblem?: WorkProblemProfile
}

export function resolveCoachRequest(
  screenText: string,
  mode: AssistantMode = 'general',
  metadata?: ScreenMetadata
): CoachRequest {
  return resolveAssistantRequest(screenText, mode, metadata)
}

export function buildActiveTabUserMessage(
  screenText: string,
  mode: AssistantMode = 'work',
  metadata?: ScreenMetadata
): string {
  const req = resolveCoachRequest(screenText, mode, metadata)
  if (req.instantReply) return req.instantReply
  const profile =
    req.workProblem ??
    resolveWorkProblemProfile(screenText, metadata, extractScreenContext(screenText, mode, metadata).kind)
  return [
    req.userMessage,
    '',
    '[TASK — GIẢI THÍCH BÀI TRÊN MÀN HÌNH]',
    profile.formatFirst
  ].join('\n')
}

/** @deprecated Use resolveCoachRequest for coach flows. */
export function buildCoachUserMessage(
  screenText: string,
  mode: AssistantMode = 'general',
  metadata?: ScreenMetadata
): string {
  const req = resolveCoachRequest(screenText, mode, metadata)
  return req.instantReply ?? req.userMessage
}
