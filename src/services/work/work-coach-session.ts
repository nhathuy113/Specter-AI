import { getSetting, setSetting } from '../settings/store'
import { createWorkCoachSession } from './work-coach-session-core'
import type { WorkCoachSessionState } from './work-coach-session-types'

export * from './work-coach-session-types'
export { extractEditorCodeFingerprint, extractStableContentId, workSessionKey } from './work-coach-identity'
export { extractCoachStepSummary, createWorkCoachSession } from './work-coach-session-core'
export {
  appendWorkCoachContext, buildWorkCoachEditorContext, buildWorkCoachCodeReviewContext,
  buildWorkCoachSnippetRejectedContext, selectWorkCoachReplyFormat,
  buildWorkCoachOverlayFeedbackContext, buildWorkCoachStuckContext
} from './work-coach-prompt'
export { sanitizeCoachDisplayText, stripThreadForDisplay } from '../../shared/coach-display'

const session = createWorkCoachSession({
  load: () => getSetting<WorkCoachSessionState | null>('workCoachSession'),
  save: (state) => setSetting('workCoachSession', state)
})

export const {
  loadWorkCoachSession,
  saveWorkCoachSession,
  getWorkCoachThread,
  updateWorkCoachThread,
  saveWorkCoachCursorReply,
  evaluateWorkCoachCodeReview,
  isWorkCoachStuck,
  getWorkCoachReplyMode
} = session
