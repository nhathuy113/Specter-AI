import type { ScreenMetadata } from '../../shared/types'

const QUIZ_SITE =
  /\b(123test|iqtest|personalitytest|test\.com|assessment|psychometric|free-iq|iq-test)\b/i
const QUIZ_UI =
  /\b(iq test|personality test|non-?verbal|spatial reasoning|matrix reasoning|figure series|which (figure|pattern|option|box|image|answer))\b/i
const QUIZ_VI = /\b(trắc nghiệm|đáp án|chọn (hình|đáp án|phương án)|câu \d+|bài test)\b/i
const QUESTION_PROGRESS = /\bquestion\s+\d+\s+of\s+\d+\b/i
const BROWSER_APP = /\b(chrome|firefox|safari|brave|edge|opera)\b/i

/** IQ / visual quiz / multiple-choice pattern tests — need vision + concrete answer. */
export function isVisualQuizScreen(screenText: string, metadata?: ScreenMetadata): boolean {
  const appHaystack = `${metadata?.appName ?? ''} ${metadata?.windowTitle ?? ''}`.toLowerCase()
  const isBrowser = BROWSER_APP.test(appHaystack)
  if (!isBrowser) return false

  const haystack = [screenText, metadata?.windowTitle ?? '', metadata?.appName ?? ''].join('\n').toLowerCase()

  const hasQuestionProgress = QUESTION_PROGRESS.test(haystack)
  const hasQuizSite = QUIZ_SITE.test(haystack)

  if (hasQuestionProgress || hasQuizSite) return true

  if (QUIZ_UI.test(haystack) || QUIZ_VI.test(haystack)) return true

  const lower = screenText.toLowerCase()
  const hasMatrixLanguage =
    (/\brow\s*[12]\b/i.test(lower) || /\bhàng\s*[12]\b/i.test(lower)) &&
    (/\bbox\s*\d+\b/i.test(lower) || /\bô\s*\d+\b/i.test(lower))
  const notCoding = !/\b(def |class |function |leetcode|import numpy|console\.log)\b/i.test(lower)
  if (hasMatrixLanguage && notCoding) return true

  return false
}

/** One-line context for quiz — no OCR dump. */
export function extractVisualQuizSummary(screenText: string): string {
  const progress = screenText.match(/\bquestion\s+(\d+)\s+of\s+(\d+)\b/i)
  const site =
    screenText.match(/\b(123test\.com[^\s]*|iqtest[^\s]*|iq-test[^\s]*)\b/i)?.[1] ??
    (QUIZ_SITE.test(screenText) ? 'online IQ / quiz test' : 'visual quiz')

  if (progress) {
    return `${site} — Question ${progress[1]} of ${progress[2]}`
  }
  return site
}

/** Slim user message for IQ — screenshot carries the puzzle; skip OCR noise. */
export function buildVisualQuizCoachMessage(screenText: string, _metadata?: ScreenMetadata): string {
  return [
    '[PROBLEM] visual-quiz',
    extractVisualQuizSummary(screenText),
    '',
    '[TASK]',
    'Screenshot đính kèm — nhìn hình và chốt đáp án.',
    'Trả lời tiếng Việt ngắn: **Đáp án:** (số 1–8, đếm trái→phải trên→dưới) + **Tại sao:** 1–2 câu.',
    'Không code. Không bắt user tự làm.'
  ].join('\n')
}
