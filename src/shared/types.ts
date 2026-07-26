// Shared type definitions for Specter AI

import type { AssistantMode, PerceptionMode } from './constants'

export type { AssistantMode, PerceptionMode }

export interface UserSettings {
  aiProvider: 'openrouter' | 'openai' | 'gemini' | 'codex'
  openrouterApiKey: string
  selectedModel: string
  openaiApiKey: string
  openaiModel: string
  geminiApiKey: string
  geminiModel: string
  codexModel: string
  overlayOpacity: number
  overlayPosition: { x: number; y: number }
  overlaySize: { width: number; height: number }
  hotkeys: {
    askAI: string
    toggleOverlay: string
    toggleAudio: string
    screenshotAsk: string
    activeTabAsk: string
  }
  autoCapture: boolean
  autoCaptureInterval: number
  continuousCoach: boolean
  detectIntervalSec: number
  coachCooldownSec: number
  fullAutoMode: boolean
  activityJournal: boolean
  journalIntervalSec: number
  journalSmartCrop: boolean
  assistantMode: AssistantMode
  perceptionMode: PerceptionMode
  coachSystemPrompt: string
  maxTranscriptLength: number
  systemPrompt: string
  language: string
  theme: 'dark' | 'light' | 'glass'
  // Whisper / audio transcription
  whisperProvider: 'groq' | 'openai' | 'custom'
  whisperApiKey: string
  whisperApiUrl: string
  whisperModel: string
  // UX
  autoHideDelay: number // seconds, 0 = disabled
  smartCrop: boolean    // capture active window only (vs full screen)
}

export interface OpenRouterModel {
  id: string
  name: string
  pricing: {
    prompt: string
    completion: string
  }
  context_length: number
  description?: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  tokenCount?: number
  cost?: number
}

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  model: string
  createdAt: number
  updatedAt: number
}

export interface ContextSnapshot {
  screenText: string
  transcript: string
  userQuery?: string
  screenshot?: string // base64
}

export interface AudioStatus {
  isRecording: boolean
  duration: number
  error?: string
}

export interface ScreenCaptureResult {
  text: string
  /** Local OCR for dedup/fingerprint only — never sent to the model when coachVision is set. */
  fingerprintText?: string
  screenshot?: string // base64 png
  timestamp: number
  textSource?: 'accessibility' | 'ocr' | 'hybrid' | 'none' | 'metadata'
  useVision?: boolean
  appName?: string
  windowTitle?: string
  displayCount?: number
}

export interface CostEstimate {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  totalCost: number
  model: string
}

export interface ScreenMetadata {
  appName?: string
  windowTitle?: string
  textSource?: 'accessibility' | 'ocr' | 'hybrid' | 'none'
  displayCount?: number
}

export interface ActivityJournalEntry {
  id: string
  minuteKey: string
  timestamp: number
  appName: string
  windowTitle: string
  screenKind: string
  snippet: string
  fingerprint: string
  durationSec: number
  /** OCR character count from smart-crop capture */
  ocrChars?: number
  textSource?: 'accessibility' | 'ocr' | 'hybrid' | 'none'
  capturePlan?: 'window-crop' | 'display-full'
}

export interface Playbook {
  id: string
  name: string
  content: string
  isActive: boolean
  /** Empty or omitted = applies to all assistant modes */
  modes?: AssistantMode[]
  createdAt: number
}
