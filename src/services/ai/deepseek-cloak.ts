import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import fs from 'fs'
import path from 'path'
import { cloakDeepseekProfileReady } from './completion-route'
import { createDeepseekBrowser } from './deepseek-browser'
import { createDeepseekSession } from './deepseek-session'

function scriptPath(): string {
  const candidates = [
    ...(process.resourcesPath ? [path.join(process.resourcesPath, 'deepseek_cloak_chat.py')] : []),
    path.join(process.cwd(), 'scripts', 'deepseek_cloak_chat.py'),
    path.resolve(__dirname, '../../scripts/deepseek_cloak_chat.py')
  ]
  const found = candidates.find(item => fs.existsSync(item))
  if (!found) throw new Error('scripts/deepseek_cloak_chat.py is missing')
  return found
}

const browser = createDeepseekBrowser(() => spawn(
  'uv',
  ['run', '--with', 'cloakbrowser', 'python', scriptPath()],
  { stdio: ['pipe', 'pipe', 'pipe'] }
) as ChildProcessWithoutNullStreams)

export function startDeepseekCloak(): void {
  if (!cloakDeepseekProfileReady()) return
  browser.start()
}

export function stopDeepseekCloak(): void {
  browser.stop()
}

export function resetDeepseekChat(): void {
  console.info('[Specter] DeepSeek new chat requested')
  browser.newChat()
}

export function openDeepseekHome(): void {
  console.info('[Specter] DeepSeek opening home')
  browser.home()
}

const session = createDeepseekSession((payload, signal) => browser.ask(payload, signal))
export const streamDeepseekCloak = session.stream
export const cancelDeepseekCloak = session.cancel
