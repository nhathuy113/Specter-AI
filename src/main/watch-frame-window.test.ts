import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC_CHANNELS } from '../shared/ipc-channels'

const native = vi.hoisted(() => ({
  settings: {} as Record<string, unknown>,
  windows: [] as { emit: (event: string) => void; webContents: unknown; setBounds: ReturnType<typeof vi.fn>; showInactive: ReturnType<typeof vi.fn>; isDestroyed: () => boolean; getBounds: () => { x: number; y: number; width: number; height: number } }[],
  set: vi.fn(), on: vi.fn(), handle: vi.fn(), quit: vi.fn()
}))
vi.mock('../services/settings/store', () => ({
  getSetting: (key: string) => native.settings[key],
  setSetting: (key: string, value: unknown) => { native.settings[key] = value; native.set(key, value) }
}))
vi.mock('./capture-exclusion', () => ({ captureExclusion: { protect: vi.fn() } }))
vi.mock('electron', async () => {
  const { EventEmitter } = await import('events')
  class Window extends EventEmitter {
    bounds: { x: number; y: number; width: number; height: number }
    destroyed = false
    visible = false
    webContents = new EventEmitter()
    setBounds = vi.fn((bounds: typeof this.bounds) => { this.bounds = bounds })
    showInactive = vi.fn(() => { this.visible = true })
    setIgnoreMouseEvents = vi.fn()
    setAlwaysOnTop = vi.fn()
    setVisibleOnAllWorkspaces = vi.fn()
    setContentProtection = vi.fn()
    loadFile = vi.fn().mockResolvedValue(undefined)
    loadURL = vi.fn().mockResolvedValue(undefined)
    constructor(bounds: { x: number; y: number; width: number; height: number }) { super(); this.bounds = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }; native.windows.push(this) }
    getBounds() { return { ...this.bounds } }
    isDestroyed() { return this.destroyed }
    isVisible() { return this.visible }
    hide() { this.visible = false }
    close() { this.destroyed = true; this.emit('closed') }
  }
  const display = { id: 42, workArea: { x: -1000, y: 0, width: 1000, height: 800 } }
  return { BrowserWindow: Window, ipcMain: { on: native.on, handle: native.handle }, app: { once: native.quit },
    screen: { getAllDisplays: () => [display], getPrimaryDisplay: () => display, getDisplayMatching: () => display, getCursorScreenPoint: () => ({ x: 0, y: 0 }) } }
})

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.useFakeTimers()
  native.windows = []
  native.settings = { fullAutoMode: true, continuousCoach: false, watchFrame: { x: 0, y: 0, width: 0, height: 0 } }
})
afterEach(() => vi.useRealTimers())
function handler(channel: string) { return native.on.mock.calls.find(([name]) => name === channel)![1] }

describe('watch frame lifecycle and IPC', () => {
  it('shows only after ready-to-show and suppresses callbacks from closed generations', async () => {
    const { syncWatchFrame } = await import('./watch-frame-window')
    syncWatchFrame()
    const first = native.windows[0]
    expect(first.showInactive).not.toHaveBeenCalled()
    native.settings.fullAutoMode = false
    syncWatchFrame()
    native.settings.fullAutoMode = true
    syncWatchFrame()
    first.emit('ready-to-show')
    expect(native.windows[1].showInactive).not.toHaveBeenCalled()
    native.windows[1].emit('ready-to-show')
    expect(native.windows[1].showInactive).toHaveBeenCalledOnce()
    native.settings.fullAutoMode = false
    syncWatchFrame()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('restricts frame mutation to its own renderer, clamps bounds and batches persistence', async () => {
    const { syncWatchFrame, registerWatchFrameIpc } = await import('./watch-frame-window')
    registerWatchFrameIpc()
    registerWatchFrameIpc()
    expect(native.handle).toHaveBeenCalledOnce()
    syncWatchFrame()
    const frame = native.windows[0]
    native.set.mockClear()
    const update = handler(IPC_CHANNELS.WATCH_FRAME_SET)
    update({ sender: {} }, { x: 0, y: 0, width: 800, height: 500 })
    expect(frame.setBounds).not.toHaveBeenCalled()
    update({ sender: frame.webContents }, { x: -9999, y: 0, width: 800, height: 500 })
    update({ sender: frame.webContents }, { x: -9999, y: 20, width: 800, height: 500 })
    expect(frame.getBounds()).toEqual({ x: -980, y: 20, width: 800, height: 500 })
    expect(native.set).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(150)
    expect(native.set).toHaveBeenCalledOnce()
    expect(native.set).toHaveBeenCalledWith('watchFrame', frame.getBounds())
    native.settings.fullAutoMode = false
    syncWatchFrame()
    expect(vi.getTimerCount()).toBe(0)
  })
})

it('keeps the frame visible during capture and does not restore it after Auto is disabled', async () => {
  const { syncWatchFrame, suspendWatchFrameForCapture } = await import('./watch-frame-window')
  syncWatchFrame()
  const frame = native.windows[0]
  frame.emit('ready-to-show')
  const capture = suspendWatchFrameForCapture()
  expect(capture.hidden).toBe(false)
  capture.restore()
  expect(frame.showInactive).toHaveBeenCalledTimes(1)
  const next = suspendWatchFrameForCapture()
  native.settings.fullAutoMode = false
  syncWatchFrame()
  next.restore()
  expect(frame.isDestroyed()).toBe(true)
  expect(frame.showInactive).toHaveBeenCalledTimes(1)
})
