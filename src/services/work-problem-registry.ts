import type { ScreenMetadata } from '../shared/types'
import type { ScreenKind } from './context-router'
import {
  WORK_COACH_CONTINUATION_FORMAT_VI,
  WORK_COACH_LECTURE_FORMAT_VI,
  WORK_COACH_MATH_FORMAT_VI,
  WORK_COACH_QUIZ_CONTINUATION_VI,
  WORK_COACH_QUIZ_FORMAT_VI,
  WORK_COACH_REPLY_FORMAT_VI
} from '../shared/constants'
import { detectCodeErrors } from './skills/code-error'
import { isVisualQuizScreen } from './work-coach-quiz'
import { extractEditorCodeText, hasUserWrittenLogic } from './work-coach-snippet'

export type WorkProblemKind =
  | 'visual-quiz'
  | 'coding-debug'
  | 'coding-exercise'
  | 'lecture-media'
  | 'written-homework'
  | 'general'

export interface WorkProblemDetectContext {
  screenText: string
  metadata?: ScreenMetadata
  screenKind: ScreenKind
}

export interface WorkProblemSpec {
  kind: WorkProblemKind
  detect: (ctx: WorkProblemDetectContext) => number
  formatFirst: string
  formatContinue: string
  taskHints: string[]
  forceVision: boolean
  snippetTracking: boolean
  allowCodeReview: boolean
}

const CODE_SIGNAL =
  /\b(error TS\d+|eslint|syntaxerror|typeerror|referenceerror|stack trace|at .+\(.+:\d+:\d+\)|failed to compile|cannot find module|unexpected token|runtime error)\b/i
const LEETCODE_SIGNAL =
  /\b(leetcode|problemlist|submissions|editorial|median of two sorted|two sum|binary search)\b/i
const IDE_SIGNAL =
  /\b(cursor|vscode|visual studio|webpack|typescript|javascript|node_modules|pnpm|npm|github|\.env|package\.json|terminal|debug console)\b/i
const LECTURE_SIGNAL =
  /\b(youtube|youtu\.be|vimeo|coursera|udemy|khan academy|slide|lecture|transcript|phút \d|minute \d|chapter \d|bài giảng|video bài|playlist)\b/i
const MATH_SIGNAL =
  /\b(tính|chứng minh|giải phương trình|đạo hàm|tích phân|probability|equation|solve for|find x|bài tập \d|câu \d+[\s:)]|=\s*\?)\b/i
const CODING_KEYWORDS = /\b(def |class |function |import |leetcode|console\.log|public static)\b/i

function haystack(ctx: WorkProblemDetectContext): string {
  return [ctx.screenText, ctx.metadata?.windowTitle ?? '', ctx.metadata?.appName ?? ''].join('\n')
}

function detectVisualQuiz(ctx: WorkProblemDetectContext): number {
  return isVisualQuizScreen(ctx.screenText, ctx.metadata) ? 0.95 : 0
}

function detectCodingDebug(ctx: WorkProblemDetectContext): number {
  const body = ctx.screenText
  const hasError = !!detectCodeErrors(body) || CODE_SIGNAL.test(body)
  const hasLogic = hasUserWrittenLogic(body) || extractEditorCodeText(body).trim().length > 20
  if (hasError && hasLogic) return 0.9
  if (ctx.screenKind === 'code' && hasLogic) return 0.82
  if (hasError && (IDE_SIGNAL.test(body) || ctx.screenKind === 'ide')) return 0.75
  return 0
}

function detectCodingExercise(ctx: WorkProblemDetectContext): number {
  const body = haystack(ctx).toLowerCase()
  if (CODING_KEYWORDS.test(body) && LEETCODE_SIGNAL.test(body)) return 0.88
  if (LEETCODE_SIGNAL.test(body)) return 0.85
  if (ctx.screenKind === 'ide' && extractEditorCodeText(ctx.screenText).trim()) return 0.8
  if (ctx.screenKind === 'code') return 0.7
  return 0
}

function detectLectureMedia(ctx: WorkProblemDetectContext): number {
  const body = haystack(ctx).toLowerCase()
  if (LECTURE_SIGNAL.test(body)) return 0.8
  if (ctx.screenKind === 'browser' && /\b(watch|subscribe|views|chapter|episode)\b/i.test(body)) return 0.55
  return 0
}

function detectWrittenHomework(ctx: WorkProblemDetectContext): number {
  const body = haystack(ctx)
  if (CODING_KEYWORDS.test(body) || LEETCODE_SIGNAL.test(body)) return 0
  if (MATH_SIGNAL.test(body) && !isVisualQuizScreen(ctx.screenText, ctx.metadata)) return 0.72
  if (/\b(homework|assignment|exercise \d|problem \d|đề bài)\b/i.test(body)) return 0.65
  return 0
}

function detectGeneral(ctx: WorkProblemDetectContext): number {
  return ctx.screenText.trim() ? 0.1 : 0
}

export const WORK_PROBLEM_SPECS: WorkProblemSpec[] = [
  {
    kind: 'visual-quiz',
    detect: detectVisualQuiz,
    formatFirst: WORK_COACH_QUIZ_FORMAT_VI,
    formatContinue: WORK_COACH_QUIZ_CONTINUATION_VI,
    taskHints: [
      'Screenshot attached — pick the answer from the image.',
      'Reply in Vietnamese with **Đáp án**, **Quy luật**, **Tại sao** — concrete, 5–8 lines max.',
      'No code. Do not ask the user to figure it out themselves.'
    ],
    forceVision: true,
    snippetTracking: false,
    allowCodeReview: false
  },
  {
    kind: 'coding-debug',
    detect: detectCodingDebug,
    formatFirst: WORK_COACH_REPLY_FORMAT_VI,
    formatContinue: WORK_COACH_CONTINUATION_FORMAT_VI,
    taskHints: [
      'User has code on screen with errors or bugs — review THEIR code in place.',
      'Giải pháp = patch 3–5 lines max; tie fixes to visible error text.',
      'Reply format block is appended separately (full 6 sections first time, short 4 sections on continuation).'
    ],
    forceVision: false,
    snippetTracking: true,
    allowCodeReview: true
  },
  {
    kind: 'coding-exercise',
    detect: detectCodingExercise,
    formatFirst: WORK_COACH_REPLY_FORMAT_VI,
    formatContinue: WORK_COACH_CONTINUATION_FORMAT_VI,
    taskHints: [
      'User is on a coding exercise (LeetCode, IDE homework).',
      'LeetCode first visit: teach ONE step — median example before partition. If editor already has while/if/return logic, review bugs in place — do NOT restart with brute force merge.',
      'Reply format block is appended separately (full 6 sections first time, short 4 sections on continuation).'
    ],
    forceVision: false,
    snippetTracking: true,
    allowCodeReview: true
  },
  {
    kind: 'lecture-media',
    detect: detectLectureMedia,
    formatFirst: WORK_COACH_LECTURE_FORMAT_VI,
    formatContinue: WORK_COACH_CONTINUATION_FORMAT_VI,
    taskHints: [
      'User is watching a lecture, video, or reading slides/article.',
      'Summarize what is ON SCREEN now and explain the concept simply in Vietnamese.',
      'Giải pháp = what to note / question to answer next — not vague "keep watching".'
    ],
    forceVision: false,
    snippetTracking: false,
    allowCodeReview: false
  },
  {
    kind: 'written-homework',
    detect: detectWrittenHomework,
    formatFirst: WORK_COACH_MATH_FORMAT_VI,
    formatContinue: WORK_COACH_CONTINUATION_FORMAT_VI,
    taskHints: [
      'User has written homework (math/text) without a code editor.',
      'Walk through steps and **must give final answer** under **Giải pháp**.',
      'No code fences unless code appears on screen.'
    ],
    forceVision: false,
    snippetTracking: false,
    allowCodeReview: false
  },
  {
    kind: 'general',
    detect: detectGeneral,
    formatFirst: WORK_COACH_REPLY_FORMAT_VI,
    formatContinue: WORK_COACH_CONTINUATION_FORMAT_VI,
    taskHints: [
      'Focus on work visible on screen: homework, exercises, reading, or tasks.',
      'Reply format block is appended separately (full 6 sections first time, short 4 sections on continuation).'
    ],
    forceVision: false,
    snippetTracking: true,
    allowCodeReview: true
  }
]

export function pickWorkProblemSpec(ctx: WorkProblemDetectContext): WorkProblemSpec {
  let best = WORK_PROBLEM_SPECS.find((s) => s.kind === 'general')!
  let bestScore = best.detect(ctx)

  for (const spec of WORK_PROBLEM_SPECS) {
    if (spec.kind === 'general') continue
    const score = spec.detect(ctx)
    if (score > bestScore) {
      bestScore = score
      best = spec
    }
  }

  return best
}
