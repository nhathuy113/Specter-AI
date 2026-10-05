import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { createDeepseekSession } from './deepseek-session'
import { runJsonProcess } from './json-process'

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

const session = createDeepseekSession((payload, signal) => runJsonProcess(
  () => spawn('uv', ['run', '--with', 'cloakbrowser', 'python', scriptPath()], { stdio: ['pipe', 'pipe', 'pipe'] }),
  payload, signal
))
export const streamDeepseekCloak = session.stream
export const cancelDeepseekCloak = session.cancel
