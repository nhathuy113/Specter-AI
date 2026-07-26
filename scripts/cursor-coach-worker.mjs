#!/usr/bin/env node
/**
 * Cursor coach worker — runs outside Electron (node:sqlite works in plain Node).
 * Usage: node scripts/cursor-coach-worker.mjs /path/to/payload.json
 */
import { readFileSync, unlinkSync } from 'fs'
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Agent, CursorAgentError } from '@cursor/sdk'
import { mkdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
config({ path: join(root, '.env') })

async function main() {
  const payloadPath = process.argv[2]
  if (!payloadPath) {
    console.log(JSON.stringify({ error: 'Missing payload path' }))
    process.exit(1)
  }

  let payload
  try {
    payload = JSON.parse(readFileSync(payloadPath, 'utf8'))
  } catch (err) {
    console.log(JSON.stringify({ error: `Invalid payload: ${err.message}` }))
    process.exit(1)
  } finally {
    try {
      unlinkSync(payloadPath)
    } catch {
      /* ignore */
    }
  }

  const apiKey = payload.apiKey || process.env.CURSOR_API_KEY?.trim()
  if (!apiKey) {
    console.log(JSON.stringify({ error: 'Missing CURSOR_API_KEY' }))
    process.exit(1)
  }

  const workDir = join(tmpdir(), `specter-coach-cursor-${Date.now()}`)
  mkdirSync(workDir, { recursive: true })

  const model = process.env.CURSOR_MODEL?.trim() || 'auto'
  const userMessage = payload.userMessage

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
        console.log(JSON.stringify({ error: result.error?.message ?? `Cursor run failed (${result.id})` }))
        process.exit(2)
      }

      console.log(JSON.stringify({ result: (result.result ?? '').trim() }))
    } finally {
      if (typeof agent[Symbol.asyncDispose] === 'function') {
        await agent[Symbol.asyncDispose]()
      } else {
        agent.close()
      }
    }
  } catch (err) {
    const msg =
      err instanceof CursorAgentError
        ? `Cursor SDK: ${err.message}`
        : err instanceof Error
          ? err.message
          : 'Cursor worker failed'
    console.log(JSON.stringify({ error: msg }))
    process.exit(1)
  } finally {
    if (process.env.SPECTER_KEEP_CURSOR_WORKDIR !== '1') {
      rmSync(workDir, { recursive: true, force: true })
    }
  }
}

main()
