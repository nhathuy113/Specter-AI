import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAutoCaptureLoop } from './auto-capture-loop'
import type { ScreenCaptureResult } from '../shared/types'

describe('auto capture lifecycle', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers() })

  it('deduplicates text and clamps the configured interval', async () => {
    const publish = vi.fn()
    const loop = createAutoCaptureLoop({
      captureScreen: async () => ({ text: 'same screen', timestamp: 0 }),
      readConfig: () => ({ enabled: true, intervalSec: 1 }),
      isDisposed: () => false, publish, onError: vi.fn(), now: () => 99
    })
    loop.sync()
    await vi.advanceTimersByTimeAsync(4999)
    expect(publish).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(5001)
    expect(publish.mock.calls).toEqual([[{ text: 'same screen', timestamp: 99 }]])
    loop.stop()
  })

  it('prevents overlap and discards a capture that completes after stop', async () => {
    let finish!: (value: ScreenCaptureResult) => void
    const captureScreen = vi.fn(() => new Promise<ScreenCaptureResult>(resolve => { finish = resolve }))
    const publish = vi.fn()
    const loop = createAutoCaptureLoop({
      captureScreen, readConfig: () => ({ enabled: true, intervalSec: 5 }),
      isDisposed: () => false, publish, onError: vi.fn()
    })
    loop.sync()
    await vi.advanceTimersByTimeAsync(15_000)
    expect(captureScreen).toHaveBeenCalledTimes(1)
    loop.stop()
    finish({ text: 'stale screen', timestamp: 0 })
    await Promise.resolve()
    expect(publish).not.toHaveBeenCalled()
  })

  it('captures again after a failure and stops when the target is disposed', async () => {
    const captureScreen = vi.fn().mockRejectedValueOnce(new Error('capture failed')).mockResolvedValue({ text: 'recovered', timestamp: 0 })
    const onError = vi.fn(), publish = vi.fn()
    let disposed = false
    const loop = createAutoCaptureLoop({ captureScreen, readConfig: () => ({ enabled: true, intervalSec: 5 }), isDisposed: () => disposed, publish, onError })
    loop.sync()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(onError).toHaveBeenCalledTimes(1)
    expect(publish).toHaveBeenCalledTimes(1)
    disposed = true
    await vi.advanceTimersByTimeAsync(10_000)
    expect(captureScreen).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
  })
})
