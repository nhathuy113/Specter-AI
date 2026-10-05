import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { createDeepseekChatRotate } from '../services/ai/deepseek-chat-rotate'
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

function runWorker() {
  const script = scriptPath()
  console.info(`[Specter] DeepSeek chat rotate worker start ${script}`)
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn('python3', [path.basename(script)], { cwd: path.dirname(script) })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer | string) => { stdout += String(chunk) })
    child.stderr.on('data', (chunk: Buffer | string) => { stderr += String(chunk) })
    child.on('close', (code) => resolve({ code, stdout, stderr }))
  })
}

const rotate = createDeepseekChatRotate({
  runWorker,
  openHome: openDeepseekHome,
  log: (line) => console.info(line),
  now: () => new Date(),
  schedule(delayMs, tick) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(tick, delayMs)
  }
})

export function syncDeepseekChatRotate(): void {
  rotate.sync()
}
