import type { ChildProcessWithoutNullStreams } from 'child_process'

/** A subprocess protocol adapter with bounded output and a single terminal outcome. */
export function runJsonProcess(
  launch: () => ChildProcessWithoutNullStreams,
  payload: string,
  signal: AbortSignal,
  timeoutMs = 120_000
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new Error('DeepSeek request cancelled')); return }
    let proc: ChildProcessWithoutNullStreams
    try { proc = launch() } catch (error) { reject(error); return }
    let output = '', errors = '', finished = false
    const finish = (error?: Error, text?: string) => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      signal.removeEventListener('abort', cancel)
      if (error) { proc.kill(); reject(error) }
      else resolve(text!)
    }
    const cancel = () => finish(new Error('DeepSeek request cancelled'))
    const timer = setTimeout(() => finish(new Error('DeepSeek request timed out')), timeoutMs)
    signal.addEventListener('abort', cancel, { once: true })
    proc.stdout.on('data', chunk => {
      if (finished) return
      output += String(chunk)
      if (output.length > 16 * 1024 * 1024) finish(new Error('DeepSeek output exceeded limit'))
    })
    proc.stderr.on('data', chunk => { errors = (errors + String(chunk)).slice(-2000) })
    proc.on('error', error => finish(error))
    proc.stdin.on('error', error => finish(error))
    proc.on('close', code => {
      if (finished) return
      try {
        const line = output.trim().split('\n').filter(line => line.trim().startsWith('{')).pop()
        if (!line) throw new Error(errors.trim() || `DeepSeek exited without a reply (${code})`)
        const result: unknown = JSON.parse(line)
        if (!result || typeof result !== 'object') throw new Error('Invalid DeepSeek response')
        if ('error' in result && typeof result.error === 'string') throw new Error(result.error)
        if (code !== 0) throw new Error(errors.trim() || `DeepSeek exited with code ${code}`)
        if (!('text' in result) || typeof result.text !== 'string' || !result.text.trim()) throw new Error('DeepSeek returned an empty reply')
        finish(undefined, result.text.trim())
      } catch (error) {
        finish(error instanceof Error ? error : new Error(String(error)))
      }
    })
    try { proc.stdin.end(payload) } catch (error) { finish(error instanceof Error ? error : new Error(String(error))) }
  })
}
