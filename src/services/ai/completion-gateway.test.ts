import { describe, expect, it, vi } from 'vitest'
import { createCompletionGateway } from './completion-gateway'
import { createStreamScope } from './stream-lifecycle'
import type { CompletionProvider, CompletionRequest, StreamCallbacks } from './contracts'

const request: CompletionRequest = { messages: [{ role: 'user', content: 'hello' }], model: 'test', apiKey: 'key' }
const callbacks = () => ({ onChunk: vi.fn(), onDone: vi.fn(), onError: vi.fn() })
function gateway(provider: CompletionProvider) {
  return createCompletionGateway({ gemini: provider, openai: provider, openrouter: provider, codex: provider })
}

describe('completion contract', () => {
  it('routes the full request to the selected provider only', async () => {
    const selected = { stream: vi.fn(async (_r, c: StreamCallbacks) => c.onDone()), cancel: vi.fn() }
    const other = { stream: vi.fn(), cancel: vi.fn() }
    const ai = createCompletionGateway({ gemini: selected, openai: other, openrouter: other, codex: other })
    const cb = callbacks()
    const input = { ...request, screenshot: 'b64', maxTokens: 42 }
    await ai.stream('gemini', input, cb)
    expect(selected.stream).toHaveBeenCalledWith(input, expect.any(Object))
    expect(other.stream).not.toHaveBeenCalled()
    expect(cb.onDone).toHaveBeenCalledTimes(1)
  })

  it('reports an error once and discards late chunks and completion', async () => {
    const cb = callbacks()
    const ai = gateway({ cancel: vi.fn(), stream: async (_r, c) => {
      c.onChunk('partial')
      c.onError('quota')
      c.onChunk('late')
      c.onDone()
      throw new Error('also rejected')
    } })
    await ai.stream('gemini', request, cb)
    expect(cb.onChunk.mock.calls).toEqual([['partial']])
    expect(cb.onError.mock.calls).toEqual([['quota']])
    expect(cb.onDone).not.toHaveBeenCalled()
  })

  it('completes a provider that returns without a terminal callback', async () => {
    const cb = callbacks()
    await gateway({ cancel: vi.fn(), stream: async () => {} }).stream('openai', request, cb)
    expect(cb.onDone).toHaveBeenCalledTimes(1)
  })

  it('a finished request cannot clear cancellation ownership of a concurrent one', () => {
    const streams = createStreamScope()
    const lite = streams.begin()
    const deep = streams.begin()
    streams.finish(lite)
    streams.cancel()
    expect(lite.signal.aborted).toBe(false)
    expect(deep.signal.aborted).toBe(true)
    const next = streams.begin()
    streams.finish(deep)
    streams.cancel()
    expect(next.signal.aborted).toBe(true)
  })

  it('cancel aborts all parallel streams; a new request starts cleanly', () => {
    const streams = createStreamScope()
    const a = streams.begin(), b = streams.begin()
    streams.cancel()
    expect(a.signal.aborted).toBe(true)
    expect(b.signal.aborted).toBe(true)
    expect(streams.begin().signal.aborted).toBe(false)
  })
})
