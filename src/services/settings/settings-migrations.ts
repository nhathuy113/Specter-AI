import { DEFAULT_SETTINGS, DEFAULT_SYSTEM_PROMPT } from '../../shared/constants'
import type { SettingsPersistence } from './settings-repository'

// --- System prompt migration ---
// Old default prompts that shipped with previous versions.
// If a user's stored systemPrompt matches one of these exactly, it's the
// factory default (not a user customisation) and should be upgraded.
const STALE_DEFAULT_PROMPTS = [
  `You are a real-time AI assistant helping the user during meetings, interviews, and work sessions.
You have access to what's on their screen and what's being said.
Give concise, immediately actionable responses.
Format responses for quick reading: use short paragraphs and bullet points.
Never reveal that you are an AI assistant unless directly asked.`,
  `You are a real-time AI copilot for meetings, interviews, and work sessions.
You have access to what's on the user's screen and what's being said.

Rules:
- Answer ONLY what is asked. Be direct and concise.
- Do NOT add unnecessary explanations or filler.
- For MCQs: give only the correct answer letter/option. Do not rewrite the question.
- For coding questions: give optimal code, a 2-line explanation, and time/space complexity.
- For behavioral/situational questions: give a structured response in 2-3 sentences.
- For technical questions: give a clear, accurate answer in 2-4 sentences.
- Format for quick reading: short paragraphs and bullet points.
- Never reveal you are an AI assistant unless directly asked.`
]

/**
 * Migrate settings that may be stale from a previous version.
 * Called once after the store is created / loaded.
 */
export function migrateSettings(s: Pick<SettingsPersistence, 'get' | 'set'>): void {
  // 1. System prompt: replace old defaults with current DEFAULT_SYSTEM_PROMPT
  const currentPrompt = s.get('systemPrompt') as string | undefined
  if (currentPrompt && STALE_DEFAULT_PROMPTS.includes(currentPrompt.trim())) {
    s.set('systemPrompt', DEFAULT_SYSTEM_PROMPT)
    console.info('[Specter] Migrated system prompt to new default')
  }

  const hotkeys = s.get('hotkeys') as Record<string, string> | undefined
  if (hotkeys && !hotkeys.activeTabAsk) {
    s.set('hotkeys', { ...DEFAULT_SETTINGS.hotkeys, ...hotkeys })
    console.info('[Specter] Migrated hotkeys — added activeTabAsk (double ⌘/)')
  }

  const opacity = s.get('overlayOpacity') as number | undefined
  if (opacity === 0.85) {
    s.set('overlayOpacity', DEFAULT_SETTINGS.overlayOpacity)
    console.info('[Specter] Migrated overlay opacity → macOS glass default (95%)')
  }
}
