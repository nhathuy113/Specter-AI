import type { Conversation } from '../../shared/types'

interface ConversationPersistence {
  read(): Conversation[] | undefined
  write(conversations: Conversation[]): void
}

export function createConversationRepository(persistence: ConversationPersistence) {
  function getConversations(): Conversation[] { return [...(persistence.read() || [])] }
  return {
    getConversations,
    saveConversation(conversation: Conversation): void {
      const conversations = getConversations()
      const index = conversations.findIndex(existing => existing.id === conversation.id)
      if (index >= 0) conversations[index] = conversation
      else conversations.unshift(conversation)
      persistence.write(conversations.slice(0, 100))
    },
    deleteConversation(id: string): void {
      persistence.write(getConversations().filter(conversation => conversation.id !== id))
    },
    clearConversations(): void { persistence.write([]) }
  }
}
