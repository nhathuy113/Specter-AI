import { describe, expect, it, vi } from 'vitest'
import { createWorkCoachOrchestrator, type WorkCoachPorts } from './work-coach-orchestrator'
import { createQuizDeepScheduler } from './work-coach-quiz-scheduler'
import type { CompletionStream, StreamCallbacks } from '../ai/contracts'
import type { CoachPanelSink } from './coach-panel-port'

function setup(streamGemini: CompletionStream) {
  const sink = { isDisposed: () => false, start: vi.fn(), update: vi.fn(), done: vi.fn() }
  const ports: WorkCoachPorts = {
    streamGemini,
    streamDeepseek: vi.fn(async (_r, c) => { c.onChunk('deepseek'); c.onDone() }),
    completeCursor: vi.fn(async () => 'Cursor advice'),
    saveCursorReply: vi.fn(),
    quiz: { begin: () => 1, isCurrent: () => true, schedule: vi.fn() }
  }
  return { sink, ports, coach: createWorkCoachOrchestrator(ports) }
}

describe('work coach ports', () => {
  it('accepts a class-based panel adapter with prototype methods and receiver state', async () => {
    class Panels implements CoachPanelSink {
      events: string[] = []
      isDisposed() { return false }
      start() { this.events.push('start') }
      update() { this.events.push('update') }
      done() { this.events.push('done') }
    }
    const sink = new Panels()
    const { coach } = setup(async (_r, c) => { c.onChunk('advice'); c.onDone() })
    await coach.runEscalation({ messages: [], geminiApiKey: 'key', useVision: false, includeCursor: false, sink })
    expect(sink.events[0]).toBe('start')
    expect(sink.events.at(-1)).toBe('done')
    expect(sink.events.filter(e => e === 'update')).toHaveLength(4)
  })
  it('a failed Lite panel does not stop deep or Cursor; errors are not session content', async () => {
    const { coach, ports, sink } = setup(async (r, c) => {
      if (r.model.includes('lite')) { c.onError('quota'); c.onChunk('late'); throw new Error('quota again') }
      c.onChunk('deep advice'); c.onDone()
    })
    const result = await coach.runEscalation({ messages: [], geminiApiKey: 'key', useVision: true, screenScreenshot: 'b64', includeCursor: true, screenText: 'code', sink })
    expect(result.primaryPanelContent).toBe('')
    expect(result.completionContent).toContain('deep advice')
    expect(result.completionContent).toContain('Cursor advice')
    expect(ports.saveCursorReply).toHaveBeenCalledWith('code', undefined, 'Cursor advice')
    expect(sink.update.mock.calls.filter(([index, , done]) => index === 0 && done)).toEqual([[0, '⚠ quota', true]])
    expect(sink.done).toHaveBeenCalledTimes(1)
  })

  it('general work needs only Gemini; optional Cursor is never invoked', async () => {
    const stream = vi.fn<CompletionStream>(async (_r, c) => { c.onChunk('advice'); c.onDone() })
    const { coach, ports, sink } = setup(stream)
    const result = await coach.runEscalation({ messages: [], geminiApiKey: 'key', useVision: false, screenScreenshot: 'b64', includeCursor: false, sink })
    expect(result.modelLabel).toBe('work-coach/dual')
    expect(result.primaryPanelContent).toBe('advice')
    expect(ports.completeCursor).not.toHaveBeenCalled()
    expect(stream.mock.calls.every(([r]) => r.screenshot === undefined)).toBe(true)
  })

  it('disposed targets receive no late panel or done writes', async () => {
    let disposed = false
    const { coach, sink } = setup(async (_r, c) => { disposed = true; c.onChunk('late'); c.onDone() })
    sink.isDisposed = () => disposed
    await coach.runEscalation({ messages: [], geminiApiKey: 'key', useVision: false, includeCursor: false, sink })
    expect(sink.start).toHaveBeenCalledTimes(1)
    expect(sink.update).not.toHaveBeenCalled()
    expect(sink.done).not.toHaveBeenCalled()
  })

  it('runs quiz comparison beside Lite without waiting for DeepSeek', async () => {
    const { ports, sink } = setup(async (_request, callbacks) => { callbacks.onChunk('Lite answer'); callbacks.onDone() })
    let callbacks!: StreamCallbacks
    let finish!: () => void
    ports.streamDeepseek = vi.fn((_request, cb) => {
      callbacks = cb
      return new Promise<void>(resolve => { finish = resolve })
    })
    const coach = createWorkCoachOrchestrator(ports)
    const result = await coach.runQuizVision({ messages: [], geminiApiKey: 'key', screenScreenshot: 'b64', sessionKey: 'quiz', includeDeepseekCompare: true, sink })
    expect(result.primaryPanelContent).toBe('Lite answer')
    expect(sink.start.mock.calls[0][0]).toHaveLength(3)
    expect(ports.streamDeepseek).toHaveBeenCalledOnce()
    expect(ports.quiz.schedule).toHaveBeenCalledOnce()
    callbacks.onChunk('comparison'); callbacks.onDone(); finish()
    expect(sink.update).toHaveBeenCalledWith(2, 'comparison', true)
  })

  it('suppresses late quiz comparison after the question changes', async () => {
    const { ports, sink } = setup(async (_request, callbacks) => { callbacks.onChunk('Lite'); callbacks.onDone() })
    let callbacks!: StreamCallbacks
    let finish!: () => void
    let generation = 0
    ports.quiz = { begin: () => ++generation, isCurrent: value => value === generation, schedule: vi.fn() }
    ports.streamDeepseek = (_request, cb) => { callbacks = cb; return new Promise<void>(resolve => { finish = resolve }) }
    const coach = createWorkCoachOrchestrator(ports)
    await coach.runQuizVision({ messages: [], geminiApiKey: 'key', screenScreenshot: 'b64', sessionKey: 'q1', includeDeepseekCompare: true, sink })
    generation++
    sink.update.mockClear()
    callbacks.onChunk('old answer'); callbacks.onDone(); finish()
    expect(sink.update).not.toHaveBeenCalled()
  })

  it('switching quiz while Lite is running discards its late UI and deep schedule', async () => {
    let callbacks!: StreamCallbacks
    let finish!: () => void
    const { ports, sink } = setup((_r, c) => { callbacks = c; return new Promise(resolve => { finish = resolve }) })
    const scheduler = createQuizDeepScheduler(ports.streamGemini)
    ports.quiz = scheduler
    const coach = createWorkCoachOrchestrator(ports)
    const running = coach.runQuizVision({ messages: [], geminiApiKey: 'key', screenScreenshot: 'b64', sessionKey: 'q1', sink })
    scheduler.begin('q2')
    sink.update.mockClear()
    callbacks.onChunk('answer to q1'); callbacks.onDone(); finish()
    await running
    expect(sink.update).not.toHaveBeenCalled()
    expect(sink.done).not.toHaveBeenCalled()
    scheduler.reset()
  })
})
