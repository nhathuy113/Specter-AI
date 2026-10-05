import { isValidSetting } from './settings-validation'
import type { UserSettings } from '../../shared/types'

export interface SettingsPersistence {
  get(key: string): unknown
  set(key: string, value: unknown): void
  clear(): void
}
export interface SecretCodec {
  encrypt(value: string): string
  decrypt(value: string): string
}

const sensitiveKeys = new Set(['openrouterApiKey', 'openaiApiKey', 'geminiApiKey', 'whisperApiKey'])

export function createSettingsRepository(persistence: () => SettingsPersistence, codec: SecretCodec) {
  function getSetting<T>(key: string): T {
    const raw = persistence().get(key)
    return (sensitiveKeys.has(key) && typeof raw === 'string' ? codec.decrypt(raw) : raw) as T
  }

  function setSetting(key: string, value: unknown): void {
    if (!isValidSetting(key, value)) {
      console.warn(`[Specter] Rejected invalid setting: ${key}`)
      return
    }
    persistence().set(key, sensitiveKeys.has(key) && typeof value === 'string' ? codec.encrypt(value) : value)
  }

  function getAllSettings(): UserSettings {
    return {
      aiProvider: getSetting('aiProvider') as UserSettings['aiProvider'],
      openrouterApiKey: getSetting('openrouterApiKey') as string,
      selectedModel: getSetting('selectedModel') as string,
      openaiApiKey: getSetting('openaiApiKey') as string,
      openaiModel: getSetting('openaiModel') as string,
      geminiApiKey: getSetting('geminiApiKey') as string,
      geminiModel: getSetting('geminiModel') as string,
      codexModel: getSetting('codexModel') as string,
      overlayOpacity: getSetting('overlayOpacity') as number,
      overlayPosition: getSetting('overlayPosition') as { x: number; y: number },
      overlaySize: getSetting('overlaySize') as { width: number; height: number },
      hotkeys: getSetting('hotkeys') as UserSettings['hotkeys'],
      autoCapture: getSetting('autoCapture') as boolean,
      autoCaptureInterval: getSetting('autoCaptureInterval') as number,
      continuousCoach: getSetting('continuousCoach') as boolean,
      detectIntervalSec: getSetting('detectIntervalSec') as number,
      coachCooldownSec: getSetting('coachCooldownSec') as number,
      fullAutoMode: getSetting('fullAutoMode') as boolean,
      activityJournal: getSetting('activityJournal') as boolean,
      journalIntervalSec: getSetting('journalIntervalSec') as number,
      journalSmartCrop: getSetting('journalSmartCrop') as boolean,
      assistantMode: getSetting('assistantMode') as UserSettings['assistantMode'],
      perceptionMode: getSetting('perceptionMode') as UserSettings['perceptionMode'],
      coachSystemPrompt: getSetting('coachSystemPrompt') as string,
      maxTranscriptLength: getSetting('maxTranscriptLength') as number,
      systemPrompt: getSetting('systemPrompt') as string,
      language: getSetting('language') as string,
      theme: getSetting('theme') as UserSettings['theme'],
      whisperProvider: getSetting('whisperProvider') as UserSettings['whisperProvider'],
      whisperApiKey: getSetting('whisperApiKey') as string,
      whisperApiUrl: getSetting('whisperApiUrl') as string,
      whisperModel: getSetting('whisperModel') as string,
      autoHideDelay: getSetting('autoHideDelay') as number,
      smartCrop: getSetting('smartCrop') as boolean,
      workAreaCaptureEnabled: getSetting('workAreaCaptureEnabled') as boolean,
      workAreaDisplayId: getSetting('workAreaDisplayId') as number,
      watchFrame: getSetting('watchFrame') as UserSettings['watchFrame']
    }
  }

  return { getSetting, setSetting, getAllSettings, resetSettings: () => persistence().clear() }
}
