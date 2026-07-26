import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC_CHANNELS } from '../shared/ipc-channels'
import { CoachTriggerEvaluator } from '../services/coach-state'
import { createCoachTickRunner } from '../services/coach-tick-runner'
import { resolveAssistantRequest } from '../services/context-router'
import { pickBestBrowserWindow, resolveWorkWindowForCrop } from '../main/work-window-memory'
import { runWorkCoachQuizVision } from '../services/work-coach-runner'
import type { ScreenCaptureResult } from '../shared/types'

vi.mock('../services/gemini-api', () => ({
  streamGeminiVisionCompletion: vi.fn(
    async (
      _messages: unknown,
      _model: unknown,
      _key: unknown,
      _image: unknown,
      callbacks: { onChunk: (c: string) => void; onDone: () => void }
    ) => {
      callbacks.onChunk('**Đáp án:** 2\n')
      callbacks.onChunk('**Quy luật:** ma trận.\n')
      callbacks.onDone()
    }
  ),
  streamGeminiCompletion: vi.fn()
}))

vi.mock('../services/work-coach-quiz-escalation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/work-coach-quiz-escalation')>()
  return {
    ...actual,
    scheduleQuizDeepExplain: vi.fn()
  }
})

const QUIZ_OCR = '123test.com\nQuestion 1 of 8\nWhich figure completes the pattern?'
const CHROME_META = { appName: 'Google Chrome', windowTitle: '123test IQ Test' }

function mockQuizCapture(overrides: Partial<ScreenCaptureResult> = {}): ScreenCaptureResult {
  return {
    text: `[ACTIVE APP] ${CHROME_META.appName}\n[WINDOW] ${CHROME_META.windowTitle}`,
    fingerprintText: QUIZ_OCR,
    screenshot: 'fake-screenshot-b64',
    timestamp: Date.now(),
    useVision: true,
    textSource: 'metadata',
    appName: CHROME_META.appName,
    windowTitle: CHROME_META.windowTitle,
    ...overrides
  }
}

describe('work coach pipeline e2e', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('poll → trigger → router → lite vision streams into coach panel (not AI_STREAM_CHUNK)', async () => {
    const evaluator = new CoachTriggerEvaluator()
    const runTick = createCoachTickRunner(evaluator)

    const tick = await runTick({
      nowMs: 1_000,
      cooldownSec: 3,
      isStreaming: false,
      assistantMode: 'work',
      captureScreen: async () => mockQuizCapture()
    })

    expect(tick.action).toBe('trigger')
    if (tick.action !== 'trigger') return
    expect(tick.screenChanged).toBe(false)

    const req = resolveAssistantRequest(tick.capture!.fingerprintText!, 'work', CHROME_META)
    expect(req.workProblem?.kind).toBe('visual-quiz')
    expect(req.userMessage).not.toContain('[OCR — supplementary only]')

    const sent: Array<{ channel: string; payload: unknown }> = []
    const event = {
      isDestroyed: () => false,
      send: (channel: string, payload: unknown) => {
        sent.push({ channel, payload })
      }
    }

    const result = await runWorkCoachQuizVision({
      messages: [{ role: 'user', content: req.userMessage }],
      geminiApiKey: 'test-key',
      screenScreenshot: tick.capture!.screenshot!,
      event: event as never,
      sessionKey: tick.fingerprint
    })

    expect(result.primaryPanelContent).toContain('**Đáp án:**')
    expect(sent[0]?.channel).toBe(IPC_CHANNELS.AI_COACH_TRIPLE_START)
    expect((sent[0]?.payload as { labels: string[] }).labels).toHaveLength(2)
    expect(sent.some((s) => s.channel === IPC_CHANNELS.AI_COACH_TRIPLE_PANEL)).toBe(true)
    expect(sent.at(-1)?.channel).toBe(IPC_CHANNELS.AI_COACH_TRIPLE_DONE)
    expect(sent.some((s) => s.channel === IPC_CHANNELS.AI_STREAM_CHUNK)).toBe(false)
  })

  it('same quiz question on next poll → skip duplicate (no re-trigger spam)', async () => {
    const evaluator = new CoachTriggerEvaluator()
    const runTick = createCoachTickRunner(evaluator)
    const capture = mockQuizCapture()

    const first = await runTick({
      nowMs: 1_000,
      cooldownSec: 3,
      isStreaming: false,
      assistantMode: 'work',
      captureScreen: async () => capture
    })
    expect(first.action).toBe('trigger')
    evaluator.recordCoachTriggered(1_000, first.fingerprint)

    const second = await runTick({
      nowMs: 5_000,
      cooldownSec: 3,
      isStreaming: false,
      assistantMode: 'work',
      captureScreen: async () => capture
    })

    expect(second.action).toBe('skip')
    if (second.action === 'skip') {
      expect(second.reason).toBe('duplicate-fingerprint')
    }
  })

  it('Cursor front on external monitor → prefers Chrome on primary for crop', () => {
    const chromeOnPrimary = {
      x: 80,
      y: 40,
      width: 1280,
      height: 800,
      pid: 123,
      bundleId: 'com.google.Chrome',
      appName: 'Google Chrome',
      windowTitle: '123test.com IQ Test'
    }
    const cursorOnExternal = {
      x: 1600,
      y: 0,
      width: 2560,
      height: 1410,
      pid: 456,
      bundleId: 'com.todesktop.230313mzl4w4u92',
      appName: 'Cursor',
      windowTitle: 'PERFORMANCE REVIEW'
    }
    const primaryBounds = { x: 0, y: 0, width: 1440, height: 900 }

    const picked = resolveWorkWindowForCrop(cursorOnExternal, {
      browserWindows: [chromeOnPrimary],
      primaryBounds
    })

    expect(picked?.appName).toBe('Google Chrome')
    expect(pickBestBrowserWindow([chromeOnPrimary], primaryBounds)?.windowTitle).toContain('123test')
  })
})
