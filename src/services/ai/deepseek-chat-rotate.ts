export interface RotateWorkerResult {
  code: number | null
  stdout: string
  stderr: string
}

export interface DeepseekChatRotatePorts {
  runWorker(): Promise<RotateWorkerResult>
  openHome(): void
  log(line: string): void
  now(): Date
  schedule(delayMs: number, tick: () => void): void
}

export function msUntilNextLocalDay(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return Math.max(1000, next.getTime() - now.getTime())
}

export function readRotateResult(stdout: string): { clearedActive: boolean } {
  const lines = stdout.trim().split('\n')
  let line = ''
  for (const item of lines) {
    if (item.startsWith('{')) line = item
  }
  if (!line) return { clearedActive: false }
  const parsed = JSON.parse(line) as { clearedActive?: unknown }
  return { clearedActive: parsed.clearedActive === true }
}

/** Daily rotate policy. IO and the browser stay behind ports. */
export function createDeepseekChatRotate(ports: DeepseekChatRotatePorts) {
  async function runOnce(): Promise<void> {
    const result = await ports.runWorker()
    const clearedActive = readRotateResult(result.stdout).clearedActive
    ports.log('AGENT_LOOP_WAKE_deepseek_chat_rotate ' + JSON.stringify({
      code: result.code,
      clearedActive,
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim()
    }))
    if (clearedActive) ports.openHome()
  }

  function arm(): void {
    const delayMs = msUntilNextLocalDay(ports.now())
    ports.log(`[Specter] DeepSeek chat rotate next run in ${Math.round(delayMs / 1000)}s`)
    ports.schedule(delayMs, () => {
      void runOnce()
      arm()
    })
  }

  return {
    sync(): void {
      void runOnce()
      arm()
    }
  }
}
