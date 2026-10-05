import type { WebContents } from 'electron'
import type { ScreenMetadata } from '../../shared/types'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import {
  WORK_COACH_GEMINI_36,
  WORK_COACH_GEMINI_LITE,
  WORK_COACH_GEMINI_LABELS,
  WORK_COACH_QUIZ_DEEP_WAITING_VI,
  WORK_COACH_QUIZ_LITE_PENDING_VI,
  resolveWorkCoachPanelLabels
} from '../../shared/constants'
import {
  streamGeminiCompletion,
  streamGeminiVisionCompletion,
  type GeminiMessage,
  type GeminiStreamCallbacks
} from '../ai/gemini-api'
import { completeCursorWorkCoach } from './work-coach-cursor'
import { saveWorkCoachCursorReply } from './work-coach-session'
import { scheduleQuizDeepExplain, beginQuizLiteSession } from './work-coach-quiz-escalation'

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

function combinePanels(labels: string[], panels: string[]): string {
  return labels.map((label, i) => `## ${label}\n\n${panels[i] || '_(no response)_'}`).join('\n\n---\n\n')
}

/** Work coach expand — Gemini Lite + 3.6; Cursor SDK only for coding problems. */
export async function runWorkCoachEscalation(deps: {
  geminiApiKey: string
  useVision: boolean
  includeCursor: boolean
  screenScreenshot?: string
  screenText?: string
  screenMetadata?: ScreenMetadata
  messages: GeminiMessage[]
  event: WebContents
}): Promise<WorkCoachRunResult> {
  const {
    messages,
    geminiApiKey,
    useVision,
    includeCursor,
    screenScreenshot,
    screenText,
    screenMetadata,
    event
  } = deps
  const labels = resolveWorkCoachPanelLabels(includeCursor)
  const plainMessages = messages as Array<{ role: string; content: string }>

  if (!event.isDestroyed()) {
    event.send(IPC_CHANNELS.AI_COACH_TRIPLE_START, { labels })
  }

  const panels: string[] = labels.map(() => '')

  const updatePanel = (index: number, content: string, done: boolean) => {
    panels[index] = content
    if (!event.isDestroyed()) {
      event.send(IPC_CHANNELS.AI_COACH_TRIPLE_PANEL, { index, content: panels[index], done })
    }
  }

  const tasks: Promise<string>[] = [
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

  if (includeCursor) {
    tasks.push(
      completeCursorWorkCoach(plainMessages)
        .then((text) => {
          if (text.trim() && screenText) {
            saveWorkCoachCursorReply(screenText, screenMetadata, text)
          }
          updatePanel(2, text.trim() || '_(Cursor trả lời rỗng)_', true)
          return text
        })
        .catch((e) => {
          const msg = e instanceof Error ? e.message : 'Cursor SDK failed'
          updatePanel(2, `⚠ ${msg}`, true)
          return ''
        })
    )
  }

  await Promise.all(tasks)

  const modelLabel = includeCursor ? 'work-coach/triple' : 'work-coach/dual'
  const combined = combinePanels(labels, panels)
  if (!event.isDestroyed()) {
    event.send(IPC_CHANNELS.AI_COACH_TRIPLE_DONE, { model: modelLabel })
  }

  return {
    completionContent: combined,
    modelLabel,
    primaryPanelContent: panels[0]
  }
}

/** IQ / visual quiz — Lite in panel 0; after 5s no user action → 3.6 in panel 1 (keeps Lite). */
export async function runWorkCoachQuizVision(deps: {
  geminiApiKey: string
  screenScreenshot: string
  messages: GeminiMessage[]
  event: WebContents
  sessionKey: string
}): Promise<WorkCoachRunResult> {
  const { messages, geminiApiKey, screenScreenshot, event, sessionKey } = deps
  const labels = [...WORK_COACH_GEMINI_LABELS]

  beginQuizLiteSession(sessionKey)

  if (!event.isDestroyed()) {
    event.send(IPC_CHANNELS.AI_COACH_TRIPLE_START, { labels })
  }

  const panels = ['', WORK_COACH_QUIZ_LITE_PENDING_VI]

  const updatePanel = (index: number, content: string, done: boolean) => {
    panels[index] = content
    if (!event.isDestroyed()) {
      event.send(IPC_CHANNELS.AI_COACH_TRIPLE_PANEL, { index, content: panels[index], done })
    }
  }

  updatePanel(1, panels[1], true)

  try {
    await runGeminiCoach(
      messages,
      WORK_COACH_GEMINI_LITE,
      geminiApiKey,
      true,
      screenScreenshot,
      {
        onChunk: (c) => {
          panels[0] += c
          updatePanel(0, panels[0], false)
        },
        onDone: () => updatePanel(0, panels[0], true),
        onError: (e) => updatePanel(0, `⚠ ${e}`, true)
      },
      1000
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Gemini Lite failed'
    updatePanel(0, `⚠ ${msg}`, true)
  }

  if (!event.isDestroyed()) {
    event.send(IPC_CHANNELS.AI_COACH_TRIPLE_DONE, { model: WORK_COACH_GEMINI_LITE })
  }

  scheduleQuizDeepExplain({
    sessionKey,
    geminiApiKey,
    screenScreenshot,
    liteAnswer: panels[0],
    event,
    onLiteComplete: () => updatePanel(1, WORK_COACH_QUIZ_DEEP_WAITING_VI, true)
  })

  return {
    completionContent: panels[0],
    modelLabel: WORK_COACH_GEMINI_LITE,
    primaryPanelContent: panels[0]
  }
}

/** @deprecated alias */
export const runWorkCoachLiteVision = runWorkCoachQuizVision
