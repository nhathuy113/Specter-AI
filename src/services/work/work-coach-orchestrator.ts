import type { ScreenMetadata } from '../../shared/types'
import {
  WORK_COACH_GEMINI_36, WORK_COACH_GEMINI_LITE, WORK_COACH_GEMINI_LABELS,
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
  screenScreenshot?: string
  screenText?: string
  screenMetadata?: ScreenMetadata
}

export interface WorkCoachQuizRequest extends WorkCoachRequest {
  screenScreenshot: string
  sessionKey: string
}

export interface WorkCoachPorts {
  streamGemini: CompletionStream
  completeCursor(messages: TextMessage[]): Promise<string>
  saveCursorReply(screenText: string, metadata: ScreenMetadata | undefined, reply: string): void
  quiz: { begin(sessionKey: string): number; isCurrent(generation: number): boolean; schedule(request: QuizDeepRequest): void }
}

export function createWorkCoachOrchestrator(ports: WorkCoachPorts) {
  async function streamPanel(request: WorkCoachRequest, index: number, model: string, maxTokens: number, screenshot?: string) {
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
      await ports.streamGemini({ messages: request.messages, model, apiKey: request.geminiApiKey, screenshot, maxTokens }, {
        onChunk: (chunk) => {
          if (finished) return
          content += chunk
          if (!request.sink.isDisposed()) request.sink.update(index, content, false)
        }, onDone: complete, onError: error
      })
      complete()
    } catch (cause) {
      error(cause instanceof Error ? cause.message : 'Gemini failed')
    }
    return failed ? '' : content
  }

  async function runEscalation(request: WorkCoachEscalationRequest): Promise<WorkCoachRunResult> {
    const labels = resolveWorkCoachPanelLabels(request.includeCursor)
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
    const screenshot = request.useVision ? request.screenScreenshot : undefined
    const input = { ...request, sink }
    const tasks = [
      streamPanel(input, 0, WORK_COACH_GEMINI_LITE, 2000, screenshot),
      streamPanel(input, 1, WORK_COACH_GEMINI_36, 2000, screenshot)
    ]
    if (request.includeCursor) {
      tasks.push((async () => {
        try {
          const text = await ports.completeCursor(request.messages)
          if (!sink.isDisposed() && text.trim() && request.screenText) ports.saveCursorReply(request.screenText, request.screenMetadata, text)
          sink.update(2, text.trim() || '_(Cursor trả lời rỗng)_', true)
          return text
        } catch (cause) {
          sink.update(2, `⚠ ${cause instanceof Error ? cause.message : 'Cursor SDK failed'}`, true)
          return ''
        }
      })())
    }
    const results = await Promise.all(tasks)
    const modelLabel = request.includeCursor ? 'work-coach/triple' : 'work-coach/dual'
    if (!sink.isDisposed()) sink.done(modelLabel)
    return {
      completionContent: labels.map((label, i) => `## ${label}\n\n${panels[i] || '_(no response)_'}`).join('\n\n---\n\n'),
      modelLabel, primaryPanelContent: results[0]
    }
  }

  async function runQuizVision(request: WorkCoachQuizRequest): Promise<WorkCoachRunResult> {
    const generation = ports.quiz.begin(request.sessionKey)
    const sink: CoachPanelSink = {
      isDisposed: () => request.sink.isDisposed() || !ports.quiz.isCurrent(generation),
      start: (labels) => request.sink.start(labels),
      update: (index, content, done) => request.sink.update(index, content, done),
      done: (model) => request.sink.done(model)
    }
    if (!sink.isDisposed()) {
      sink.start([...WORK_COACH_GEMINI_LABELS])
      sink.update(1, WORK_COACH_QUIZ_LITE_PENDING_VI, true)
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
