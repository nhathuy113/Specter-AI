import type { ChildProcessWithoutNullStreams } from 'child_process'

type Pending = {
  resolve: (text: string) => void
  reject: (error: Error) => void
}

/** One Cloak process for the life of the app. Prompts are lines; the browser is not restarted per prompt. */
export function createDeepseekBrowser(launch: () => ChildProcessWithoutNullStreams) {
  let proc: ChildProcessWithoutNullStreams | null = null
  let buffer = ''
  let pending: Pending | null = null

  function failPending(error: Error) {
    const current = pending
    pending = null
    current?.reject(error)
  }

  function handleLine(line: string) {
    if (!line.startsWith('{')) return
    let parsed: { text?: unknown; error?: unknown; ready?: unknown }
    try { parsed = JSON.parse(line) as typeof parsed } catch {
      failPending(new Error('Invalid DeepSeek response'))
      return
    }
    if (parsed.ready === true) return
    const current = pending
    pending = null
    if (!current) return
    if (typeof parsed.error === 'string') current.reject(new Error(parsed.error))
    else if (typeof parsed.text === 'string' && parsed.text.trim()) current.resolve(parsed.text.trim())
    else current.reject(new Error('DeepSeek returned an empty reply'))
  }

  function attach(child: ChildProcessWithoutNullStreams) {
    child.stdout.on('data', (chunk: Buffer | string) => {
      buffer += String(chunk)
      let nl = buffer.indexOf('\n')
      while (nl >= 0) {
        const line = buffer.slice(0, nl).trim()
        buffer = buffer.slice(nl + 1)
        if (line) handleLine(line)
        nl = buffer.indexOf('\n')
      }
    })
    child.on('close', () => {
      if (proc === child) proc = null
      failPending(new Error('DeepSeek browser closed'))
    })
  }

  function alive() {
    return !!proc && proc.exitCode == null && !proc.killed
  }

  return {
    start() {
      if (alive()) return
      buffer = ''
      proc = launch()
      attach(proc)
    },
    stop() {
      if (!proc) return
      const child = proc
      try { child.stdin.write('{"cmd":"quit"}\n') } catch { /* process already closing */ }
      child.kill()
    },
    ask(payload: string, signal: AbortSignal): Promise<string> {
      if (signal.aborted) return Promise.reject(new Error('DeepSeek request cancelled'))
      this.start()
      if (!proc) return Promise.reject(new Error('DeepSeek browser is not running'))
      if (pending) return Promise.reject(new Error('DeepSeek browser is busy'))
      return new Promise((resolve, reject) => {
        let settled = false
        const settle = (error?: Error, text?: string) => {
          if (settled) return
          settled = true
          pending = null
          if (error) reject(error)
          else resolve(text!)
        }
        pending = {
          resolve: (text) => settle(undefined, text),
          reject: (error) => settle(error)
        }
        try { proc!.stdin.write(`${payload}\n`) } catch (error) {
          settle(error instanceof Error ? error : new Error(String(error)))
        }
      })
    }
  }
}
