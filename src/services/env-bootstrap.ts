import { config } from 'dotenv'
import { resolve } from 'path'
import { getSetting, setSetting } from './store'

/** Load `.env` from project cwd (dev) or app path. Idempotent. */
export function loadEnvFiles(): void {
  config({ path: resolve(process.cwd(), '.env') })
}

/**
 * Seed settings from environment when the store is empty.
 * Lets developers use `.env` without re-entering keys in Settings UI.
 */
export function bootstrapSettingsFromEnv(): void {
  const geminiKey = process.env.GEMINI_API_KEY?.trim()
  if (geminiKey && !(getSetting<string>('geminiApiKey') || '').trim()) {
    setSetting('geminiApiKey', geminiKey)
    console.info('[Specter] Loaded Gemini API key from GEMINI_API_KEY')
  }

  const openrouterKey = process.env.OPENROUTER_API_KEY?.trim()
  if (openrouterKey && !(getSetting<string>('openrouterApiKey') || '').trim()) {
    setSetting('openrouterApiKey', openrouterKey)
    console.info('[Specter] Loaded OpenRouter API key from OPENROUTER_API_KEY')
  }

  const geminiModel = process.env.GEMINI_MODEL?.trim()
  if (geminiModel) {
    setSetting('geminiModel', geminiModel)
    console.info(`[Specter] Using Gemini model from GEMINI_MODEL: ${geminiModel}`)
  }

  const aiProvider = process.env.AI_PROVIDER?.trim()
  if (aiProvider === 'gemini' || aiProvider === 'openrouter' || aiProvider === 'openai' || aiProvider === 'codex') {
    setSetting('aiProvider', aiProvider)
  } else if (geminiKey && !(getSetting<string>('aiProvider'))) {
    setSetting('aiProvider', 'gemini')
  }

  const assistantMode = process.env.ASSISTANT_MODE?.trim()
  if (assistantMode === 'general' || assistantMode === 'work' || assistantMode === 'game' || assistantMode === 'custom') {
    setSetting('assistantMode', assistantMode)
  }

  const perceptionMode = process.env.PERCEPTION_MODE?.trim()
  if (perceptionMode === 'auto' || perceptionMode === 'ocr' || perceptionMode === 'vision') {
    setSetting('perceptionMode', perceptionMode)
  }
}
