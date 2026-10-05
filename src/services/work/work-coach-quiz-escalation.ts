import { streamGemini } from '../ai/gemini-completion'
import { createCoachPanelSink, type MessageTarget } from '../ui/coach-panel-ipc'
import { createQuizDeepScheduler, type QuizDeepRequest } from './work-coach-quiz-scheduler'

export { buildQuizDeepMessages, buildQuizDeepUserMessage } from './work-coach-quiz-scheduler'

const scheduler = createQuizDeepScheduler(streamGemini)
export const cancelQuizDeepExplain = scheduler.cancel
export const markQuizUserActivity = () => scheduler.cancel()
export const beginQuizLiteSession = scheduler.begin
export const isQuizSessionCurrent = scheduler.isCurrent
export const resetQuizDeepExplainState = scheduler.reset

type QuizDeepInput = Omit<QuizDeepRequest, 'sink'> & (
  { event: MessageTarget; sink?: never } | { sink: QuizDeepRequest['sink']; event?: never }
)

export function scheduleQuizDeepExplain(request: QuizDeepInput): void {
  const sink = request.sink ?? createCoachPanelSink(request.event!)
  scheduler.schedule({ ...request, sink })
}
