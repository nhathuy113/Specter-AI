import type { BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc-channels'
import { DEFAULT_SETTINGS } from '../shared/constants'
import type { AssistantMode } from '../shared/types'
import type { PerceptionMode } from '../shared/constants'
import type { ScreenCaptureResult } from '../shared/types'
import { checkAiConfig } from '../services/ai-config'
import { CoachTriggerEvaluator } from '../services/coach-state'
import { createCoachTickRunner } from '../services/coach-tick-runner'
import { getSetting } from '../services/store'
import { captureScreenText } from './screen-capture'

let coachTimer: ReturnType<typeof setInterval> | null = null
let coachOverlay: BrowserWindow | null = null
let overlayCoachStreaming = false

const evaluator = new CoachTriggerEvaluator()
const runCoachTick = createCoachTickRunner(evaluator)

export function setOverlayCoachStreaming(streaming: boolean): void {
  overlayCoachStreaming = streaming
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
}> = {}) {
  const nowMs = deps.nowMs ?? Date.now()
  const cooldownSec = deps.cooldownSec ?? DEFAULT_SETTINGS.coachCooldownSec
  const isStreaming = deps.isStreaming ?? overlayCoachStreaming
  const assistantMode = deps.assistantMode ?? (getSetting<string>('assistantMode') as AssistantMode) ?? DEFAULT_SETTINGS.assistantMode
  const captureScreen = deps.captureScreen ?? (async () => {
    const smartCrop = getSetting<boolean>('smartCrop') || false
    const perceptionMode = (getSetting<string>('perceptionMode') as PerceptionMode) ?? DEFAULT_SETTINGS.perceptionMode
    return captureScreenText(smartCrop, perceptionMode)
  })

  return runCoachTick({ nowMs, cooldownSec, isStreaming, assistantMode, captureScreen })
}

async function coachTimerTick(): Promise<void> {
  if (!coachOverlay || coachOverlay.isDestroyed()) {
    stopContinuousCoach()
    return
  }

  const aiConfig = checkAiConfig()
  if (!aiConfig.configured) {
    return
  }

  const cooldownSec = getSetting<number>('coachCooldownSec') || DEFAULT_SETTINGS.coachCooldownSec
  const result = await runCoachTickForTest({ cooldownSec })

  if (result.action === 'trigger' && !coachOverlay.isDestroyed()) {
    coachOverlay.webContents.send(IPC_CHANNELS.COACH_TRIGGER, {
      screenText: result.screenText,
      timestamp: Date.now(),
      appName: result.capture?.appName,
      windowTitle: result.capture?.windowTitle,
      useVision: result.capture?.useVision,
      screenshot: result.capture?.screenshot
    })
  }
}

export function stopContinuousCoach(): void {
  if (coachTimer) {
    clearInterval(coachTimer)
    coachTimer = null
  }
  coachOverlay = null
  overlayCoachStreaming = false
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

export function syncContinuousCoach(overlayWindow: BrowserWindow): void {
  coachOverlay = overlayWindow
  const enabled = getSetting<boolean>('continuousCoach')
  const intervalSec = getSetting<number>('detectIntervalSec') || DEFAULT_SETTINGS.detectIntervalSec

  if (enabled) {
    startContinuousCoach(overlayWindow, intervalSec)
  } else {
    stopContinuousCoach()
    coachOverlay = overlayWindow
  }
}
