// IPC handlers — bridge between main and renderer processes
import { ipcMain, BrowserWindow, app, shell, screen } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc-channels'
import { getSetting, setSetting, getAllSettings, getConversations, saveConversation, deleteConversation, clearConversations, isValidSetting } from '../services/store'
import { streamCompletion, cancelStream, fetchAvailableModels, estimateCost, getCachedModels } from '../services/openrouter'
import { streamOpenAICompletion, cancelOpenAIStream } from '../services/openai-api'
import { streamGeminiCompletion, streamGeminiVisionCompletion, cancelGeminiStream, validateGeminiApiKey } from '../services/gemini-api'
import { buildVisionUserTask } from '../services/perception'
import { streamCodexCompletion, cancelCodexStream } from '../services/codex'
import { buildSystemPrompt, buildUserMessage, estimateTokens } from '../services/context-builder'
import { buildCoachSystemPrompt, resolveCoachRequest, buildActiveTabUserMessage } from '../services/coach-prompt'
import {
  appendWorkCoachContext,
  getWorkCoachThread,
  updateWorkCoachThread
} from '../services/work-coach-session'
import { buildPlaybookContext, filterPlaybooksForMode } from '../services/playbook-filter'
import { getRecentJournalContext, getJournalEntries, exportJournalMarkdown, clearJournal } from '../services/activity-journal'
import { syncActivityJournal, stopActivityJournal } from './activity-journal-loop'
import { syncHourlyReportLoop, stopHourlyReportLoop } from './hourly-report-loop'
import { syncGameCaptureLoop, stopGameCaptureLoop } from './game-capture-loop'
import { checkAiConfig } from '../services/ai-config'
import { captureScreenText, captureScreenOnly } from './screen-capture'
import { syncContinuousCoach, stopContinuousCoach, setOverlayCoachStreaming } from './continuous-coach-loop'
import { transcribeAudio, getTranscript, checkWhisperConfig } from './audio-capture'
import { createDashboardWindow } from './dashboard-window'
import { setOverlayOpacity, expandOverlayWindow, showOverlayPill } from './overlay-window'
import { reRegisterHotkeys } from './hotkey-manager'
import { APP_VERSION, DEFAULT_MODELS, DEFAULT_SETTINGS, GEMINI_MODELS } from '../shared/constants'
import type { AssistantMode, PerceptionMode, ScreenMetadata } from '../shared/types'
import type { Playbook, Conversation } from '../shared/types'

// --- Auto-capture timer ---
let autoCaptureTimer: ReturnType<typeof setInterval> | null = null
let lastAutoScreenText = ''
let autoCaptureOverlay: BrowserWindow | null = null

function stopAutoCapture(): void {
  if (autoCaptureTimer) {
    clearInterval(autoCaptureTimer)
    autoCaptureTimer = null
  }
  lastAutoScreenText = ''
}

function startAutoCapture(intervalSec: number): void {
  stopAutoCapture()

  // Clamp to reasonable range: 5-300 seconds
  const clampedInterval = Math.max(5, Math.min(300, intervalSec))

  autoCaptureTimer = setInterval(async () => {
    if (!autoCaptureOverlay || autoCaptureOverlay.isDestroyed()) {
      stopAutoCapture()
      return
    }
    try {
      const capture = await captureScreenText()
      // Only send if text changed meaningfully (avoid spamming identical context)
      if (capture.text && capture.text !== lastAutoScreenText) {
        lastAutoScreenText = capture.text
        if (!autoCaptureOverlay.isDestroyed()) {
          autoCaptureOverlay.webContents.send(IPC_CHANNELS.AUTO_CAPTURE_UPDATE, {
            text: capture.text,
            timestamp: Date.now()
          })
        }
      }
    } catch (err: unknown) {
      console.warn('[Specter] Auto-capture failed:', err)
    }
  }, clampedInterval * 1000)
}

function syncAutoCapture(): void {
  const enabled = getSetting<boolean>('autoCapture')
  const interval = getSetting<number>('autoCaptureInterval') || DEFAULT_SETTINGS.autoCaptureInterval
  if (enabled) {
    startAutoCapture(interval)
  } else {
    stopAutoCapture()
  }
}

// --- Rate limiter ---
// Simple sliding-window rate limiter to prevent IPC abuse

interface RateLimitEntry {
  timestamps: number[]
  maxCalls: number
  windowMs: number
}

const rateLimiters: Record<string, RateLimitEntry> = {
  [IPC_CHANNELS.AI_QUERY]: { timestamps: [], maxCalls: 2, windowMs: 2000 },        // max 2 per 2s
  [IPC_CHANNELS.AUDIO_TRANSCRIBE]: { timestamps: [], maxCalls: 1, windowMs: 3000 }  // max 1 per 3s
}

function checkRateLimit(channel: string): boolean {
  const limiter = rateLimiters[channel]
  if (!limiter) return true

  const now = Date.now()
  // Prune old entries
  limiter.timestamps = limiter.timestamps.filter(t => now - t < limiter.windowMs)

  if (limiter.timestamps.length >= limiter.maxCalls) {
    console.warn(`[Specter] Rate limit exceeded for ${channel}`)
    return false
  }

  limiter.timestamps.push(now)
  return true
}

// --- Input validation helpers ---

const CONVERSATION_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/

const OPENAI_MODEL_PRICING: Record<string, { prompt: string; completion: string }> = {
  'gpt-5.5': { prompt: '0.000005', completion: '0.00003' },
  'gpt-5.5-pro': { prompt: '0.00003', completion: '0.00018' },
  'gpt-5.4': { prompt: '0.0000025', completion: '0.000015' },
  'gpt-5.4-mini': { prompt: '0.00000075', completion: '0.0000045' },
  'gpt-5.4-nano': { prompt: '0.0000002', completion: '0.00000125' },
  'chat-latest': { prompt: '0.000005', completion: '0.00003' }
}

const GEMINI_MODEL_PRICING: Record<string, { prompt: string; completion: string }> = Object.fromEntries(
  GEMINI_MODELS.map((m) => [m.id, m.pricing])
)

function isValidQuery(query: unknown): query is string {
  return typeof query === 'string' && query.length > 0 && query.length <= 50000
}

function isValidConversationId(id: unknown): id is string {
  return typeof id === 'string' && CONVERSATION_ID_REGEX.test(id)
}

function isValidConversation(c: unknown): c is Conversation {
  if (typeof c !== 'object' || c === null) return false
  const conv = c as Record<string, unknown>
  return (
    typeof conv.id === 'string' && conv.id.length <= 128 &&
    typeof conv.title === 'string' && conv.title.length <= 500 &&
    Array.isArray(conv.messages) && conv.messages.length <= 1000 &&
    typeof conv.model === 'string' && conv.model.length <= 200 &&
    typeof conv.createdAt === 'number' &&
    typeof conv.updatedAt === 'number'
  )
}

function isValidMessageHistory(history: unknown): history is Array<{ role: string; content: string }> {
  if (!Array.isArray(history)) return false
  if (history.length > 50) return false // cap history length
  return history.every(
    (msg) =>
      typeof msg === 'object' && msg !== null &&
      typeof msg.role === 'string' && ['user', 'assistant', 'system'].includes(msg.role) &&
      typeof msg.content === 'string' && msg.content.length <= 50000
  )
}

function isValidSettingsKey(key: unknown): key is string {
  return typeof key === 'string' && key.length <= 100
}

export function registerIpcHandlers(overlayWindow: BrowserWindow): void {
  // Store overlay reference for auto-capture
  autoCaptureOverlay = overlayWindow
  // AI Query — streaming with cost tracking
  ipcMain.on(IPC_CHANNELS.AI_QUERY, async (event, args: {
    query: string
    includeScreen: boolean
    includeAudio: boolean
    messageHistory?: Array<{ role: string; content: string }>
    screenTextOverride?: string
    screenshotOverride?: string
    useVisionOverride?: boolean
    screenMetadata?: ScreenMetadata
    coachMode?: boolean
    activeTabMode?: boolean
  }) => {
    // Rate limit
    if (!checkRateLimit(IPC_CHANNELS.AI_QUERY)) {
      event.sender.send(IPC_CHANNELS.AI_STREAM_ERROR, 'Too many requests. Please wait a moment.')
      return
    }

    // Validate inputs
    if (!isValidQuery(args?.query)) {
      event.sender.send(IPC_CHANNELS.AI_STREAM_ERROR, 'Invalid query.')
      return
    }

    if (args.messageHistory && !isValidMessageHistory(args.messageHistory)) {
      event.sender.send(IPC_CHANNELS.AI_STREAM_ERROR, 'Invalid message history.')
      return
    }

    const aiConfig = checkAiConfig()
    if (!aiConfig.configured) {
      event.sender.send(IPC_CHANNELS.AI_STREAM_ERROR, aiConfig.error || 'AI is not configured. Open Settings to continue.')
      return
    }

    const aiProvider = aiConfig.provider
    const openrouterApiKey = getSetting<string>('openrouterApiKey')
    const openaiApiKey = getSetting<string>('openaiApiKey')
    const geminiApiKey = getSetting<string>('geminiApiKey')

    const model = aiProvider === 'codex'
      ? getSetting<string>('codexModel') || DEFAULT_SETTINGS.codexModel
      : aiProvider === 'openai'
        ? getSetting<string>('openaiModel') || DEFAULT_SETTINGS.openaiModel
        : aiProvider === 'gemini'
          ? getSetting<string>('geminiModel') || DEFAULT_SETTINGS.geminiModel
      : getSetting<string>('selectedModel') || DEFAULT_SETTINGS.selectedModel
    const systemPrompt = args.coachMode
      ? getSetting<string>('coachSystemPrompt')
      : getSetting<string>('systemPrompt')

    let screenText = ''
    let screenScreenshot: string | undefined
    let useVision = false
    let screenMetadata: ScreenMetadata = args.screenMetadata ?? {}
    let transcript = ''

    if (typeof args.screenTextOverride === 'string' && args.screenTextOverride.trim()) {
      screenText = args.screenTextOverride.trim()
      screenScreenshot = args.screenshotOverride
      useVision = args.useVisionOverride ?? false
    } else if (args.includeScreen) {
      try {
        const fullAuto = getSetting<boolean>('fullAutoMode')
        const smartCrop = getSetting<boolean>('smartCrop') || false
        const perceptionMode = fullAuto
          ? ('ocr' as PerceptionMode)
          : ((getSetting<string>('perceptionMode') || DEFAULT_SETTINGS.perceptionMode) as PerceptionMode)
        const capture = await captureScreenText(smartCrop, perceptionMode, { skipAccessibility: fullAuto })
        screenText = capture.text
        screenScreenshot = capture.screenshot
        useVision = capture.useVision ?? false
        screenMetadata = {
          appName: capture.appName,
          windowTitle: capture.windowTitle,
          textSource: capture.textSource,
          displayCount: capture.displayCount
        }
      } catch (err: unknown) {
        console.warn('[Specter] Screen capture failed:', err)
      }
    }

    // Get audio transcript if requested
    if (args.includeAudio) {
      transcript = getTranscript()
    }

    const assistantMode = (getSetting<string>('assistantMode') || DEFAULT_SETTINGS.assistantMode) as AssistantMode

    const playbooks = getSetting<Playbook[]>('playbooks') || []
    const activePlaybooks = filterPlaybooksForMode(playbooks, assistantMode)
    const playbookContext = buildPlaybookContext(activePlaybooks)

    let coachInstantReply: string | undefined
    let coachUserMessage = args.coachMode
      ? (() => {
          if (args.activeTabMode) {
            const coachReq = resolveCoachRequest(screenText, assistantMode, screenMetadata)
            coachInstantReply = coachReq.instantReply
            return coachInstantReply ?? buildActiveTabUserMessage(screenText, assistantMode, screenMetadata)
          }
          const coachReq = resolveCoachRequest(screenText, assistantMode, screenMetadata)
          coachInstantReply = coachReq.instantReply
          return coachReq.userMessage
        })()
      : buildUserMessage({
          screenText,
          transcript,
          userQuery: args.query
        })

    if (args.coachMode && assistantMode === 'work' && !coachInstantReply) {
      const thread = getWorkCoachThread(screenText, screenMetadata)
      coachUserMessage = appendWorkCoachContext(coachUserMessage, thread)
    }

    const userMessage = coachUserMessage

    const journalEnabled = getSetting<boolean>('activityJournal') || getSetting<boolean>('fullAutoMode')
    // Coach = screen-only; journal/playbooks caused HOI4/mod noise on unrelated tabs (e.g. YouTube)
    const journalContext =
      args.coachMode ? '' : journalEnabled ? getRecentJournalContext(30) : ''

    const contextParts = args.coachMode
      ? [userMessage]
      : [playbookContext, journalContext, userMessage].filter(Boolean)
    const fullUserMessage = contextParts.join('\n\n')

    // Build messages array: system prompt + conversation history + new user message
    const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
      {
        role: 'system',
        content: args.coachMode
          ? buildCoachSystemPrompt(systemPrompt, assistantMode)
          : buildSystemPrompt(systemPrompt)
      }
    ]

    // Add conversation history (last 10 messages max to stay within context limits)
    if (args.messageHistory && args.messageHistory.length > 0) {
      const recentHistory = args.messageHistory.slice(-10)
      for (const msg of recentHistory) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content })
        }
      }
    }

    // Add the new user message with full context
    const finalUserContent = useVision && !coachInstantReply
      ? buildVisionUserTask(fullUserMessage)
      : fullUserMessage
    messages.push({ role: 'user', content: finalUserContent })

    // Estimate prompt tokens for cost tracking
    const promptTokens = estimateTokens(messages.map(m => m.content).join(' '))
    let completionContent = ''

    const streamCallbacks = {
      onChunk: (content: string) => {
        completionContent += content
        if (!event.sender.isDestroyed()) {
          event.sender.send(IPC_CHANNELS.AI_STREAM_CHUNK, content)
        }
      },
      onDone: () => {
        if (args.coachMode && assistantMode === 'work' && completionContent.trim()) {
          updateWorkCoachThread(screenText, screenMetadata, completionContent)
        }
        if (!event.sender.isDestroyed()) {
          const completionTokens = estimateTokens(completionContent)
          const totalTokens = promptTokens + completionTokens
          const modelLabel = aiProvider === 'codex'
            ? `codex/${model}`
            : aiProvider === 'openai'
              ? `openai/${model}`
              : aiProvider === 'gemini'
                ? `gemini/${model}`
                : model
          const modelInfo = aiProvider === 'openrouter'
            ? DEFAULT_MODELS.find(m => m.id === model) || getCachedModels().find(m => m.id === model)
            : aiProvider === 'openai'
              ? { pricing: OPENAI_MODEL_PRICING[model] }
              : aiProvider === 'gemini'
                ? { pricing: GEMINI_MODEL_PRICING[model] }
              : undefined
          const promptPrice = modelInfo?.pricing?.prompt || '0'
          const completionPrice = modelInfo?.pricing?.completion || '0'
          const totalCost = aiProvider === 'codex'
            ? 0
            : estimateCost(promptTokens, completionTokens, promptPrice, completionPrice)
          event.sender.send(IPC_CHANNELS.AI_STREAM_DONE, {
            promptTokens,
            completionTokens,
            totalTokens,
            totalCost,
            model: modelLabel
          })
        }
      },
      onError: (error: string) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send(IPC_CHANNELS.AI_STREAM_ERROR, error)
        }
      }
    }

    if (args.coachMode && coachInstantReply) {
      streamCallbacks.onChunk(coachInstantReply)
      streamCallbacks.onDone()
      return
    }

    if (aiProvider === 'codex') {
      await streamCodexCompletion(messages, model, streamCallbacks)
    } else if (aiProvider === 'openai') {
      await streamOpenAICompletion(messages, model, openaiApiKey, streamCallbacks)
    } else if (aiProvider === 'gemini') {
      if (useVision && screenScreenshot && !coachInstantReply) {
        await streamGeminiVisionCompletion(messages, model, geminiApiKey, screenScreenshot, streamCallbacks)
      } else {
        await streamGeminiCompletion(messages, model, geminiApiKey, streamCallbacks)
      }
    } else {
      await streamCompletion(messages, model, openrouterApiKey, streamCallbacks)
    }
  })

  // Cancel AI stream
  ipcMain.on(IPC_CHANNELS.AI_CANCEL, () => {
    cancelStream()
    cancelOpenAIStream()
    cancelGeminiStream()
    cancelCodexStream()
  })

  // Screen capture (with OCR)
  ipcMain.handle(IPC_CHANNELS.SCREEN_CAPTURE, async () => {
    try {
      return await captureScreenText()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Screen capture failed'
      throw new Error(message)
    }
  })

  // Screen capture preview (no OCR, just screenshot)
  ipcMain.handle(IPC_CHANNELS.SCREEN_CAPTURE_PREVIEW, async () => {
    try {
      return await captureScreenOnly()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Screen capture failed'
      throw new Error(message)
    }
  })

  // AI config check — called on overlay load and before AI actions
  ipcMain.handle(IPC_CHANNELS.AI_CHECK_CONFIG, () => {
    return checkAiConfig()
  })

  ipcMain.handle(IPC_CHANNELS.GEMINI_VALIDATE_KEY, async (_event, apiKey: unknown) => {
    if (typeof apiKey !== 'string' || !apiKey.trim()) {
      return { valid: false, error: 'API key is empty.' }
    }
    return validateGeminiApiKey(apiKey.trim())
  })

  // Audio config check — called before starting recording to give immediate feedback
  ipcMain.handle(IPC_CHANNELS.AUDIO_CHECK_CONFIG, () => {
    return checkWhisperConfig()
  })

  // Audio transcription — receives audio buffer from renderer's MediaRecorder
  // Electron IPC can deliver ArrayBuffer as Buffer, Uint8Array, or ArrayBuffer depending on version
  ipcMain.handle(IPC_CHANNELS.AUDIO_TRANSCRIBE, async (_event, audioData: unknown, mimeType: string) => {
    // Rate limit
    if (!checkRateLimit(IPC_CHANNELS.AUDIO_TRANSCRIBE)) {
      throw new Error('Transcription rate limit exceeded. Please wait.')
    }

    // Validate mimeType is a string
    if (typeof mimeType !== 'string' || mimeType.length > 100) {
      throw new Error('Invalid MIME type')
    }

    try {
      let buffer: Buffer
      if (Buffer.isBuffer(audioData)) {
        buffer = audioData
      } else if (audioData instanceof ArrayBuffer) {
        buffer = Buffer.from(audioData)
      } else if (ArrayBuffer.isView(audioData)) {
        buffer = Buffer.from(audioData.buffer, audioData.byteOffset, audioData.byteLength)
      } else {
        buffer = Buffer.from(audioData as ArrayBuffer)
      }
      const text = await transcribeAudio(buffer, mimeType || 'audio/webm;codecs=opus')
      return text
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Transcription failed'
      throw new Error(message)
    }
  })

  // Settings — with allowlist validation
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, (_event, key: string) => {
    if (!isValidSettingsKey(key)) {
      throw new Error('Invalid settings key')
    }
    return getSetting(key)
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, (_event, key: string, value: unknown) => {
    if (!isValidSettingsKey(key)) {
      throw new Error('Invalid settings key')
    }
    if (!isValidSetting(key, value)) {
      throw new Error(`Invalid value for setting: ${key}`)
    }
    setSetting(key, value)
    // Live-update overlay opacity when changed
    if (key === 'overlayOpacity' && typeof value === 'number') {
      setOverlayOpacity(value)
    }
    // Re-sync auto-capture when its settings change
    if (key === 'autoCapture' || key === 'autoCaptureInterval') {
      syncAutoCapture()
    }
    if (
      key === 'continuousCoach' ||
      key === 'fullAutoMode' ||
      key === 'assistantMode' ||
      key === 'perceptionMode' ||
      key === 'detectIntervalSec' ||
      key === 'coachCooldownSec'
    ) {
      if (key === 'fullAutoMode' && value === true) {
        setSetting('continuousCoach', true)
        setSetting('activityJournal', true)
        setSetting('smartCrop', true)
        setSetting('journalSmartCrop', true)
      }
      syncContinuousCoach(overlayWindow)
    }
    if (key === 'activityJournal' || key === 'journalIntervalSec' || key === 'journalSmartCrop' || key === 'fullAutoMode') {
      syncActivityJournal()
      syncHourlyReportLoop()
    }
    if (key === 'hourlyReportEnabled' || key === 'hourlyReportIntervalSec') {
      syncHourlyReportLoop()
    }
    if (
      key === 'gameModeEnabled' ||
      key === 'gameCaptureIntervalSec' ||
      key === 'gameBlockSec' ||
      key === 'gameHourlyAiSec'
    ) {
      syncGameCaptureLoop()
    }
    // Re-register hotkeys when hotkey settings change
    if (key === 'hotkeys') {
      reRegisterHotkeys()
    }
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_ALL, () => {
    return getAllSettings()
  })

  ipcMain.handle(IPC_CHANNELS.DISPLAYS_LIST, () => {
    const primaryId = screen.getPrimaryDisplay().id
    return screen.getAllDisplays().map((d) => ({
      id: d.id,
      label: d.label || `Display ${d.id}`,
      bounds: d.bounds,
      isPrimary: d.id === primaryId
    }))
  })

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

  // App
  ipcMain.handle(IPC_CHANNELS.APP_VERSION, () => {
    return APP_VERSION
  })

  ipcMain.on(IPC_CHANNELS.COACH_STREAMING, (_event, args: { streaming?: boolean }) => {
    setOverlayCoachStreaming(!!args?.streaming)
  })

  ipcMain.on(IPC_CHANNELS.APP_QUIT, () => {
    stopAutoCapture()
    stopContinuousCoach()
    stopActivityJournal()
    app.quit()
  })

  ipcMain.handle(IPC_CHANNELS.ACTIVITY_JOURNAL_LIST, () => {
    return getJournalEntries()
  })

  ipcMain.handle(IPC_CHANNELS.ACTIVITY_JOURNAL_EXPORT, () => {
    return exportJournalMarkdown()
  })

  ipcMain.on(IPC_CHANNELS.ACTIVITY_JOURNAL_CLEAR, () => {
    clearJournal()
  })

  ipcMain.on(IPC_CHANNELS.OVERLAY_EXPAND, () => {
    expandOverlayWindow(true)
  })

  ipcMain.on(IPC_CHANNELS.OVERLAY_COLLAPSE, () => {
    showOverlayPill()
  })

  // Shell — open URLs in external browser (validated in preload)
  ipcMain.on('shell:open-external', (_event, url: unknown) => {
    if (typeof url !== 'string') return
    try {
      const parsed = new URL(url)
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        shell.openExternal(url)
      }
    } catch {
      // Invalid URL — ignore
    }
  })

  // Initialize auto-capture if enabled
  syncAutoCapture()
  syncContinuousCoach(overlayWindow)
  syncActivityJournal()
  syncHourlyReportLoop()
  syncGameCaptureLoop()
}
