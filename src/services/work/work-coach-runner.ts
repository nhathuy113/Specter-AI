import { streamGemini } from '../ai/gemini-completion'
import { streamDeepseekCloak } from '../ai/deepseek-cloak'
import { createCoachPanelSink, type MessageTarget } from '../ui/coach-panel-ipc'
import { completeCursorWorkCoach } from './work-coach-cursor'
import { saveWorkCoachCursorReply } from './work-coach-session'
import { scheduleQuizDeepExplain, beginQuizLiteSession, isQuizSessionCurrent } from './work-coach-quiz-escalation'
import {
  createWorkCoachOrchestrator,
  type WorkCoachEscalationRequest, type WorkCoachQuizRequest, type WorkCoachRunResult
} from './work-coach-orchestrator'

export type { WorkCoachRunResult } from './work-coach-orchestrator'

const coach = createWorkCoachOrchestrator({
  streamGemini,
  streamDeepseek: streamDeepseekCloak,
  completeCursor: completeCursorWorkCoach,
  saveCursorReply: saveWorkCoachCursorReply,
  quiz: { begin: beginQuizLiteSession, isCurrent: isQuizSessionCurrent, schedule: scheduleQuizDeepExplain }
})

/** Composition adapter for Electron callers; domain orchestration uses narrow ports. */
export function runWorkCoachEscalation(request: Omit<WorkCoachEscalationRequest, 'sink'> & { event: MessageTarget }): Promise<WorkCoachRunResult> {
  return coach.runEscalation({ ...request, sink: createCoachPanelSink(request.event) })
}

export function runWorkCoachQuizVision(request: Omit<WorkCoachQuizRequest, 'sink'> & { event: MessageTarget }): Promise<WorkCoachRunResult> {
  return coach.runQuizVision({ ...request, sink: createCoachPanelSink(request.event) })
}

/** @deprecated alias */
export const runWorkCoachLiteVision = runWorkCoachQuizVision
