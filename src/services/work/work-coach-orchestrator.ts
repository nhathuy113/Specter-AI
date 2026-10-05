import type { ScreenMetadata } from '../../shared/types'
import {
  WORK_COACH_GEMINI_36, WORK_COACH_GEMINI_LITE,
  WORK_COACH_QUIZ_DEEP_WAITING_VI, WORK_COACH_QUIZ_LITE_PENDING_VI,
  resolveWorkCoachPanelLabels
} from '../../shared/constants'
import type { CompletionStream, TextMessage } from '../ai/contracts'
import type { CoachPanelSink } from './coach-panel-port'
import type { QuizDeepRequest } from './work-coach-quiz-scheduler'

export interface WorkCoachRunResult {
  completionContent: string
  modelLabel: string
  primaryPanelContent: string
}

export interface WorkCoachRequest {
  geminiApiKey: string
  messages: TextMessage[]
  sink: CoachPanelSink
}

export interface WorkCoachEscalationRequest extends WorkCoachRequest {
  useVision: boolean
  includeCursor: boolean
  /** Parallel DeepSeek Cloak panel (screenshot) for A/B vs Gemini. */
  includeDeepseekCompare?: boolean
  screenScreenshot?: string
  screenText?: string
  screenMetadata?: ScreenMetadata
}

export interface WorkCoachQuizRequest extends WorkCoachRequest {
  screenScreenshot: string
  includeDeepseekCompare?: boolean
  sessionKey: string
}

export interface WorkCoachPorts {
  streamGemini: CompletionStream
  streamDeepseek: CompletionStream
  completeCursor(messages: TextMessage[]): Promise<string>
  saveCursorReply(screenText: string, metadata: ScreenMetadata | undefined, reply: string): void
  quiz: { begin(sessionKey: string): number; isCurrent(generation: number): boolean; schedule(request: QuizDeepRequest): void }
}

export function createWorkCoachOrchestrator(ports: WorkCoachPorts) {
  async function streamPanel(request: WorkCoachRequest, index: number, model: string, maxTokens: number, screenshot?: string, stream: CompletionStream = ports.streamGemini, apiKey = request.geminiApiKey) {
    let content = ''
    let finished = false
    let failed = false
    const complete = () => {
      if (finished) return
      finished = true
      if (!request.sink.isDisposed()) request.sink.update(index, content, true)
    }
    const error = (message: string) => {
      if (finished) return
      finished = true
      failed = true
      if (!request.sink.isDisposed()) request.sink.update(index, `⚠ ${message}`, true)
    }
    try {
      await stream({ messages: request.messages, model, apiKey, screenshot, maxTokens }, {
        onChunk: (chunk) => {
          if (finished) return
          content += chunk
          if (!request.sink.isDisposed()) request.sink.update(index, content, false)
        }, onDone: complete, onError: error
      })
      complete()
    } catch (cause) {
      error(cause instanceof Error ? cause.message : 'Completion failed')
    }
    return failed ? '' : content
  }

  function streamDeepseekPanel(request: WorkCoachRequest, index: number, screenshot: string, maxTokens: number) {
    return streamPanel(request, index, 'deepseek-cloak/web', maxTokens, screenshot, ports.streamDeepseek, '')
  }

  async function runEscalation(request: WorkCoachEscalationRequest): Promise<WorkCoachRunResult> {
    const screenshot = request.useVision ? request.screenScreenshot : undefined
    const includeDeepseek = !!(
      request.includeDeepseekCompare &&
      screenshot?.trim()
    )
    const labels = resolveWorkCoachPanelLabels(request.includeCursor, includeDeepseek)
    const panels = labels.map(() => '')
    const sink: CoachPanelSink = {
      isDisposed: () => request.sink.isDisposed(),
      start: (labels) => request.sink.start(labels),
      done: (model) => request.sink.done(model),
      update: (index, content, done) => {
        panels[index] = content
        if (!request.sink.isDisposed()) request.sink.update(index, content, done)
      }
    }
    if (!sink.isDisposed()) sink.start(labels)
    const input = { ...request, sink }
    const tasks: Promise<string>[] = [
      streamPanel(input, 0, WORK_COACH_GEMINI_LITE, 2000, screenshot),
      streamPanel(input, 1, WORK_COACH_GEMINI_36, 2000, screenshot)
    ]
    let nextIndex = 2
    if (includeDeepseek && screenshot) {
      const deepIndex = nextIndex++
      tasks.push(streamDeepseekPanel(input, deepIndex, screenshot, 2000))
    }
    if (request.includeCursor) {
      const cursorIndex = nextIndex
      tasks.push((async () => {
        try {
          const text = await ports.completeCursor(request.messages)
          if (!sink.isDisposed() && text.trim() && request.screenText) {
            ports.saveCursorReply(request.screenText, request.screenMetadata, text)
          }
          sink.update(cursorIndex, text.trim() || '_(Cursor trả lời rỗng)_', true)
          return text
        } catch (cause) {
          sink.update(cursorIndex, `⚠ ${cause instanceof Error ? cause.message : 'Cursor SDK failed'}`, true)
          return ''
        }
      })())
    }
    const results = await Promise.all(tasks)
    const modelLabel = includeDeepseek
      ? (request.includeCursor ? 'work-coach/compare+cursor' : 'work-coach/compare')
      : (request.includeCursor ? 'work-coach/triple' : 'work-coach/dual')
    if (!sink.isDisposed()) sink.done(modelLabel)
    return {
      completionContent: labels.map((label, i) => `## ${label}\n\n${panels[i] || '_(no response)_'}`).join('\n\n---\n\n'),
      modelLabel, primaryPanelContent: results[0]
    }
  }

  async function runQuizVision(request: WorkCoachQuizRequest): Promise<WorkCoachRunResult> {
    const includeDeepseek = !!(request.includeDeepseekCompare && request.screenScreenshot.trim())
    const generation = ports.quiz.begin(request.sessionKey)
    const sink: CoachPanelSink = {
      isDisposed: () => request.sink.isDisposed() || !ports.quiz.isCurrent(generation),
      start: (labels) => request.sink.start(labels),
      update: (index, content, done) => request.sink.update(index, content, done),
      done: (model) => request.sink.done(model)
    }
    if (!sink.isDisposed()) {
      sink.start(resolveWorkCoachPanelLabels(false, includeDeepseek))
      sink.update(1, WORK_COACH_QUIZ_LITE_PENDING_VI, true)
    }
    if (includeDeepseek) {
      // Comparison never delays Lite or its deferred Gemini explanation.
      void streamDeepseekPanel({ ...request, sink }, 2, request.screenScreenshot, 2000)
    }
    const content = await streamPanel({ ...request, sink }, 0, WORK_COACH_GEMINI_LITE, 1000, request.screenScreenshot)
    if (!sink.isDisposed()) sink.done(WORK_COACH_GEMINI_LITE)
    ports.quiz.schedule({
      sessionKey: request.sessionKey, generation, geminiApiKey: request.geminiApiKey,
      screenScreenshot: request.screenScreenshot, liteAnswer: content, sink,
      onLiteComplete: () => { if (!sink.isDisposed()) sink.update(1, WORK_COACH_QUIZ_DEEP_WAITING_VI, true) }
    })
    return { completionContent: content, modelLabel: WORK_COACH_GEMINI_LITE, primaryPanelContent: content }
  }
  return { runEscalation, runQuizVision }
}
