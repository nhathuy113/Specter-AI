import { EventEmitter } from 'events'
import type { ChildProcessWithoutNullStreams } from 'child_process'
import { describe, expect, it, vi } from 'vitest'
import { createDeepseekBrowser } from './deepseek-browser'

function fakeProcess() {
  const proc = Object.assign(new EventEmitter(), {
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    stdin: Object.assign(new EventEmitter(), { write: vi.fn() }),
    kill: vi.fn(),
    killed: false,
    exitCode: null as number | null
  })
  return proc
}

describe('persistent DeepSeek browser', () => {
  it('launches once and keeps the process open across prompts', async () => {
    const first = fakeProcess()
    const launch = vi.fn(() => first as unknown as ChildProcessWithoutNullStreams)
    const browser = createDeepseekBrowser(launch)
    browser.start()
    const a = browser.ask('{"prompt":"one"}', new AbortController().signal)
    first.stdout.emit('data', '{"ready":true}\n')
    first.stdout.emit('data', '{"text":"mot"}\n')
    await expect(a).resolves.toBe('mot')
    const b = browser.ask('{"prompt":"two"}', new AbortController().signal)
    first.stdout.emit('data', '{"text":"hai"}\n')
    await expect(b).resolves.toBe('hai')
    expect(launch).toHaveBeenCalledOnce()
    expect(first.kill).not.toHaveBeenCalled()
    expect(first.stdin.write).toHaveBeenCalledWith('{"prompt":"one"}\n')
    expect(first.stdin.write).toHaveBeenCalledWith('{"prompt":"two"}\n')
  })

  it('closes the browser only when stopped', () => {
    const proc = fakeProcess()
    const browser = createDeepseekBrowser(() => proc as unknown as ChildProcessWithoutNullStreams)
    browser.start()
    browser.stop()
    expect(proc.stdin.write).toHaveBeenCalledWith('{"cmd":"quit"}\n')
    expect(proc.kill).toHaveBeenCalledOnce()
  })
})
