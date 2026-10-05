import { ASSISTANT_MODES, PERCEPTION_MODES } from '../../shared/constants'
import { isWatchFrame } from '../capture/watch-frame'

// --- Settings value validation ---

const SETTINGS_KEY_VALIDATORS: Record<string, (value: unknown) => boolean> = {
  aiProvider: (v) => typeof v === 'string' && ['openrouter', 'openai', 'gemini', 'codex'].includes(v),
  openrouterApiKey: (v) => typeof v === 'string' && v.length <= 500,
  openaiApiKey: (v) => typeof v === 'string' && v.length <= 500,
  geminiApiKey: (v) => typeof v === 'string' && v.length <= 500,
  whisperApiKey: (v) => typeof v === 'string' && v.length <= 500,
  selectedModel: (v) => typeof v === 'string' && v.length <= 200 && /^[a-zA-Z0-9/_.:@-]+$/.test(v),
  openaiModel: (v) => typeof v === 'string' && v.length <= 100 && /^[a-zA-Z0-9_.:-]+$/.test(v),
  geminiModel: (v) => typeof v === 'string' && v.length <= 100 && /^[a-zA-Z0-9_.:-]+$/.test(v),
  codexModel: (v) => typeof v === 'string' && v.length <= 100 && /^[a-zA-Z0-9_.:-]+$/.test(v),
  overlayOpacity: (v) => typeof v === 'number' && v >= 0.3 && v <= 1.0,
  overlayPosition: (v) =>
    typeof v === 'object' && v !== null &&
    'x' in v && 'y' in v &&
    typeof (v as Record<string, unknown>).x === 'number' &&
    typeof (v as Record<string, unknown>).y === 'number',
  overlaySize: (v) =>
    typeof v === 'object' && v !== null &&
    'width' in v && 'height' in v &&
    typeof (v as Record<string, unknown>).width === 'number' &&
    typeof (v as Record<string, unknown>).height === 'number' &&
    (v as Record<string, number>).width >= 200 && (v as Record<string, number>).width <= 4000 &&
    (v as Record<string, number>).height >= 200 && (v as Record<string, number>).height <= 4000,
  hotkeys: (v) => typeof v === 'object' && v !== null,
  autoCapture: (v) => typeof v === 'boolean',
  autoCaptureInterval: (v) => typeof v === 'number' && v >= 5 && v <= 3600,
  continuousCoach: (v) => typeof v === 'boolean',
  detectIntervalSec: (v) => typeof v === 'number' && v >= 3 && v <= 300,
  coachCooldownSec: (v) => typeof v === 'number' && v >= 5 && v <= 300,
  fullAutoMode: (v) => typeof v === 'boolean',
  activityJournal: (v) => typeof v === 'boolean',
  journalIntervalSec: (v) => typeof v === 'number' && v >= 30 && v <= 300,
  journalSmartCrop: (v) => typeof v === 'boolean',
  activityJournalLog: (v) => {
    if (!Array.isArray(v)) return false
    return v.every((item) => {
      if (typeof item !== 'object' || item === null) return false
      const e = item as Record<string, unknown>
      return (
        typeof e.id === 'string' &&
        typeof e.minuteKey === 'string' &&
        typeof e.timestamp === 'number' &&
        typeof e.appName === 'string' &&
        typeof e.durationSec === 'number'
      )
    })
  },
  perceptionMode: (v) => typeof v === 'string' && (PERCEPTION_MODES as readonly string[]).includes(v),
  coachSystemPrompt: (v) => typeof v === 'string' && v.length <= 10000,
  maxTranscriptLength: (v) => typeof v === 'number' && v >= 100 && v <= 100000,
  systemPrompt: (v) => typeof v === 'string' && v.length <= 10000,
  language: (v) => typeof v === 'string' && v.length <= 10 && /^[a-zA-Z-]+$/.test(v),
  theme: (v) => typeof v === 'string' && ['dark', 'light', 'glass'].includes(v),
  conversations: (v) => Array.isArray(v),
  playbooks: (v) => {
    if (!Array.isArray(v)) return false
    return v.every((item) => {
      if (typeof item !== 'object' || item === null) return false
      const p = item as Record<string, unknown>
      if (typeof p.id !== 'string' || typeof p.name !== 'string' || typeof p.content !== 'string') return false
      if (typeof p.isActive !== 'boolean' || typeof p.createdAt !== 'number') return false
      if (p.modes !== undefined) {
        if (!Array.isArray(p.modes)) return false
        if (!p.modes.every((m) => typeof m === 'string' && (ASSISTANT_MODES as readonly string[]).includes(m))) {
          return false
        }
      }
      return true
    })
  },
  assistantMode: (v) => typeof v === 'string' && (ASSISTANT_MODES as readonly string[]).includes(v),
  whisperProvider: (v) => typeof v === 'string' && ['groq', 'openai', 'custom'].includes(v),
  whisperApiUrl: (v) => typeof v === 'string' && v.length <= 500,
  whisperModel: (v) => typeof v === 'string' && v.length <= 200,
  autoHideDelay: (v) => typeof v === 'number' && v >= 0 && v <= 300,
  smartCrop: (v) => typeof v === 'boolean',
  workAreaCaptureEnabled: (v) => typeof v === 'boolean',
  workAreaDisplayId: (v) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0,
  watchFrame: (v) => isWatchFrame(v),
  watchFrameBorderPx: (v) => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 8,
  watchFrameBorderOpacity: (v) => typeof v === 'number' && v >= 0.4 && v <= 1,
  workCoachSession: (v) => {
    if (v === null || v === undefined) return true
    if (typeof v !== 'object') return false
    const s = v as Record<string, unknown>
    const base =
      typeof s.sessionKey === 'string' && typeof s.thread === 'string' && typeof s.updatedAt === 'number'
    if (!base) return false
    if (s.codeFingerprintAtLastCoach !== undefined && typeof s.codeFingerprintAtLastCoach !== 'string') {
      return false
    }
    if (s.stuckRetryCount !== undefined && typeof s.stuckRetryCount !== 'number') {
      return false
    }
    if (s.cursorCoachReply !== undefined && typeof s.cursorCoachReply !== 'string') {
      return false
    }
    if (s.lastSuggestedSnippet !== undefined && typeof s.lastSuggestedSnippet !== 'string') {
      return false
    }
    if (s.lastCoachStepSummary !== undefined && typeof s.lastCoachStepSummary !== 'string') {
      return false
    }
    if (
      s.lastReviewOutcome !== undefined &&
      s.lastReviewOutcome !== 'unchanged' &&
      s.lastReviewOutcome !== 'approved' &&
      s.lastReviewOutcome !== 'rejected'
    ) {
      return false
    }
    return true
  }
}

/** Returns the set of allowed settings keys */
export function getAllowedSettingsKeys(): ReadonlySet<string> {
  return new Set(Object.keys(SETTINGS_KEY_VALIDATORS))
}

/** Validate a setting key + value. Returns true if valid. */
export function isValidSetting(key: string, value: unknown): boolean {
  if (!Object.hasOwn(SETTINGS_KEY_VALIDATORS, key)) return false
  const validator = SETTINGS_KEY_VALIDATORS[key]
  if (!validator) return false // unknown key → reject
  return validator(value)
}
