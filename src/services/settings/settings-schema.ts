import { DEFAULT_SETTINGS, DEFAULT_COACH_SYSTEM_PROMPT } from '../../shared/constants'

export const settingsSchema = {
  aiProvider: { type: 'string' as const, default: DEFAULT_SETTINGS.aiProvider },
  openrouterApiKey: { type: 'string' as const, default: DEFAULT_SETTINGS.openrouterApiKey },
  selectedModel: { type: 'string' as const, default: DEFAULT_SETTINGS.selectedModel },
  openaiApiKey: { type: 'string' as const, default: DEFAULT_SETTINGS.openaiApiKey },
  openaiModel: { type: 'string' as const, default: DEFAULT_SETTINGS.openaiModel },
  geminiApiKey: { type: 'string' as const, default: DEFAULT_SETTINGS.geminiApiKey },
  geminiModel: { type: 'string' as const, default: DEFAULT_SETTINGS.geminiModel },
  codexModel: { type: 'string' as const, default: DEFAULT_SETTINGS.codexModel },
  overlayOpacity: { type: 'number' as const, default: DEFAULT_SETTINGS.overlayOpacity, minimum: 0.3, maximum: 1.0 },
  overlayPosition: {
    type: 'object' as const,
    properties: {
      x: { type: 'number' as const },
      y: { type: 'number' as const }
    },
    default: DEFAULT_SETTINGS.overlayPosition
  },
  overlaySize: {
    type: 'object' as const,
    properties: {
      width: { type: 'number' as const },
      height: { type: 'number' as const }
    },
    default: DEFAULT_SETTINGS.overlaySize
  },
  hotkeys: {
    type: 'object' as const,
    default: DEFAULT_SETTINGS.hotkeys
  },
  autoCapture: { type: 'boolean' as const, default: DEFAULT_SETTINGS.autoCapture },
  autoCaptureInterval: { type: 'number' as const, default: DEFAULT_SETTINGS.autoCaptureInterval },
  continuousCoach: { type: 'boolean' as const, default: DEFAULT_SETTINGS.continuousCoach },
  detectIntervalSec: { type: 'number' as const, default: DEFAULT_SETTINGS.detectIntervalSec },
  coachCooldownSec: { type: 'number' as const, default: DEFAULT_SETTINGS.coachCooldownSec },
  assistantMode: { type: 'string' as const, default: DEFAULT_SETTINGS.assistantMode },
  perceptionMode: { type: 'string' as const, default: DEFAULT_SETTINGS.perceptionMode },
  coachSystemPrompt: { type: 'string' as const, default: DEFAULT_COACH_SYSTEM_PROMPT },
  maxTranscriptLength: { type: 'number' as const, default: DEFAULT_SETTINGS.maxTranscriptLength },
  systemPrompt: { type: 'string' as const, default: DEFAULT_SETTINGS.systemPrompt },
  language: { type: 'string' as const, default: DEFAULT_SETTINGS.language },
  theme: { type: 'string' as const, default: DEFAULT_SETTINGS.theme },
  conversations: { type: 'array' as const, default: [] },
  playbooks: { type: 'array' as const, default: [] },
  whisperProvider: { type: 'string' as const, default: DEFAULT_SETTINGS.whisperProvider },
  whisperApiKey: { type: 'string' as const, default: DEFAULT_SETTINGS.whisperApiKey },
  whisperApiUrl: { type: 'string' as const, default: DEFAULT_SETTINGS.whisperApiUrl },
  whisperModel: { type: 'string' as const, default: DEFAULT_SETTINGS.whisperModel },
  autoHideDelay: { type: 'number' as const, default: DEFAULT_SETTINGS.autoHideDelay },
  smartCrop: { type: 'boolean' as const, default: DEFAULT_SETTINGS.smartCrop },
  fullAutoMode: { type: 'boolean' as const, default: DEFAULT_SETTINGS.fullAutoMode },
  activityJournal: { type: 'boolean' as const, default: DEFAULT_SETTINGS.activityJournal },
  journalIntervalSec: { type: 'number' as const, default: DEFAULT_SETTINGS.journalIntervalSec },
  journalSmartCrop: { type: 'boolean' as const, default: DEFAULT_SETTINGS.journalSmartCrop },
  activityJournalLog: { type: 'array' as const, default: [] },
  workAreaCaptureEnabled: { type: 'boolean' as const, default: DEFAULT_SETTINGS.workAreaCaptureEnabled },
  workAreaDisplayId: { type: 'number' as const, default: DEFAULT_SETTINGS.workAreaDisplayId },
  watchFrame: {
    type: 'object' as const,
    properties: {
      x: { type: 'number' as const },
      y: { type: 'number' as const },
      width: { type: 'number' as const },
      height: { type: 'number' as const }
    },
    default: DEFAULT_SETTINGS.watchFrame
  },
  watchFrameBorderPx: { type: 'number' as const, default: DEFAULT_SETTINGS.watchFrameBorderPx, minimum: 1, maximum: 8 },
  watchFrameBorderOpacity: { type: 'number' as const, default: DEFAULT_SETTINGS.watchFrameBorderOpacity, minimum: 0.4, maximum: 1 }
}
