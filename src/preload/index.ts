import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc-channels'

export interface StreamDoneData {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  totalCost: number
  model: string
}

export interface QueryAIOptions {
  screenTextOverride?: string
  screenshotOverride?: string
  useVisionOverride?: boolean
  screenMetadata?: { appName?: string; windowTitle?: string; textSource?: string }
  coachMode?: boolean
  activeTabMode?: boolean
}

export interface SpecterAPI {
  // AI
  checkAiConfig: () => Promise<{ configured: boolean; provider: string; error?: string }>
  validateGeminiKey: (apiKey: string) => Promise<{ valid: boolean; error?: string }>
  queryAI: (
    query: string,
    includeScreen: boolean,
    includeAudio: boolean,
    messageHistory?: Array<{ role: string; content: string }>,
    options?: QueryAIOptions
  ) => void
  cancelAI: () => void
  onStreamChunk: (callback: (chunk: string) => void) => () => void
  onStreamDone: (callback: (data: StreamDoneData) => void) => () => void
  onStreamError: (callback: (error: string) => void) => () => void
  onCoachTripleStart: (callback: (data: { labels: string[] }) => void) => () => void
  onCoachTriplePanel: (
    callback: (data: { index: number; content: string; done: boolean }) => void
  ) => () => void
  onCoachTripleDone: (callback: () => void) => () => void

  // Screen
  captureScreen: () => Promise<{ text: string; screenshot?: string; timestamp: number }>
  captureScreenPreview: () => Promise<{ screenshot: string; timestamp: number }>

  // Audio — recording is handled in renderer via MediaRecorder
  checkAudioConfig: () => Promise<{ configured: boolean; provider: string; error?: string }>
  sendAudioForTranscription: (audioData: ArrayBuffer, mimeType: string) => Promise<string>
  onTranscript: (callback: (text: string) => void) => () => void
  onAudioStatus: (callback: (status: { isRecording: boolean; duration: number; error?: string }) => void) => () => void

  // Settings
  getSetting: <T>(key: string) => Promise<T>
  setSetting: (key: string, value: unknown) => Promise<void>
  getAllSettings: () => Promise<Record<string, unknown>>
  listDisplays: () => Promise<Array<{ id: number; label: string; bounds: { x: number; y: number; width: number; height: number }; isPrimary: boolean }>>

  // Models
  fetchModels: () => Promise<Array<{ id: string; name: string; pricing: { prompt: string; completion: string }; context_length: number }>>

  // Hotkeys
  onHotkeyAskAI: (callback: () => void) => () => void
  onHotkeyScreenshot: (callback: () => void) => () => void
  onHotkeyToggleAudio: (callback: () => void) => () => void
  onHotkeyToggleOverlay: (callback: () => void) => () => void
  onWorkAutoToggled: (callback: (data: { enabled: boolean }) => void) => () => void
  getWorkAutoStatus: () => Promise<{ enabled: boolean }>
  toggleWorkAuto: () => Promise<{ enabled: boolean }>

  // Activity journal
  listActivityJournal: () => Promise<Array<{ id: string; minuteKey: string; timestamp: number; appName: string; windowTitle: string; screenKind: string; snippet: string; fingerprint: string; durationSec: number }>>
  exportActivityJournal: () => Promise<string>
  clearActivityJournal: () => void

  // Auto-capture
  onAutoCaptureUpdate: (callback: (data: { text: string; timestamp: number }) => void) => () => void

  // Continuous coach
  onCoachTrigger: (callback: (data: {
    screenText: string
    timestamp: number
    appName?: string
    windowTitle?: string
    useVision?: boolean
    screenshot?: string
    screenChanged?: boolean
  }) => void) => () => void
  setCoachStreaming: (streaming: boolean) => void

  // Dashboard
  openDashboard: () => void

  // Conversations
  listConversations: () => Promise<Array<{ id: string; title: string; messages: Array<{ id: string; role: string; content: string; timestamp: number; tokenCount?: number; cost?: number }>; model: string; createdAt: number; updatedAt: number }>>
  saveConversation: (conversation: { id: string; title: string; messages: Array<{ id: string; role: string; content: string; timestamp: number; tokenCount?: number; cost?: number }>; model: string; createdAt: number; updatedAt: number }) => Promise<void>
  deleteConversation: (id: string) => void
  clearConversations: () => void

  // App
  getVersion: () => Promise<string>
  quit: () => void

  // Shell
  openExternal: (url: string) => void

  // Overlay opacity — applied via CSS (not native) to avoid WS_EX_LAYERED breaking WDA_EXCLUDEFROMCAPTURE
  onOpacityChange: (callback: (opacity: number) => void) => () => void
  onGlassModeChange: (callback: (data: { native: boolean }) => void) => () => void
  onOverlayPillMode: (callback: (data: { minimized: boolean }) => void) => () => void
  expandOverlay: () => void
  collapseOverlay: () => void
  fitOverlayContent: (payload: { mode: 'pill' | 'panel' | 'work-triple'; width: number; height: number }) => void
}

// --- Type guard helpers for IPC callback data ---
// These ensure the renderer never receives unexpected types from main process

function isString(v: unknown): v is string {
  return typeof v === 'string'
}

function isStreamDoneData(v: unknown): v is StreamDoneData {
  if (typeof v !== 'object' || v === null) return false
  const d = v as Record<string, unknown>
  return (
    typeof d.promptTokens === 'number' &&
    typeof d.completionTokens === 'number' &&
    typeof d.totalTokens === 'number' &&
    typeof d.totalCost === 'number' &&
    typeof d.model === 'string'
  )
}

function isCoachTripleStart(v: unknown): v is { labels: string[] } {
  if (typeof v !== 'object' || v === null) return false
  const d = v as Record<string, unknown>
  return Array.isArray(d.labels) && d.labels.every((l) => typeof l === 'string')
}

function isCoachTriplePanel(v: unknown): v is { index: number; content: string; done: boolean } {
  if (typeof v !== 'object' || v === null) return false
  const d = v as Record<string, unknown>
  return typeof d.index === 'number' && typeof d.content === 'string' && typeof d.done === 'boolean'
}

function isAudioStatus(v: unknown): v is { isRecording: boolean; duration: number; error?: string } {
  if (typeof v !== 'object' || v === null) return false
  const s = v as Record<string, unknown>
  return typeof s.isRecording === 'boolean' && typeof s.duration === 'number'
}

const api: SpecterAPI = {
  // AI
  checkAiConfig: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.AI_CHECK_CONFIG) as Promise<{ configured: boolean; provider: string; error?: string }>
  },
  validateGeminiKey: (apiKey: string) => {
    return ipcRenderer.invoke(IPC_CHANNELS.GEMINI_VALIDATE_KEY, apiKey) as Promise<{ valid: boolean; error?: string }>
  },
  queryAI: (query, includeScreen, includeAudio, messageHistory, options) => {
    if (typeof query !== 'string') return
    ipcRenderer.send(IPC_CHANNELS.AI_QUERY, {
      query,
      includeScreen: !!includeScreen,
      includeAudio: !!includeAudio,
      messageHistory: messageHistory || [],
      screenTextOverride: options?.screenTextOverride,
      screenshotOverride: options?.screenshotOverride,
      useVisionOverride: options?.useVisionOverride,
      screenMetadata: options?.screenMetadata,
      coachMode: !!options?.coachMode,
      activeTabMode: !!options?.activeTabMode
    })
  },
  cancelAI: () => {
    ipcRenderer.send(IPC_CHANNELS.AI_CANCEL)
  },
  onStreamChunk: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, chunk: unknown) => {
      if (isString(chunk)) callback(chunk)
    }
    ipcRenderer.on(IPC_CHANNELS.AI_STREAM_CHUNK, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AI_STREAM_CHUNK, handler)
  },
  onStreamDone: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, data: unknown) => {
      if (isStreamDoneData(data)) callback(data)
    }
    ipcRenderer.on(IPC_CHANNELS.AI_STREAM_DONE, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AI_STREAM_DONE, handler)
  },
  onStreamError: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, error: unknown) => {
      callback(isString(error) ? error : 'An unknown error occurred')
    }
    ipcRenderer.on(IPC_CHANNELS.AI_STREAM_ERROR, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AI_STREAM_ERROR, handler)
  },
  onCoachTripleStart: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, data: unknown) => {
      if (isCoachTripleStart(data)) callback(data)
    }
    ipcRenderer.on(IPC_CHANNELS.AI_COACH_TRIPLE_START, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AI_COACH_TRIPLE_START, handler)
  },
  onCoachTriplePanel: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, data: unknown) => {
      if (isCoachTriplePanel(data)) callback(data)
    }
    ipcRenderer.on(IPC_CHANNELS.AI_COACH_TRIPLE_PANEL, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AI_COACH_TRIPLE_PANEL, handler)
  },
  onCoachTripleDone: (callback) => {
    const handler = () => callback()
    ipcRenderer.on(IPC_CHANNELS.AI_COACH_TRIPLE_DONE, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AI_COACH_TRIPLE_DONE, handler)
  },

  // Screen
  captureScreen: () => ipcRenderer.invoke(IPC_CHANNELS.SCREEN_CAPTURE),
  captureScreenPreview: () => ipcRenderer.invoke(IPC_CHANNELS.SCREEN_CAPTURE_PREVIEW),

  // Audio — recording happens in renderer, transcription in main
  checkAudioConfig: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.AUDIO_CHECK_CONFIG) as Promise<{ configured: boolean; provider: string; error?: string }>
  },
  sendAudioForTranscription: (audioData: ArrayBuffer, mimeType: string) => {
    if (typeof mimeType !== 'string') mimeType = 'audio/webm;codecs=opus'
    return ipcRenderer.invoke(IPC_CHANNELS.AUDIO_TRANSCRIBE, audioData, mimeType) as Promise<string>
  },
  onTranscript: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, text: unknown) => {
      if (isString(text)) callback(text)
    }
    ipcRenderer.on(IPC_CHANNELS.AUDIO_TRANSCRIPT, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AUDIO_TRANSCRIPT, handler)
  },
  onAudioStatus: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, status: unknown) => {
      if (isAudioStatus(status)) callback(status)
    }
    ipcRenderer.on(IPC_CHANNELS.AUDIO_STATUS, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AUDIO_STATUS, handler)
  },

  // Settings
  getSetting: <T>(key: string) => {
    if (typeof key !== 'string') return Promise.reject(new Error('Invalid key'))
    return ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET, key) as Promise<T>
  },
  setSetting: (key, value) => {
    if (typeof key !== 'string') return Promise.reject(new Error('Invalid key'))
    return ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, key, value)
  },
  getAllSettings: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET_ALL),
  listDisplays: () => ipcRenderer.invoke(IPC_CHANNELS.DISPLAYS_LIST),

  // Models
  fetchModels: () => ipcRenderer.invoke(IPC_CHANNELS.MODELS_FETCH),

  // Hotkeys
  onHotkeyAskAI: (callback) => {
    const handler = () => callback()
    ipcRenderer.on(IPC_CHANNELS.HOTKEY_ASK_AI, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.HOTKEY_ASK_AI, handler)
  },
  onHotkeyScreenshot: (callback) => {
    const handler = () => callback()
    ipcRenderer.on(IPC_CHANNELS.HOTKEY_ASK_WITH_SCREENSHOT, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.HOTKEY_ASK_WITH_SCREENSHOT, handler)
  },
  onHotkeyToggleAudio: (callback) => {
    const handler = () => callback()
    ipcRenderer.on(IPC_CHANNELS.HOTKEY_TOGGLE_AUDIO, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.HOTKEY_TOGGLE_AUDIO, handler)
  },
  onHotkeyToggleOverlay: (callback) => {
    const handler = () => callback()
    ipcRenderer.on(IPC_CHANNELS.HOTKEY_TOGGLE_OVERLAY, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.HOTKEY_TOGGLE_OVERLAY, handler)
  },
  onWorkAutoToggled: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, data: unknown) => {
      if (typeof data === 'object' && data !== null && typeof (data as { enabled?: unknown }).enabled === 'boolean') {
        callback({ enabled: (data as { enabled: boolean }).enabled })
      }
    }
    ipcRenderer.on(IPC_CHANNELS.WORK_AUTO_TOGGLED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.WORK_AUTO_TOGGLED, handler)
  },

  getWorkAutoStatus: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.WORK_AUTO_GET_STATUS) as Promise<{ enabled: boolean }>
  },

  toggleWorkAuto: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.WORK_AUTO_TOGGLE) as Promise<{ enabled: boolean }>
  },

  listActivityJournal: () => ipcRenderer.invoke(IPC_CHANNELS.ACTIVITY_JOURNAL_LIST),
  exportActivityJournal: () => ipcRenderer.invoke(IPC_CHANNELS.ACTIVITY_JOURNAL_EXPORT),
  clearActivityJournal: () => ipcRenderer.send(IPC_CHANNELS.ACTIVITY_JOURNAL_CLEAR),

  // Dashboard
  openDashboard: () => ipcRenderer.send(IPC_CHANNELS.OPEN_DASHBOARD),

  // Auto-capture
  onAutoCaptureUpdate: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, data: unknown) => {
      if (typeof data === 'object' && data !== null) {
        const d = data as Record<string, unknown>
        if (typeof d.text === 'string' && typeof d.timestamp === 'number') {
          callback({ text: d.text, timestamp: d.timestamp })
        }
      }
    }
    ipcRenderer.on(IPC_CHANNELS.AUTO_CAPTURE_UPDATE, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AUTO_CAPTURE_UPDATE, handler)
  },

  onCoachTrigger: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, data: unknown) => {
      if (typeof data === 'object' && data !== null) {
        const d = data as Record<string, unknown>
        if (typeof d.screenText === 'string' && typeof d.timestamp === 'number') {
          callback({
            screenText: d.screenText,
            timestamp: d.timestamp,
            appName: typeof d.appName === 'string' ? d.appName : undefined,
            windowTitle: typeof d.windowTitle === 'string' ? d.windowTitle : undefined,
            useVision: typeof d.useVision === 'boolean' ? d.useVision : undefined,
            screenshot: typeof d.screenshot === 'string' ? d.screenshot : undefined,
            screenChanged: typeof d.screenChanged === 'boolean' ? d.screenChanged : undefined
          })
        }
      }
    }
    ipcRenderer.on(IPC_CHANNELS.COACH_TRIGGER, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.COACH_TRIGGER, handler)
  },

  setCoachStreaming: (streaming) => {
    ipcRenderer.send(IPC_CHANNELS.COACH_STREAMING, { streaming: !!streaming })
  },

  // Conversations
  listConversations: () => ipcRenderer.invoke(IPC_CHANNELS.CONVERSATIONS_LIST),
  saveConversation: (conversation) => ipcRenderer.invoke(IPC_CHANNELS.CONVERSATIONS_SAVE, conversation),
  deleteConversation: (id) => {
    if (typeof id !== 'string') return
    ipcRenderer.send(IPC_CHANNELS.CONVERSATIONS_DELETE, id)
  },
  clearConversations: () => ipcRenderer.send(IPC_CHANNELS.CONVERSATIONS_CLEAR),

  // App
  getVersion: () => ipcRenderer.invoke(IPC_CHANNELS.APP_VERSION),
  quit: () => ipcRenderer.send(IPC_CHANNELS.APP_QUIT),

  // Shell — open URLs in external browser
  openExternal: (url: string) => {
    if (typeof url !== 'string') return
    // Only allow http(s) URLs to prevent shell injection
    try {
      const parsed = new URL(url)
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        ipcRenderer.send('shell:open-external', url)
      }
    } catch {
      // Invalid URL — ignore
    }
  },

  // Overlay opacity — received from main process, applied via CSS in renderer
  // This avoids using native win.setOpacity() which adds WS_EX_LAYERED and breaks
  // SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE) on Windows
  onOpacityChange: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, opacity: unknown) => {
      if (typeof opacity === 'number' && opacity >= 0 && opacity <= 1) {
        callback(opacity)
      }
    }
    ipcRenderer.on(IPC_CHANNELS.OVERLAY_SET_OPACITY, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.OVERLAY_SET_OPACITY, handler)
  },

  onGlassModeChange: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, data: unknown) => {
      if (typeof data === 'object' && data !== null && typeof (data as { native?: unknown }).native === 'boolean') {
        callback({ native: (data as { native: boolean }).native })
      }
    }
    ipcRenderer.on(IPC_CHANNELS.OVERLAY_SET_GLASS_MODE, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.OVERLAY_SET_GLASS_MODE, handler)
  },

  onOverlayPillMode: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, data: unknown) => {
      if (typeof data === 'object' && data !== null && typeof (data as { minimized?: unknown }).minimized === 'boolean') {
        callback({ minimized: (data as { minimized: boolean }).minimized })
      }
    }
    ipcRenderer.on(IPC_CHANNELS.OVERLAY_SET_PILL_MODE, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.OVERLAY_SET_PILL_MODE, handler)
  },

  expandOverlay: () => ipcRenderer.send(IPC_CHANNELS.OVERLAY_EXPAND),
  collapseOverlay: () => ipcRenderer.send(IPC_CHANNELS.OVERLAY_COLLAPSE),
  fitOverlayContent: (payload) => ipcRenderer.send(IPC_CHANNELS.OVERLAY_FIT_CONTENT, payload)
}

contextBridge.exposeInMainWorld('specterAPI', api)
