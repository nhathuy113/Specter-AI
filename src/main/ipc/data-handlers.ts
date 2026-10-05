import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { getSetting, getConversations, saveConversation, deleteConversation, clearConversations } from '../../services/settings/store'
import { fetchAvailableModels } from '../../services/ai/openrouter'
import { createDashboardWindow } from '../dashboard-window'
import type { Conversation } from '../../shared/types'
import { isValidConversation, isValidConversationId } from './input-validation'

export function registerDataIpcHandlers(): void {
  // Models
  ipcMain.handle(IPC_CHANNELS.MODELS_FETCH, async () => {
    const apiKey = getSetting<string>('openrouterApiKey')
    if (!apiKey) {
      throw new Error('No API key configured')
    }
    return fetchAvailableModels(apiKey)
  })

  // Dashboard
  ipcMain.on(IPC_CHANNELS.OPEN_DASHBOARD, () => {
    createDashboardWindow()
  })

  // Conversations — with input validation
  ipcMain.handle(IPC_CHANNELS.CONVERSATIONS_LIST, () => {
    return getConversations()
  })

  ipcMain.handle(IPC_CHANNELS.CONVERSATIONS_SAVE, (_event, conversation: unknown) => {
    if (!isValidConversation(conversation)) {
      throw new Error('Invalid conversation data')
    }
    saveConversation(conversation as Conversation)
  })

  ipcMain.on(IPC_CHANNELS.CONVERSATIONS_DELETE, (_event, id: unknown) => {
    if (!isValidConversationId(id)) {
      console.warn('[Specter] Invalid conversation ID for delete:', id)
      return
    }
    deleteConversation(id)
  })

  ipcMain.on(IPC_CHANNELS.CONVERSATIONS_CLEAR, () => {
    clearConversations()
  })

}
