import type { BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc-channels'
import { DEFAULT_SETTINGS } from '../shared/constants'
import type { AssistantMode } from '../shared/types'
import type { ScreenCaptureResult } from '../shared/types'
import { checkAiConfig } from '../services/ai/ai-config'
import { cloakDeepseekProfileReady } from '../services/ai/completion-route'
import { CoachTriggerEvaluator } from '../services/coach/coach-state'
import { createCoachTickRunner } from '../services/coach/coach-tick-runner'
import { resolveBackgroundCaptureParams } from '../services/capture/background-capture-params'
import { getSetting } from '../services/settings/store'
import { captureScreenText } from './screen-capture'
import { appendJournalFromCapture, resolveJournalFocusFingerprint } from '../services/journal/activity-journal-capture'
import { expandOverlayWindow, syncOverlayBackgroundMode, shouldRunCoachAutoUi, shouldRunWorkJournal } from './overlay-window'

let coachTimer: ReturnType<typeof setInterval> | null = null
let coachOverlay: BrowserWindow | null = null
let overlayCoachStreaming = false
let lastJournalLogMs = 0
let lastJournalFingerprint = ''

const evaluator = new CoachTriggerEvaluator()
const runCoachTick = createCoachTickRunner(evaluator)

export function setOverlayCoachStreaming(streaming: boolean): void {
  overlayCoachStreaming = streaming
  if (!streaming) {
    const pollSec =
      getSetting<number>('detectIntervalSec') || DEFAULT_SETTINGS.detectIntervalSec
    evaluator.recordReadingPause(Date.now(), pollSec)
  }
}

export function resetCoachEvaluator(): void {
  evaluator.reset()
}

export async function runCoachTickForTest(deps: Partial<{
  nowMs: number
  cooldownSec: number
  isStreaming: boolean
  assistantMode: AssistantMode
  captureScreen: () => Promise<ScreenCaptureResult>
  recordTrigger?: boolean
}> = {}) {
  const nowMs = deps.nowMs ?? Date.now()
  const cooldownSec = deps.cooldownSec ?? DEFAULT_SETTINGS.coachCooldownSec
  const isStreaming = deps.isStreaming ?? overlayCoachStreaming
  const assistantMode = deps.assistantMode ?? (getSetting<string>('assistantMode') as AssistantMode) ?? DEFAULT_SETTINGS.assistantMode
  const recordTrigger = deps.recordTrigger
  const captureScreen = deps.captureScreen ?? (async () => {
    const p = resolveBackgroundCaptureParams((key) => getSetting(key))
    return captureScreenText(p.activeWindowOnly, p.perceptionMode, {
      skipAccessibility: p.skipAccessibility,
      coachVision: p.coachVision
    })
  })

  return runCoachTick({ nowMs, cooldownSec, isStreaming, assistantMode, captureScreen, recordTrigger })
}

async function coachTimerTick(): Promise<void> {
  if (!coachOverlay || coachOverlay.isDestroyed()) {
    stopContinuousCoach()
    return
  }

  const aiConfig = checkAiConfig()
  if (!aiConfig.configured && !cloakDeepseekProfileReady()) {
    return
  }

  const pollSec = getSetting<number>('detectIntervalSec') || DEFAULT_SETTINGS.detectIntervalSec
  const cooldownSec =
    (getSetting<string>('assistantMode') as AssistantMode) === 'work' && shouldRunCoachAutoUi()
      ? pollSec
      : getSetting<number>('coachCooldownSec') || DEFAULT_SETTINGS.coachCooldownSec
  const journalIntervalSec =
    getSetting<number>('journalIntervalSec') || DEFAULT_SETTINGS.journalIntervalSec
  const uiReady = shouldRunCoachAutoUi()
  const result = await runCoachTickForTest({ cooldownSec, recordTrigger: uiReady })

  const journalEnabled =
    getSetting<boolean>('activityJournal') || getSetting<boolean>('fullAutoMode')
  if (journalEnabled && result.capture?.text?.trim() && shouldRunWorkJournal()) {
    const now = Date.now()
    const fp = resolveJournalFocusFingerprint(result.capture) ?? ''
    const focusChanged = fp !== '' && fp !== lastJournalFingerprint
    const intervalElapsed = now - lastJournalLogMs >= journalIntervalSec * 1000

    if (focusChanged || intervalElapsed) {
      const elapsedSec = lastJournalLogMs
        ? Math.max(1, Math.round((now - lastJournalLogMs) / 1000))
        : journalIntervalSec
      appendJournalFromCapture(result.capture, {
        durationSec: elapsedSec,
        capturePlan: 'window-crop'
      })
      lastJournalLogMs = now
      lastJournalFingerprint = fp
    }
  }

  // Auto prompt send is paused. Manual send stays in askWatchFrameCoach.
  // if (result.action === 'trigger' && !coachOverlay.isDestroyed() && uiReady) {
  //   coachOverlay.webContents.send(IPC_CHANNELS.COACH_TRIGGER, {
  //     screenText: result.capture?.text?.trim() || result.screenText,
  //     timestamp: Date.now(),
  //     appName: result.capture?.appName,
  //     windowTitle: result.capture?.windowTitle,
  //     useVision: !!result.capture?.useVision,
  //     screenshot: result.capture?.screenshot,
  //     screenChanged: result.screenChanged
  //   })
  // }
}

export function stopContinuousCoach(): void {
  if (coachTimer) {
    clearInterval(coachTimer)
    coachTimer = null
  }
  coachOverlay = null
  overlayCoachStreaming = false
  lastJournalLogMs = 0
  lastJournalFingerprint = ''
  evaluator.reset()
}

export function startContinuousCoach(overlayWindow: BrowserWindow, intervalSec: number): void {
  stopContinuousCoach()
  coachOverlay = overlayWindow

  const clampedInterval = Math.max(3, Math.min(300, intervalSec))
  void coachTimerTick()
  coachTimer = setInterval(() => {
    void coachTimerTick()
  }, clampedInterval * 1000)
}

/** Manual send from the watch frame. Ignores fingerprint and cooldown. */
export async function askWatchFrameCoach(): Promise<void> {
  if (!coachOverlay || coachOverlay.isDestroyed()) return
  expandOverlayWindow(false)
  const p = resolveBackgroundCaptureParams((key) => getSetting(key))
  const capture = await captureScreenText(p.activeWindowOnly, p.perceptionMode, {
    skipAccessibility: p.skipAccessibility,
    coachVision: p.coachVision
  })
  const fingerprint = capture.imageFingerprint || capture.fingerprintText || capture.text
  if (fingerprint) evaluator.recordCoachTriggered(Date.now(), fingerprint)
  coachOverlay.webContents.send(IPC_CHANNELS.COACH_TRIGGER, {
    screenText: capture.text?.trim() || '[SCREENSHOT]',
    timestamp: Date.now(),
    appName: capture.appName,
    windowTitle: capture.windowTitle,
    useVision: !!capture.useVision,
    screenshot: capture.screenshot,
    screenChanged: true,
    force: true
  })
}

/** Run one coach poll immediately after user expands overlay (pill → panel). */
export function flushCoachTickOnExpand(): void {
  if (!coachOverlay || coachOverlay.isDestroyed()) return
  void coachTimerTick()
}

export function syncContinuousCoach(overlayWindow: BrowserWindow): void {
  coachOverlay = overlayWindow
  const fullAuto = getSetting<boolean>('fullAutoMode')
  const enabled = getSetting<boolean>('continuousCoach') || fullAuto
  // Poll every detectIntervalSec; journal throttling is separate inside each tick
  const intervalSec = getSetting<number>('detectIntervalSec') || DEFAULT_SETTINGS.detectIntervalSec

  syncOverlayBackgroundMode()

  if (enabled) {
    startContinuousCoach(overlayWindow, intervalSec)
  } else {
    stopContinuousCoach()
    coachOverlay = overlayWindow
    syncOverlayBackgroundMode()
  }
}
