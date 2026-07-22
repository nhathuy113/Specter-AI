import { DEFAULT_COACH_SYSTEM_PROMPT } from '../shared/constants'
import type { AssistantMode, ScreenMetadata } from '../shared/types'
import { resolveAssistantRequest, type ScreenKind } from './context-router'

export function buildCoachSystemPrompt(customPrompt?: string, mode?: AssistantMode): string {
  if (mode === 'custom' && customPrompt?.trim()) {
    return customPrompt.trim()
  }
  return customPrompt?.trim() || DEFAULT_COACH_SYSTEM_PROMPT
}

export interface CoachRequest {
  kind: ScreenKind
  userMessage: string
  instantReply?: string
  actionable: boolean
}

export function resolveCoachRequest(
  screenText: string,
  mode: AssistantMode = 'general',
  metadata?: ScreenMetadata
): CoachRequest {
  return resolveAssistantRequest(screenText, mode, metadata)
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
