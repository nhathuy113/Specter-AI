import { describe, expect, it, vi } from 'vitest'
import { cancelGeminiStream, streamGeminiCompletion } from './gemini-api'

const { create } = vi.hoisted(() => ({ create: vi.fn() }))
vi.mock('openai', () => ({ default: class { chat = { completions: { create } } } }))

describe('Gemini concurrent cancellation', () => {
  it('finishing Lite does not remove the controller of a still-running deep request', async () => {
    let finishLite!: (stream: AsyncIterable<unknown>) => void
    let failDeep!: (error: Error) => void
    const signals: AbortSignal[] = []
    create.mockImplementationOnce((_request, options) => {
      signals.push(options.signal)
      return new Promise(resolve => { finishLite = resolve })
    }).mockImplementationOnce((_request, options) => {
      signals.push(options.signal)
      return new Promise((_resolve, reject) => { failDeep = reject })
    })
    const callbacks = { onChunk: vi.fn(), onDone: vi.fn(), onError: vi.fn() }
    const lite = streamGeminiCompletion([], 'lite', 'key', callbacks)
    const deep = streamGeminiCompletion([], 'deep', 'key', callbacks)
    finishLite((async function* () {})())
    await lite
    cancelGeminiStream()
    expect(signals[0].aborted).toBe(false)
    expect(signals[1].aborted).toBe(true)
    failDeep(Object.assign(new Error('cancelled'), { name: 'AbortError' }))
    await deep
    expect(callbacks.onError).not.toHaveBeenCalled()
    expect(callbacks.onDone).toHaveBeenCalledTimes(2)
  })
})
