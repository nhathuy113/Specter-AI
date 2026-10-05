import { describe, expect, it, vi } from 'vitest'
import { runWhenCaptureFree } from './capture-slot'

describe('runWhenCaptureFree', () => {
  it('waits until the current capture finishes', async () => {
    let busy = true
    const run = vi.fn(async () => 'shot')
    const wait = vi.fn(async () => { busy = false })
    await expect(runWhenCaptureFree(() => busy, run, wait)).resolves.toBe('shot')
    expect(run).toHaveBeenCalledOnce()
  })

  it('retries when the lock is taken between the check and the capture', async () => {
    const run = vi.fn()
      .mockRejectedValueOnce(new Error('Screen capture already in progress'))
      .mockResolvedValueOnce('shot')
    const wait = vi.fn(async () => {})
    await expect(runWhenCaptureFree(() => false, run, wait)).resolves.toBe('shot')
    expect(run).toHaveBeenCalledTimes(2)
  })
})
