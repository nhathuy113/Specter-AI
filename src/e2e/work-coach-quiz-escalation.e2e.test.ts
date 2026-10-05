import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC_CHANNELS } from '../shared/ipc-channels'
import { resetQuizDeepExplainState } from '../services/work/work-coach-quiz-escalation'
import { runWorkCoachQuizVision } from '../services/work/work-coach-runner'

vi.mock('../services/ai/gemini-api', () => ({
  streamGeminiVisionCompletion: vi.fn(
    async (
      _messages: unknown,
      model: string,
      _key: unknown,
      _image: unknown,
      callbacks: { onChunk: (c: string) => void; onDone: () => void }
    ) => {
      if (model.includes('lite')) {
        callbacks.onChunk('**Đáp án:** 2\n**Quy luật:** test\n')
      } else {
        callbacks.onChunk('**Giải thích từng bước:**\n- Chi tiết\n')
      }
      callbacks.onDone()
    }
  ),
  streamGeminiCompletion: vi.fn()
}))

describe('runWorkCoachQuizVision e2e', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetQuizDeepExplainState()
  })

  afterEach(() => {
    vi.useRealTimers()
    resetQuizDeepExplainState()
  })

  it('keeps Lite in panel 0 and fills panel 1 after 5s', async () => {
    const sent: Array<{ channel: string; payload: unknown }> = []
    const event = {
      isDestroyed: () => false,
      send: (channel: string, payload: unknown) => sent.push({ channel, payload })
    }

    const litePromise = runWorkCoachQuizVision({
      messages: [{ role: 'user', content: 'quiz' }],
      geminiApiKey: 'key',
      screenScreenshot: 'b64',
      event: event as never,
      sessionKey: 'q1'
    })

    await litePromise

    const panel0 = sent.find(
      (s) =>
        s.channel === IPC_CHANNELS.AI_COACH_TRIPLE_PANEL &&
        (s.payload as { index: number; done: boolean }).index === 0 &&
        (s.payload as { done: boolean }).done
    )
    expect(String((panel0?.payload as { content: string }).content)).toContain('**Đáp án:**')

    const waitingPanel = sent.find(
      (s) =>
        s.channel === IPC_CHANNELS.AI_COACH_TRIPLE_PANEL &&
        (s.payload as { index: number }).index === 1 &&
        String((s.payload as { content: string }).content).includes('Lite xong')
    )
    expect(waitingPanel).toBeTruthy()

    await vi.advanceTimersByTimeAsync(5000)
    await Promise.resolve()
    await Promise.resolve()

    const panel1Done = sent.filter(
      (s) =>
        s.channel === IPC_CHANNELS.AI_COACH_TRIPLE_PANEL &&
        (s.payload as { index: number }).index === 1 &&
        (s.payload as { done: boolean }).done
    )
    expect(panel1Done.length).toBeGreaterThan(0)
    expect(String((panel1Done.at(-1)?.payload as { content: string }).content)).toContain('Giải thích')

    // panel 0 content unchanged after deep explain
    expect(String((panel0?.payload as { content: string }).content)).toContain('**Đáp án:**')
  })
})
