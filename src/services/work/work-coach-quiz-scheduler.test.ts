import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createQuizDeepScheduler } from './work-coach-quiz-scheduler'
import type { CompletionStream, StreamCallbacks } from '../ai/contracts'

describe('quiz request lifetime', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers() })
  const sink = () => ({ isDisposed: () => false, start: vi.fn(), update: vi.fn(), done: vi.fn() })

  it('user activity while Lite runs prevents its delayed escalation', async () => {
    const stream = vi.fn<CompletionStream>()
    const scheduler = createQuizDeepScheduler(stream)
    const generation = scheduler.begin('q1')
    scheduler.cancel()
    scheduler.schedule({ generation, sessionKey: 'q1', geminiApiKey: 'key', screenScreenshot: 'b64', liteAnswer: 'answer', sink: sink() })
    await vi.advanceTimersByTimeAsync(6000)
    expect(stream).not.toHaveBeenCalled()
  })

  it('cancelling an in-flight deep explanation suppresses every late outcome', async () => {
    let callback!: StreamCallbacks
    let finish!: () => void
    const stream: CompletionStream = (_r, c) => { callback = c; return new Promise(resolve => { finish = resolve }) }
    const scheduler = createQuizDeepScheduler(stream)
    const target = sink()
    scheduler.schedule({ sessionKey: 'q1', geminiApiKey: 'key', screenScreenshot: 'b64', liteAnswer: 'answer', sink: target })
    await vi.advanceTimersByTimeAsync(5000)
    expect(target.update).toHaveBeenCalledTimes(1)
    scheduler.cancel('q1')
    callback.onChunk('old explanation'); callback.onError('old error'); callback.onDone(); finish()
    await Promise.resolve()
    expect(target.update).toHaveBeenCalledTimes(1)
  })

  it('a stale Lite result cannot replace a pending explanation for the next question', async () => {
    const stream = vi.fn<CompletionStream>(async (_r, c) => c.onDone())
    const scheduler = createQuizDeepScheduler(stream)
    const oldGeneration = scheduler.begin('q1')
    const generation = scheduler.begin('q2')
    const target = sink()
    const base = { geminiApiKey: 'key', screenScreenshot: 'b64', liteAnswer: 'answer', sink: target }
    scheduler.schedule({ ...base, sessionKey: 'q2', generation })
    scheduler.schedule({ ...base, sessionKey: 'q1', generation: oldGeneration })
    await vi.advanceTimersByTimeAsync(5000)
    expect(stream).toHaveBeenCalledTimes(1)
    expect(target.update).toHaveBeenCalledTimes(2)
  })
})
