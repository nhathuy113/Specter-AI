// IPC channel constants for main ↔ renderer communication
export const IPC_CHANNELS = {
  // Overlay
  TOGGLE_OVERLAY: 'overlay:toggle',
  SHOW_OVERLAY: 'overlay:show',
  HIDE_OVERLAY: 'overlay:hide',
  OVERLAY_READY: 'overlay:ready',
  OVERLAY_SET_OPACITY: 'overlay:set-opacity',
  /** macOS NSVisualEffectView — real desktop blur, not CSS opacity. */
  OVERLAY_SET_GLASS_MODE: 'overlay:set-glass-mode',
  OVERLAY_SET_PILL_MODE: 'overlay:set-pill-mode',
  OVERLAY_EXPAND: 'overlay:expand',
  OVERLAY_COLLAPSE: 'overlay:collapse',
  OVERLAY_FIT_CONTENT: 'overlay:fit-content',
  WATCH_FRAME_DRAGGING: 'watch-frame:dragging',
  WATCH_FRAME_GET: 'watch-frame:get',
  WATCH_FRAME_SET: 'watch-frame:set',
  WATCH_FRAME_PASSTHROUGH: 'watch-frame:passthrough',
  WATCH_FRAME_ASK: 'watch-frame:ask',

  // AI
  AI_CHECK_CONFIG: 'ai:check-config',
  GEMINI_VALIDATE_KEY: 'gemini:validate-key',
  AI_QUERY: 'ai:query',
  AI_STREAM_CHUNK: 'ai:stream-chunk',
  AI_STREAM_DONE: 'ai:stream-done',
  AI_STREAM_ERROR: 'ai:stream-error',
  AI_CANCEL: 'ai:cancel',
  AI_COACH_TRIPLE_START: 'ai:coach-triple-start',
  AI_COACH_TRIPLE_PANEL: 'ai:coach-triple-panel',
  AI_COACH_TRIPLE_DONE: 'ai:coach-triple-done',

  // Screen capture
  SCREEN_CAPTURE: 'screen:capture',
  SCREEN_CAPTURE_PREVIEW: 'screen:capture-preview',
  SCREEN_CAPTURE_AUTO_PREVIEW: 'screen:capture-auto-preview',
  SCREEN_CAPTURE_RESULT: 'screen:capture-result',
  SCREEN_CAPTURE_ERROR: 'screen:capture-error',

  // Audio
  AUDIO_CHECK_CONFIG: 'audio:check-config',
  AUDIO_TRANSCRIBE: 'audio:transcribe',
  AUDIO_TRANSCRIPT: 'audio:transcript',
  AUDIO_STATUS: 'audio:status',

  // Displays
  DISPLAYS_LIST: 'displays:list',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_GET_ALL: 'settings:get-all',

  // Models
  MODELS_FETCH: 'models:fetch',
  MODELS_LIST: 'models:list',

  // Hotkeys
  HOTKEY_ASK_AI: 'hotkey:ask-ai',
  HOTKEY_ASK_WITH_SCREENSHOT: 'hotkey:ask-with-screenshot',
  HOTKEY_TOGGLE_AUDIO: 'hotkey:toggle-audio',
  HOTKEY_TOGGLE_OVERLAY: 'hotkey:toggle-overlay',
  HOTKEY_ACTIVE_TAB: 'hotkey:active-tab',
  WORK_AUTO_TOGGLED: 'work-auto:toggled',
  WORK_AUTO_GET_STATUS: 'work-auto:get-status',
  WORK_AUTO_TOGGLE: 'work-auto:toggle',
  HOTKEY_REREGISTER: 'hotkey:reregister',

  // Dashboard
  OPEN_DASHBOARD: 'dashboard:open',
  CLOSE_DASHBOARD: 'dashboard:close',

  // Context
  CONTEXT_GET: 'context:get',
  CONTEXT_SCREEN_TEXT: 'context:screen-text',
  CONTEXT_TRANSCRIPT: 'context:transcript',

  // Auto-capture
  AUTO_CAPTURE_UPDATE: 'auto-capture:update',

  // Continuous coach
  COACH_TRIGGER: 'coach:trigger',
  COACH_STREAMING: 'coach:streaming',

  // Activity journal (performance review)
  ACTIVITY_JOURNAL_LIST: 'activity-journal:list',
  ACTIVITY_JOURNAL_EXPORT: 'activity-journal:export',
  ACTIVITY_JOURNAL_CLEAR: 'activity-journal:clear',

  // Conversations
  CONVERSATIONS_LIST: 'conversations:list',
  CONVERSATIONS_SAVE: 'conversations:save',
  CONVERSATIONS_DELETE: 'conversations:delete',
  CONVERSATIONS_CLEAR: 'conversations:clear',

  // App
  APP_QUIT: 'app:quit',
  APP_VERSION: 'app:version'
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
