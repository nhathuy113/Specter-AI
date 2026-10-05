import { Agent, CursorAgentError } from '@cursor/sdk'
import { spawn } from 'child_process'
import { mkdirSync, rmSync, unlinkSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

export function getCursorApiKey(): string {
  return process.env.CURSOR_API_KEY?.trim() || ''
}

export function messagesToCursorCoachPrompt(
  messages: Array<{ role: string; content: string }>
): string {
  const system = messages.find((m) => m.role === 'system')?.content?.trim() ?? ''
  const userParts = messages.filter((m) => m.role === 'user').map((m) => m.content.trim())
  return [
    'TEXT ONLY — Vietnamese work coach copilot.',
    'Do NOT use tools, files, or shell. Do NOT output a full LeetCode solution.',
    'Follow the 6-section format in the user message (Trạng thái → … → Tại sao).',
    '',
    system,
    '',
    ...userParts
  ].join('\n')
}

export interface CursorCoachUserMessage {
  text: string
  images?: Array<{ data: string; mimeType: string }>
}

export function buildCursorCoachUserMessage(
  messages: Array<{ role: string; content: string }>
): CursorCoachUserMessage {
  return { text: messagesToCursorCoachPrompt(messages) }
}

export interface CompleteCursorWorkCoachOptions {
  useVision?: boolean
  screenScreenshot?: string
}

async function disposeAgent(agent: Awaited<ReturnType<typeof Agent.create>>): Promise<void> {
  if (typeof agent[Symbol.asyncDispose] === 'function') {
    await agent[Symbol.asyncDispose]()
    return
  }
  agent.close()
}

function isElectronMain(): boolean {
  return !!process.versions.electron
}

function resolveCursorWorkerScript(): string {
  return join(process.cwd(), 'scripts/cursor-coach-worker.mjs')
}

/** Electron lacks node:sqlite — run Cursor SDK in plain Node subprocess. */
async function completeCursorWorkCoachSubprocess(
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const userMessage = buildCursorCoachUserMessage(messages)
  const payloadPath = join(tmpdir(), `specter-cursor-payload-${Date.now()}.json`)
  writeFileSync(
    payloadPath,
    JSON.stringify({
      apiKey: getCursorApiKey(),
      userMessage
    })
  )

  const workerScript = resolveCursorWorkerScript()

  return new Promise((resolve, reject) => {
    const child = spawn('node', [workerScript, payloadPath], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on('error', (err) => {
      try {
        unlinkSync(payloadPath)
      } catch {
        /* ignore */
      }
      reject(new Error(`Cursor worker failed to start: ${err.message}`))
    })
    child.on('close', (code) => {
      try {
        unlinkSync(payloadPath)
      } catch {
        /* ignore */
      }

      const line = stdout.trim().split('\n').pop() ?? ''
      try {
        const parsed = JSON.parse(line) as { result?: string; error?: string }
        if (parsed.error) {
          reject(new Error(parsed.error))
          return
        }
        resolve(parsed.result ?? '')
        return
      } catch {
        /* fall through */
      }

      if (code !== 0) {
        reject(new Error(stderr.trim() || `Cursor worker exited with code ${code}`))
        return
      }
      reject(new Error('Cursor worker returned invalid response'))
    })
  })
}

async function completeCursorWorkCoachInProcess(
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const apiKey = getCursorApiKey()
  if (!apiKey) {
    throw new Error('Missing CURSOR_API_KEY — add it in .env for Cursor coach escalation.')
  }

  const workDir = join(tmpdir(), `specter-coach-cursor-${Date.now()}`)
  mkdirSync(workDir, { recursive: true })

  const model = process.env.CURSOR_MODEL?.trim() || 'auto'
  const userMessage = buildCursorCoachUserMessage(messages)

  try {
    const agent = await Agent.create({
      apiKey,
      model: { id: model },
      local: { cwd: workDir, settingSources: [] }
    })

    try {
      const run = await agent.send(userMessage)
      const result = await run.wait()

      if (result.status === 'error') {
        throw new Error(result.error?.message ?? `Cursor run failed (${result.id})`)
      }

      return (result.result ?? '').trim()
    } finally {
      await disposeAgent(agent)
    }
  } catch (err) {
    if (err instanceof CursorAgentError) {
      throw new Error(`Cursor SDK: ${err.message}`)
    }
    throw err
  } finally {
    if (process.env.SPECTER_KEEP_CURSOR_WORKDIR !== '1') {
      rmSync(workDir, { recursive: true, force: true })
    }
  }
}

/** Cursor SDK reply for work coach column 3 (coding only). Text-only for speed. */
export async function completeCursorWorkCoach(
  messages: Array<{ role: string; content: string }>,
  _options?: CompleteCursorWorkCoachOptions
): Promise<string> {
  const apiKey = getCursorApiKey()
  if (!apiKey) {
    throw new Error('Missing CURSOR_API_KEY — add it in .env for Cursor coach escalation.')
  }

  if (isElectronMain()) {
    return completeCursorWorkCoachSubprocess(messages)
  }

  return completeCursorWorkCoachInProcess(messages)
}
