import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import {
  buildQuizDeepUserMessage,
  cancelQuizDeepExplain,
  markQuizUserActivity,
  resetQuizDeepExplainState,
  scheduleQuizDeepExplain
} from './work-coach-quiz-escalation'

vi.mock('../ai/gemini-api', () => ({
  streamGeminiVisionCompletion: vi.fn(
    async (
      _messages: unknown,
      _model: unknown,
      _key: unknown,
      _image: unknown,
      callbacks: { onChunk: (c: string) => void; onDone: () => void }
    ) => {
      callbacks.onChunk('**Giải thích từng bước:**\n- Bước 1\n')
      callbacks.onDone()
    }
  )
}))

describe('work-coach-quiz-escalation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetQuizDeepExplainState()
  })

  afterEach(() => {
    vi.useRealTimers()
    resetQuizDeepExplainState()
  })

  it('buildQuizDeepUserMessage includes lite answer context', () => {
    const msg = buildQuizDeepUserMessage('**Đáp án:** 2\n**Tại sao:** pattern')
    expect(msg).toContain('**Đáp án:** 2')
    expect(msg).toContain('Lite đã trả lời')
    expect(msg).not.toContain('Giải thích từng bước:** 3–5')
  })

  it('onLiteComplete fires before 5s wait; deep runs only after delay', async () => {
    const sent: Array<{ channel: string; payload: unknown }> = []
    const event = {
      isDestroyed: () => false,
      send: (channel: string, payload: unknown) => sent.push({ channel, payload })
    }
    let liteDone = false

    scheduleQuizDeepExplain({
      sessionKey: 'quiz-q1',
      delayMs: 5000,
      geminiApiKey: 'key',
      screenScreenshot: 'b64',
      liteAnswer: '**Đáp án:** 2',
      event: event as never,
      onLiteComplete: () => {
        liteDone = true
      }
    })

    expect(liteDone).toBe(true)
    await vi.advanceTimersByTimeAsync(4999)
    expect(sent.some((s) => s.channel === IPC_CHANNELS.AI_COACH_TRIPLE_PANEL)).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    await Promise.resolve()
    await Promise.resolve()
    expect(sent.some((s) => s.channel === IPC_CHANNELS.AI_COACH_TRIPLE_PANEL)).toBe(true)
  })

  it('after 5s schedules 3.6 into panel 1 without clearing panel 0', async () => {
    const sent: Array<{ channel: string; payload: unknown }> = []
    const event = {
      isDestroyed: () => false,
      send: (channel: string, payload: unknown) => sent.push({ channel, payload })
    }

    scheduleQuizDeepExplain({
      sessionKey: 'quiz-q1',
      delayMs: 5000,
      geminiApiKey: 'key',
      screenScreenshot: 'b64',
      liteAnswer: '**Đáp án:** 2',
      event: event as never
    })

    await vi.advanceTimersByTimeAsync(4999)
    expect(sent.some((s) => s.channel === IPC_CHANNELS.AI_COACH_TRIPLE_PANEL)).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    await Promise.resolve()
    await Promise.resolve()

    const panelUpdates = sent.filter((s) => s.channel === IPC_CHANNELS.AI_COACH_TRIPLE_PANEL)
    expect(panelUpdates.length).toBeGreaterThan(0)
    expect(panelUpdates.every((s) => (s.payload as { index: number }).index === 1)).toBe(true)
    expect(panelUpdates.at(-1)?.payload).toMatchObject({
      index: 1,
      done: true
    })
    expect(String((panelUpdates.at(-1)?.payload as { content: string }).content)).toContain('Giải thích')
  })

  it('markQuizUserActivity cancels pending deep explain', async () => {
    const sent: Array<{ channel: string; payload: unknown }> = []
    const event = {
      isDestroyed: () => false,
      send: (channel: string, payload: unknown) => sent.push({ channel, payload })
    }

    scheduleQuizDeepExplain({
      sessionKey: 'quiz-q1',
      geminiApiKey: 'key',
      screenScreenshot: 'b64',
      liteAnswer: '**Đáp án:** 2',
      event: event as never
    })

    markQuizUserActivity()
    await vi.advanceTimersByTimeAsync(6000)
    expect(sent.length).toBe(0)
  })

  it('cancelQuizDeepExplain clears timer', async () => {
    const event = {
      isDestroyed: () => false,
      send: vi.fn()
    }

    scheduleQuizDeepExplain({
      sessionKey: 'quiz-q1',
      geminiApiKey: 'key',
      screenScreenshot: 'b64',
      liteAnswer: 'lite',
      event: event as never
    })

    cancelQuizDeepExplain('quiz-q1')
    await vi.advanceTimersByTimeAsync(6000)
    expect(event.send).not.toHaveBeenCalled()
  })
})
