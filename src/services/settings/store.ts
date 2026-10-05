// Persistence composition root; public functions remain compatible with callers.
import { getStore } from './electron-settings-store'
export { getStore } from './electron-settings-store'
import { nativeSecretCodec } from './secret-storage'
import { createSettingsRepository } from './settings-repository'
import { createConversationRepository } from './conversation-repository'
export { isValidSetting, getAllowedSettingsKeys } from './settings-validation'

const settings = createSettingsRepository(getStore, nativeSecretCodec)
export const getSetting = settings.getSetting
export const setSetting = settings.setSetting
export const getAllSettings = settings.getAllSettings
export const resetSettings = settings.resetSettings

const conversations = createConversationRepository({
  read: () => getSetting('conversations'),
  write: value => getStore().set('conversations', value)
})
export const getConversations = conversations.getConversations
export const saveConversation = conversations.saveConversation
export const deleteConversation = conversations.deleteConversation
export const clearConversations = conversations.clearConversations
