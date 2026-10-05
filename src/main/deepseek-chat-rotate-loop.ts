import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { openDeepseekHome } from '../services/ai/deepseek-cloak'

let timer: ReturnType<typeof setTimeout> | null = null

function scriptPath(): string {
  const candidates = [
    ...(process.resourcesPath ? [path.join(process.resourcesPath, 'deepseek_chat_rotate.py')] : []),
    path.join(process.cwd(), 'scripts', 'deepseek_chat_rotate.py'),
    path.resolve(__dirname, '../../scripts/deepseek_chat_rotate.py')
  ]
  const found = candidates.find(item => fs.existsSync(item))
  if (!found) throw new Error('scripts/deepseek_chat_rotate.py is missing')
  return found
}

function msUntilNextLocalDay(): number {
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return Math.max(1000, next.getTime() - now.getTime())
}

function runRotateWorker(): void {
  const script = scriptPath()
  console.info(`[Specter] DeepSeek chat rotate worker start ${script}`)
  const child = spawn('python3', [path.basename(script)], { cwd: path.dirname(script) })
  let out = ''
  let err = ''
  child.stdout.on('data', (chunk: Buffer | string) => { out += String(chunk) })
  child.stderr.on('data', (chunk: Buffer | string) => { err += String(chunk) })
  child.on('close', (code) => {
    const clearedActive = out.includes('"clearedActive": true') || out.includes('"clearedActive":true')
    console.info('AGENT_LOOP_WAKE_deepseek_chat_rotate ' + JSON.stringify({
      code,
      clearedActive,
      stdout: out.trim(),
      stderr: err.trim()
    }))
    if (clearedActive) openDeepseekHome()
  })
}

function scheduleNextDay(): void {
  const delayMs = msUntilNextLocalDay()
  console.info(`[Specter] DeepSeek chat rotate next run in ${Math.round(delayMs / 1000)}s`)
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    runRotateWorker()
    scheduleNextDay()
  }, delayMs)
}

export function syncDeepseekChatRotate(): void {
  runRotateWorker()
  scheduleNextDay()
}
