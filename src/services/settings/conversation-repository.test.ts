import { describe, expect, it } from 'vitest'
import { createConversationRepository } from './conversation-repository'
import type { Conversation } from '../../shared/types'

function conversation(id: string): Conversation {
  return { id, title: id, messages: [], model: 'model', createdAt: 1, updatedAt: 1 }
}

describe('conversation repository', () => {
  it('inserts newest first, replaces existing records in place and caps history at 100', () => {
    let saved: Conversation[] = []
    const repository = createConversationRepository({ read: () => saved, write: value => { saved = value } })
    for (let index = 0; index < 102; index++) repository.saveConversation(conversation(String(index)))
    expect(saved).toHaveLength(100)
    expect(saved[0].id).toBe('101')
    expect(saved[99].id).toBe('2')
    repository.saveConversation({ ...conversation('100'), title: 'updated' })
    expect(saved[1].title).toBe('updated')
    expect(saved).toHaveLength(100)
  })

  it('does not mutate a persistence-owned array, even if a write fails', () => {
    const existing = Object.freeze([conversation('old')])
    const repository = createConversationRepository({ read: () => existing as unknown as Conversation[], write: () => { throw new Error('disk full') } })
    expect(() => repository.saveConversation(conversation('new'))).toThrow('disk full')
    expect(() => repository.saveConversation({ ...conversation('old'), title: 'update' })).toThrow('disk full')
    expect(existing[0].title).toBe('old')
    expect(existing).toHaveLength(1)
  })

  it('supports empty stores, deletion and clearing without exposing the stored array', () => {
    let saved: Conversation[] | undefined
    const repository = createConversationRepository({ read: () => saved, write: value => { saved = value } })
    expect(repository.getConversations()).toEqual([])
    repository.saveConversation(conversation('a'))
    repository.saveConversation(conversation('b'))
    repository.getConversations().pop()
    expect(saved).toHaveLength(2)
    repository.deleteConversation('a')
    expect(saved?.map(value => value.id)).toEqual(['b'])
    repository.clearConversations()
    expect(saved).toEqual([])
  })
})
