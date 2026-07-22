// App-wide constants for Specter AI

export const APP_NAME = 'Specter AI'
export const APP_ID = 'com.specter.ai'
export const APP_VERSION = '1.2.1'

export const ACCENT_COLOR = '#7C3AED' // violet
export const ACCENT_COLOR_RGB = '124, 58, 237'

export const OVERLAY_DEFAULTS = {
  width: 420,
  height: 600,
  opacity: 0.85,
  margin: 20
}

export const DEFAULT_SYSTEM_PROMPT = `You are a real-time AI copilot for meetings, interviews, and work sessions.
You can use the user's screen content, transcript, and question as context.

Core rules:
- Answer only the latest user request. Be direct, useful, and concise.
- Do not restate the question unless it is needed for clarity.
- Do not add filler, disclaimers, meta-commentary, or unnecessary explanation.
- If the answer cannot be determined from the available context, say what is missing in one short sentence.
- Never reveal you are an AI assistant unless directly asked.

Answer formats:
- Multiple-choice questions: return only the correct letter/option. No explanation.
- "Code only" requests: return only code. No prose, markdown, or explanation.
- Coding questions: provide the complete solution code first, then exactly 2 lines explaining the code.
- Technical questions: answer clearly in 2-4 concise sentences.
- Behavioral or situational questions: give a polished 2-3 sentence response.
- Open-ended work questions: use short paragraphs or bullets for quick reading.

Priority:
- Follow explicit user formatting instructions over the defaults above.
- Prefer the most recent visible question or spoken request when context contains multiple topics.`

export const DEFAULT_COACH_SYSTEM_PROMPT = `You are a virtual screen assistant. The user performs every click and keystroke — you recommend only.

Rules:
- Read the screen context provided. Be direct and useful.
- Reply with 1-3 short bullets: situation → suggested next step → optional watch-out.
- Quote specific text, numbers, or errors from the screen when visible.
- Never claim you clicked, typed, or completed anything.
- Never mention API keys, Specter settings, or developer setup unless the user is clearly configuring those.
- If context is insufficient, say what is missing in one sentence.
- Be concise. No filler or meta-commentary.
- Never reveal you are an AI assistant unless directly asked.`

export const ASSISTANT_MODES = ['general', 'work', 'game', 'custom'] as const
export type AssistantMode = (typeof ASSISTANT_MODES)[number]

export const ASSISTANT_MODE_LABELS: Record<AssistantMode, string> = {
  general: 'General — help with whatever is on screen',
  work: 'Work — prioritize coding and debugging',
  game: 'Game — prioritize gameplay; skip IDE-only screens when watching',
  custom: 'Custom — use your coach system prompt as-is'
}

export const PERCEPTION_MODES = ['auto', 'ocr', 'vision'] as const
export type PerceptionMode = (typeof PERCEPTION_MODES)[number]

export const PERCEPTION_MODE_LABELS: Record<PerceptionMode, string> = {
  auto: 'Auto — OCR + Accessibility, vision when text is thin',
  ocr: 'OCR only — text extraction, no image to model',
  vision: 'Vision — always send screenshot to Gemini multimodal'
}

export const DEFAULT_HOTKEYS = {
  askAI: 'CommandOrControl+Return',
  toggleOverlay: 'CommandOrControl+\\',
  toggleAudio: 'CommandOrControl+Shift+Space',
  screenshotAsk: 'CommandOrControl+Shift+Return',
  /** Double-tap ⌘/ within ~450ms (like typing //) → ask about active tab */
  activeTabAsk: 'Command+/'
}

export const DEFAULT_ACTIVE_TAB_PROMPT =
  'What am I doing in the active tab/window right now? Recommend the single best next step.'

export const DEFAULT_MODELS = [
  {
    id: 'google/gemini-3-flash-preview',
    name: 'Gemini 3 Flash (Recommended - Fast)',
    pricing: { prompt: '0.0000005', completion: '0.000003' },
    context_length: 1048576,
    description: 'Ultra-fast responses, great for real-time use'
  },
  {
    id: 'anthropic/claude-sonnet-4',
    name: 'Claude Sonnet 4 (High Quality)',
    pricing: { prompt: '0.003', completion: '0.015' },
    context_length: 200000,
    description: 'Top-tier quality and reasoning'
  },
  {
    id: 'deepseek/deepseek-chat',
    name: 'DeepSeek V3 (Cost-Effective)',
    pricing: { prompt: '0.00032', completion: '0.00089' },
    context_length: 163840,
    description: 'Great quality at low cost'
  },
  {
    id: 'meta-llama/llama-4-maverick',
    name: 'Llama 4 Maverick (1M Context)',
    pricing: { prompt: '0.00015', completion: '0.0006' },
    context_length: 1048576,
    description: 'Latest Llama model with massive context'
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B Instruct',
    pricing: { prompt: '0.0001', completion: '0.00032' },
    context_length: 131072,
    description: 'Strong open-source model'
  },
  {
    id: 'meta-llama/llama-3.1-8b-instruct',
    name: 'Llama 3.1 8B Instruct (Budget)',
    pricing: { prompt: '0.00002', completion: '0.00005' },
    context_length: 16384,
    description: 'Fast and extremely cheap'
  },
  {
    id: 'upstage/solar-pro-3:free',
    name: 'Solar Pro 3 (Free)',
    pricing: { prompt: '0', completion: '0' },
    context_length: 128000,
    description: 'Free tier for testing'
  }
]

export const GEMINI_MODELS = [
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite (Recommended)',
    pricing: { prompt: '0.00000025', completion: '0.0000015' },
    context_length: 1048576,
    description: 'Fastest/cheapest Gemini 3 — best for continuous screen coach'
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    pricing: { prompt: '0.0000003', completion: '0.0000025' },
    context_length: 1048576,
    description: 'Previous-gen fast model'
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    pricing: { prompt: '0.0000001', completion: '0.0000004' },
    context_length: 1048576,
    description: 'Cheapest high-volume classification and extraction'
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    pricing: { prompt: '0.00000125', completion: '0.00001' },
    context_length: 1048576,
    description: 'Stronger reasoning for complex screen context'
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    pricing: { prompt: '0.0000001', completion: '0.0000004' },
    context_length: 1048576,
    description: 'Previous-gen cost leader'
  }
] as const

export const DEFAULT_SETTINGS = {
  aiProvider: 'gemini' as 'openrouter' | 'openai' | 'gemini' | 'codex',
  openrouterApiKey: '',
  selectedModel: 'google/gemini-3-flash-preview',
  openaiApiKey: '',
  openaiModel: 'gpt-5.5',
  geminiApiKey: '',
  geminiModel: 'gemini-3.1-flash-lite',
  codexModel: 'gpt-5.4',
  overlayOpacity: 0.85,
  overlayPosition: { x: -1, y: -1 }, // -1 means auto-position
  overlaySize: { width: 420, height: 600 },
  hotkeys: DEFAULT_HOTKEYS,
  autoCapture: false,
  autoCaptureInterval: 30,
  continuousCoach: false,
  detectIntervalSec: 3,
  coachCooldownSec: 10,
  assistantMode: 'general' as AssistantMode,
  perceptionMode: 'auto' as PerceptionMode,
  coachSystemPrompt: DEFAULT_COACH_SYSTEM_PROMPT,
  maxTranscriptLength: 5000,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  language: 'en',
  theme: 'dark' as const,
  // Whisper / audio transcription settings
  whisperProvider: 'groq' as 'groq' | 'openai' | 'custom',
  whisperApiKey: '',        // separate key for Whisper (Groq key or OpenAI key)
  whisperApiUrl: '',        // only used when provider is 'custom'
  whisperModel: '',         // only used when provider is 'custom'
  autoHideDelay: 0,          // seconds, 0 = disabled
  smartCrop: true,            // auto-detect single/dual monitor smart crop
  fullAutoMode: false,        // watch + journal, no hotkey needed
  activityJournal: false,     // log focus every minute for performance review
  journalIntervalSec: 60
}

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
export const OPENROUTER_KEYS_URL = 'https://openrouter.ai/keys'
export const OPENROUTER_REFERER = 'https://github.com/umairinayat/Specter-AI'
export const OPENROUTER_TITLE = 'Specter AI'

export const OPENAI_API_BASE_URL = 'https://api.openai.com/v1'
export const OPENAI_API_KEYS_URL = 'https://platform.openai.com/api-keys'
export const OPENAI_API_PRICING_URL = 'https://developers.openai.com/api/docs/pricing'

export const CHATGPT_CODEX_URL = 'https://chatgpt.com/codex'
export const CHATGPT_PRICING_URL = 'https://chatgpt.com/pricing'

export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai'
export const GEMINI_API_KEYS_URL = 'https://aistudio.google.com/apikey'
export const GEMINI_PRICING_URL = 'https://ai.google.dev/gemini-api/docs/pricing'
