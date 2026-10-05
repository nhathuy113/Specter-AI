import { describe, expect, it, vi } from 'vitest'
import { createDeepseekSession } from './deepseek-session'

const request = { messages: [{ role: 'user' as const, content: 'hello' }], model: '', apiKey: '', screenshot: 'b64' }
function callbacks() { return { onChunk: vi.fn(), onDone: vi.fn(), onError: vi.fn() } }

describe('DeepSeek browser session', () => {
  it('serializes access to one persistent browser profile', async () => {
    let finish!: (text: string) => void
    const execute = vi.fn().mockImplementationOnce(() => new Promise<string>(resolve => { finish = resolve })).mockResolvedValue('second')
    const session = createDeepseekSession(execute)
    const a = callbacks(), b = callbacks()
    const first = session.stream(request, a), second = session.stream(request, b)
    await vi.waitFor(() => expect(execute).toHaveBeenCalledOnce())
    expect(JSON.parse(execute.mock.calls[0][0])).toEqual({ prompt: 'hello', image_base64: 'b64' })
    finish('first')
    await Promise.all([first, second])
    expect(a.onChunk).toHaveBeenCalledWith('first')
    expect(b.onChunk).toHaveBeenCalledWith('second')
    expect(a.onDone).toHaveBeenCalledOnce()
    expect(b.onDone).toHaveBeenCalledOnce()
  })

  it('cancels both active and queued requests and remains usable afterwards', async () => {
    let finish!: (text: string) => void
    let active!: AbortSignal
    const execute = vi.fn((_payload: string, signal: AbortSignal) => {
      active = signal
      return new Promise<string>(resolve => { finish = resolve })
    })
    const session = createDeepseekSession(execute)
    const a = callbacks(), b = callbacks()
    const first = session.stream(request, a), second = session.stream(request, b)
    const results = Promise.allSettled([first, second])
    await vi.waitFor(() => expect(execute).toHaveBeenCalledOnce())
    session.cancel()
    expect(active.aborted).toBe(true)
    finish('late')
    expect((await results).every(result => result.status === 'rejected')).toBe(true)
    expect(a.onChunk).not.toHaveBeenCalled()
    expect(b.onChunk).not.toHaveBeenCalled()
    expect(execute).toHaveBeenCalledOnce()
    execute.mockResolvedValue('fresh')
    const c = callbacks()
    await session.stream(request, c)
    expect(c.onChunk).toHaveBeenCalledWith('fresh')
  })

  it('a failed request does not block the queue', async () => {
    const execute = vi.fn().mockRejectedValueOnce(new Error('failed')).mockResolvedValue('next')
    const session = createDeepseekSession(execute)
    const results = await Promise.allSettled([session.stream(request, callbacks()), session.stream(request, callbacks())])
    expect(results.map(result => result.status)).toEqual(['rejected', 'fulfilled'])
  })
})
