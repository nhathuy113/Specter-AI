import type { WebContents } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc-channels'
import { WORK_COACH_GEMINI_36, WORK_COACH_GEMINI_LITE, WORK_COACH_TRIPLE_LABELS } from '../shared/constants'
import {
  streamGeminiCompletion,
  streamGeminiVisionCompletion,
  type GeminiMessage,
  type GeminiStreamCallbacks
} from './gemini-api'

export interface WorkCoachRunResult {
  completionContent: string
  modelLabel: string
  /** Primary panel for snippet / session tracking (Gemini Lite). */
  primaryPanelContent: string
}

async function runGeminiCoach(
  messages: GeminiMessage[],
  model: string,
  apiKey: string,
  useVision: boolean,
  screenScreenshot: string | undefined,
  callbacks: GeminiStreamCallbacks,
  maxTokens: number
): Promise<string> {
  let content = ''
  const wrapped: GeminiStreamCallbacks = {
    onChunk: (chunk) => {
      content += chunk
      callbacks.onChunk(chunk)
    },
    onDone: callbacks.onDone,
    onError: callbacks.onError
  }

  if (useVision && screenScreenshot) {
    await streamGeminiVisionCompletion(messages, model, apiKey, screenScreenshot, wrapped, maxTokens)
  } else {
    await streamGeminiCompletion(messages, model, apiKey, wrapped, maxTokens)
  }

  return content
}

function combineDualPanels(panels: string[]): string {
  return WORK_COACH_TRIPLE_LABELS.map((label, i) => `## ${label}\n\n${panels[i] || '_(no response)_'}`).join(
    '\n\n---\n\n'
  )
}

/** Work coach expand — Gemini Lite + 3.6 Flash in parallel, one column each. */
export async function runWorkCoachEscalation(deps: {
  geminiApiKey: string
  useVision: boolean
  screenScreenshot?: string
  messages: GeminiMessage[]
  event: WebContents
}): Promise<WorkCoachRunResult> {
  const { messages, geminiApiKey, useVision, screenScreenshot, event } = deps
  const panelCount = WORK_COACH_TRIPLE_LABELS.length

  if (!event.isDestroyed()) {
    event.send(IPC_CHANNELS.AI_COACH_TRIPLE_START, { labels: [...WORK_COACH_TRIPLE_LABELS] })
  }

  const panels: string[] = Array.from({ length: panelCount }, () => '')

  const updatePanel = (index: number, content: string, done: boolean) => {
    panels[index] = content
    if (!event.isDestroyed()) {
      event.send(IPC_CHANNELS.AI_COACH_TRIPLE_PANEL, { index, content: panels[index], done })
    }
  }

  const tasks = [
    runGeminiCoach(
      messages,
      WORK_COACH_GEMINI_LITE,
      geminiApiKey,
      useVision,
      screenScreenshot,
      {
        onChunk: (c) => {
          panels[0] += c
          updatePanel(0, panels[0], false)
        },
        onDone: () => updatePanel(0, panels[0], true),
        onError: (e) => updatePanel(0, `⚠ ${e}`, true)
      },
      2000
    ).catch((e) => {
      const msg = e instanceof Error ? e.message : 'Gemini Lite failed'
      updatePanel(0, `⚠ ${msg}`, true)
      return ''
    }),
    runGeminiCoach(
      messages,
      WORK_COACH_GEMINI_36,
      geminiApiKey,
      useVision,
      screenScreenshot,
      {
        onChunk: (c) => {
          panels[1] += c
          updatePanel(1, panels[1], false)
        },
        onDone: () => updatePanel(1, panels[1], true),
        onError: (e) => updatePanel(1, `⚠ ${e}`, true)
      },
      2000
    ).catch((e) => {
      const msg = e instanceof Error ? e.message : 'Gemini 3.6 failed'
      updatePanel(1, `⚠ ${msg}`, true)
      return ''
    })
  ]

  await Promise.all(tasks)

  const combined = combineDualPanels(panels)
  if (!event.isDestroyed()) {
    event.send(IPC_CHANNELS.AI_COACH_TRIPLE_DONE, { model: 'work-coach/dual' })
  }

  return {
    completionContent: combined,
    modelLabel: 'work-coach/dual',
    primaryPanelContent: panels[0]
  }
}
