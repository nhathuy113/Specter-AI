import { createHash } from 'crypto'
import type { ScreenMetadata } from '../../shared/types'

const CODE_LINE =
  /^\s*(def |class |import |from |return |if |elif |else:|for |while |public |private |void |int |#include|function |const |let |var |nums|self\.|\}|\{|\)|\(.*=>)/i
const SKIP_LINE =
  /^(file|edit|selection|view|run|terminal|submit|acceptance|submissions|description|solution|console|output)$/i
const UI_NOISE = /leetcode|easy|medium|hard|acceptance rate|memory|runtime|beats \d/i

/** Hash editor-like OCR lines so unchanged code = user has not applied the last hint. */
export function extractEditorCodeFingerprint(screenText: string): string {
  const lines = screenText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !SKIP_LINE.test(l) && !UI_NOISE.test(l))

  const codeLines = lines.filter(
    (l) =>
      CODE_LINE.test(l) ||
      (/[=<>+\-*\/\[\]{}();]/.test(l) && l.length > 5 && /[a-zA-Z_]/.test(l))
  )

  const normalized = codeLines
    .slice(-48)
    .map((l) => l.replace(/\s+/g, ' '))
    .join('\n')
    .toLowerCase()

  if (!normalized) return 'no-code'
  return createHash('sha256').update(normalized).digest('hex').slice(0, 12)
}

/** Stable key for the same video/page on pinned work display — resets when content changes. */
export function workSessionKey(screenText: string, metadata?: ScreenMetadata): string {
  const area = metadata?.appName?.startsWith('Work:')
    ? `work-area:${metadata.appName}`
    : `${metadata?.appName || ''}|${metadata?.windowTitle || ''}`

  const contentId = extractStableContentId(screenText)
  return createHash('sha256').update(`${area}|${contentId}`).digest('hex').slice(0, 16)
}

export function extractStableContentId(screenText: string): string {
  const lines = screenText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const quizProgress = screenText.match(/\bquestion\s+(\d+)\s+of\s+(\d+)\b/i)
  if (quizProgress) {
    return `quiz-${quizProgress[1]}-of-${quizProgress[2]}`
  }

  for (const line of lines) {
    const numbered = line.match(/^\d+\.\s*(.+)/)
    if (numbered && numbered[1].length > 8) {
      return numbered[1].replace(/\s+/g, ' ').slice(0, 160).toLowerCase()
    }
  }

  for (const line of lines) {
    if (/youtube|youtu\.be|coursera|udemy|pdf|bài giảng|phân tích|leetcode/i.test(line) && line.length > 12) {
      return line.replace(/\s+/g, ' ').slice(0, 160).toLowerCase()
    }
  }

  const problemTitle = lines.find(
    (l) =>
      l.length > 16 &&
      l.length < 120 &&
      !/^(brave|chrome|safari|firefox|http|www\.|easy|medium|hard|acceptance|submissions|solution|description)$/i.test(l) &&
      !/^\d+$/.test(l)
  )
  if (problemTitle) {
    return problemTitle.replace(/\s+/g, ' ').slice(0, 160).toLowerCase()
  }

  const substantial = lines.find((l) => l.length > 24 && !/^(brave|chrome|safari|http|www\.)/i.test(l))
  return (substantial || lines.slice(0, 3).join(' ')).slice(0, 160).toLowerCase()
}
