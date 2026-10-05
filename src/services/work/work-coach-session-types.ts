export interface WorkCoachSessionState {
  sessionKey: string
  thread: string
  updatedAt: number
  codeFingerprintAtLastCoach?: string
  stuckRetryCount?: number
  /** Cached Cursor SDK reply (coding sessions only). */
  cursorCoachReply?: string
  /** Last fenced code block from coach — approve/reject detection. */
  lastSuggestedSnippet?: string
  /** One-line summary of the step being taught — do not skip on re-explain. */
  lastCoachStepSummary?: string
  lastReviewOutcome?: 'unchanged' | 'approved' | 'rejected'
}

export type WorkCoachReplyMode = 'normal' | 'stuck-reexplain' | 'snippet-rejected' | 'code-review'

export type WorkCoachCodeReviewStatus =
  | 'baseline'
  | 'unchanged'
  | 'approved'
  | 'rejected'
  | 'rejected-unchanged'

export interface WorkCoachCodeReview {
  status: WorkCoachCodeReviewStatus
  replyMode: WorkCoachReplyMode
}
