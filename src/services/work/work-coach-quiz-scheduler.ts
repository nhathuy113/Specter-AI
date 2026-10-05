import {
  WORK_COACH_GEMINI_36, WORK_COACH_QUIZ_DEEP_DELAY_MS,
  WORK_COACH_QUIZ_DEEP_SYSTEM_PROMPT
} from '../../shared/constants'
import type { CompletionStream, TextMessage } from '../ai/contracts'
import type { CoachPanelSink } from './coach-panel-port'

export interface QuizDeepRequest {
  sessionKey: string
  generation?: number
  delayMs?: number
  geminiApiKey: string
  screenScreenshot: string
  liteAnswer: string
  sink: CoachPanelSink
  onLiteComplete?: () => void
}

export function buildQuizDeepUserMessage(liteAnswer: string): string {
  return [
    '[Lite đã trả lời — user ~5s chưa chuyển câu, có thể chưa hiểu]',
    liteAnswer.trim().slice(0, 2500), '',
    'Giải thích chi tiết hơn Lite. Nhìn screenshot, trả lời tiếng Việt theo format trong system prompt.'
  ].filter(Boolean).join('\n')
}

export function buildQuizDeepMessages(liteAnswer: string): TextMessage[] {
  return [
    { role: 'system', content: WORK_COACH_QUIZ_DEEP_SYSTEM_PROMPT },
    { role: 'user', content: buildQuizDeepUserMessage(liteAnswer) }
  ]
}

/** State belongs to this scheduler instance. A generation invalidates stale UI writes. */
export function createQuizDeepScheduler(stream: CompletionStream) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let activeSessionKey = ''
  let deepDoneForSession = ''
  let generation = 0

  function cancel(sessionKey?: string): void {
    if (sessionKey && sessionKey !== activeSessionKey) return
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    generation++
  }

  function begin(sessionKey: string): number {
    cancel()
    activeSessionKey = sessionKey
    if (deepDoneForSession === sessionKey) deepDoneForSession = ''
    return generation
  }

  function schedule(request: QuizDeepRequest): void {
    if (request.generation !== undefined && request.generation !== generation) return
    if (request.generation !== undefined && request.sessionKey !== activeSessionKey) return
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    activeSessionKey = request.sessionKey
    if (!request.liteAnswer.trim() || deepDoneForSession === request.sessionKey || request.sink.isDisposed()) return
    const current = request.generation ?? ++generation
    request.onLiteComplete?.()
    timer = setTimeout(() => {
      timer = undefined
      void run(request, current)
    }, request.delayMs ?? WORK_COACH_QUIZ_DEEP_DELAY_MS)
  }

  async function run(request: QuizDeepRequest, current: number): Promise<void> {
    const isCurrent = () => current === generation && request.sessionKey === activeSessionKey && !request.sink.isDisposed()
    if (!isCurrent()) return
    deepDoneForSession = request.sessionKey
    let panel = ''
    let finished = false
    const push = (content: string, done: boolean) => {
      if (!isCurrent() || finished) return
      request.sink.update(1, content, done)
      if (done) finished = true
    }
    push('Đang giải thích chi tiết hơn (3.6)…', false)
    try {
      await stream({
        messages: buildQuizDeepMessages(request.liteAnswer),
        model: WORK_COACH_GEMINI_36, apiKey: request.geminiApiKey,
        screenshot: request.screenScreenshot, maxTokens: 1500
      }, {
        onChunk: (chunk) => { panel += chunk; push(panel, false) },
        onDone: () => push(panel, true),
        onError: (error) => push(`⚠ ${error}`, true)
      })
      push(panel, true)
    } catch (error) {
      push(`⚠ ${error instanceof Error ? error.message : 'Gemini 3.6 failed'}`, true)
    }
  }

  function reset(): void {
    cancel()
    activeSessionKey = ''
    deepDoneForSession = ''
  }
  return { begin, schedule, cancel, reset, isCurrent: (value: number) => value === generation }
}
