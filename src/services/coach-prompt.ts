import { DEFAULT_COACH_SYSTEM_PROMPT, DEFAULT_WORK_COACH_SYSTEM_PROMPT } from '../shared/constants'
import type { AssistantMode, ScreenMetadata } from '../shared/types'
import { resolveAssistantRequest, type ScreenKind } from './context-router'

export function buildCoachSystemPrompt(customPrompt?: string, mode?: AssistantMode): string {
  if (mode === 'custom' && customPrompt?.trim()) {
    return customPrompt.trim()
  }
  if (customPrompt?.trim()) return customPrompt.trim()
  if (mode === 'work') return DEFAULT_WORK_COACH_SYSTEM_PROMPT
  return DEFAULT_COACH_SYSTEM_PROMPT
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

export function buildActiveTabUserMessage(
  screenText: string,
  mode: AssistantMode = 'work',
  metadata?: ScreenMetadata
): string {
  const req = resolveCoachRequest(screenText, mode, metadata)
  if (req.instantReply) return req.instantReply
  return [
    req.userMessage,
    '',
    '[TASK — GIẢI THÍCH BÀI TRÊN MÀN HÌNH]',
    'Giải thích như giáo viên đang dạy trên bảng/slide/video:',
    '1) Chủ đề là gì (1 câu)',
    '2) Giải thích từng ý, công thức, biểu đồ, số liệu nhìn thấy — từng bước',
    '3) Kết luận ngắn / ý cần nhớ',
    'Chỉ dùng nội dung trên màn hình. Không gợi ý file hay app khác.'
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
