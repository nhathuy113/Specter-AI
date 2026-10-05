import { EventEmitter } from 'events'
import type { ChildProcessWithoutNullStreams } from 'child_process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { runJsonProcess } from './json-process'

function processPort() {
  const proc = Object.assign(new EventEmitter(), {
    stdout: new EventEmitter(), stderr: new EventEmitter(),
    stdin: Object.assign(new EventEmitter(), { end: vi.fn() }), kill: vi.fn()
  })
  return { proc, launch: () => proc as unknown as ChildProcessWithoutNullStreams }
}

afterEach(() => vi.useRealTimers())

describe('JSON subprocess protocol', () => {
  it('preserves multiline replies and settles once despite late events', async () => {
    const { proc, launch } = processPort()
    const promise = runJsonProcess(launch, '{"prompt":"hello"}', new AbortController().signal)
    proc.stdout.emit('data', 'diagnostic\n' + JSON.stringify({ text: 'line 1\ncode\nline 3' }))
    proc.emit('close', 0)
    proc.emit('error', new Error('late'))
    expect(await promise).toBe('line 1\ncode\nline 3')
    expect(proc.stdin.end).toHaveBeenCalledWith('{"prompt":"hello"}')
    expect(proc.kill).not.toHaveBeenCalled()
  })

  it.each(['{invalid json', '{"text":123}', '{"text":""}', '{"error":"upload failed"}'])('rejects malformed replies safely: %s', async output => {
    const { proc, launch } = processPort()
    const promise = runJsonProcess(launch, '', new AbortController().signal)
    const assertion = expect(promise).rejects.toBeInstanceOf(Error)
    proc.stdout.emit('data', output)
    expect(() => proc.emit('close', 0)).not.toThrow()
    await assertion
  })

  it('rejects a failed exit even when stdout looks successful', async () => {
    const { proc, launch } = processPort()
    const promise = runJsonProcess(launch, '', new AbortController().signal)
    proc.stdout.emit('data', '{"text":"partial"}')
    proc.emit('close', 1)
    await expect(promise).rejects.toThrow('code 1')
  })

  it('handles launch/stdin errors and cancellation without waiting for close', async () => {
    const { proc, launch } = processPort()
    const controller = new AbortController()
    const pending = runJsonProcess(launch, '', controller.signal)
    controller.abort()
    await expect(pending).rejects.toThrow('cancelled')
    expect(proc.kill).toHaveBeenCalledOnce()
    const next = runJsonProcess(launch, '', new AbortController().signal)
    proc.stdin.emit('error', new Error('broken pipe'))
    await expect(next).rejects.toThrow('broken pipe')
    await expect(runJsonProcess(() => { throw new Error('missing executable') }, '', new AbortController().signal)).rejects.toThrow('missing executable')
    expect(proc.stdin.end).toHaveBeenCalledTimes(2)
    await expect(runJsonProcess(vi.fn(), '', controller.signal)).rejects.toThrow('cancelled')
  })

  it('bounds subprocess duration and output size', async () => {
    vi.useFakeTimers()
    const { proc, launch } = processPort()
    const pending = runJsonProcess(launch, '', new AbortController().signal, 100)
    const assertion = expect(pending).rejects.toThrow('timed out')
    await vi.advanceTimersByTimeAsync(100)
    await assertion
    expect(vi.getTimerCount()).toBe(0)
    const oversized = runJsonProcess(launch, '', new AbortController().signal)
    proc.stdout.emit('data', 'x'.repeat(16 * 1024 * 1024 + 1))
    await expect(oversized).rejects.toThrow('exceeded limit')
    expect(vi.getTimerCount()).toBe(0)
  })
})
