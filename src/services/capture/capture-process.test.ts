import { EventEmitter } from 'events'
import type { ChildProcessByStdio } from 'child_process'
import type { Readable } from 'stream'
import { afterEach, expect, it, vi } from 'vitest'
import { runPngCapture } from './capture-process'
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
function fakeProcess() {
  const child = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter(), kill: vi.fn() })
  return { child, launch: () => child as unknown as ChildProcessByStdio<null, Readable, Readable> }
}
afterEach(() => vi.useRealTimers())

it('preserves valid PNG bytes and rejects failed/malformed captures', async () => {
  const { child, launch } = fakeProcess()
  const success = runPngCapture(launch)
  child.stdout.emit('data', signature)
  child.emit('close', 0)
  expect(await success).toEqual(signature)
  const malformed = runPngCapture(launch)
  child.stdout.emit('data', Buffer.from('diagnostic text'))
  child.emit('close', 0)
  await expect(malformed).rejects.toThrow('invalid PNG')
  const failed = runPngCapture(launch)
  child.stderr.emit('data', 'permission denied')
  child.emit('close', 1)
  await expect(failed).rejects.toThrow('permission denied')
})

it('kills stuck captures and clears deadlines without double settlement', async () => {
  vi.useFakeTimers()
  const { child, launch } = fakeProcess()
  const capture = runPngCapture(launch, 100)
  const assertion = expect(capture).rejects.toThrow('timed out')
  await vi.advanceTimersByTimeAsync(100)
  await assertion
  child.emit('error', new Error('late failure'))
  expect(child.kill).toHaveBeenCalledOnce()
  expect(vi.getTimerCount()).toBe(0)
})
