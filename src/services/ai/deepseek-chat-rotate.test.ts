import { describe, expect, it, vi } from 'vitest'
import { createDeepseekChatRotate, msUntilNextLocalDay, readRotateResult } from './deepseek-chat-rotate'

describe('deepseek chat rotate policy', () => {
  it('reads clearedActive from the worker json line', () => {
    expect(readRotateResult('')).toEqual({ clearedActive: false })
    expect(readRotateResult('{"deleted":[],"clearedActive":false}\n')).toEqual({ clearedActive: false })
    expect(readRotateResult('noise\n{"deleted":["x"],"clearedActive":true}\n')).toEqual({ clearedActive: true })
  })

  it('waits until the next local midnight', () => {
    const now = new Date(2026, 9, 5, 17, 10, 0)
    expect(msUntilNextLocalDay(now)).toBe(new Date(2026, 9, 6).getTime() - now.getTime())
  })

  it('opens home only when the active chat was cleared', async () => {
    const openHome = vi.fn()
    const logs: string[] = []
    const rotate = createDeepseekChatRotate({
      runWorker: async () => ({ code: 0, stdout: '{"clearedActive":true}', stderr: '' }),
      openHome,
      log: (line) => logs.push(line),
      now: () => new Date(2026, 9, 5, 17, 0, 0),
      schedule: () => {}
    })
    rotate.sync()
    await vi.waitFor(() => expect(openHome).toHaveBeenCalledOnce())
    expect(logs.some(line => line.includes('"clearedActive":true'))).toBe(true)
  })
})
