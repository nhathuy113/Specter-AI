import type { ChildProcessByStdio } from 'child_process'
import type { Readable } from 'stream'

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

export function runPngCapture(launch: () => ChildProcessByStdio<null, Readable, Readable>, timeoutMs = 20_000): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let child: ChildProcessByStdio<null, Readable, Readable>
    try { child = launch() } catch (error) { reject(error); return }
    const chunks: Buffer[] = []
    let size = 0, errors = '', finished = false
    const finish = (error?: Error, png?: Buffer) => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      if (error) { child.kill(); reject(error) }
      else resolve(png!)
    }
    const timer = setTimeout(() => finish(new Error('Screen capture timed out')), timeoutMs)
    child.stdout.on('data', (chunk: Buffer) => {
      if (finished) return
      size += chunk.length
      if (size > 64 * 1024 * 1024) { finish(new Error('Screen capture exceeded 64MB')); return }
      chunks.push(chunk)
    })
    child.stderr.on('data', chunk => { errors = (errors + String(chunk)).slice(-2000) })
    child.on('error', error => finish(error))
    child.on('close', code => {
      if (finished) return
      if (code !== 0) { finish(new Error(errors.trim() || `Screen capture exited with code ${code}`)); return }
      const png = Buffer.concat(chunks)
      if (!png.subarray(0, 8).equals(PNG_SIGNATURE)) { finish(new Error('Screen capture returned an invalid PNG')); return }
      finish(undefined, png)
    })
  })
}
