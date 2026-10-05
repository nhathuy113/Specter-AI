import type { WebContents } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import {
  WORK_COACH_GEMINI_36,
  WORK_COACH_QUIZ_DEEP_DELAY_MS,
  WORK_COACH_QUIZ_DEEP_SYSTEM_PROMPT
} from '../../shared/constants'
import type { GeminiMessage } from '../ai/gemini-api'
import { streamGeminiVisionCompletion } from '../ai/gemini-api'

interface PendingQuizDeep {
  sessionKey: string
  timer: ReturnType<typeof setTimeout>
}

let pending: PendingQuizDeep | null = null
let activeSessionKey = ''
let deepDoneForSession = ''

export function cancelQuizDeepExplain(sessionKey?: string): void {
  if (pending && (!sessionKey || pending.sessionKey === sessionKey)) {
    clearTimeout(pending.timer)
    pending = null
  }
}

export function markQuizUserActivity(): void {
  cancelQuizDeepExplain()
}

/** Call before a new Lite run so deep explain can fire again for this question. */
export function beginQuizLiteSession(sessionKey: string): void {
  cancelQuizDeepExplain()
  activeSessionKey = sessionKey
  if (deepDoneForSession === sessionKey) {
    deepDoneForSession = ''
  }
}

export function buildQuizDeepUserMessage(liteAnswer: string): string {
  return [
    '[Lite đã trả lời — user ~5s chưa chuyển câu, có thể chưa hiểu]',
    liteAnswer.trim().slice(0, 2500),
    '',
    'Giải thích chi tiết hơn Lite. Nhìn screenshot, trả lời tiếng Việt theo format trong system prompt.'
  ]
    .filter(Boolean)
    .join('\n')
}

export function buildQuizDeepMessages(liteAnswer: string): GeminiMessage[] {
  return [
    { role: 'system', content: WORK_COACH_QUIZ_DEEP_SYSTEM_PROMPT },
    { role: 'user', content: buildQuizDeepUserMessage(liteAnswer) }
  ]
}

export function scheduleQuizDeepExplain(deps: {
  sessionKey: string
  delayMs?: number
  geminiApiKey: string
  screenScreenshot: string
  liteAnswer: string
  event: WebContents
  /** Fires right when Lite finished — before the 5s wait. */
  onLiteComplete?: () => void
}): void {
  const { sessionKey, geminiApiKey, screenScreenshot, liteAnswer, event, onLiteComplete } = deps
  const delayMs = deps.delayMs ?? WORK_COACH_QUIZ_DEEP_DELAY_MS

  cancelQuizDeepExplain()
  activeSessionKey = sessionKey

  if (!liteAnswer.trim() || deepDoneForSession === sessionKey) return

  onLiteComplete?.()

  pending = {
    sessionKey,
    timer: setTimeout(() => {
      pending = null
      if (activeSessionKey !== sessionKey || deepDoneForSession === sessionKey) return
      void runQuizDeepExplain({
        sessionKey,
        geminiApiKey,
        screenScreenshot,
        liteAnswer,
        event
      })
    }, delayMs)
  }
}

async function runQuizDeepExplain(deps: {
  sessionKey: string
  geminiApiKey: string
  screenScreenshot: string
  liteAnswer: string
  event: WebContents
}): Promise<void> {
  const { sessionKey, geminiApiKey, screenScreenshot, liteAnswer, event } = deps
  if (event.isDestroyed() || activeSessionKey !== sessionKey) return

  deepDoneForSession = sessionKey
  const messages = buildQuizDeepMessages(liteAnswer)

  let panel = ''
  let streaming = false

  const pushPanel = (content: string, done: boolean) => {
    panel = content
    if (!event.isDestroyed()) {
      event.send(IPC_CHANNELS.AI_COACH_TRIPLE_PANEL, { index: 1, content: panel, done })
    }
  }

  pushPanel('Đang giải thích chi tiết hơn (3.6)…', false)

  try {
    await streamGeminiVisionCompletion(
      messages,
      WORK_COACH_GEMINI_36,
      geminiApiKey,
      screenScreenshot,
      {
        onChunk: (chunk) => {
          if (!streaming) {
            streaming = true
            panel = chunk
          } else {
            panel += chunk
          }
          pushPanel(panel, false)
        },
        onDone: () => pushPanel(panel, true),
        onError: (err) => pushPanel(`⚠ ${err}`, true)
      },
      1500
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gemini 3.6 failed'
    pushPanel(`⚠ ${msg}`, true)
  }
}

export function resetQuizDeepExplainState(): void {
  cancelQuizDeepExplain()
  activeSessionKey = ''
  deepDoneForSession = ''
}
