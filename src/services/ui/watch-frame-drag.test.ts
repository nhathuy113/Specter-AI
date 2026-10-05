import { describe, expect, it, vi } from 'vitest'
import { createWatchFrameDrag } from './watch-frame-drag'
const bounds = { x: 0, y: 0, width: 200, height: 100 }

describe('watch frame drag ownership', () => {
  it('ignores a late bounds response after mouse-up', async () => {
    let resolve!: (value: typeof bounds) => void
    const publish = vi.fn()
    const drag = createWatchFrameDrag(() => new Promise(ok => { resolve = ok }), publish)
    const start = drag.begin('move', { x: 10, y: 10 })
    drag.end()
    resolve(bounds)
    await start
    drag.move({ x: 30, y: 30 })
    expect(publish).not.toHaveBeenCalled()
  })

  it('uses the latest pointer position while the bounds lookup is pending', async () => {
    let resolve!: (value: typeof bounds) => void
    const publish = vi.fn()
    const drag = createWatchFrameDrag(() => new Promise(ok => { resolve = ok }), publish)
    const start = drag.begin('w', { x: 10, y: 10 })
    drag.move({ x: 30, y: 10 })
    resolve(bounds)
    await start
    expect(publish).toHaveBeenLastCalledWith({ x: 20, y: 0, width: 180, height: 100 })
  })

  it('a stale lookup failure cannot cancel the new drag', async () => {
    let reject!: (error: Error) => void
    const read = vi.fn().mockImplementationOnce(() => new Promise((_ok, fail) => { reject = fail })).mockResolvedValue(bounds)
    const publish = vi.fn()
    const drag = createWatchFrameDrag(read, publish)
    const old = drag.begin('move', { x: 0, y: 0 })
    await drag.begin('move', { x: 10, y: 10 })
    reject(new Error('late failure'))
    await old
    drag.move({ x: 20, y: 20 })
    expect(publish).toHaveBeenLastCalledWith({ ...bounds, x: 10, y: 10 })
  })
})
