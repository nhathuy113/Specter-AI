import type { Conversation } from '../../shared/types'

const CONVERSATION_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/

export function isValidQuery(query: unknown): query is string {
  return typeof query === 'string' && query.length > 0 && query.length <= 50000
}

export function isValidConversationId(id: unknown): id is string {
  return typeof id === 'string' && CONVERSATION_ID_REGEX.test(id)
}

export function isValidConversation(c: unknown): c is Conversation {
  if (typeof c !== 'object' || c === null) return false
  const conv = c as Record<string, unknown>
  return (
    typeof conv.id === 'string' && conv.id.length <= 128 &&
    typeof conv.title === 'string' && conv.title.length <= 500 &&
    Array.isArray(conv.messages) && conv.messages.length <= 1000 &&
    typeof conv.model === 'string' && conv.model.length <= 200 &&
    typeof conv.createdAt === 'number' &&
    typeof conv.updatedAt === 'number'
  )
}

export function isValidMessageHistory(history: unknown): history is Array<{ role: string; content: string }> {
  if (!Array.isArray(history)) return false
  if (history.length > 50) return false // cap history length
  return history.every(
    (msg) =>
      typeof msg === 'object' && msg !== null &&
      typeof msg.role === 'string' && ['user', 'assistant', 'system'].includes(msg.role) &&
      typeof msg.content === 'string' && msg.content.length <= 50000
  )
}

export function isValidSettingsKey(key: unknown): key is string {
  return typeof key === 'string' && key.length <= 100
}
