import type { AssistantMode } from '../../shared/types'
import type { TextMessage } from '../ai/contracts'
import { buildVisionUserTask } from '../capture/perception'
import { buildCoachSystemPrompt } from '../coach/coach-prompt'
import { buildSystemPrompt } from './context-builder'

export interface AssistantMessageInput {
  coachMode: boolean
  assistantMode: AssistantMode
  systemPrompt?: string
  userMessage: string
  playbookContext?: string
  journalContext?: string
  history?: Array<{ role: string; content: string }>
  useVision: boolean
  instantReply?: string
}

/** Prompt policy is independent of IPC, settings and native capture. */
export function buildAssistantMessages(input: AssistantMessageInput): TextMessage[] {
  const context = input.coachMode ? [input.userMessage]
    : [input.playbookContext, input.journalContext, input.userMessage].filter(Boolean)
  const userContent = context.join('\n\n')
  const messages: TextMessage[] = [{
    role: 'system',
    content: input.coachMode
      ? buildCoachSystemPrompt(input.systemPrompt, input.assistantMode)
      : buildSystemPrompt(input.systemPrompt)
  }]
  for (const message of input.history?.slice(-10) ?? []) {
    if (message.role === 'user' || message.role === 'assistant') messages.push({ role: message.role, content: message.content })
  }
  messages.push({
    role: 'user',
    content: input.useVision && !input.instantReply ? buildVisionUserTask(userContent) : userContent
  })
  return messages
}
