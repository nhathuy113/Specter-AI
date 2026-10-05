import type { ScreenCaptureResult } from '../shared/types'

export interface AutoCaptureDependencies {
  captureScreen(): Promise<ScreenCaptureResult>
  readConfig(): { enabled: boolean; intervalSec: number }
  isDisposed(): boolean
  publish(update: { text: string; timestamp: number }): void
  onError(error: unknown): void
  now?: () => number
}

export function createAutoCaptureLoop(deps: AutoCaptureDependencies) {
  let timer: ReturnType<typeof setInterval> | undefined
  let generation = 0
  let lastText = ''
  let capturing = false

  function stop(): void {
    if (timer !== undefined) clearInterval(timer)
    timer = undefined
    generation++
    lastText = ''
  }

  function sync(): void {
    stop()
    const config = deps.readConfig()
    if (!config.enabled || deps.isDisposed()) return
    const intervalSec = Number.isFinite(config.intervalSec)
      ? Math.max(5, Math.min(300, config.intervalSec)) : 5
    const current = generation
    timer = setInterval(async () => {
      if (deps.isDisposed()) { stop(); return }
      if (capturing) return
      capturing = true
      try {
        const capture = await deps.captureScreen()
        if (current !== generation || deps.isDisposed()) return
        if (capture.text && capture.text !== lastText) {
          lastText = capture.text
          deps.publish({ text: capture.text, timestamp: (deps.now ?? Date.now)() })
        }
      } catch (error) {
        if (current === generation) deps.onError(error)
      } finally {
        capturing = false
      }
    }, intervalSec * 1000)
  }
  return { sync, stop }
}
