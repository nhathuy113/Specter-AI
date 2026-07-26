import { config as loadEnv } from 'dotenv'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { IPC_CHANNELS } from '../shared/ipc-channels'
import { resolveAssistantRequest } from '../services/context-router'
import { runWorkCoachQuizVision } from '../services/work-coach-runner'
import { buildCoachSystemPrompt } from '../services/coach-prompt'

loadEnv({ path: resolve(__dirname, '../../.env') })

const FIXTURE = resolve(__dirname, 'fixtures/iq-quiz.png')
const apiKey = process.env.GEMINI_API_KEY?.trim()
const canRun = !!apiKey && existsSync(FIXTURE)

describe.skipIf(!canRun)('work coach live e2e (Gemini + fixture)', () => {
  it('IQ quiz fixture → Gemini Lite → panel contains Vietnamese answer', async () => {
    const screenshot = readFileSync(FIXTURE).toString('base64')
    const fingerprintText =
      '123test.com\nQuestion 1 of 8\nWhich figure belongs in the empty box?'
    const metadata = { appName: 'Google Chrome', windowTitle: '123test.com' }

    const req = resolveAssistantRequest(fingerprintText, 'work', metadata)
    expect(req.workProblem?.kind).toBe('visual-quiz')

    const sent: Array<{ channel: string; payload: unknown }> = []
    const event = {
      isDestroyed: () => false,
      send: (channel: string, payload: unknown) => {
        sent.push({ channel, payload })
      }
    }

    const result = await runWorkCoachQuizVision({
      messages: [
        { role: 'system', content: buildCoachSystemPrompt() },
        { role: 'user', content: req.userMessage }
      ],
      geminiApiKey: apiKey!,
      screenScreenshot: screenshot,
      event: event as never,
      sessionKey: 'live-quiz-fixture'
    })

    expect(sent.some((s) => s.channel === IPC_CHANNELS.AI_COACH_TRIPLE_PANEL)).toBe(true)
    expect(result.primaryPanelContent.length).toBeGreaterThan(20)
    expect(/\*\*Đáp án:\*\*|đáp án/i.test(result.primaryPanelContent)).toBe(true)
    expect(sent.some((s) => s.channel === IPC_CHANNELS.AI_STREAM_CHUNK)).toBe(false)
  }, 45_000)
})
